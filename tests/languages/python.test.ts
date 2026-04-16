import path from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { PythonParser } from "../../src/indexer/languages/python.js";

const fixture = path.resolve("tests/fixtures/python-sample.py");

test("Python parser extracts symbols and edges", async () => {
  const parser = new PythonParser();
  const { symbols, edges } = await parser.parseFile(fixture);

  const kindsByName = new Map(symbols.map((s) => [s.name, s.kind]));
  assert.equal(kindsByName.get("python-sample"), "module");
  assert.equal(kindsByName.get("helper"), "function");
  assert.equal(kindsByName.get("foo"), "function");
  assert.equal(kindsByName.get("Greeter"), "class");
  assert.equal(kindsByName.get("greet"), "method");

  const moduleId = `${fixture}:python-sample:module`;
  assert.ok(edges.some((e) => e.from === moduleId && e.to === "module:os" && e.kind === "imports"));
  assert.ok(edges.some((e) => e.from === moduleId && e.to === "module:pkg.dep" && e.kind === "imports"));
  assert.ok(edges.some((e) => e.from === `${fixture}:foo:function` && e.to === `${fixture}:helper:function` && e.kind === "calls"));
  assert.ok(edges.some((e) => e.from === `${fixture}:helper:function` && e.to === "unresolved:dep" && e.kind === "calls"));
  assert.ok(edges.some((e) => e.from === `${fixture}:Greeter.greet:method` && e.to === `${fixture}:foo:function` && e.kind === "calls"));
});
