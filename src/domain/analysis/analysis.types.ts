import type { PRData } from "@/types/github";
import type { ReviewCommentData, RiskScore } from "@/types/analysis";
import type { AnalysisStatus } from "@/generated/prisma/client";

export interface AnalysisContext {
  prData: PRData;
  analysisId: string;
}

export interface AnalysisOutput {
  summary: string;
  riskScore: RiskScore;
  comments: ReviewCommentData[];
}

export interface AnalysisRecord {
  id: string;
  prId: string;
  status: AnalysisStatus;
  riskScore: RiskScore | null;
  summary: string | null;
  comments: ReviewCommentData[];
  completedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}
