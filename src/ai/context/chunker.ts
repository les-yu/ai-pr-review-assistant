import type { ChangedFile } from "@/types/github";
import type { CodeChunk } from "./context.types";

/**
 * Splits a file's diff into analyzable chunks.
 *
 * Strategy:
 * - Each diff hunk becomes a chunk
 * - Surrounding code is added as context
 * - Large files are split into smaller pieces
 * - Chunks are prioritized by risk indicators
 */

export function chunkDiff(file: ChangedFile): CodeChunk[] {
  // TODO: Implement in PR #3
  // Parse the patch string into hunks
  // Extract surrounding context lines
  // Return prioritized chunks
  return [];
}

export function detectLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const languageMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    py: "python",
    go: "go",
    rs: "rust",
    java: "java",
    rb: "ruby",
    php: "php",
    cs: "csharp",
    cpp: "cpp",
    c: "c",
    swift: "swift",
    kt: "kotlin",
    sql: "sql",
    sh: "shell",
    yml: "yaml",
    yaml: "yaml",
    json: "json",
    md: "markdown",
  };
  return languageMap[ext] ?? "text";
}
