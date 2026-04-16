import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { ALL_SCHEMA_STATEMENTS } from "../../src/graph/schema.js";
import {
  handleGetCallPath,
  handleGetDefinition,
  handleGetFileSymbols,
  handleGetImporters,
  handleGetReferences,
  handleGetTypeDefinition,
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

function emptyDb(): Database.Database {
  const db = new Database(":memory:");
  for (const ddl of ALL_SCHEMA_STATEMENTS) db.exec(ddl);
  return db;
}

test("tool handlers return clear messages on empty graph", async (t) => {
  if (!HAS_SQLITE) return t.skip("better-sqlite3 native binding is unavailable in this environment");

  const db = emptyDb();
  try {
    assert.match(await handleGetDefinition(db, { symbol: "Missing" }), /No definition found/);
    assert.match(await handleGetCallPath(db, { from: "A", to: "B" }), /No call path found/);
    assert.match(await handleGetReferences(db, { symbol: "Missing" }), /No references found/);
    assert.match(await handleGetTypeDefinition(db, { symbol: "Missing" }), /No type definitions found/);
    assert.match(await handleGetFileSymbols(db, { file: "src/missing.ts" }), /No symbols found in/);
    assert.match(await handleGetImporters(db, { file: "src/missing.ts" }), /No importers found/);
  } finally {
    db.close();
  }
});
