import type { AnalysisContext } from "@/ai/context/context.types";
import type { ReviewCommentData } from "@/types/analysis";

export interface AnalysisStrategy {
  readonly name: string;
  readonly type: "rule" | "llm" | "composite";

  analyze(context: AnalysisContext): Promise<StrategyResult>;
}

export interface StrategyResult {
  comments: ReviewCommentData[];
  metadata: Record<string, unknown>;
}

export interface RuleStrategy extends AnalysisStrategy {
  type: "rule";
}

export interface LLMStrategy extends AnalysisStrategy {
  type: "llm";
}
