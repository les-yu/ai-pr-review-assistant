import { describe, it, expect } from "vitest";
import { renderPrompt } from "../renderer";
import type { PromptTemplate } from "../types";

function makeTemplate(
  overrides: Partial<PromptTemplate> = {}
): PromptTemplate {
  return {
    id: "test",
    version: "1.0.0",
    expectedFormat: "text",
    systemPrompt: "You are a code reviewer.",
    userPromptTemplate: "Review {{filename}}: {{diff}}",
    ...overrides,
  };
}

describe("renderPrompt", () => {
  it("replaces all placeholders with values", () => {
    const result = renderPrompt(makeTemplate(), {
      filename: "src/app.ts",
      diff: "+ const x = 1;",
    });

    expect(result.userPrompt).toBe("Review src/app.ts: + const x = 1;");
  });

  it("preserves system prompt unchanged", () => {
    const template = makeTemplate({ systemPrompt: "Custom system prompt" });
    const result = renderPrompt(template, { filename: "a.ts", diff: "diff" });

    expect(result.systemPrompt).toBe("Custom system prompt");
  });

  it("handles template with no placeholders", () => {
    const template = makeTemplate({ userPromptTemplate: "No vars here" });
    const result = renderPrompt(template, {});

    expect(result.userPrompt).toBe("No vars here");
  });

  it("handles missing variables (leaves placeholder intact)", () => {
    const result = renderPrompt(makeTemplate(), { filename: "a.ts" });

    expect(result.userPrompt).toBe("Review a.ts: {{diff}}");
  });

  it("handles empty variables object", () => {
    const result = renderPrompt(makeTemplate(), {});

    expect(result.userPrompt).toBe("Review {{filename}}: {{diff}}");
  });

  it("replaces repeated placeholders", () => {
    const template = makeTemplate({
      userPromptTemplate: "{{filename}} and {{filename}}",
    });
    const result = renderPrompt(template, { filename: "a.ts" });

    expect(result.userPrompt).toBe("a.ts and a.ts");
  });

  it("handles multi-line template", () => {
    const template = makeTemplate({
      userPromptTemplate: "File: {{filename}}\nDiff:\n{{diff}}\nEnd.",
    });
    const result = renderPrompt(template, {
      filename: "x.ts",
      diff: "+ line1\n- line2",
    });

    expect(result.userPrompt).toBe("File: x.ts\nDiff:\n+ line1\n- line2\nEnd.");
  });

  it("handles empty string values", () => {
    const result = renderPrompt(makeTemplate(), {
      filename: "",
      diff: "",
    });

    expect(result.userPrompt).toBe("Review : ");
  });
});
