import { describe, it, expect } from "vitest";
import { TodoFixmeRule } from "../todo-fixme.rule";
import type { CodeChunk } from "@/ai/context/context.types";

const rule = new TodoFixmeRule();

function makeChunk(content: string): CodeChunk {
  return {
    id: "test:0", filePath: "src/app.ts", content,
    startLine: 1, endLine: 20, type: "diff", language: "typescript", priority: 0,
  };
}

describe("TodoFixmeRule", () => {
  it("detects TODO comment", () => {
    const findings = rule.apply(makeChunk('+// TODO: implement this'));
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain("TODO");
    expect(findings[0].suggestion).toBeUndefined(); // TODO doesn't need urgent action
  });

  it("detects FIXME comment", () => {
    const findings = rule.apply(makeChunk('+// FIXME: broken logic'));
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain("FIXME");
    expect(findings[0].suggestion).toBeDefined(); // FIXME should be addressed
  });

  it("detects HACK comment", () => {
    const findings = rule.apply(makeChunk('+// HACK: temporary workaround'));
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain("HACK");
  });

  it("detects XXX marker", () => {
    const findings = rule.apply(makeChunk('+// XXX: this is suspicious'));
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain("XXX");
  });

  it("detects WORKAROUND marker", () => {
    const findings = rule.apply(makeChunk('+// WORKAROUND: for issue #123'));
    expect(findings).toHaveLength(1);
    expect(findings).toHaveLength(1);
  });

  it("detects block comment TODO", () => {
    const findings = rule.apply(makeChunk('+/* TODO: refactor this */'));
    expect(findings).toHaveLength(1);
  });

  it("detects Python-style TODO", () => {
    const findings = rule.apply(makeChunk('+# TODO: add validation'));
    expect(findings).toHaveLength(1);
  });

  it("does NOT flag normal comments", () => {
    const findings = rule.apply(makeChunk('+// This function does something'));
    expect(findings).toHaveLength(0);
  });

  it("does NOT flag removed lines", () => {
    const findings = rule.apply(makeChunk('-// TODO: remove this'));
    expect(findings).toHaveLength(0);
  });

  it("does NOT flag TODO in string literals", () => {
    const findings = rule.apply(makeChunk('+const msg = "TODO: not a real todo"'));
    // This is in a string, not a comment - our regex requires // or /* or #
    expect(findings).toHaveLength(0);
  });
});
