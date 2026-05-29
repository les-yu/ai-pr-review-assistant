import { describe, it, expect } from "vitest";
import { HardcodedSecretRule } from "../hardcoded-secret.rule";
import type { CodeChunk } from "@/ai/context/context.types";

const rule = new HardcodedSecretRule();

function makeChunk(content: string): CodeChunk {
  return {
    id: "test:0", filePath: "src/config.ts", content,
    startLine: 1, endLine: 20, type: "diff", language: "typescript", priority: 0,
  };
}

describe("HardcodedSecretRule", () => {
  it("detects hardcoded password", () => {
    const findings = rule.apply(makeChunk(`+const password = "supersecret123"`));
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("CRITICAL");
  });

  it("detects hardcoded API key", () => {
    const findings = rule.apply(makeChunk(`+const API_KEY = "sk-abc123def456"`));
    expect(findings).toHaveLength(1);
  });

  it("detects hardcoded token", () => {
    const findings = rule.apply(makeChunk(`+const auth_token = "ghp_xx_very_long_token_here"`));
    expect(findings).toHaveLength(1);
  });

  it("does NOT flag env var reference", () => {
    const findings = rule.apply(makeChunk(`+const password = process.env.DB_PASSWORD`));
    expect(findings).toHaveLength(0);
  });

  it("does NOT flag empty string", () => {
    const findings = rule.apply(makeChunk(`+const password = ""`));
    expect(findings).toHaveLength(0);
  });

  it("does NOT flag short value (< 8 chars)", () => {
    const findings = rule.apply(makeChunk(`+const password = "short"`));
    expect(findings).toHaveLength(0);
  });

  it("does NOT flag placeholder values", () => {
    const findings = rule.apply(makeChunk(`+const api_key = "your-api-key-here"`));
    expect(findings).toHaveLength(0);
  });

  it("does NOT flag removed lines", () => {
    const findings = rule.apply(makeChunk(`-const password = "removed123"`));
    expect(findings).toHaveLength(0);
  });

  it("does NOT flag hash-related variables", () => {
    const findings = rule.apply(makeChunk(`+const passwordHash = hash(input)`));
    expect(findings).toHaveLength(0);
  });
});
