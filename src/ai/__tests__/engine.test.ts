import { describe, it, expect } from "vitest";
import { AIEngine } from "../engine";
import type { AnalysisStrategy, StrategyResult } from "../strategies/strategy.interface";
import type { AnalysisContext, CodeChunk } from "../context/context.types";
import type { ReviewCommentData } from "@/types/analysis";

function makeStrategy(result: StrategyResult): AnalysisStrategy {
  return {
    name: "mock",
    type: "composite",
    analyze: async () => result,
  };
}

function makeComment(
  overrides: Partial<ReviewCommentData> = {}
): ReviewCommentData {
  return {
    filePath: "src/app.ts",
    lineStart: 10,
    severity: "WARNING",
    category: "quality",
    message: "test issue",
    source: "rule",
    ...overrides,
  };
}

function makeContext(): AnalysisContext {
  const chunk: CodeChunk = {
    id: "test:0",
    filePath: "src/app.ts",
    content: "const x = 1;",
    startLine: 1,
    endLine: 1,
    type: "diff",
    language: "typescript",
    priority: 50,
  };
  return {
    chunks: [chunk],
    fileContexts: [],
    metadata: {
      totalTokens: 100,
      tokenBudget: 8000,
      fileCount: 1,
      chunkCount: 1,
      truncatedFiles: [],
    },
  };
}

describe("AIEngine", () => {
  it("returns low risk and no-issues summary when no comments", async () => {
    const engine = new AIEngine(makeStrategy({ comments: [], metadata: {} }));

    const result = await engine.analyze(makeContext());

    expect(result.riskScore.overall).toBe(0);
    expect(result.riskScore.level).toBe("low");
    expect(result.summary).toBe("No issues found.");
  });

  it("calculates risk score from comments", async () => {
    const comments = [
      makeComment({ severity: "CRITICAL", category: "security" }),
      makeComment({ severity: "ERROR", category: "quality" }),
    ];
    const engine = new AIEngine(makeStrategy({ comments, metadata: {} }));

    const result = await engine.analyze(makeContext());

    expect(result.riskScore.overall).toBeGreaterThan(0);
    expect(result.riskScore.breakdown.security).toBeGreaterThan(0);
    expect(result.riskScore.breakdown.quality).toBeGreaterThan(0);
  });

  it("generates summary with issue count and file count", async () => {
    const comments = [
      makeComment({ filePath: "a.ts", severity: "WARNING" }),
      makeComment({ filePath: "b.ts", severity: "ERROR" }),
      makeComment({ filePath: "a.ts", severity: "INFO" }),
    ];
    const engine = new AIEngine(makeStrategy({ comments, metadata: {} }));

    const result = await engine.analyze(makeContext());

    expect(result.summary).toContain("3 issues");
    expect(result.summary).toContain("2 files");
  });

  it("returns medium risk for moderate issues", async () => {
    const comments = Array.from({ length: 10 }, () =>
      makeComment({ severity: "WARNING" })
    );
    const engine = new AIEngine(makeStrategy({ comments, metadata: {} }));

    const result = await engine.analyze(makeContext());

    expect(result.riskScore.level).toBe("medium");
  });

  it("returns high risk for many errors", async () => {
    const comments = Array.from({ length: 10 }, () =>
      makeComment({ severity: "ERROR", category: "security" })
    );
    const engine = new AIEngine(makeStrategy({ comments, metadata: {} }));

    const result = await engine.analyze(makeContext());

    expect(result.riskScore.level === "high" || result.riskScore.level === "critical").toBe(true);
  });

  it("caps risk score at 100", async () => {
    const comments = Array.from({ length: 50 }, () =>
      makeComment({ severity: "CRITICAL", category: "security" })
    );
    const engine = new AIEngine(makeStrategy({ comments, metadata: {} }));

    const result = await engine.analyze(makeContext());

    expect(result.riskScore.overall).toBeLessThanOrEqual(100);
    expect(result.riskScore.breakdown.security).toBeLessThanOrEqual(100);
  });

  it("returns all risk breakdown categories", async () => {
    const comments = [
      makeComment({ category: "security" }),
      makeComment({ category: "quality" }),
      makeComment({ category: "performance" }),
      makeComment({ category: "maintainability" }),
    ];
    const engine = new AIEngine(makeStrategy({ comments, metadata: {} }));

    const result = await engine.analyze(makeContext());

    expect(result.riskScore.breakdown).toHaveProperty("security");
    expect(result.riskScore.breakdown).toHaveProperty("quality");
    expect(result.riskScore.breakdown).toHaveProperty("performance");
    expect(result.riskScore.breakdown).toHaveProperty("maintainability");
  });

  it("includes pipeline results with context and strategy outputs", async () => {
    const engine = new AIEngine(makeStrategy({ comments: [], metadata: {} }));
    const context = makeContext();

    const result = await engine.analyze(context);

    expect(result.pipeline).toBeDefined();
    expect(result.pipeline!.context).toBe(context);
    expect(result.pipeline!.ruleResults).toEqual({ comments: [], metadata: {} });
    expect(result.pipeline!.llmResults).toEqual({ comments: [], metadata: {} });
  });
});
