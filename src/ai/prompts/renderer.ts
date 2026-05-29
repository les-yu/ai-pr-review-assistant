import type { PromptTemplate } from "./types";

export interface RenderedPrompt {
  systemPrompt: string;
  userPrompt: string;
}

/**
 * Renders a prompt template by replacing {{key}} placeholders with values.
 */
export function renderPrompt(
  template: PromptTemplate,
  variables: Record<string, string>
): RenderedPrompt {
  let userPrompt = template.userPromptTemplate;

  for (const [key, value] of Object.entries(variables)) {
    userPrompt = userPrompt.replaceAll(`{{${key}}}`, value);
  }

  return {
    systemPrompt: template.systemPrompt,
    userPrompt,
  };
}
