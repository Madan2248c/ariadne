// MCP tool: get_callers
import type { Database } from "../graph/db.js";
import { getCallers } from "../graph/queries.js";
import { fmtCallSite, cap } from "./format.js";

export const GET_CALLERS_TOOL = {
  name: "get_callers",
  description: "List all call sites that invoke the given symbol.",
  inputSchema: {
    type: "object",
    properties: {
      symbol: { type: "string", description: "Symbol name to find callers for" },
    },
    required: ["symbol"],
  },
} as const;

export async function handleGetCallers(
  db: Database.Database,
  args: { symbol: string },
): Promise<string> {
  const results = await getCallers(db, args.symbol);
  if (results.length === 0) return `No callers found for "${args.symbol}".`;

  const { items, note } = cap(results, "callers");
  const out = items.map(fmtCallSite);
  return JSON.stringify(note ? { note, callers: out } : out, null, 2);
}
