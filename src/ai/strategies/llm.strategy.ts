import type { AnalysisContext } from "@/ai/context/context.types";
import type { LLMStrategy, StrategyResult } from "./strategy.interface";

/**
 * LLM-based analysis strategy.
 *
 * Uses DeepSeek API for:
 * - PR summary generation
 * - Business logic understanding
 * - Architecture risk analysis
 * - Code smell detection
 * - Review comment generation
 */
export class LLMAnalysisStrategy implements LLMStrategy {
  readonly name = "llm-analyzer";
  readonly type = "llm" as const;

  async analyze(context: AnalysisContext): Promise<StrategyResult> {
    // TODO: Implement in PR #5-6
    // 1. Select appropriate prompt template
    // 2. Build prompt with context chunks
    // 3. Call DeepSeek API
    // 4. Parse structured output
    // 5. Return ReviewCommentData[]
    return { comments: [], metadata: {} };
  }
}
