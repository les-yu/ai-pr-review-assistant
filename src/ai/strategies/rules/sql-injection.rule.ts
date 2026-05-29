import type { Rule, RuleFinding } from "./rule.interface";
import type { CodeChunk } from "@/ai/context/context.types";

/**
 * Detects potential SQL injection via string concatenation or template literals.
 *
 * Matches: SQL keywords combined with string interpolation or concatenation
 * in added lines. Does NOT flag parameterized queries or ORM calls.
 */
export class SqlInjectionRule implements Rule {
  readonly id = "sql-injection";
  readonly name = "SQL Injection Risk";
  readonly description = "Detects potential SQL injection via string concatenation";
  readonly severity = "CRITICAL" as const;
  readonly category = "security";
  readonly enabled = true;

  private readonly SQL_KEYWORDS =
    /(?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|EXEC|UNION)\s/i;

  private readonly INJECTION_PATTERNS = [
    /["'`].*\$\{/,                     // template literal with ${}
    /["'].*\+\s*\w+/,                  // string concat: "..." + var
    /\+\s*["'].*(?:SELECT|INSERT|UPDATE|DELETE)/i, // var + "SELECT..."
    /format\s*\(.*(?:SELECT|INSERT|UPDATE|DELETE)/i, // .format() with SQL
  ];

  private readonly SAFE_PATTERNS = [
    /\?\s*[,\)]/,           // parameterized: WHERE id = ?
    /\$\d+\s*[,\)]/,        // parameterized: WHERE id = $1
    /:\w+/,                  // named params: WHERE id = :id
    /\.query\s*\(/,          // ORM .query() - likely parameterized
    /\.raw\s*\(/,            // Prisma .raw()
    /Prisma\.sql/,           // Prisma tagged template
    /sql`\s*SELECT/,         // tagged template (safe)
  ];

  apply(chunk: CodeChunk): RuleFinding[] {
    if (chunk.type !== "diff") return [];

    const findings: RuleFinding[] = [];
    const lines = chunk.content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.startsWith("+")) continue;

      const code = line.slice(1).trim();

      // Must contain SQL keyword
      if (!this.SQL_KEYWORDS.test(code)) continue;

      // Must have injection pattern
      if (!this.INJECTION_PATTERNS.some((p) => p.test(code))) continue;

      // Skip safe patterns
      if (this.SAFE_PATTERNS.some((p) => p.test(code))) continue;

      findings.push({
        ruleId: this.id,
        ruleName: this.name,
        filePath: chunk.filePath,
        lineStart: chunk.startLine + i,
        lineEnd: chunk.startLine + i,
        severity: this.severity,
        category: this.category,
        message: "Potential SQL injection via string concatenation or template literal.",
        suggestion: "Use parameterized queries (e.g., ? placeholders or $1, $2) instead of string interpolation.",
      });
    }

    return findings;
  }
}
