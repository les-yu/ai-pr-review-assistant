import { createLogger } from "@/infrastructure/logger/logger";
import type { ChangedFile } from "@/types/github";
import type { CodeChunk, DiffHunk, DiffLine } from "./context.types";

const log = createLogger("chunker");

const HUNK_HEADER_PATTERN = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/;

/**
 * Parse a git diff patch into structured hunks.
 */
export function parsePatch(patch: string): DiffHunk[] {
  if (!patch || patch.trim() === "") return [];

  const hunks: DiffHunk[] = [];
  const lines = patch.split("\n");
  let currentHunk: DiffHunk | null = null;

  for (const line of lines) {
    const hunkMatch = line.match(HUNK_HEADER_PATTERN);

    if (hunkMatch) {
      if (currentHunk) hunks.push(currentHunk);
      currentHunk = {
        header: line,
        oldStart: parseInt(hunkMatch[1], 10),
        oldLines: parseInt(hunkMatch[2] ?? "1", 10),
        newStart: parseInt(hunkMatch[3], 10),
        newLines: parseInt(hunkMatch[4] ?? "1", 10),
        lines: [],
      };
      continue;
    }

    if (!currentHunk) continue;

    // Skip git diff metadata lines
    if (line.startsWith("diff --git") || line.startsWith("index ") ||
        line.startsWith("---") || line.startsWith("+++")) {
      continue;
    }

    const diffLine = parseDiffLine(line, currentHunk);
    if (diffLine) currentHunk.lines.push(diffLine);
  }

  if (currentHunk) hunks.push(currentHunk);
  return hunks;
}

function parseDiffLine(line: string, hunk: DiffHunk): DiffLine | null {
  if (line.startsWith("+")) {
    const newLineNum = hunk.newStart + hunk.lines.filter(l => l.type !== "remove").length;
    return { type: "add", content: line.slice(1), newLineNumber: newLineNum };
  }

  if (line.startsWith("-")) {
    const oldLineNum = hunk.oldStart + hunk.lines.filter(l => l.type !== "add").length;
    return { type: "remove", content: line.slice(1), oldLineNumber: oldLineNum };
  }

  if (line.startsWith(" ") || line === "") {
    const contextOffset = hunk.lines.filter(l => l.type !== "add" && l.type !== "remove").length;
    return {
      type: "context",
      content: line.startsWith(" ") ? line.slice(1) : line,
      oldLineNumber: hunk.oldStart + contextOffset,
      newLineNumber: hunk.newStart + hunk.lines.filter(l => l.type !== "remove").length,
    };
  }

  // Handle conflict markers and other non-standard lines
  if (line.startsWith("\\") || line === "") return null;

  // Treat unknown lines as context
  return { type: "context", content: line };
}

/**
 * Chunk a changed file into analyzable CodeChunks.
 * Each hunk becomes a chunk, optionally with surrounding context lines.
 */
export function chunkFile(
  file: ChangedFile,
  surroundingLines: number = 10
): CodeChunk[] {
  const language = detectLanguage(file.filename);
  const hunks = parsePatch(file.patch);

  if (hunks.length === 0) {
    // Empty patch (e.g., binary file, or file with only metadata changes)
    return [];
  }

  const chunks: CodeChunk[] = [];

  for (let i = 0; i < hunks.length; i++) {
    const hunk = hunks[i];
    const lines = hunk.lines;

    if (lines.length === 0) continue;

    // Build chunk content with surrounding context
    const contentLines: string[] = [];

    // Add surrounding context before
    const contextBefore = lines
      .filter((l) => l.type === "context")
      .slice(-surroundingLines);
    for (const l of contextBefore) {
      contentLines.push(`  ${l.content}`);
    }

    // Add actual changes
    for (const l of lines) {
      if (l.type === "add") contentLines.push(`+ ${l.content}`);
      else if (l.type === "remove") contentLines.push(`- ${l.content}`);
    }

    // Add surrounding context after
    const contextAfter = lines
      .filter((l) => l.type === "context")
      .slice(0, surroundingLines);
    for (const l of contextAfter) {
      contentLines.push(`  ${l.content}`);
    }

    const firstLine = lines[0];
    const lastLine = lines[lines.length - 1];
    const startLine = firstLine.newLineNumber ?? firstLine.oldLineNumber ?? 0;
    const endLine = lastLine.newLineNumber ?? lastLine.oldLineNumber ?? startLine;

    chunks.push({
      id: `${file.filename}:hunk:${i}`,
      filePath: file.filename,
      content: contentLines.join("\n"),
      startLine: Math.max(1, startLine - surroundingLines),
      endLine: endLine + surroundingLines,
      type: "diff",
      language,
      priority: calculateChunkPriority(lines),
    });
  }

  return chunks;
}

/**
 * Calculate a priority score for a chunk based on its content.
 * Higher score = more important to analyze.
 */
function calculateChunkPriority(lines: DiffLine[]): number {
  let score = 0;

  for (const line of lines) {
    if (line.type !== "add" && line.type !== "remove") continue;
    const content = line.content.toLowerCase();

    // Security-sensitive patterns
    if (/password|secret|token|api.?key|credential/.test(content)) score += 10;
    if (/exec|eval|spawn|system\(/.test(content)) score += 8;
    if (/sql|query|select|insert|update|delete/.test(content) &&
        /\+.*['"]/.test(line.content)) score += 6;

    // Quality patterns
    if (/todo|fixme|hack|xxx/.test(content)) score += 2;
    if (/catch\s*\(\s*\)/.test(content)) score += 3; // Empty catch
    if (/(?:^|\s)(?:0x[0-9a-f]+|\d{3,})(?:\s|$)/.test(content)) score += 1; // Magic numbers
  }

  return score;
}

const LANGUAGE_MAP: Record<string, string> = {
  ts: "typescript", tsx: "typescript",
  js: "javascript", jsx: "javascript",
  py: "python", go: "go", rs: "rust",
  java: "java", rb: "ruby", php: "php",
  cs: "csharp", cpp: "cpp", c: "c",
  swift: "swift", kt: "kotlin",
  sql: "sql", sh: "shell", bash: "shell",
  yml: "yaml", yaml: "yaml",
  json: "json", md: "markdown",
  html: "html", css: "css", scss: "css",
  dockerfile: "docker",
};

export function detectLanguage(filename: string): string {
  // Handle Dockerfile and similar
  const baseName = filename.split("/").pop()?.toLowerCase() ?? "";
  if (baseName === "dockerfile") return "docker";

  const ext = baseName.split(".").pop() ?? "";
  return LANGUAGE_MAP[ext] ?? "text";
}
