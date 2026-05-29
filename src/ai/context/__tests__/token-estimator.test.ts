import { describe, it, expect } from "vitest";
import { estimateTokens, allocateTokenBudget, buildMetadata } from "../token-estimator";
import type { FileContext, CodeChunk } from "../context.types";
import type { ChangedFile } from "@/types/github";

function makeChunk(content: string): CodeChunk {
  return {
    id: "test:0",
    filePath: "test.ts",
    content,
    startLine: 1,
    endLine: 10,
    type: "diff",
    language: "typescript",
    priority: 0,
  };
}

function makeFileContext(
  filename: string,
  priority: "critical" | "high" | "medium" | "low",
  estimatedTokens: number
): FileContext {
  return {
    file: { filename, status: "modified", additions: 1, deletions: 0, changes: 1, patch: "" },
    chunks: [makeChunk("x".repeat(estimatedTokens * 4))],
    language: "typescript",
    priority,
    priorityScore: 0,
    estimatedTokens,
  };
}

// ─── estimateTokens ─────────────────────────────────────────

describe("estimateTokens", () => {
  it("returns 0 for empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("estimates ~4 chars per token", () => {
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2); // ceil(5/4)
    expect(estimateTokens("x".repeat(100))).toBe(25);
  });

  it("handles single character", () => {
    expect(estimateTokens("a")).toBe(1);
  });

  it("handles whitespace-heavy content (code-like)", () => {
    const code = "  const x = 1;\n  const y = 2;\n";
    const tokens = estimateTokens(code);
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(code.length); // Should be less than char count
  });
});

// ─── allocateTokenBudget ────────────────────────────────────

describe("allocateTokenBudget", () => {
  it("returns empty allocation for empty input", () => {
    const result = allocateTokenBudget([], 1000);
    expect(result.fileTokens.size).toBe(0);
    expect(result.totalTokens).toBe(0);
    expect(result.truncatedFiles).toEqual([]);
  });

  it("returns empty allocation for zero budget", () => {
    const files = [makeFileContext("a.ts", "high", 100)];
    const result = allocateTokenBudget(files, 0);
    expect(result.fileTokens.size).toBe(0);
  });

  it("allocates tokens to a single file within budget", () => {
    const files = [makeFileContext("a.ts", "medium", 500)];
    const result = allocateTokenBudget(files, 2000);
    expect(result.fileTokens.get("a.ts")).toBe(500);
    expect(result.truncatedFiles).toEqual([]);
  });

  it("truncates file exceeding its allocation", () => {
    const files = [makeFileContext("big.ts", "low", 5000)];
    const result = allocateTokenBudget(files, 1000);
    const allocated = result.fileTokens.get("big.ts")!;
    expect(allocated).toBeLessThan(5000);
    expect(result.truncatedFiles).toContain("big.ts");
  });

  it("gives critical files more budget than low files", () => {
    // Use large token counts so tier allocation is the limiting factor
    const files = [
      makeFileContext("auth.ts", "critical", 5000),
      makeFileContext("readme.md", "low", 5000),
    ];
    const result = allocateTokenBudget(files, 4000);

    const authTokens = result.fileTokens.get("auth.ts")!;
    const readmeTokens = result.fileTokens.get("readme.md")!;
    expect(authTokens).toBeGreaterThan(readmeTokens);
  });

  it("distributes evenly within same tier", () => {
    const files = [
      makeFileContext("a.ts", "high", 500),
      makeFileContext("b.ts", "high", 500),
    ];
    const result = allocateTokenBudget(files, 4000);

    expect(result.fileTokens.get("a.ts")).toBe(result.fileTokens.get("b.ts"));
  });

  it("handles multiple priority tiers correctly", () => {
    const files = [
      makeFileContext("critical.ts", "critical", 1000),
      makeFileContext("high.ts", "high", 1000),
      makeFileContext("medium.ts", "medium", 1000),
      makeFileContext("low.ts", "low", 1000),
    ];
    const result = allocateTokenBudget(files, 8000);

    const critical = result.fileTokens.get("critical.ts")!;
    const high = result.fileTokens.get("high.ts")!;
    const medium = result.fileTokens.get("medium.ts")!;
    const low = result.fileTokens.get("low.ts")!;

    expect(critical).toBeGreaterThanOrEqual(high);
    expect(high).toBeGreaterThanOrEqual(medium);
    expect(medium).toBeGreaterThanOrEqual(low);
  });

  it("total tokens does not exceed budget", () => {
    const files = Array.from({ length: 20 }, (_, i) =>
      makeFileContext(`file${i}.ts`, "medium", 1000)
    );
    const result = allocateTokenBudget(files, 5000);
    expect(result.totalTokens).toBeLessThanOrEqual(5000);
  });

  it("handles very small budget gracefully", () => {
    const files = [
      makeFileContext("a.ts", "critical", 100),
      makeFileContext("b.ts", "low", 100),
    ];
    const result = allocateTokenBudget(files, 10);
    expect(result.totalTokens).toBeGreaterThanOrEqual(0);
    expect(result.fileTokens.size).toBe(2);
  });
});

// ─── buildMetadata ──────────────────────────────────────────

describe("buildMetadata", () => {
  it("builds correct metadata", () => {
    const files = [
      makeFileContext("a.ts", "high", 100),
      makeFileContext("b.ts", "low", 200),
    ];
    const allocation = {
      fileTokens: new Map([["a.ts", 100], ["b.ts", 150]]),
      truncatedFiles: ["b.ts"],
      totalTokens: 250,
    };

    const meta = buildMetadata(files, allocation, 1000);
    expect(meta.totalTokens).toBe(250);
    expect(meta.tokenBudget).toBe(1000);
    expect(meta.fileCount).toBe(2);
    expect(meta.chunkCount).toBe(2);
    expect(meta.truncatedFiles).toEqual(["b.ts"]);
  });
});
