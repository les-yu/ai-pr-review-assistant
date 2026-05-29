export interface LLMProvider {
  readonly name: string;

  chat(params: LLMChatParams): Promise<LLMChatResponse>;
}

export interface LLMChatParams {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "json" | "text";
}

export interface LLMChatResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
}
