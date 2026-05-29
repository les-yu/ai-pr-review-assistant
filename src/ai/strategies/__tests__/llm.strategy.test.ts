import { describe, it, expect, vi } from "vitest";
import { LLMAnalysisStrategy } from "../llm.strategy";
import type { LLMProvider, LLMChatResponse } from "@/ai/providers/provider.interface";
import type { AnalysisContext, CodeChunk, FileContext } from "@/ai/context/context.types";
import type { ChangedFile } from "@/types/github";

function makeProvider(response: Partial<LLMChatResponse> = {}): LLMProvider {
  return {
    name: "mock",
    chat: vi.fn().mockResolvedValue({
      content: "[]",
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      model: "mock-model",
      ...response,
    }),
  };
}

function makeChunk(overrides: Partial<CodeChunk> = {}): CodeChunk {
  return {
    id: "test:0",
    filePath: "src/app.ts",
    content: "const x = 1;",
    startLine: 1,
    endLine: 1,
    type: "diff",
    language: "typescript",
    priority: 50,
    ...overrides,
  };
}

function makeFile(overrides: Partial<ChangedFile> = {}): ChangedFile {
  return {
    filename: "src/app.ts",
    status: "modified",
    additions: 10,
    deletions: 5,
    changes: 15,
    patch: "",
    ...overrides,
  };
}

function makeContext(chunks: CodeChunk[] = [makeChunk()]): AnalysisContext {
  const file: ChangedFile = makeFile();
  const fileContext: FileContext = {
    file,
    chunks,
    language: "typescript",
    priority: "high",
    priorityScore: 80,
    estimatedTokens: 100,
  };
  return {
    chunks,
    fileContexts: [fileContext],
    metadata: {
      totalTokens: 100,
      tokenBudget: 8000,
      fileCount: 1,
      chunkCount: chunks.length,
      truncatedFiles: [],
    },
  };
}

describe("LLMAnalysisStrategy", () => {
  it("calls provider with rendered prompt", async () => {
    const provider = makeProvider();
    const strategy = new LLMAnalysisStrategy(provider);
    const context = makeContext();

    await strategy.analyze(context);

    expect(provider.chat).toHaveBeenCalledTimes(1);
    const call = (provider.chat as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.systemPrompt).toContain("code reviewer");
    expect(call.userPrompt).toContain("src/app.ts");
    expect(call.userPrompt).toContain("const x = 1;");
    expect(call.responseFormat).toBe("json");
  });

  it("returns empty comments when LLM returns empty array", async () => {
    const provider = makeProvider({ content: "[]" });
    const strategy = new LLMAnalysisStrategy(provider);

    const result = await strategy.analyze(makeContext());

    expect(result.comments).toHaveLength(0);
  });

  it("parses LLM review comments from response", async () => {
    const comments = [
      {
        filePath: "src/app.ts",
        lineStart: 5,
        lineEnd: 5,
        severity: "ERROR",
        category: "security",
        message: "SQL injection risk",
        suggestion: "Use parameterized queries",
      },
    ];
    const provider = makeProvider({ content: JSON.stringify(comments) });
    const strategy = new LLMAnalysisStrategy(provider);

    const result = await strategy.analyze(makeContext());

    expect(result.comments).toHaveLength(1);
    expect(result.comments[0].filePath).toBe("src/app.ts");
    expect(result.comments[0].severity).toBe("ERROR");
    expect(result.comments[0].category).toBe("security");
    expect(result.comments[0].message).toBe("SQL injection risk");
    expect(result.comments[0].suggestion).toBe("Use parameterized queries");
    expect(result.comments[0].source).toBe("llm");
  });

  it("handles single object response (not array)", async () => {
    const comment = {
      filePath: "src/app.ts",
      severity: "WARNING",
      category: "quality",
      message: "Needs refactor",
    };
    const provider = makeProvider({ content: JSON.stringify(comment) });
    const strategy = new LLMAnalysisStrategy(provider);

    const result = await strategy.analyze(makeContext());

    expect(result.comments).toHaveLength(1);
    expect(result.comments[0].message).toBe("Needs refactor");
  });

  it("returns empty on invalid JSON and does not throw", async () => {
    const provider = makeProvider({ content: "not valid json {{" });
    const strategy = new LLMAnalysisStrategy(provider);

    const result = await strategy.analyze(makeContext());

    expect(result.comments).toHaveLength(0);
  });

  it("normalizes severity to valid values", async () => {
    const comments = [
      { severity: "error", message: "test1" },
      { severity: "critical", message: "test2" },
      { severity: "unknown", message: "test3" },
      { message: "test4" },
    ];
    const provider = makeProvider({ content: JSON.stringify(comments) });
    const strategy = new LLMAnalysisStrategy(provider);

    const result = await strategy.analyze(makeContext());

    expect(result.comments[0].severity).toBe("ERROR");
    expect(result.comments[1].severity).toBe("CRITICAL");
    expect(result.comments[2].severity).toBe("WARNING");
    expect(result.comments[3].severity).toBe("WARNING");
  });

  it("uses default filePath when not provided in response", async () => {
    const comments = [{ severity: "INFO", message: "test" }];
    const provider = makeProvider({ content: JSON.stringify(comments) });
    const strategy = new LLMAnalysisStrategy(provider);
    const context = makeContext([
      makeChunk({ filePath: "src/other.ts" }),
    ]);
    context.fileContexts[0].file = makeFile({ filename: "src/other.ts" });

    const result = await strategy.analyze(context);

    expect(result.comments[0].filePath).toBe("src/other.ts");
  });

  it("skips files with empty diff", async () => {
    const provider = makeProvider();
    const strategy = new LLMAnalysisStrategy(provider);
    const context = makeContext([makeChunk({ content: "" })]);

    await strategy.analyze(context);

    expect(provider.chat).not.toHaveBeenCalled();
  });

  it("returns token usage in metadata", async () => {
    const provider = makeProvider({
      usage: { promptTokens: 200, completionTokens: 100, totalTokens: 300 },
    });
    const strategy = new LLMAnalysisStrategy(provider);

    const result = await strategy.analyze(makeContext());

    expect(result.metadata.promptTokens).toBe(200);
    expect(result.metadata.completionTokens).toBe(100);
    expect(result.metadata.filesAnalyzed).toBe(1);
  });

  it("returns metadata with filesAnalyzed count", async () => {
    const provider = makeProvider({ content: "[]" });
    const strategy = new LLMAnalysisStrategy(provider);
    const context = makeContext();

    const result = await strategy.analyze(context);

    expect(result.metadata.filesAnalyzed).toBe(1);
  });

  it("continues when provider throws for a file", async () => {
    const provider: LLMProvider = {
      name: "mock",
      chat: vi.fn().mockRejectedValue(new Error("API error")),
    };
    const strategy = new LLMAnalysisStrategy(provider);

    const result = await strategy.analyze(makeContext());

    expect(result.comments).toHaveLength(0);
    expect(result.metadata.filesAnalyzed).toBe(1);
  });
});
