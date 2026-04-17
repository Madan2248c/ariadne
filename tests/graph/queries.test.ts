import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import type { Database as SQLite } from "../../src/graph/db.js";
import { ALL_SCHEMA_STATEMENTS } from "../../src/graph/schema.js";
import { upsertEdge, upsertSymbol } from "../../src/graph/writer.js";
import {
  findSymbol,
  getCallPath,
  getCallers,
  getDefinition,
  getFileSymbols,
  getImporters,
  searchFiles,
} from "../../src/graph/queries.js";
import type { Symbol, Edge } from "../../src/types/index.js";

let db: SQLite.Database;
const HAS_SQLITE = (() => {
  try {
    const probe = new Database(":memory:");
    probe.close();
    return true;
  } catch {
    return false;
  }
})();

function seedSymbol(symbol: Symbol): void {
  upsertSymbol(db, symbol);
}

function seedEdge(edge: Edge): void {
  upsertEdge(db, edge);
}

beforeEach(() => {
  if (!HAS_SQLITE) return;
  db = new Database(":memory:");
  for (const ddl of ALL_SCHEMA_STATEMENTS) db.exec(ddl);

  seedSymbol({ id: "s:a", name: "alpha", kind: "function", file: "/repo/src/a.ts", line: 1, signature: "function alpha()" });
  seedSymbol({ id: "s:b", name: "beta", kind: "function", file: "/repo/src/b.ts", line: 2, signature: "function beta()" });
  seedSymbol({ id: "s:c", name: "gamma", kind: "function", file: "/repo/src/c.ts", line: 3, signature: "function gamma()" });
  seedSymbol({ id: "s:model", name: "User", kind: "class", file: "/repo/src/models/user.ts", line: 1, signature: "class User" });

  seedEdge({ from: "s:a", to: "s:b", kind: "calls", line: 10 });
  seedEdge({ from: "s:c", to: "s:a", kind: "calls", line: 20 });
  seedEdge({ from: "s:c", to: "s:model", kind: "imports", line: 21 });
});

afterEach(() => {
  if (!HAS_SQLITE) return;
  db.close();
});

test("getDefinition respects optional file filter", async (t) => {
  if (!HAS_SQLITE) return t.skip("better-sqlite3 native binding is unavailable in this environment");
  const byName = await getDefinition(db, "alpha");
  assert.equal(byName?.symbol.file, "/repo/src/a.ts");

  const byNameAndFile = await getDefinition(db, "alpha", "/repo/src/a.ts");
  assert.equal(byNameAndFile?.symbol.id, "s:a");
});

test("getCallers returns direct callers", async (t) => {
  if (!HAS_SQLITE) return t.skip("better-sqlite3 native binding is unavailable in this environment");
  const callers = await getCallers(db, "alpha");
  assert.equal(callers.length, 1);
  assert.equal(callers[0].caller.name, "gamma");
  assert.equal(callers[0].line, 20);
});

test("getCallPath returns shortest call chain", async (t) => {
  if (!HAS_SQLITE) return t.skip("better-sqlite3 native binding is unavailable in this environment");
  const path = await getCallPath(db, "gamma", "beta");
  assert.ok(path);
  assert.deepEqual(path.symbols.map((s) => s.name), ["gamma", "alpha", "beta"]);
});

test("findSymbol and file queries return deterministic matches", async (t) => {
  if (!HAS_SQLITE) return t.skip("better-sqlite3 native binding is unavailable in this environment");
  const fuzzy = await findSymbol(db, "alp");
  assert.equal(fuzzy[0].name, "alpha");

  const files = await searchFiles(db, "**/*.ts");
  assert.ok(files.includes("/repo/src/a.ts"));

  const symbolsInFile = await getFileSymbols(db, "/repo/src/a.ts");
  assert.equal(symbolsInFile.length, 1);
  assert.equal(symbolsInFile[0].name, "alpha");
});

test("getImporters returns file-level importers", async (t) => {
  if (!HAS_SQLITE) return t.skip("better-sqlite3 native binding is unavailable in this environment");
  const importers = await getImporters(db, "/repo/src/models/user.ts");
  assert.equal(importers.length, 1);
  assert.equal(importers[0].symbol.name, "gamma");
});
