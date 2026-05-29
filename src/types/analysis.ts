import type { CommentSeverity } from "@/generated/prisma/client";

export type AnalysisStatusType =
  | "PENDING"
  | "ANALYZING"
  | "COMPLETED"
  | "FAILED";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface RiskScore {
  overall: number;
  level: RiskLevel;
  breakdown: {
    security: number;
    quality: number;
    performance: number;
    maintainability: number;
  };
}

export interface ReviewCommentData {
  filePath: string;
  lineStart?: number;
  lineEnd?: number;
  severity: CommentSeverity;
  category: string;
  message: string;
  suggestion?: string;
  ruleId?: string;
  source: "rule" | "llm";
  metadata?: Record<string, unknown>;
}

export interface AnalysisResult {
  id: string;
  status: AnalysisStatusType;
  riskScore: RiskScore | null;
  summary: string | null;
  comments: ReviewCommentData[];
  completedAt: Date | null;
  errorMessage: string | null;
}

export interface RuleFinding {
  ruleId: string;
  ruleName: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  severity: CommentSeverity;
  message: string;
  suggestion?: string;
}

export interface LLMAnalysisOutput {
  summary: string;
  riskScore: RiskScore;
  comments: ReviewCommentData[];
}
