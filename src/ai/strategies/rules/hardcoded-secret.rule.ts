import type { Rule, RuleFinding } from "./rule.interface";
import type { CodeChunk } from "@/ai/context/context.types";

/**
 * Detects potential hardcoded secrets, passwords, and API keys.
 *
 * Matches: variable assignments where the key contains secret-related
 * keywords and the value is a non-empty string literal.
 *
 * Avoids false positives: env vars, empty strings, hashed values, placeholders.
 */
export class HardcodedSecretRule implements Rule {
  readonly id = "hardcoded-secret";
  readonly name = "Hardcoded Secret";
  readonly description = "Detects potential hardcoded secrets, passwords, or API keys";
  readonly severity = "CRITICAL" as const;
  readonly category = "security";
  readonly enabled = true;

  private readonly SECRET_KEY_PATTERN =
    /(?:password|passwd|secret|token|api[_-]?key|credential|auth[_-]?token|private[_-]?key|access[_-]?key|client[_-]?secret)\s*[=:]/i;

  private readonly SECRET_VALUE_PATTERN =
    /=\s*["']([^"']{8,})["']/;

  private readonly SAFE_PATTERNS = [
    /env\./i,
    /process\.env/i,
    /getenv/i,
    /os\.environ/i,
    /\$\{/,
    /\$\w+/,
    /placeholder/i,
    /example/i,
    /xxx/i,
    /your[_-]?/i,
    /CHANGE_ME/i,
    /TODO/i,
  ];

  apply(chunk: CodeChunk): RuleFinding[] {
    if (chunk.type !== "diff") return [];

    const findings: RuleFinding[] = [];
    const lines = chunk.content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Only check added lines
      if (!line.startsWith("+")) continue;

      const code = line.slice(1).trim();
      if (!this.SECRET_KEY_PATTERN.test(code)) continue;
      if (!this.SECRET_VALUE_PATTERN.test(code)) continue;

      // Skip if it looks like a safe pattern (env var, placeholder)
      if (this.SAFE_PATTERNS.some((p) => p.test(code))) continue;

      findings.push({
        ruleId: this.id,
        ruleName: this.name,
        filePath: chunk.filePath,
        lineStart: chunk.startLine + i,
        lineEnd: chunk.startLine + i,
        severity: this.severity,
        category: this.category,
        message: "Potential hardcoded secret detected. Use environment variables or a secrets manager instead.",
        suggestion: "Replace with process.env.YOUR_SECRET or a vault reference.",
      });
    }

    return findings;
  }
}
