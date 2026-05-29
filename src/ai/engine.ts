import { createLogger } from "@/infrastructure/logger/logger";
import type { AnalysisContext } from "@/ai/context/context.types";
import type { AnalysisOutput } from "@/domain/analysis/analysis.types";
import type { AnalysisStrategy, StrategyResult } from "@/ai/strategies/strategy.interface";
import { CompositeAnalysisStrategy } from "@/ai/strategies/composite.strategy";
import { RuleAnalysisStrategy } from "@/ai/strategies/rule.strategy";
import { LLMAnalysisStrategy } from "@/ai/strategies/llm.strategy";
import { deepseekProvider } from "@/ai/providers/deepseek.provider";
import type { RiskScore } from "@/types/analysis";

const log = createLogger("ai.engine");

export class AIEngine {
  private strategy: AnalysisStrategy;

  constructor(strategy?: AnalysisStrategy) {
    this.strategy =
      strategy ??
      new CompositeAnalysisStrategy(
        new RuleAnalysisStrategy(),
        new LLMAnalysisStrategy(deepseekProvider)
      );
  }

  async analyze(context: AnalysisContext): Promise<AnalysisOutput> {
    log.info("Starting AI analysis");

    const result = await this.strategy.analyze(context);

    const riskScore = this.calculateRiskScore(result.comments);

    const summary =
      result.comments.length > 0
        ? `Found ${result.comments.length} issues across ${new Set(result.comments.map((c) => c.filePath)).size} files.`
        : "No issues found.";

    const ruleResults = result.metadata.ruleResults as StrategyResult | undefined;
    const llmResults = result.metadata.llmResults as StrategyResult | undefined;

    return {
      summary,
      riskScore,
      comments: result.comments,
      pipeline: {
        context,
        ruleResults: ruleResults ?? { comments: [], metadata: {} },
        llmResults: llmResults ?? { comments: [], metadata: {} },
      },
    };
  }

  private calculateRiskScore(
    comments: AnalysisOutput["comments"]
  ): RiskScore {
    if (comments.length === 0) {
      return {
        overall: 0,
        level: "low",
        breakdown: {
          security: 0,
          quality: 0,
          performance: 0,
          maintainability: 0,
        },
      };
    }

    const weights = { CRITICAL: 10, ERROR: 5, WARNING: 2, INFO: 0.5 };
    const categoryScores: Record<string, number> = {
      security: 0,
      quality: 0,
      performance: 0,
      maintainability: 0,
    };

    for (const comment of comments) {
      const weight = weights[comment.severity] ?? 1;
      const category = comment.category as keyof typeof categoryScores;
      if (category in categoryScores) {
        categoryScores[category] += weight;
      }
    }

    const total = Object.values(categoryScores).reduce((a, b) => a + b, 0);
    const overall = Math.min(100, Math.round(total));

    const level: RiskScore["level"] =
      overall >= 70
        ? "critical"
        : overall >= 40
          ? "high"
          : overall >= 15
            ? "medium"
            : "low";

    return {
      overall,
      level,
      breakdown: {
        security: Math.min(100, Math.round(categoryScores.security)),
        quality: Math.min(100, Math.round(categoryScores.quality)),
        performance: Math.min(100, Math.round(categoryScores.performance)),
        maintainability: Math.min(
          100,
          Math.round(categoryScores.maintainability)
        ),
      },
    };
  }
}

export const aiEngine = new AIEngine();
