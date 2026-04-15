// MCP tool: get_call_path
import type { Database } from "../graph/db.js";
import { getCallPath } from "../graph/queries.js";
import { relPath } from "./format.js";

export const GET_CALL_PATH_TOOL = {
  name: "get_call_path",
  description: "Find the shortest call chain between two symbols.",
  inputSchema: {
    type: "object",
    properties: {
      from: { type: "string", description: "Starting symbol name" },
      to: { type: "string", description: "Target symbol name" },
    },
    required: ["from", "to"],
  },
} as const;

export async function handleGetCallPath(
  db: Database.Database,
  args: { from: string; to: string },
): Promise<string> {
  const result = await getCallPath(db, args.from, args.to);
  if (!result) {
    return `No call path found from "${args.from}" to "${args.to}" within 12 hops.`;
  }

  return JSON.stringify(
    {
      hops: result.symbols.length,
      path: result.symbols.map((s) => `${s.name} (${relPath(s.file)}:${s.line})`),
    },
    null,
    2,
  );
}
