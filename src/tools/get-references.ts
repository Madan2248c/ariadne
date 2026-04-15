// MCP tool: get_references
import type { Database } from "../graph/db.js";
import { getReferences } from "../graph/queries.js";
import { fmtCallSite, cap } from "./format.js";

export const GET_REFERENCES_TOOL = {
  name: "get_references",
  description: "Find every place in the repo that references the given symbol.",
  inputSchema: {
    type: "object",
    properties: {
      symbol: { type: "string", description: "Symbol name to find references for" },
    },
    required: ["symbol"],
  },
} as const;

export async function handleGetReferences(
  db: Database.Database,
  args: { symbol: string },
): Promise<string> {
  const results = await getReferences(db, args.symbol);
  if (results.length === 0) return `No references found for "${args.symbol}".`;

  const { items, note } = cap(results, "references");
  const out = items.map(fmtCallSite);
  return JSON.stringify(note ? { note, references: out } : out, null, 2);
}
