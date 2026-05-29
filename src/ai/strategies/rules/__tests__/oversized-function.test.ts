import { describe, it, expect } from "vitest";
import { OversizedFunctionRule } from "../oversized-function.rule";
import type { CodeChunk } from "@/ai/context/context.types";

const rule = new OversizedFunctionRule();

function makeChunk(additions: number): CodeChunk {
  const lines = Array.from({ length: additions }, (_, i) => `+  const x${i} = ${i};`);
  return {
    id: "test:0", filePath: "src/big.ts", content: lines.join("\n"),
    startLine: 1, endLine: additions, type: "diff", language: "typescript", priority: 0,
  };
}

describe("OversizedFunctionRule", () => {
  it("detects large function (>50 added lines)", () => {
    const findings = rule.apply(makeChunk(60));
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("WARNING");
    expect(findings[0].message).toContain("60");
  });

  it("does NOT flag small function (<50 added lines)", () => {
    const findings = rule.apply(makeChunk(20));
    expect(findings).toHaveLength(0);
  });

  it("does NOT flag exactly at threshold", () => {
    const findings = rule.apply(makeChunk(49));
    expect(findings).toHaveLength(0);
  });

  it("flags exactly at threshold (50)", () => {
    const findings = rule.apply(makeChunk(50));
    expect(findings).toHaveLength(1);
  });
});
