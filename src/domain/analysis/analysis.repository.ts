import { prisma } from "@/infrastructure/db/prisma";
import { createLogger } from "@/infrastructure/logger/logger";
import type { PRData } from "@/types/github";
import type { AnalysisResult, ReviewCommentData, RiskScore } from "@/types/analysis";
import type { AnalysisStatus, Prisma } from "@/generated/prisma/client";

const log = createLogger("analysis.repository");

export async function findOrCreatePR(prData: PRData) {
  const { info } = prData;

  return prisma.pullRequest.upsert({
    where: {
      owner_repo_prNumber: {
        owner: info.owner,
        repo: info.repo,
        prNumber: info.prNumber,
      },
    },
    update: {
      title: info.title,
      description: info.description,
      state: info.state,
      diffData: prData.diff as unknown as Prisma.InputJsonValue,
      filesData: prData.files as unknown as Prisma.InputJsonValue,
      commitsData: prData.commits as unknown as Prisma.InputJsonValue,
    },
    create: {
      url: info.url,
      owner: info.owner,
      repo: info.repo,
      prNumber: info.prNumber,
      title: info.title,
      description: info.description,
      author: info.author,
      state: info.state,
      baseBranch: info.baseBranch,
      headBranch: info.headBranch,
      diffData: prData.diff as unknown as Prisma.InputJsonValue,
      filesData: prData.files as unknown as Prisma.InputJsonValue,
      commitsData: prData.commits as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function createAnalysis(prId: string): Promise<string> {
  const analysis = await prisma.analysis.create({
    data: { prId },
  });
  log.info({ analysisId: analysis.id }, "Analysis created");
  return analysis.id;
}

export async function updateAnalysisStatus(
  analysisId: string,
  status: AnalysisStatus
) {
  return prisma.analysis.update({
    where: { id: analysisId },
    data: { status },
  });
}

export async function saveAnalysisResult(
  analysisId: string,
  result: {
    summary: string;
    riskScore: RiskScore;
    comments: ReviewCommentData[];
  }
) {
  return prisma.$transaction([
    prisma.analysis.update({
      where: { id: analysisId },
      data: {
        status: "COMPLETED",
        summary: result.summary,
        riskScore: result.riskScore as unknown as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    }),
    prisma.reviewComment.createMany({
      data: result.comments.map((comment) => ({
        analysisId,
        filePath: comment.filePath,
        lineStart: comment.lineStart,
        lineEnd: comment.lineEnd,
        severity: comment.severity,
        category: comment.category,
        message: comment.message,
        suggestion: comment.suggestion,
        ruleId: comment.ruleId,
        source: comment.source,
        metadata: comment.metadata as unknown as Prisma.InputJsonValue,
      })),
    }),
  ]);
}

export async function saveAnalysisError(
  analysisId: string,
  errorMessage: string
) {
  return prisma.analysis.update({
    where: { id: analysisId },
    data: {
      status: "FAILED",
      errorMessage,
    },
  });
}

export async function getAnalysisById(
  analysisId: string
): Promise<AnalysisResult | null> {
  const analysis = await prisma.analysis.findUnique({
    where: { id: analysisId },
    include: { comments: true, pr: true },
  });

  if (!analysis) return null;

  return {
    id: analysis.id,
    status: analysis.status as AnalysisResult["status"],
    riskScore: analysis.riskScore as unknown as RiskScore | null,
    summary: analysis.summary,
    comments: analysis.comments.map((c) => ({
      filePath: c.filePath,
      lineStart: c.lineStart ?? undefined,
      lineEnd: c.lineEnd ?? undefined,
      severity: c.severity,
      category: c.category,
      message: c.message,
      suggestion: c.suggestion ?? undefined,
      ruleId: c.ruleId ?? undefined,
      source: c.source as "rule" | "llm",
      metadata: (c.metadata as Record<string, unknown>) ?? undefined,
    })),
    completedAt: analysis.completedAt,
    errorMessage: analysis.errorMessage,
  };
}
