import type { PromptTemplate } from "./types";

export const summaryPrompt: PromptTemplate = {
  id: "summary",
  version: "1.0.0",
  expectedFormat: "json",
  systemPrompt: `You are a senior code reviewer. Analyze the given PR diff and produce a concise summary.

Output a JSON object with this structure:
{
  "summary": "Brief description of what this PR does",
  "keyChanges": ["change 1", "change 2"],
  "impact": "low|medium|high|critical",
  "suggestedReviewers": ["area-expert-1"]
}

Be concise and focus on the intent and impact of the changes.`,
  userPromptTemplate: `Analyze this PR:

Title: {{title}}
Author: {{author}}
Files changed: {{fileCount}}

Diff:
{{diff}}`,
};
