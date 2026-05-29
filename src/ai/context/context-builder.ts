import { createLogger } from "@/infrastructure/logger/logger";
import type { PRData } from "@/types/github";
import type { AnalysisContext, FileContext } from "./context.types";
import { chunkFile } from "./chunker";
import { calculateFilePriority } from "./file-priority";
import { estimateChunkTokens, allocateTokenBudget, buildMetadata } from "./token-estimator";

const log = createLogger("context-builder");

const DEFAULT_TOKEN_BUDGET = 8000;
const DEFAULT_SURROUNDING_LINES = 10;

export interface ContextBuilderOptions {
  tokenBudget?: number;
  surroundingLines?: number;
}

/**
 * Builds rich analysis context from PR data.
 *
 * Pipeline:
 * 1. Chunk each file's diff into CodeChunks
 * 2. Score files by priority (security > business > test)
 * 3. Estimate tokens per file
 * 4. Allocate token budget by priority tier
 * 5. Assemble AnalysisContext
 */
export async function buildContext(
  prData: PRData,
  options: ContextBuilderOptions = {}
): Promise<AnalysisContext> {
  const budget = options.tokenBudget ?? DEFAULT_TOKEN_BUDGET;
  const surroundingLines = options.surroundingLines ?? DEFAULT_SURROUNDING_LINES;

  log.info(
    { fileCount: prData.files.length, budget },
    "Building analysis context"
  );

  // Stage 1: Chunk each file
  const fileContexts: FileContext[] = [];

  for (const file of prData.files) {
    const chunks = chunkFile(file, surroundingLines);
    const { score, level } = calculateFilePriority(file);
    const estimatedTokens = chunks.reduce(
      (sum, c) => sum + estimateChunkTokens(c),
      0
    );

    fileContexts.push({
      file,
      chunks,
      language: chunks[0]?.language ?? "text",
      priority: level,
      priorityScore: score,
      estimatedTokens,
    });
  }

  // Stage 2: Sort by priority (highest first)
  fileContexts.sort((a, b) => b.priorityScore - a.priorityScore);

  // Stage 3: Allocate token budget
  const allocation = allocateTokenBudget(fileContexts, budget);

  // Stage 4: Filter chunks to fit budget
  const allChunks = fileContexts.flatMap((fc) => fc.chunks);
  const metadata = buildMetadata(fileContexts, allocation, budget);

  log.info(
    {
      chunkCount: allChunks.length,
      totalTokens: metadata.totalTokens,
      truncatedFiles: metadata.truncatedFiles.length,
    },
    "Context built"
  );

  return {
    chunks: allChunks,
    fileContexts,
    metadata,
  };
}
