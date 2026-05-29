import { createLogger } from "@/infrastructure/logger/logger";
import { env } from "@/infrastructure/config/env";
import type { LLMProvider, LLMChatParams, LLMChatResponse } from "./provider.interface";

const log = createLogger("deepseek.provider");

const DEFAULT_MODEL = "deepseek-chat";

export class DeepSeekProvider implements LLMProvider {
  readonly name = "deepseek";

  async chat(params: LLMChatParams): Promise<LLMChatResponse> {
    if (!env.DEEPSEEK_API_KEY) {
      throw new Error("DEEPSEEK_API_KEY is not configured");
    }

    log.debug({ model: DEFAULT_MODEL }, "Calling DeepSeek API");

    const response = await fetch(`${env.DEEPSEEK_BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          { role: "system", content: params.systemPrompt },
          { role: "user", content: params.userPrompt },
        ],
        temperature: params.temperature ?? 0.1,
        max_tokens: params.maxTokens ?? 4096,
        response_format:
          params.responseFormat === "json"
            ? { type: "json_object" }
            : undefined,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      log.error({ status: response.status, error }, "DeepSeek API error");
      throw new Error(`DeepSeek API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      content: data.choices[0].message.content,
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
      model: data.model,
    };
  }
}

export const deepseekProvider = new DeepSeekProvider();
