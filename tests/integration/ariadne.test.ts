import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { init, getDb, close } from "../../src/graph/db.js";
import { loadScipIndex } from "../../src/indexer/scip-reader.js";
import { scip } from "../../src/indexer/scip.js";
import {
  handleFindSymbol,
  handleGetCallPath,
  handleGetCallees,
  handleGetCallers,
  handleGetDefinition,
  handleGetFileSymbols,
  handleGetImplementations,
  handleGetImporters,
  handleGetIndexStatus,
  handleGetReferences,
  handleGetSourceDefinition,
  handleGetTypeDefinition,
  handleSearchFiles,
} from "../../src/tools/index.js";

const HAS_SQLITE = (() => {
  try {
    const probe = new Database(":memory:");
    probe.close();
    return true;
  } catch {
    return false;
  }
})();

function definitionOccurrence(symbol: string, line: number, start: number, end: number): scip.Occurrence {
  return new scip.Occurrence({
    symbol,
    symbol_roles: scip.SymbolRole.Definition,
    range: [line, 0, line, 5],
    enclosing_range: [start, 0, end, 0],
  });
}

test("SCIP load and MCP handlers work against a tiny indexed repo", async (t) => {
  if (!HAS_SQLITE) return t.skip("better-sqlite3 native binding is unavailable in this environment");
  const originalCwd = process.cwd();
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ariadne-it-"));
  await fs.mkdir(path.join(repoRoot, "src"), { recursive: true });

  const alpha = "scip-typescript npm demo 0.1.0 alpha().";
  const beta = "scip-typescript npm demo 0.1.0 beta().";
  const gamma = "scip-typescript npm demo 0.1.0 gamma().";
  const worker = "scip-typescript npm demo 0.1.0 Worker#";
  const workerImpl = "scip-typescript npm demo 0.1.0 WorkerImpl#";
  const reExportedIndex = "scip-typescript npm demo 0.1.0 reExportedIndex().";
  const reExportedCore = "scip-typescript npm demo 0.1.0 reExportedCore().";

  const mainDoc = new scip.Document({
    relative_path: "src/main.ts",
    symbols: [
      new scip.SymbolInformation({
        symbol: alpha,
        display_name: "alpha",
        documentation: ["```ts\nfunction alpha(): void\n```"],
        relationships: [new scip.Relationship({ symbol: worker, is_reference: true })],
      }),
      new scip.SymbolInformation({
        symbol: beta,
        display_name: "beta",
        documentation: ["```ts\nfunction beta(): void\n```"],
      }),
      new scip.SymbolInformation({
        symbol: worker,
        display_name: "Worker",
        documentation: ["```ts\ninterface Worker\n```"],
      }),
      new scip.SymbolInformation({
        symbol: workerImpl,
        display_name: "WorkerImpl",
        documentation: ["```ts\nclass WorkerImpl implements Worker\n```"],
        relationships: [new scip.Relationship({ symbol: worker, is_implementation: true })],
      }),
    ],
    occurrences: [
      definitionOccurrence(alpha, 0, 0, 4),
      definitionOccurrence(beta, 5, 5, 6),
      definitionOccurrence(worker, 8, 8, 9),
      definitionOccurrence(workerImpl, 10, 10, 12),
      new scip.Occurrence({
        symbol: beta,
        range: [2, 0, 2, 4],
        enclosing_range: [2, 0, 2, 4],
      }),
    ],
  });

  const importerDoc = new scip.Document({
    relative_path: "src/importer.ts",
    symbols: [
      new scip.SymbolInformation({
        symbol: gamma,
        display_name: "gamma",
        documentation: ["```ts\nfunction gamma(): void\n```"],
      }),
    ],
    occurrences: [
      definitionOccurrence(gamma, 0, 0, 3),
      new scip.Occurrence({
        symbol: alpha,
        symbol_roles: scip.SymbolRole.Import,
        range: [1, 0, 1, 4],
        enclosing_range: [1, 0, 1, 4],
      }),
    ],
  });

  const indexDoc = new scip.Document({
    relative_path: "src/index.ts",
    symbols: [
      new scip.SymbolInformation({
        symbol: reExportedIndex,
        display_name: "reExported",
        documentation: ["```ts\nfunction reExported(): void\n```"],
      }),
    ],
    occurrences: [definitionOccurrence(reExportedIndex, 0, 0, 1)],
  });

  const coreDoc = new scip.Document({
    relative_path: "src/core.ts",
    symbols: [
      new scip.SymbolInformation({
        symbol: reExportedCore,
        display_name: "reExported",
        documentation: ["```ts\nfunction reExported(): void\n```"],
      }),
    ],
    occurrences: [definitionOccurrence(reExportedCore, 0, 0, 1)],
  });

  const index = new scip.Index({ documents: [mainDoc, importerDoc, indexDoc, coreDoc] });
  const scipPath = path.join(repoRoot, ".ariadne", "tiny.scip");
  await fs.mkdir(path.dirname(scipPath), { recursive: true });
  await fs.writeFile(scipPath, Buffer.from(index.serializeBinary()));

  try {
    process.chdir(repoRoot);
    await init(repoRoot);
    const db = getDb();
    const result = await loadScipIndex(db, scipPath, repoRoot);
    assert.equal(result.symbolCount, 7);
    assert.equal(result.edgeCount, 4);

    assert.match(await handleGetDefinition(db, { symbol: "alpha" }), /"name": "alpha"/);
    assert.match(await handleGetCallers(db, { symbol: "beta" }), /"name": "alpha"/);
    assert.match(await handleGetCallees(db, { symbol: "alpha" }), /"name": "beta"/);
    assert.match(await handleGetReferences(db, { symbol: "Worker" }), /WorkerImpl|alpha/);
    assert.match(await handleGetImplementations(db, { interface: "Worker" }), /WorkerImpl/);
    assert.match(await handleGetCallPath(db, { from: "alpha", to: "beta" }), /alpha/);
    assert.match(await handleGetFileSymbols(db, { file: "src/main.ts" }), /"name": "alpha"/);
    assert.match(await handleGetTypeDefinition(db, { symbol: "alpha" }), /Worker/);
    assert.match(await handleGetImporters(db, { file: "src/main.ts" }), /gamma/);
    assert.match(await handleFindSymbol(db, { query: "reExpo" }), /reExported/);
    assert.match(await handleSearchFiles(db, { pattern: "**/*.ts" }), /src\/main\.ts/);
    assert.match(handleGetIndexStatus(), /state:/);

    const source = JSON.parse(await handleGetSourceDefinition(db, { symbol: "reExported" })) as { file: string };
    assert.equal(source.file, "src/core.ts");
  } finally {
    close();
    process.chdir(originalCwd);
    await fs.rm(repoRoot, { recursive: true, force: true });
  }
});
