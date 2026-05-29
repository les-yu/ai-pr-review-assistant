import { createLogger } from "@/infrastructure/logger/logger";
import type { PRData } from "@/types/github";
import type { AnalysisResult } from "@/types/analysis";
import { buildContext } from "@/ai/context/context-builder";
import { aiEngine } from "@/ai/engine";
import {
  findOrCreatePR,
  createAnalysis,
  updateAnalysisStatus,
  saveAnalysisResult,
  saveAnalysisError,
  saveIntermediateResults,
  getAnalysisById,
} from "./analysis.repository";

const log = createLogger("analysis.service");

export async function startAnalysis(prData: PRData): Promise<string> {
  if (!prData.info?.url) {
    throw new Error("PR data must include info.url");
  }
  if (!prData.files || !Array.isArray(prData.files)) {
    throw new Error("PR data must include a files array");
  }

  log.info({ prUrl: prData.info.url }, "Starting analysis");

  const pr = await findOrCreatePR(prData);
  const analysisId = await createAnalysis(pr.id);

  runAnalysisPipeline(analysisId, prData).catch((err) => {
    log.error({ err, analysisId }, "Analysis pipeline failed");
  });

  return analysisId;
}

async function runAnalysisPipeline(
  analysisId: string,
  prData: PRData
): Promise<void> {
  try {
    await updateAnalysisStatus(analysisId, "ANALYZING");

    const context = await buildContext(prData);

    await saveIntermediateResults(analysisId, {
      contextData: context as unknown as Record<string, unknown>,
    });

    const result = await aiEngine.analyze(context);

    if (result.pipeline) {
      await saveIntermediateResults(analysisId, {
        ruleResults: result.pipeline.ruleResults as unknown as Record<string, unknown>,
        llmResults: result.pipeline.llmResults as unknown as Record<string, unknown>,
      });
    }

    await saveAnalysisResult(analysisId, result);

    log.info({ analysisId }, "Analysis completed");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await saveAnalysisError(analysisId, message);
    log.error({ err: error, analysisId }, "Analysis failed");
  }
}

export async function getAnalysisResult(
  analysisId: string
): Promise<AnalysisResult | null> {
  if (!analysisId || typeof analysisId !== "string") {
    throw new Error("analysisId must be a non-empty string");
  }
  return getAnalysisById(analysisId);
}
