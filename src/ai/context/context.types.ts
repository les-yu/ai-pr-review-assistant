import type { ChangedFile } from "@/types/github";

export type FilePriority = "critical" | "high" | "medium" | "low";

export interface AnalysisContext {
  chunks: CodeChunk[];
  fileContexts: FileContext[];
  metadata: ContextMetadata;
}

export interface CodeChunk {
  id: string;
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  type: "diff" | "surrounding" | "function" | "module";
  language: string;
  priority: number;
}

export interface FileContext {
  file: ChangedFile;
  chunks: CodeChunk[];
  language: string;
  priority: FilePriority;
  priorityScore: number;
  estimatedTokens: number;
}

export interface ContextMetadata {
  totalTokens: number;
  tokenBudget: number;
  fileCount: number;
  chunkCount: number;
  truncatedFiles: string[];
}

export interface DiffHunk {
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: "add" | "remove" | "context";
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}
