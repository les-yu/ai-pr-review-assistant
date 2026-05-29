import type { Rule, RuleFinding } from "./rule.interface";
import type { CodeChunk } from "@/ai/context/context.types";

/**
 * Detects empty or effectively empty catch blocks.
 * Swallowing exceptions silently hides bugs and makes debugging difficult.
 */
export class EmptyCatchRule implements Rule {
  readonly id = "empty-catch";
  readonly name = "Empty Catch Block";
  readonly description = "Detects catch blocks with no error handling";
  readonly severity = "WARNING" as const;
  readonly category = "quality";
  readonly enabled = true;

  apply(chunk: CodeChunk): RuleFinding[] {
    if (chunk.type !== "diff") return [];

    const findings: RuleFinding[] = [];
    const lines = chunk.content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.startsWith("+")) continue;

      const code = line.slice(1).trim();

      // Match catch block opening
      if (!/catch\s*(?:\([^)]*\))?\s*\{/.test(code)) continue;

      // If catch opens and closes on the same line: catch (e) {}
      if (/catch\s*(?:\([^)]*\))?\s*\{\s*\}/.test(code)) {
        findings.push(this.makeFinding(chunk, i, 1));
        continue;
      }

      // Multi-line catch: check if the next lines are only comments/empty
      const body = this.extractCatchBody(lines, i + 1);
      if (this.isEffectivelyEmpty(body)) {
        findings.push(this.makeFinding(chunk, i, body.length + 2));
      }
    }

    return findings;
  }

  private extractCatchBody(lines: string[], startIndex: number): string[] {
    const body: string[] = [];

    for (let j = startIndex; j < lines.length && j < startIndex + 20; j++) {
      const raw = lines[j];
      const code = raw.startsWith("+") ? raw.slice(1) : raw;
      const trimmed = code.trim();

      // Stop at closing brace
      if (trimmed === "}" || trimmed.startsWith("}")) break;

      body.push(trimmed);
    }

    return body;
  }

  private isEffectivelyEmpty(body: string[]): boolean {
    if (body.length === 0) return true;
    const meaningful = body.filter(
      (line) => line !== "" && !line.startsWith("//") && !line.startsWith("/*") && !line.startsWith("*")
    );
    return meaningful.length === 0;
  }

  private makeFinding(chunk: CodeChunk, lineIndex: number, span: number): RuleFinding {
    return {
      ruleId: this.id,
      ruleName: this.name,
      filePath: chunk.filePath,
      lineStart: chunk.startLine + lineIndex,
      lineEnd: chunk.startLine + lineIndex + span,
      severity: this.severity,
      category: this.category,
      message: "Empty catch block silently swallows errors.",
      suggestion: "Log the error, rethrow, or add a comment explaining why the error is intentionally ignored.",
    };
  }
}
