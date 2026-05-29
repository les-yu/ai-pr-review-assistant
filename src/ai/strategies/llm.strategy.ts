import { createLogger } from "@/infrastructure/logger/logger";
import type { AnalysisContext } from "@/ai/context/context.types";
import type { LLMStrategy, StrategyResult } from "./strategy.interface";
import type { LLMProvider } from "@/ai/providers/provider.interface";
import type { ReviewCommentData } from "@/types/analysis";
import { renderPrompt } from "@/ai/prompts/renderer";
import { reviewPrompt } from "@/ai/prompts/review.prompt";

const log = createLogger("llm.strategy");

export class LLMAnalysisStrategy implements LLMStrategy {
  readonly name = "llm-analyzer";
  readonly type = "llm" as const;

  constructor(private provider: LLMProvider) {}

  async analyze(context: AnalysisContext): Promise<StrategyResult> {
    log.info({ chunkCount: context.chunks.length }, "Running LLM analysis");

    const allComments: ReviewCommentData[] = [];
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;

    // Process each file context
    for (const fileCtx of context.fileContexts) {
      const filename = fileCtx.file.filename;
      const language = fileCtx.language;
      const diff = fileCtx.chunks
        .map((c) => c.content)
        .join("\n");
      const surroundingContext = fileCtx.chunks
        .filter((c) => c.type === "surrounding")
        .map((c) => c.content)
        .join("\n");

      if (!diff.trim()) continue;

      const rendered = renderPrompt(reviewPrompt, {
        filename,
        language,
        diff,
        context: surroundingContext || "(no surrounding context)",
      });

      try {
        const response = await this.provider.chat({
          systemPrompt: rendered.systemPrompt,
          userPrompt: rendered.userPrompt,
          responseFormat: "json",
          temperature: 0.1,
        });

        totalPromptTokens += response.usage.promptTokens;
        totalCompletionTokens += response.usage.completionTokens;

        const comments = parseReviewComments(response.content, filename);
        allComments.push(...comments);
      } catch (err) {
        log.warn(
          { err, filename },
          "LLM analysis failed for file"
        );
      }
    }

    log.info(
      {
        commentCount: allComments.length,
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
      },
      "LLM analysis complete"
    );

    return {
      comments: allComments,
      metadata: {
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        filesAnalyzed: context.fileContexts.length,
      },
    };
  }
}

function parseReviewComments(
  raw: string,
  defaultFilePath: string
): ReviewCommentData[] {
  try {
    const parsed = JSON.parse(raw);

    // Handle both array and single object responses
    const items = Array.isArray(parsed) ? parsed : [parsed];

    return items.map((item: Record<string, unknown>) => ({
      filePath: typeof item.filePath === "string" ? item.filePath : defaultFilePath,
      lineStart: typeof item.lineStart === "number" ? item.lineStart : undefined,
      lineEnd: typeof item.lineEnd === "number" ? item.lineEnd : undefined,
      severity: normalizeSeverity(item.severity),
      category: typeof item.category === "string" ? item.category : "quality",
      message: typeof item.message === "string" ? item.message : "No message provided",
      suggestion: typeof item.suggestion === "string" ? item.suggestion : undefined,
      source: "llm" as const,
    }));
  } catch {
    log.warn("Failed to parse LLM response as JSON, returning empty");
    return [];
  }
}

function normalizeSeverity(raw: unknown): ReviewCommentData["severity"] {
  const valid: ReviewCommentData["severity"][] = [
    "CRITICAL",
    "ERROR",
    "WARNING",
    "INFO",
  ];
  if (typeof raw === "string") {
    const upper = raw.toUpperCase();
    if (valid.includes(upper as ReviewCommentData["severity"])) {
      return upper as ReviewCommentData["severity"];
    }
  }
  return "WARNING";
}
