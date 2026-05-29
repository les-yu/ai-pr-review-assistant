import type { PRData } from "@/types/github";
import type { ReviewCommentData, RiskScore } from "@/types/analysis";
import type { AnalysisStatus } from "@/generated/prisma/client";
import type { AnalysisContext as AIContext } from "@/ai/context/context.types";
import type { StrategyResult } from "@/ai/strategies/strategy.interface";

export interface AnalysisContext {
  prData: PRData;
  analysisId: string;
}

export interface PipelineResults {
  context: AIContext;
  ruleResults: StrategyResult;
  llmResults: StrategyResult;
}

export interface AnalysisOutput {
  summary: string;
  riskScore: RiskScore;
  comments: ReviewCommentData[];
  pipeline?: PipelineResults;
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
