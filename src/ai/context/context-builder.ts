import { createLogger } from "@/infrastructure/logger/logger";
import type { PRData } from "@/types/github";
import type { AnalysisContext } from "./context.types";

const log = createLogger("context-builder");

/**
 * Builds rich analysis context from PR data.
 *
 * Goes beyond raw diff by including:
 * - Diff context (the actual changes)
 * - Surrounding code (lines around the change)
 * - Function context (the containing function/class)
 * - File priority (security-sensitive files ranked higher)
 *
 * @param prData - Full PR data from GitHub
 * @returns Structured analysis context ready for AI processing
 */
export async function buildContext(prData: PRData): Promise<AnalysisContext> {
  log.info(
    { fileCount: prData.files.length },
    "Building analysis context"
  );

  // TODO: Implement in PR #3
  // 1. Parse diff into chunks
  // 2. Rank files by priority (security-sensitive > test > other)
  // 3. Extract surrounding code context
  // 4. Estimate token count and truncate if needed

  return {
    chunks: [],
    fileMap: new Map(),
    metadata: {
      totalTokens: 0,
      fileCount: prData.files.length,
      chunkCount: 0,
      truncatedFiles: [],
    },
  };
}
