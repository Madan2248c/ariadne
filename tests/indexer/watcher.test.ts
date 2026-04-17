import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveUnresolvedCallEdges } from "../../src/indexer/watcher.js";
import type { Edge } from "../../src/types/index.js";

test("resolveUnresolvedCallEdges resolves calls by name and prefers same-file symbols", () => {
  const changedFile = "src/foo.ts";
  const sameFileBar = "src/foo.ts:bar:function";
  const otherFileBar = "src/bar.ts:bar:function";

  const edges: Edge[] = [
    { from: `${changedFile}:caller:function`, to: "unresolved:bar", kind: "calls", line: 3 },
    { from: `${changedFile}:caller:function`, to: "unresolved:missing", kind: "calls", line: 4 },
    { from: `${changedFile}:foo:module`, to: "module:./bar", kind: "imports", line: 1 },
  ];

  resolveUnresolvedCallEdges(changedFile, edges, (calleeName, filePath) => {
    if (calleeName !== "bar") return null;
    return filePath === changedFile ? sameFileBar : otherFileBar;
  });

  assert.equal(edges[0]?.to, sameFileBar);
  assert.equal(edges[1]?.to, "unresolved:missing");
  assert.equal(edges[2]?.to, "module:./bar");
});

test("resolveUnresolvedCallEdges caches lookups per unresolved name", () => {
  const changedFile = "src/foo.ts";
  const edges: Edge[] = [
    { from: `${changedFile}:a:function`, to: "unresolved:bar", kind: "calls" },
    { from: `${changedFile}:b:function`, to: "unresolved:bar", kind: "calls" },
    { from: `${changedFile}:c:function`, to: "unresolved:baz", kind: "calls" },
  ];

  let lookupCount = 0;
  resolveUnresolvedCallEdges(changedFile, edges, (calleeName) => {
    lookupCount += 1;
    if (calleeName === "bar") return "src/bar.ts:bar:function";
    return null;
  });

  assert.equal(lookupCount, 2);
  assert.equal(edges[0]?.to, "src/bar.ts:bar:function");
  assert.equal(edges[1]?.to, "src/bar.ts:bar:function");
  assert.equal(edges[2]?.to, "unresolved:baz");
});
