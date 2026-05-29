import { createLogger } from "@/infrastructure/logger/logger";
import type { PRData } from "@/types/github";
import type { AnalysisResult } from "@/types/analysis";
import {
  findOrCreatePR,
  createAnalysis,
  updateAnalysisStatus,
  saveAnalysisResult,
  saveAnalysisError,
  getAnalysisById,
} from "./analysis.repository";

const log = createLogger("analysis.service");

/**
 * Core orchestration service for the PR analysis workflow.
 *
 * Flow: Fetch PR → Build Context → Run Rule Engine → Run LLM → Persist Results
 *
 * Each stage delegates to its respective module:
 * - integrations/github for PR data fetching
 * - ai/context for context building
 * - ai/engine for analysis (rule + LLM)
 */
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

    // Stage 1: Build context (implemented in ai/context)
    // const context = await buildContext(prData);

    // Stage 2: Run rule engine (implemented in ai/strategies)
    // const ruleFindings = await runRuleEngine(context);

    // Stage 3: Run LLM analysis (implemented in ai/engine)
    // const llmResult = await runLLMAnalysis(context);

    // Stage 4: Merge results (implemented in ai/engine)
    // const merged = mergeResults(ruleFindings, llmResult);

    // Placeholder: will be replaced with actual pipeline
    await saveAnalysisResult(analysisId, {
      summary: "Analysis pipeline placeholder - not yet implemented",
      riskScore: {
        overall: 0,
        level: "low",
        breakdown: { security: 0, quality: 0, performance: 0, maintainability: 0 },
      },
      comments: [],
    });

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
