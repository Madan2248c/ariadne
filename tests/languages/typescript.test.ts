import path from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { TypeScriptParser } from "../../src/indexer/languages/typescript.js";

const fixture = path.resolve("tests/fixtures/typescript-sample.ts");

test("TypeScript parser extracts symbols and edges", async () => {
  const parser = new TypeScriptParser();
  const { symbols, edges } = await parser.parseFile(fixture);

  const kindsByName = new Map(symbols.map((s) => [s.name, s.kind]));
  assert.equal(kindsByName.get("typescript-sample"), "module");
  assert.equal(kindsByName.get("bar"), "function");
  assert.equal(kindsByName.get("foo"), "function");
  assert.equal(kindsByName.get("Greeter"), "class");
  assert.equal(kindsByName.get("greet"), "method");

  const moduleId = `${fixture}:typescript-sample:module`;
  assert.ok(edges.some((e) => e.from === moduleId && e.to === "module:./dep" && e.kind === "imports"));
  assert.ok(edges.some((e) => e.from === `${fixture}:foo:function` && e.to === `${fixture}:bar:function` && e.kind === "calls"));
  assert.ok(edges.some((e) => e.from === `${fixture}:bar:function` && e.to === "unresolved:dep" && e.kind === "calls"));
  assert.ok(edges.some((e) => e.from === `${fixture}:Greeter.greet:method` && e.to === `${fixture}:foo:function` && e.kind === "calls"));
});
