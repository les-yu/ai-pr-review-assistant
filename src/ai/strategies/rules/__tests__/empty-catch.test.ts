import { describe, it, expect } from "vitest";
import { EmptyCatchRule } from "../empty-catch.rule";
import type { CodeChunk } from "@/ai/context/context.types";

const rule = new EmptyCatchRule();

function makeChunk(content: string): CodeChunk {
  return {
    id: "test:0", filePath: "src/app.ts", content,
    startLine: 1, endLine: 30, type: "diff", language: "typescript", priority: 0,
  };
}

describe("EmptyCatchRule", () => {
  it("detects empty catch block", () => {
    const findings = rule.apply(makeChunk(`+try {
+  doSomething();
+} catch (e) {
+}`));
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("WARNING");
  });

  it("detects catch with only comments", () => {
    const findings = rule.apply(makeChunk(`+try {
+  doSomething();
+} catch (e) {
+  // todo: handle error
+}`));
    expect(findings).toHaveLength(1);
  });

  it("does NOT flag catch with error handling", () => {
    const findings = rule.apply(makeChunk(`+try {
+  doSomething();
+} catch (e) {
+  logger.error(e);
+}`));
    expect(findings).toHaveLength(0);
  });

  it("does NOT flag catch with rethrow", () => {
    const findings = rule.apply(makeChunk(`+try {
+  doSomething();
+} catch (e) {
+  throw new Error("wrapped", { cause: e });
+}`));
    expect(findings).toHaveLength(0);
  });

  it("does NOT flag removed lines", () => {
    const findings = rule.apply(makeChunk(`-} catch (e) {
-}`));
    expect(findings).toHaveLength(0);
  });
});
