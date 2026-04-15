// MCP tool: get_implementations
import type { Database } from "../graph/db.js";
import { getImplementations } from "../graph/queries.js";
import { fmtSymbol, cap } from "./format.js";

export const GET_IMPLEMENTATIONS_TOOL = {
  name: "get_implementations",
  description:
    "List all classes or functions that implement the given interface or abstract base.",
  inputSchema: {
    type: "object",
    properties: {
      interface: { type: "string", description: "Interface or abstract class name" },
    },
    required: ["interface"],
  },
} as const;

export async function handleGetImplementations(
  db: Database.Database,
  args: { interface: string },
): Promise<string> {
  const results = await getImplementations(db, args.interface);
  if (results.length === 0) return `No implementations found for "${args.interface}".`;

  const { items, note } = cap(results, "implementations");
  const out = items.map(({ symbol }) => fmtSymbol(symbol));
  return JSON.stringify(note ? { note, implementations: out } : out, null, 2);
}
