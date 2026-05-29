import type { AnalysisContext } from "@/ai/context/context.types";
import type { RuleFinding, ReviewCommentData } from "@/types/analysis";

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
  findRules(): RuleDefinition[];
}

export interface LLMStrategy extends AnalysisStrategy {
  type: "llm";
}

export interface RuleDefinition {
  id: string;
  name: string;
  description: string;
  severity: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  category: string;
  enabled: boolean;
}
