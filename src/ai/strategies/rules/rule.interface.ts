import type { CommentSeverity } from "@/generated/prisma/client";
import type { CodeChunk } from "@/ai/context/context.types";

export interface Rule {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly severity: CommentSeverity;
  readonly category: string;
  readonly enabled: boolean;

  apply(chunk: CodeChunk): RuleFinding[];
}

export interface RuleFinding {
  ruleId: string;
  ruleName: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  severity: CommentSeverity;
  category: string;
  message: string;
  suggestion?: string;
}
