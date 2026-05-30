import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/ai/context/context-builder", () => ({
  buildContext: vi.fn(),
}));

vi.mock("@/ai/engine", () => ({
  aiEngine: { analyze: vi.fn() },
}));

vi.mock("@/infrastructure/logger/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

vi.mock("../analysis.repository", () => ({
  findOrCreatePR: vi.fn(),
  createAnalysis: vi.fn(),
  updateAnalysisStatus: vi.fn(),
  saveAnalysisResult: vi.fn(),
  saveAnalysisError: vi.fn(),
  saveIntermediateResults: vi.fn(),
  getAnalysisById: vi.fn(),
}));

import { createAnalysisRecord, executeAnalysis, getAnalysisResult } from "../analysis.service";
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
} from "../analysis.repository";
import type { PRData } from "@/types/github";
import type { AnalysisOutput } from "../analysis.types";
import type { AnalysisContext } from "@/ai/context/context.types";

function makePRData(overrides: Partial<PRData> = {}): PRData {
  return {
    info: {
      owner: "testowner",
      repo: "testrepo",
      prNumber: 1,
      title: "Test PR",
      description: "A test PR",
      author: "testuser",
      state: "open",
      baseBranch: "main",
      headBranch: "feature",
      url: "https://github.com/testowner/testrepo/pull/1",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    },
    files: [
      {
        filename: "src/app.ts",
        status: "modified",
        additions: 10,
        deletions: 5,
        changes: 15,
        patch: "@@ -1,5 +1,10 @@\n+const x = 1;",
      },
    ],
    commits: [
      {
        sha: "abc123",
        message: "feat: add feature",
        author: "testuser",
        date: "2025-01-01T00:00:00Z",
      },
    ],
    diff: "diff --git a/src/app.ts b/src/app.ts\n...",
    ...overrides,
  };
}

function makeContext(): AnalysisContext {
  return {
    chunks: [],
    fileContexts: [],
    metadata: {
      totalTokens: 100,
      tokenBudget: 8000,
      fileCount: 1,
      chunkCount: 0,
      truncatedFiles: [],
    },
  };
}

function makeAnalysisOutput(
  overrides: Partial<AnalysisOutput> = {}
): AnalysisOutput {
  return {
    summary: "No issues found.",
    riskScore: {
      overall: 0,
      level: "low",
      breakdown: { security: 0, quality: 0, performance: 0, maintainability: 0 },
    },
    comments: [],
    pipeline: {
      context: makeContext(),
      ruleResults: { comments: [], metadata: {} },
      llmResults: { comments: [], metadata: {} },
    },
    ...overrides,
  };
}

function flushMicrotasks() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("createAnalysisRecord", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findOrCreatePR).mockResolvedValue({ id: "pr-1" } as any);
    vi.mocked(createAnalysis).mockResolvedValue("analysis-1");
  });

  it("creates PR record and analysis, returns analysisId", async () => {
    const result = await createAnalysisRecord(makePRData());

    expect(result).toBe("analysis-1");
    expect(findOrCreatePR).toHaveBeenCalledWith(expect.objectContaining({
      info: expect.objectContaining({ url: "https://github.com/testowner/testrepo/pull/1" }),
    }));
    expect(createAnalysis).toHaveBeenCalledWith("pr-1");
  });

  it("throws when prData.info.url is missing", async () => {
    const prData = makePRData();
    prData.info.url = "";

    await expect(createAnalysisRecord(prData)).rejects.toThrow("PR data must include info.url");
  });

  it("throws when prData.files is not an array", async () => {
    const prData = makePRData();
    (prData as any).files = undefined;

    await expect(createAnalysisRecord(prData)).rejects.toThrow("PR data must include a files array");
  });
});

describe("executeAnalysis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(buildContext).mockResolvedValue(makeContext());
    vi.mocked(aiEngine.analyze).mockResolvedValue(makeAnalysisOutput());
    vi.mocked(updateAnalysisStatus).mockResolvedValue(undefined as any);
    vi.mocked(saveIntermediateResults).mockResolvedValue(undefined as any);
    vi.mocked(saveAnalysisResult).mockResolvedValue(undefined as any);
  });

  it("sets status to ANALYZING then COMPLETED on success", async () => {
    await executeAnalysis("analysis-1", makePRData());

    expect(updateAnalysisStatus).toHaveBeenCalledWith("analysis-1", "ANALYZING");
    expect(saveAnalysisResult).toHaveBeenCalledWith(
      "analysis-1",
      expect.objectContaining({ summary: "No issues found." })
    );
  });

  it("persists contextData after buildContext", async () => {
    await executeAnalysis("analysis-1", makePRData());

    expect(saveIntermediateResults).toHaveBeenCalledWith(
      "analysis-1",
      expect.objectContaining({ contextData: expect.any(Object) })
    );
  });

  it("persists ruleResults and llmResults after engine analysis", async () => {
    await executeAnalysis("analysis-1", makePRData());

    const calls = vi.mocked(saveIntermediateResults).mock.calls;
    expect(calls.length).toBe(2);
    expect(calls[1][1]).toEqual(
      expect.objectContaining({
        ruleResults: expect.any(Object),
        llmResults: expect.any(Object),
      })
    );
  });

  it("persists intermediate results in correct order", async () => {
    const callOrder: string[] = [];
    vi.mocked(saveIntermediateResults).mockImplementation(async (_, data) => {
      if ("contextData" in data) callOrder.push("context");
      if ("ruleResults" in data) callOrder.push("ruleResults");
      return undefined as any;
    });

    await executeAnalysis("analysis-1", makePRData());

    expect(callOrder).toEqual(["context", "ruleResults"]);
  });

  it("sets status to FAILED and saves error on pipeline failure", async () => {
    vi.mocked(buildContext).mockRejectedValue(new Error("context build failed"));

    await executeAnalysis("analysis-1", makePRData());

    expect(saveAnalysisError).toHaveBeenCalledWith("analysis-1", "context build failed");
    expect(saveAnalysisResult).not.toHaveBeenCalled();
  });

  it("saves 'Unknown error' when non-Error is thrown", async () => {
    vi.mocked(buildContext).mockRejectedValue("string error");

    await executeAnalysis("analysis-1", makePRData());

    expect(saveAnalysisError).toHaveBeenCalledWith("analysis-1", "Unknown error");
  });

  it("still saves contextData even if engine fails", async () => {
    vi.mocked(aiEngine.analyze).mockRejectedValue(new Error("engine failed"));

    await executeAnalysis("analysis-1", makePRData());

    const calls = vi.mocked(saveIntermediateResults).mock.calls;
    expect(calls.length).toBe(1);
    expect(calls[0][1]).toEqual(
      expect.objectContaining({ contextData: expect.any(Object) })
    );
  });

  it("handles output without pipeline field gracefully", async () => {
    vi.mocked(aiEngine.analyze).mockResolvedValue(
      makeAnalysisOutput({ pipeline: undefined })
    );

    await executeAnalysis("analysis-1", makePRData());

    const calls = vi.mocked(saveIntermediateResults).mock.calls;
    expect(calls.length).toBe(1);
    expect(saveAnalysisResult).toHaveBeenCalled();
  });
});

describe("getAnalysisResult", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns analysis result from repository", async () => {
    const expected = { id: "analysis-1", status: "COMPLETED" };
    vi.mocked(getAnalysisById).mockResolvedValue(expected as any);

    const result = await getAnalysisResult("analysis-1");

    expect(result).toBe(expected);
    expect(getAnalysisById).toHaveBeenCalledWith("analysis-1");
  });

  it("returns null when analysis not found", async () => {
    vi.mocked(getAnalysisById).mockResolvedValue(null);

    const result = await getAnalysisResult("nonexistent");

    expect(result).toBeNull();
  });

  it("throws when analysisId is empty string", async () => {
    await expect(getAnalysisResult("")).rejects.toThrow("non-empty string");
  });

  it("throws when analysisId is not a string", async () => {
    await expect(getAnalysisResult(undefined as any)).rejects.toThrow("non-empty string");
  });
});
