/**
 * Shared response formatters for MCP tool handlers.
 *
 * Goals:
 *   - Relative file paths   (strip process.cwd() prefix — saves ~40 chars per entry)
 *   - First-line signatures (multi-line Python/TS sigs waste hundreds of tokens)
 *   - No docstrings in list responses (only in get_definition)
 *   - Capped result lists   (references/callers can be 500+ rows)
 */

import type { Symbol, CallSite } from "../types/index.js";

const CWD = process.cwd();

/** Strip the repo root prefix so paths are repo-relative. */
export function relPath(file: string): string {
  if (file.startsWith(CWD + "/")) return file.slice(CWD.length + 1);
  if (file.startsWith(CWD + "\\")) return file.slice(CWD.length + 1);
  return file;
}

/** Keep only the first line of a multi-line signature. */
export function firstLine(sig: string | undefined): string | undefined {
  if (!sig) return undefined;
  const line = sig.split("\n")[0].trim();
  return line || undefined;
}

/** Compact symbol for list responses — no id, no docstring, relative path, single-line sig. */
export function fmtSymbol(s: Symbol): Record<string, unknown> {
  const out: Record<string, unknown> = {
    name: s.name,
    kind: s.kind,
    file: relPath(s.file),
    line: s.line,
  };
  const sig = firstLine(s.signature);
  if (sig) out["signature"] = sig;
  return out;
}

/** Compact call site for callers/references responses. */
export function fmtCallSite(cs: CallSite): Record<string, unknown> {
  return {
    name: cs.caller.name,
    kind: cs.caller.kind,
    file: relPath(cs.caller.file),
    line: cs.line,
  };
}

/**
 * Cap a result array and append a note if truncated.
 * Returns [capped array, optional truncation note].
 */
export const MAX_LIST = 40;

export function cap<T>(
  items: T[],
  label: string,
): { items: T[]; note: string | null } {
  if (items.length <= MAX_LIST) return { items, note: null };
  return {
    items: items.slice(0, MAX_LIST),
    note: `(showing ${MAX_LIST} of ${items.length} ${label} — narrow your query for more specific results)`,
  };
}
