import type { AnalysisContext } from "@/ai/context/context.types";
import type { RuleStrategy, StrategyResult, RuleDefinition } from "./strategy.interface";

/**
 * Rule-based static analysis strategy.
 *
 * Detects common code issues without LLM:
 * - SQL injection patterns
 * - Hardcoded secrets/passwords
 * - TODO/FIXME markers
 * - Missing error handling
 * - Oversized functions
 * - Magic numbers
 * - Null pointer risks
 * - Code duplication signals
 */
export class RuleAnalysisStrategy implements RuleStrategy {
  readonly name = "rule-engine";
  readonly type = "rule" as const;

  private rules: RuleDefinition[] = [
    {
      id: "hardcoded-secret",
      name: "Hardcoded Secret",
      description: "Detects potential hardcoded secrets, passwords, or API keys",
      severity: "CRITICAL",
      category: "security",
      enabled: true,
    },
    {
      id: "sql-injection",
      name: "SQL Injection Risk",
      description: "Detects potential SQL injection via string concatenation",
      severity: "CRITICAL",
      category: "security",
      enabled: true,
    },
    {
      id: "todo-fixme",
      name: "TODO/FIXME",
      description: "Detects TODO and FIXME comments",
      severity: "INFO",
      category: "quality",
      enabled: true,
    },
    {
      id: "missing-error-handling",
      name: "Missing Error Handling",
      description: "Detects try/catch blocks with empty catch or missing handling",
      severity: "WARNING",
      category: "quality",
      enabled: true,
    },
    {
      id: "oversized-function",
      name: "Oversized Function",
      description: "Detects functions exceeding line threshold",
      severity: "WARNING",
      category: "maintainability",
      enabled: true,
    },
    {
      id: "magic-number",
      name: "Magic Number",
      description: "Detects unexplained numeric literals",
      severity: "INFO",
      category: "quality",
      enabled: true,
    },
  ];

  findRules(): RuleDefinition[] {
    return this.rules;
  }

  async analyze(context: AnalysisContext): Promise<StrategyResult> {
    // TODO: Implement in PR #4
    // Iterate over context.chunks
    // Apply each enabled rule via regex/AST
    // Collect findings into ReviewCommentData[]
    return { comments: [], metadata: { rulesApplied: 0 } };
  }
}
