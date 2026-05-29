import type { Rule, RuleFinding } from "./rule.interface";
import type { CodeChunk } from "@/ai/context/context.types";

/**
 * Detects calls to dangerous functions like eval(), exec(), spawn(), etc.
 * These functions can execute arbitrary code and are security risks.
 */
export class DangerousFunctionRule implements Rule {
  readonly id = "dangerous-function";
  readonly name = "Dangerous Function";
  readonly description = "Detects calls to dangerous functions (eval, exec, spawn)";
  readonly severity = "ERROR" as const;
  readonly category = "security";
  readonly enabled = true;

  private readonly DANGEROUS_PATTERNS = [
    { pattern: /\beval\s*\(/, name: "eval()" },
    { pattern: /\bnew\s+Function\s*\(/, name: "new Function()" },
    { pattern: /\bexec\s*\(/, name: "exec()" },
    { pattern: /\bspawn\s*\(/, name: "spawn()" },
    { pattern: /\bexecSync\s*\(/, name: "execSync()" },
    { pattern: /\bexecFile\s*\(/, name: "execFile()" },
    { pattern: /\b__import__\s*\(/, name: "__import__()" },
    { pattern: /\bsubprocess\b/, name: "subprocess" },
  ];

  private readonly CONTEXT_PATTERNS = [
    /\/\/.*/,           // line comments
    /\/\*[\s\S]*?\*\//, // block comments
    /\*.*$/,            // JSDoc lines
    /console\.log/,     // logging about eval is not the same as using it
  ];

  apply(chunk: CodeChunk): RuleFinding[] {
    if (chunk.type !== "diff") return [];

    const findings: RuleFinding[] = [];
    const lines = chunk.content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.startsWith("+")) continue;

      const code = line.slice(1);

      // Skip comment-only lines
      if (this.CONTEXT_PATTERNS.some((p) => p.test(code.trim()))) continue;

      for (const { pattern, name } of this.DANGEROUS_PATTERNS) {
        if (pattern.test(code)) {
          findings.push({
            ruleId: this.id,
            ruleName: this.name,
            filePath: chunk.filePath,
            lineStart: chunk.startLine + i,
            lineEnd: chunk.startLine + i,
            severity: this.severity,
            category: this.category,
            message: `Use of dangerous function ${name} detected. This can execute arbitrary code.`,
            suggestion: `Avoid ${name}. Use safer alternatives (e.g., Function constructor for eval, child_process.execFile with args array for exec).`,
          });
          break; // one finding per line
        }
      }
    }

    return findings;
  }
}
