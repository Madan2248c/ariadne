// MCP tool: reindex
//
// Wraps `indexer.forceReindex` so an agent can ask for a fresh code map
// after a large structural change without restarting the MCP server.
import { forceReindex } from "../indexer/index.js";

export const REINDEX_TOOL = {
  name: "reindex",
  description:
    "Force-rebuild the Ariadne code index. Deletes the SCIP cache and graph " +
    "database, then re-runs scip-typescript / scip-python from scratch and " +
    "reloads symbols. Use when a large refactor (new modules, file moves, " +
    "renames spanning many files) makes the existing index stale and the " +
    "24h SCIP cache hasn't expired yet. Re-indexing a large TypeScript repo " +
    "can take 5\u201310 minutes; agents should warn the user and not call this " +
    "speculatively.",
  inputSchema: {
    type: "object",
    properties: {},
    required: [],
  },
} as const;

export async function handleReindex(): Promise<string> {
  return forceReindex();
}
