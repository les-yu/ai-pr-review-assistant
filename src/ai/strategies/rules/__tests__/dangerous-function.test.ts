import { describe, it, expect } from "vitest";
import { DangerousFunctionRule } from "../dangerous-function.rule";
import type { CodeChunk } from "@/ai/context/context.types";

const rule = new DangerousFunctionRule();

function makeChunk(content: string): CodeChunk {
  return {
    id: "test:0", filePath: "src/utils.ts", content,
    startLine: 1, endLine: 20, type: "diff", language: "typescript", priority: 0,
  };
}

describe("DangerousFunctionRule", () => {
  it("detects eval()", () => {
    const findings = rule.apply(makeChunk('+const result = eval(userInput)'));
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain("eval()");
  });

  it("detects new Function()", () => {
    const findings = rule.apply(makeChunk('+const fn = new Function("return " + code)'));
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain("new Function()");
  });

  it("detects exec()", () => {
    const findings = rule.apply(makeChunk('+exec("rm -rf /")'));
    expect(findings).toHaveLength(1);
  });

  it("detects spawn()", () => {
    const findings = rule.apply(makeChunk('+spawn("sh", ["-c", cmd])'));
    expect(findings).toHaveLength(1);
  });

  it("detects execSync()", () => {
    const findings = rule.apply(makeChunk('+execSync("ls")'));
    expect(findings).toHaveLength(1);
  });

  it("does NOT flag comment-only lines", () => {
    const findings = rule.apply(makeChunk('+// eval is dangerous, do not use'));
    expect(findings).toHaveLength(0);
  });

  it("does NOT flag removed lines", () => {
    const findings = rule.apply(makeChunk('-eval(code)'));
    expect(findings).toHaveLength(0);
  });

  it("does NOT flag non-dangerous functions", () => {
    const findings = rule.apply(makeChunk('+const result = evaluate(input)'));
    expect(findings).toHaveLength(0);
  });

  it("only reports one finding per line", () => {
    const findings = rule.apply(makeChunk('+eval(exec(cmd))'));
    expect(findings).toHaveLength(1);
  });
});
