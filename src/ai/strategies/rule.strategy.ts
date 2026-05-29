import { createLogger } from "@/infrastructure/logger/logger";
import type { AnalysisContext } from "@/ai/context/context.types";
import type { RuleStrategy, StrategyResult } from "./strategy.interface";
import type { RuleFinding, Rule } from "./rules/rule.interface";
import { RuleRegistry } from "./rules/registry";
import { HardcodedSecretRule } from "./rules/hardcoded-secret.rule";
import { SqlInjectionRule } from "./rules/sql-injection.rule";
import { DangerousFunctionRule } from "./rules/dangerous-function.rule";
import { EmptyCatchRule } from "./rules/empty-catch.rule";
import { OversizedFunctionRule } from "./rules/oversized-function.rule";
import { MagicNumberRule } from "./rules/magic-number.rule";
import { TodoFixmeRule } from "./rules/todo-fixme.rule";
import type { ReviewCommentData } from "@/types/analysis";

const log = createLogger("rule.strategy");

/**
 * Rule-based static analysis strategy.
 *
 * Runs all registered rules against each code chunk and collects findings.
 * Rules are independent, deterministic, and require no API calls.
 */
export class RuleAnalysisStrategy implements RuleStrategy {
  readonly name = "rule-engine";
  readonly type = "rule" as const;

  private registry: RuleRegistry;

  constructor() {
    this.registry = new RuleRegistry();
    this.registerDefaultRules();
  }

  private registerDefaultRules(): void {
    const rules: Rule[] = [
      new HardcodedSecretRule(),
      new SqlInjectionRule(),
      new DangerousFunctionRule(),
      new EmptyCatchRule(),
      new OversizedFunctionRule(),
      new MagicNumberRule(),
      new TodoFixmeRule(),
    ];

    for (const rule of rules) {
      this.registry.register(rule);
    }

    log.info({ ruleCount: rules.length }, "Default rules registered");
  }

  async analyze(context: AnalysisContext): Promise<StrategyResult> {
    const enabledRules = this.registry.getEnabled();
    const allFindings: RuleFinding[] = [];

    log.info(
      { ruleCount: enabledRules.length, chunkCount: context.chunks.length },
      "Running rule analysis"
    );

    for (const chunk of context.chunks) {
      for (const rule of enabledRules) {
        try {
          const findings = rule.apply(chunk);
          allFindings.push(...findings);
        } catch (err) {
          log.warn(
            { err, ruleId: rule.id, chunkId: chunk.id },
            "Rule failed on chunk"
          );
        }
      }
    }

    // Deduplicate: same file + line + rule
    const seen = new Set<string>();
    const uniqueFindings = allFindings.filter((f) => {
      const key = `${f.filePath}:${f.lineStart}:${f.ruleId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by severity (critical first), then by file
    const severityOrder = { CRITICAL: 0, ERROR: 1, WARNING: 2, INFO: 3 };
    uniqueFindings.sort(
      (a, b) =>
        (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4) ||
        a.filePath.localeCompare(b.filePath)
    );

    log.info(
      { totalFindings: allFindings.length, uniqueFindings: uniqueFindings.length },
      "Rule analysis complete"
    );

    return {
      comments: uniqueFindings.map(toReviewComment),
      metadata: {
        rulesApplied: enabledRules.length,
        totalFindings: allFindings.length,
        uniqueFindings: uniqueFindings.length,
      },
    };
  }

  getRegistry(): RuleRegistry {
    return this.registry;
  }
}

function toReviewComment(finding: RuleFinding): ReviewCommentData {
  return {
    filePath: finding.filePath,
    lineStart: finding.lineStart,
    lineEnd: finding.lineEnd,
    severity: finding.severity,
    category: finding.category,
    message: `[${finding.ruleName}] ${finding.message}`,
    suggestion: finding.suggestion,
    ruleId: finding.ruleId,
    source: "rule",
  };
}
