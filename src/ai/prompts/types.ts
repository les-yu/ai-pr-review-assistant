export interface PromptTemplate {
  id: string;
  version: string;
  systemPrompt: string;
  userPromptTemplate: string;
  expectedFormat: "json" | "text";
}

export interface PromptInput {
  context: string;
  additionalInstructions?: string;
}

export interface PromptRegistry {
  get(id: string, version?: string): PromptTemplate;
  register(template: PromptTemplate): void;
  list(): PromptTemplate[];
}
