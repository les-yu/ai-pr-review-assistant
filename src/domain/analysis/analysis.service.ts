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
  getAnalysisById,
} from "./analysis.repository";

const log = createLogger("analysis.service");

export async function startAnalysis(prData: PRData): Promise<string> {
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
    const result = await aiEngine.analyze(context);

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
  return getAnalysisById(analysisId);
}
