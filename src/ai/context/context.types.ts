import type { ChangedFile } from "@/types/github";

export interface AnalysisContext {
  chunks: CodeChunk[];
  fileMap: Map<string, FileContext>;
  metadata: ContextMetadata;
}

export interface CodeChunk {
  id: string;
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  type: "diff" | "surrounding" | "function" | "module";
  priority: number;
}

export interface FileContext {
  file: ChangedFile;
  chunks: CodeChunk[];
  totalLines: number;
  language: string;
}

export interface ContextMetadata {
  totalTokens: number;
  fileCount: number;
  chunkCount: number;
  truncatedFiles: string[];
}
