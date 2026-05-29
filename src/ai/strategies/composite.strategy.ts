import type { AnalysisContext } from "@/ai/context/context.types";
import type { AnalysisStrategy, StrategyResult } from "./strategy.interface";
import type { ReviewCommentData } from "@/types/analysis";

/**
 * Composite strategy that runs Rule Engine + LLM in sequence.
 *
 * Flow:
 * 1. Run rule engine first (fast, deterministic)
 * 2. Run LLM analysis (slow, semantic)
 * 3. Merge and deduplicate results
 * 4. LLM comments can override rule comments on same location
 */
export class CompositeAnalysisStrategy implements AnalysisStrategy {
  readonly name = "composite";
  readonly type = "composite" as const;

  constructor(
    private ruleStrategy: AnalysisStrategy,
    private llmStrategy: AnalysisStrategy
  ) {}

  async analyze(context: AnalysisContext): Promise<StrategyResult> {
    const ruleResult = await this.ruleStrategy.analyze(context);
    const llmResult = await this.llmStrategy.analyze(context);

    return {
      comments: this.mergeComments(ruleResult.comments, llmResult.comments),
      metadata: {
        ruleCount: ruleResult.comments.length,
        llmCount: llmResult.comments.length,
      },
    };
  }

  private mergeComments(
    ruleComments: ReviewCommentData[],
    llmComments: ReviewCommentData[]
  ): ReviewCommentData[] {
    // Deduplicate: if LLM has a comment on the same file+line as a rule,
    // keep the LLM version (more nuanced)
    const merged = new Map<string, ReviewCommentData>();

    for (const comment of ruleComments) {
      const key = `${comment.filePath}:${comment.lineStart ?? 0}`;
      merged.set(key, comment);
    }

    for (const comment of llmComments) {
      const key = `${comment.filePath}:${comment.lineStart ?? 0}`;
      merged.set(key, comment); // LLM overrides rule
    }

    return Array.from(merged.values());
  }
}
