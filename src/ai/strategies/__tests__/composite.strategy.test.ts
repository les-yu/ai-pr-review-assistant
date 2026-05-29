import { describe, it, expect } from "vitest";
import { CompositeAnalysisStrategy } from "../composite.strategy";
import type { AnalysisStrategy, StrategyResult } from "../strategy.interface";
import type { AnalysisContext, CodeChunk } from "@/ai/context/context.types";
import type { ReviewCommentData } from "@/types/analysis";

function makeStrategy(result: StrategyResult): AnalysisStrategy {
  return {
    name: "mock",
    type: "rule",
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

describe("CompositeAnalysisStrategy", () => {
  it("merges rule and LLM comments", async () => {
    const ruleComment = makeComment({
      filePath: "a.ts",
      lineStart: 1,
      message: "rule finding",
    });
    const llmComment = makeComment({
      filePath: "b.ts",
      lineStart: 5,
      message: "llm finding",
      source: "llm",
    });

    const strategy = new CompositeAnalysisStrategy(
      makeStrategy({ comments: [ruleComment], metadata: {} }),
      makeStrategy({ comments: [llmComment], metadata: {} })
    );

    const result = await strategy.analyze(makeContext());

    expect(result.comments).toHaveLength(2);
  });

  it("LLM overrides rule on same file+line", async () => {
    const ruleComment = makeComment({
      filePath: "a.ts",
      lineStart: 10,
      message: "rule says warning",
      severity: "WARNING",
      source: "rule",
    });
    const llmComment = makeComment({
      filePath: "a.ts",
      lineStart: 10,
      message: "llm says critical",
      severity: "CRITICAL",
      source: "llm",
    });

    const strategy = new CompositeAnalysisStrategy(
      makeStrategy({ comments: [ruleComment], metadata: {} }),
      makeStrategy({ comments: [llmComment], metadata: {} })
    );

    const result = await strategy.analyze(makeContext());

    expect(result.comments).toHaveLength(1);
    expect(result.comments[0].message).toBe("llm says critical");
    expect(result.comments[0].severity).toBe("CRITICAL");
  });

  it("returns rule comments when LLM returns empty", async () => {
    const ruleComment = makeComment({ message: "only rule" });

    const strategy = new CompositeAnalysisStrategy(
      makeStrategy({ comments: [ruleComment], metadata: {} }),
      makeStrategy({ comments: [], metadata: {} })
    );

    const result = await strategy.analyze(makeContext());

    expect(result.comments).toHaveLength(1);
    expect(result.comments[0].message).toBe("only rule");
  });

  it("returns LLM comments when rule returns empty", async () => {
    const llmComment = makeComment({ message: "only llm", source: "llm" });

    const strategy = new CompositeAnalysisStrategy(
      makeStrategy({ comments: [], metadata: {} }),
      makeStrategy({ comments: [llmComment], metadata: {} })
    );

    const result = await strategy.analyze(makeContext());

    expect(result.comments).toHaveLength(1);
    expect(result.comments[0].message).toBe("only llm");
  });

  it("returns empty when both strategies return empty", async () => {
    const strategy = new CompositeAnalysisStrategy(
      makeStrategy({ comments: [], metadata: {} }),
      makeStrategy({ comments: [], metadata: {} })
    );

    const result = await strategy.analyze(makeContext());

    expect(result.comments).toHaveLength(0);
  });

  it("includes ruleCount and llmCount in metadata", async () => {
    const ruleComments = [
      makeComment({ filePath: "a.ts", lineStart: 1 }),
      makeComment({ filePath: "a.ts", lineStart: 2 }),
    ];
    const llmComments = [makeComment({ filePath: "b.ts", lineStart: 1 })];

    const strategy = new CompositeAnalysisStrategy(
      makeStrategy({ comments: ruleComments, metadata: {} }),
      makeStrategy({ comments: llmComments, metadata: {} })
    );

    const result = await strategy.analyze(makeContext());

    expect(result.metadata.ruleCount).toBe(2);
    expect(result.metadata.llmCount).toBe(1);
  });

  it("deduplicates rule comments on same file+line (keeps last)", async () => {
    const rule1 = makeComment({
      filePath: "a.ts",
      lineStart: 5,
      message: "first rule",
      source: "rule",
    });
    const rule2 = makeComment({
      filePath: "a.ts",
      lineStart: 5,
      message: "second rule",
      source: "rule",
    });

    const strategy = new CompositeAnalysisStrategy(
      makeStrategy({ comments: [rule1, rule2], metadata: {} }),
      makeStrategy({ comments: [], metadata: {} })
    );

    const result = await strategy.analyze(makeContext());

    expect(result.comments).toHaveLength(1);
    expect(result.comments[0].message).toBe("second rule");
  });

  it("preserves comments from different files", async () => {
    const comments = [
      makeComment({ filePath: "a.ts", lineStart: 1 }),
      makeComment({ filePath: "b.ts", lineStart: 1 }),
      makeComment({ filePath: "c.ts", lineStart: 1 }),
    ];

    const strategy = new CompositeAnalysisStrategy(
      makeStrategy({ comments, metadata: {} }),
      makeStrategy({ comments: [], metadata: {} })
    );

    const result = await strategy.analyze(makeContext());

    expect(result.comments).toHaveLength(3);
  });
});
