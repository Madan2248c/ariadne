// MCP tool: get_source_definition
import type { Database } from "../graph/db.js";
import { getSourceDefinition } from "../graph/queries.js";
import { relPath, firstLine } from "./format.js";

export const GET_SOURCE_DEFINITION_TOOL = {
  name: "get_source_definition",
  description:
    "Like get_definition but skips barrel/index files. " +
    "Returns the original source location rather than a re-export in an index.ts.",
  inputSchema: {
    type: "object",
    properties: {
      symbol: { type: "string", description: "Symbol name to look up" },
      file: {
        type: "string",
        description: "Optional: restrict search to this file path",
      },
    },
    required: ["symbol"],
  },
} as const;

export async function handleGetSourceDefinition(
  db: Database.Database,
  args: { symbol: string; file?: string },
): Promise<string> {
  const result = await getSourceDefinition(db, args.symbol, args.file);
  if (!result) {
    return `No source definition found for "${args.symbol}"${args.file ? ` in ${args.file}` : ""}.`;
  }

  const { symbol } = result;
  const out: Record<string, unknown> = {
    name: symbol.name,
    kind: symbol.kind,
    file: relPath(symbol.file),
    line: symbol.line,
  };
  const sig = firstLine(symbol.signature);
  if (sig) out["signature"] = sig;
  if (symbol.docstring) out["docstring"] = symbol.docstring.slice(0, 120);
  return JSON.stringify(out, null, 2);
}
