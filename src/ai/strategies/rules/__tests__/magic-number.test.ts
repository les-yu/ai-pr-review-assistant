import { describe, it, expect } from "vitest";
import { MagicNumberRule } from "../magic-number.rule";
import type { CodeChunk } from "@/ai/context/context.types";

const rule = new MagicNumberRule();

function makeChunk(content: string): CodeChunk {
  return {
    id: "test:0", filePath: "src/app.ts", content,
    startLine: 1, endLine: 20, type: "diff", language: "typescript", priority: 0,
  };
}

describe("MagicNumberRule", () => {
  it("detects magic number in comparison", () => {
    const findings = rule.apply(makeChunk('+if (status === 204) {'));
    expect(findings).toHaveLength(1);
  });

  it("detects magic number in assignment", () => {
    const findings = rule.apply(makeChunk('+const timeout = 30000;'));
    expect(findings).toHaveLength(1);
  });

  it("does NOT flag 0, 1, -1", () => {
    expect(rule.apply(makeChunk('+let count = 0;'))).toHaveLength(0);
    expect(rule.apply(makeChunk('+let count = 1;'))).toHaveLength(0);
    expect(rule.apply(makeChunk('+let offset = -1;'))).toHaveLength(0);
  });

  it("does NOT flag common HTTP status codes", () => {
    expect(rule.apply(makeChunk("+if (res.status === 200)"))).toHaveLength(0);
    expect(rule.apply(makeChunk("+if (res.status === 404)"))).toHaveLength(0);
  });

  it("does NOT flag const declarations (named constants)", () => {
    const findings = rule.apply(makeChunk('+const MAX_RETRIES = 5;'));
    expect(findings).toHaveLength(0);
  });

  it("does NOT flag array indices", () => {
    const findings = rule.apply(makeChunk('+const first = arr[0];'));
    expect(findings).toHaveLength(0);
  });

  it("does NOT flag CSS units", () => {
    const findings = rule.apply(makeChunk('+  width: 100px;'));
    expect(findings).toHaveLength(0);
  });

  it("does NOT flag removed lines", () => {
    const findings = rule.apply(makeChunk('-if (x === 42)'));
    expect(findings).toHaveLength(0);
  });

  it("does NOT flag comments", () => {
    const findings = rule.apply(makeChunk('+// wait 5000ms'));
    expect(findings).toHaveLength(0);
  });
});
