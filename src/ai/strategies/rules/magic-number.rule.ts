import type { Rule, RuleFinding } from "./rule.interface";
import type { CodeChunk } from "@/ai/context/context.types";

/**
 * Detects unexplained numeric literals (magic numbers) in code.
 * Magic numbers make code harder to understand and maintain.
 *
 * Ignores: 0, 1, -1, common percentages (100), array indices, and
 * numbers in variable declarations that suggest they're named constants.
 */
export class MagicNumberRule implements Rule {
  readonly id = "magic-number";
  readonly name = "Magic Number";
  readonly description = "Detects unexplained numeric literals";
  readonly severity = "INFO" as const;
  readonly category = "quality";
  readonly enabled = true;

  // Order matters: longer operators must come before shorter ones
  // (=== before == before =, !== before !=)
  private readonly MAGIC_NUMBER_PATTERN =
    /(?:===|!==|==|!=|>=|<=|>|<|\+|-|\*|\/|%|=(?:\s*)(?!==)|:\s*)(-?\d+(?:\.\d+)?)/g;

  private readonly ALLOWED_NUMBERS = new Set([
    "0", "1", "-1", "100", "1000",
    "200", "201", "301", "302", "400", "401", "403", "404", "500", // HTTP status
  ]);

  private readonly CONTEXT_EXCLUSIONS = [
    /(?:case|return|throw)\s+\d/,     // switch case, return code
    /\[\d+\]/,                         // array index
    /(?:0x[0-9a-fA-F]+|0b[01]+|0o[0-7]+)/, // hex/bin/oct literals
    /\d+\s*(?:px|em|rem|%|ms|s|deg)/,  // CSS/time units
    /version.*\d+\.\d+/,              // version numbers
    /(?:port|Port|PORT)\s*[=:]\s*\d/,  // port numbers
  ];

  apply(chunk: CodeChunk): RuleFinding[] {
    if (chunk.type !== "diff") return [];

    const findings: RuleFinding[] = [];
    const lines = chunk.content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.startsWith("+")) continue;

      const code = line.slice(1);
      const trimmed = code.trim();

      // Skip comments and strings-only
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;

      // Skip if excluded context
      if (this.CONTEXT_EXCLUSIONS.some((p) => p.test(code))) continue;

      // Find all numbers in the line
      const matches = [...code.matchAll(this.MAGIC_NUMBER_PATTERN)];

      for (const match of matches) {
        const num = match[1];
        if (this.ALLOWED_NUMBERS.has(num)) continue;

        // Skip if it's a properly named constant (ALL_CAPS with underscores)
        if (/(?:const|let|var)\s+[A-Z][A-Z0-9_]+\s*=\s*\d/.test(trimmed)) continue;

        findings.push({
          ruleId: this.id,
          ruleName: this.name,
          filePath: chunk.filePath,
          lineStart: chunk.startLine + i,
          lineEnd: chunk.startLine + i,
          severity: this.severity,
          category: this.category,
          message: `Magic number ${num} found. Consider using a named constant.`,
          suggestion: `Extract ${num} into a descriptive constant (e.g., const MAX_RETRIES = ${num}).`,
        });
        break; // one finding per line
      }
    }

    return findings;
  }
}
