/**
 * Master indexing orchestrator.
 *
 * Called once at startup.  Detects languages, runs the appropriate SCIP
 * indexers automatically, loads the resulting .scip files into SQLite, then
 * starts the tree-sitter file watcher for incremental updates.
 *
 * All progress goes to stderr so it never touches the MCP stdio channel.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { getDb, wipAndReinit } from "../graph/db.js";
import { detectLanguages } from "./detector.js";
import { runPythonIndexer, runTypescriptIndexer } from "./scip-runner.js";
import { loadScipIndex } from "./scip-reader.js";
import { startWatcher } from "./watcher.js";
import { setStatus } from "./status.js";

/** SCIP cache files removed by `forceReindex` to bypass the 24h cache. */
const SCIP_FILES = ["index-python.scip", "index-ts.scip"];

/** True while a `forceReindex` is in flight, used by the MCP tool to refuse
 * concurrent invocations rather than corrupt the in-progress run. */
let reindexInFlight = false;

function log(msg: string): void {
  process.stderr.write(msg + "\n");
}

/** Check whether the DB already has symbols AND is not stale vs the SCIP file. */
async function needsReload(repoPath: string, scipPath: string): Promise<boolean> {
  let scipMtime: number;
  try {
    scipMtime = (await fs.stat(scipPath)).mtimeMs;
  } catch {
    return true; // no SCIP yet
  }

  const dbPath = path.join(repoPath, ".ariadne", "graph.db");
  let dbMtime: number;
  try {
    dbMtime = (await fs.stat(dbPath)).mtimeMs;
  } catch {
    return true; // no DB file
  }

  if (scipMtime > dbMtime) return true;

  try {
    const db = getDb();
    const r = db.prepare("SELECT COUNT(*) AS n FROM symbols").get() as { n: number } | undefined;
    if (r == null || r.n === 0) return true;
  } catch {
    return true;
  }

  return false;
}

export async function runIndexer(): Promise<void> {
  const repoPath = process.cwd();

  // ── 1. Language detection ────────────────────────────────────────────────
  setStatus({ state: "detecting", phase: "Detecting languages…" });
  log("→ Detecting languages...");
  const langs = await detectLanguages(repoPath);

  const detected: string[] = [];
  if (langs.python)     detected.push("Python");
  if (langs.typescript) detected.push("TypeScript");
  if (langs.javascript) detected.push("JavaScript");

  setStatus({ languages: detected });

  if (detected.length === 0) {
    setStatus({ state: "ready", phase: "No supported languages found — graph is empty.", symbolCount: 0, edgeCount: 0 });
    log("→ No supported languages detected — starting with empty graph.");
    log("→ Ariadne ready.");
    return;
  }

  log(`→ Found: ${detected.join(", ")}`);

  // ── 2. Run SCIP indexers (conditionally) ─────────────────────────────────
  let totalSymbols = 0;
  let totalEdges   = 0;

  if (langs.python) {
    try {
      setStatus({ state: "scip-running", phase: "Running scip-python… (first run installs it via pip)" });
      const scipPath = await runPythonIndexer(repoPath);

      if (await needsReload(repoPath, scipPath)) {
        setStatus({ state: "loading", phase: "Loading Python symbols into graph…" });
        log("→ Loading Python index...");
        await wipAndReinit(repoPath);
        const result = await loadScipIndex(getDb(), scipPath, repoPath);
        totalSymbols += result.symbolCount;
        totalEdges   += result.edgeCount;
        setStatus({ symbolCount: totalSymbols, edgeCount: totalEdges });
        log(`→ Python ready: ${result.symbolCount.toLocaleString()} symbols`);
      } else {
        log("→ Python index up to date — skipping reload.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`→ Python indexing failed: ${msg}`);
      log("   (Ariadne will continue without Python symbols)");
    }
  }

  if (langs.typescript || langs.javascript) {
    try {
      setStatus({
        state: "scip-running",
        phase: "Running scip-typescript… (first run may take 5–10 min for large repos)",
      });
      const scipPath = await runTypescriptIndexer(repoPath);

      if (await needsReload(repoPath, scipPath)) {
        setStatus({ state: "loading", phase: "Loading TypeScript/JavaScript symbols into graph…" });
        log("→ Loading TypeScript/JavaScript index...");
        await wipAndReinit(repoPath);
        const result = await loadScipIndex(getDb(), scipPath, repoPath);
        totalSymbols += result.symbolCount;
        totalEdges   += result.edgeCount;
        setStatus({ symbolCount: totalSymbols, edgeCount: totalEdges });
        log(`→ TypeScript/JavaScript ready: ${result.symbolCount.toLocaleString()} symbols`);
      } else {
        log("→ TypeScript/JavaScript index up to date — skipping reload.");
        try {
          const db = getDb();
          const rs = db.prepare("SELECT COUNT(*) AS n FROM symbols").get() as { n: number } | undefined;
          totalSymbols += rs?.n ?? 0;
          const re = db.prepare("SELECT COUNT(*) AS n FROM edges").get() as { n: number } | undefined;
          totalEdges += re?.n ?? 0;
        } catch { /* non-fatal */ }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus({ state: "error", phase: `TypeScript/JavaScript indexing failed: ${msg}`, errorMessage: msg });
      log(`→ TypeScript/JavaScript indexing failed: ${msg}`);
      log("   (Ariadne will continue without TypeScript/JavaScript symbols)");
    }
  }

  // ── 3. Summary ───────────────────────────────────────────────────────────
  log(`→ Graph ready: ${totalSymbols.toLocaleString()} symbols, ${totalEdges.toLocaleString()} edges`);

  setStatus({
    state:       "ready",
    phase:       "Index fully loaded. File watcher active for incremental updates.",
    symbolCount: totalSymbols,
    edgeCount:   totalEdges,
  });

  // ── 4. Start incremental watcher ─────────────────────────────────────────
  startWatcher(getDb(), repoPath);

  log("→ Ariadne ready.");
}

/**
 * Drop the SCIP cache files and re-run the full indexing pipeline.
 *
 * The default startup path treats `.ariadne/index-*.scip` as a 24h cache
 * keyed on file mtime; large structural changes (refactor, new modules)
 * therefore aren't reflected until the cache is manually deleted. This
 * function does that deletion atomically and then re-enters `runIndexer`,
 * letting the agent ask for a fresh map without restarting the MCP server.
 *
 * Returns a one-line summary suitable for use as the MCP tool response.
 *
 * Refuses concurrent invocations: a re-index in flight needs to finish
 * before another one is meaningful, and stomping the SCIP files mid-run
 * would corrupt the partial load.
 */
export async function forceReindex(): Promise<string> {
  if (reindexInFlight) {
    return "Re-index already in progress — wait for it to finish before triggering another.";
  }

  reindexInFlight = true;
  const startedAt = Date.now();

  try {
    const repoPath = process.cwd();
    const ariadneDir = path.join(repoPath, ".ariadne");

    log("→ Force re-index requested: deleting SCIP cache and graph DB...");

    // Drop the SCIP cache so `needsReload` always sees the SCIP file as
    // newer than the (about-to-be-recreated) DB. Errors are non-fatal:
    // a missing file is the desired post-state.
    await Promise.all(
      SCIP_FILES.map((file) =>
        fs.rm(path.join(ariadneDir, file), { force: true }),
      ),
    );

    // Wipe the graph DB for the same reason — without this, `needsReload`
    // can short-circuit and skip the SCIP load on stale-but-equal mtimes.
    await wipAndReinit(repoPath);

    await runIndexer();

    const elapsedMs = Date.now() - startedAt;
    return `Re-index complete in ${(elapsedMs / 1000).toFixed(1)}s. Index is ready.`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setStatus({ state: "error", phase: `Re-index failed: ${msg}`, errorMessage: msg });
    log(`→ Force re-index failed: ${msg}`);
    return `Re-index failed: ${msg}`;
  } finally {
    reindexInFlight = false;
  }
}
