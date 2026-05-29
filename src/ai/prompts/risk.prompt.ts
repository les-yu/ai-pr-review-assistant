import type { PromptTemplate } from "./types";

export const riskPrompt: PromptTemplate = {
  id: "risk",
  version: "1.0.0",
  expectedFormat: "json",
  systemPrompt: `You are a security-focused code reviewer. Assess the risk level of the given code changes.

Output a JSON object:
{
  "overall": 0-100,
  "level": "low|medium|high|critical",
  "breakdown": {
    "security": 0-100,
    "quality": 0-100,
    "performance": 0-100,
    "maintainability": 0-100
  },
  "criticalFindings": ["finding 1", "finding 2"]
}

Score interpretation:
- 0-15: Low risk, safe to merge
- 15-40: Medium risk, review recommended
- 40-70: High risk, changes requested
- 70-100: Critical risk, do not merge`,
  userPromptTemplate: `Assess the risk of these code changes:

PR: {{title}}
Files changed: {{fileCount}}

{{diff}}`,
};
