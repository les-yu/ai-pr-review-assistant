import type { CodeChunk, FileContext, ContextMetadata } from "./context.types";
import type { FilePriority } from "./context.types";

/**
 * Rough token estimation: ~4 characters per token for code.
 * This is a heuristic; actual tokenization varies by model.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Estimate tokens for a chunk.
 */
export function estimateChunkTokens(chunk: CodeChunk): number {
  return estimateTokens(chunk.content);
}

export interface BudgetAllocation {
  fileTokens: Map<string, number>;
  truncatedFiles: string[];
  totalTokens: number;
}

/**
 * Allocate token budget across files based on priority.
 *
 * Strategy:
 * - critical/high files get 60% of budget
 * - medium files get 30% of budget
 * - low files get 10% of budget
 * - Within each tier, tokens are distributed evenly
 * - Files exceeding their allocation are truncated
 */
export function allocateTokenBudget(
  fileContexts: FileContext[],
  budget: number
): BudgetAllocation {
  const fileTokens = new Map<string, number>();
  const truncatedFiles: string[] = [];
  let totalTokens = 0;

  if (fileContexts.length === 0 || budget <= 0) {
    return { fileTokens, truncatedFiles, totalTokens };
  }

  // Group by priority tier
  const tiers: Record<FilePriority, FileContext[]> = {
    critical: [],
    high: [],
    medium: [],
    low: [],
  };

  for (const fc of fileContexts) {
    tiers[fc.priority].push(fc);
  }

  // Budget allocation per tier
  const tierBudgets: Record<FilePriority, number> = {
    critical: Math.floor(budget * 0.35),
    high: Math.floor(budget * 0.25),
    medium: Math.floor(budget * 0.25),
    low: Math.floor(budget * 0.15),
  };

  for (const priority of ["critical", "high", "medium", "low"] as FilePriority[]) {
    const tierFiles = tiers[priority];
    if (tierFiles.length === 0) continue;

    const tierBudget = tierBudgets[priority];
    const perFileBudget = Math.floor(tierBudget / tierFiles.length);

    for (const fc of tierFiles) {
      const allocated = Math.min(fc.estimatedTokens, perFileBudget);
      fileTokens.set(fc.file.filename, allocated);
      totalTokens += allocated;

      if (fc.estimatedTokens > perFileBudget) {
        truncatedFiles.push(fc.file.filename);
      }
    }
  }

  return { fileTokens, truncatedFiles, totalTokens };
}

/**
 * Build ContextMetadata from file contexts and budget allocation.
 */
export function buildMetadata(
  fileContexts: FileContext[],
  allocation: BudgetAllocation,
  budget: number
): ContextMetadata {
  return {
    totalTokens: allocation.totalTokens,
    tokenBudget: budget,
    fileCount: fileContexts.length,
    chunkCount: fileContexts.reduce((sum, fc) => sum + fc.chunks.length, 0),
    truncatedFiles: allocation.truncatedFiles,
  };
}
