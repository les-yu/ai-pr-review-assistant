import type { Rule, RuleFinding } from "./rule.interface";
import type { CodeChunk } from "@/ai/context/context.types";

/**
 * Detects TODO, FIXME, HACK, XXX, and WORKAROUND markers in code.
 * These markers indicate known issues or technical debt.
 */
export class TodoFixmeRule implements Rule {
  readonly id = "todo-fixme";
  readonly name = "TODO/FIXME Marker";
  readonly description = "Detects TODO, FIXME, HACK, XXX markers";
  readonly severity = "INFO" as const;
  readonly category = "quality";
  readonly enabled = true;

  private readonly MARKER_PATTERN =
    /(?:\/\/|\/\*|#|--)\s*(TODO|FIXME|HACK|XXX|WORKAROUND)\b\s*:?\s*(.*)/i;

  apply(chunk: CodeChunk): RuleFinding[] {
    if (chunk.type !== "diff") return [];

    const findings: RuleFinding[] = [];
    const lines = chunk.content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.startsWith("+")) continue;

      const code = line.slice(1);
      const match = code.match(this.MARKER_PATTERN);

      if (match) {
        const marker = match[1].toUpperCase();
        const note = match[2]?.trim() || "No description provided";

        findings.push({
          ruleId: this.id,
          ruleName: this.name,
          filePath: chunk.filePath,
          lineStart: chunk.startLine + i,
          lineEnd: chunk.startLine + i,
          severity: this.severity,
          category: this.category,
          message: `${marker} found: ${note}`,
          suggestion: marker === "FIXME" || marker === "HACK"
            ? "Address this before merging or create a tracking issue."
            : undefined,
        });
      }
    }

    return findings;
  }
}
