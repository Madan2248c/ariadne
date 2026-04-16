import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

test("MCP stdio server responds to tool discovery and get_index_status", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ariadne-mcp-it-"));
  const serverEntry = path.resolve("dist/index.js");
  const stderrLines: string[] = [];
  const childEnv = Object.fromEntries(
    Object.entries(process.env).filter(([, value]) => typeof value === "string"),
  ) as Record<string, string>;

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverEntry],
    env: childEnv,
    cwd: repoRoot,
    stderr: "pipe",
  });

  const stderr = transport.stderr;
  stderr?.on("data", (chunk) => stderrLines.push(String(chunk)));

  const client = new Client({ name: "ariadne-test-client", version: "0.0.0" });

  try {
    await client.connect(transport);

    const tools = await client.listTools();
    assert.ok(tools.tools.some((t) => t.name === "get_index_status"));
    assert.ok(tools.tools.some((t) => t.name === "get_definition"));

    const status = await client.callTool({
      name: "get_index_status",
      arguments: {},
    });

    const text = status.content
      .filter((item): item is { type: "text"; text: string } => item.type === "text")
      .map((item) => item.text)
      .join("\n");

    assert.match(text, /state:/);
    assert.match(text, /phase:/);
  } finally {
    await client.close().catch(() => {});
    await transport.close().catch(() => {});
    await fs.rm(repoRoot, { recursive: true, force: true });
  }

  // Useful assertion to ensure the child process produced expected startup logs.
  assert.ok(stderrLines.join("").includes("Ariadne"));
});
