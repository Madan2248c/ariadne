import path from "node:path";

export function pathVariants(p: string): string[] {
  return [...new Set([
    p,
    p.replace(/\\/g, "/"),
    p.replace(/\//g, "\\"),
  ])];
}

export function candidatePaths(inputPath: string, cwd = process.cwd()): string[] {
  const absolute = path.isAbsolute(inputPath) ? inputPath : path.join(cwd, inputPath);
  return [...pathVariants(absolute), ...pathVariants(inputPath)];
}
