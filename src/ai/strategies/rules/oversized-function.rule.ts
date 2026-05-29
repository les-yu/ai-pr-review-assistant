import type { Rule, RuleFinding } from "./rule.interface";
import type { CodeChunk } from "@/ai/context/context.types";

/**
 * Detects functions that exceed a configurable line threshold.
 * Long functions are harder to understand, test, and maintain.
 */
export class OversizedFunctionRule implements Rule {
  readonly id = "oversized-function";
  readonly name = "Oversized Function";
  readonly description = "Detects functions exceeding the line threshold";
  readonly severity = "WARNING" as const;
  readonly category = "maintainability";
  readonly enabled = true;

  private readonly THRESHOLD = 50;

  private readonly FUNCTION_PATTERNS = [
    /(?:function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>|\w+\s*=>))/,
    /(?:async\s+)?(?:function\s+\w+|(?:get|set)\s+\w+)\s*\(/,
    /^\s*(?:public|private|protected|static)\s+(?:async\s+)?\w+\s*\(/,
    /(?:def\s+\w+|class\s+\w+)/, // Python
  ];

  apply(chunk: CodeChunk): RuleFinding[] {
    if (chunk.type !== "diff") return [];

    const findings: RuleFinding[] = [];
    const lines = chunk.content.split("\n");

    // Count added lines (actual code changes)
    const addedLines = lines.filter((l) => l.startsWith("+")).length;

    // Only flag if the chunk itself is very large
    if (addedLines >= this.THRESHOLD) {
      findings.push({
        ruleId: this.id,
        ruleName: this.name,
        filePath: chunk.filePath,
        lineStart: chunk.startLine,
        lineEnd: chunk.endLine,
        severity: this.severity,
        category: this.category,
        message: `This change adds ${addedLines} lines, exceeding the ${this.THRESHOLD}-line threshold. Consider breaking it into smaller functions.`,
        suggestion: "Extract logical sections into well-named helper functions.",
      });
    }

    return findings;
  }
}
