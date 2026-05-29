import { createLogger } from "@/infrastructure/logger/logger";
import { env } from "@/infrastructure/config/env";
import type { LLMProvider, LLMChatParams, LLMChatResponse } from "./provider.interface";

const log = createLogger("deepseek.provider");

const DEFAULT_MODEL = "deepseek-chat";
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 30_000;

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class DeepSeekProvider implements LLMProvider {
  readonly name = "deepseek";
  private _sleep: (ms: number) => Promise<void>;

  constructor(options?: { sleep?: (ms: number) => Promise<void> }) {
    this._sleep = options?.sleep ?? defaultSleep;
  }

  async chat(params: LLMChatParams): Promise<LLMChatResponse> {
    if (!env.DEEPSEEK_API_KEY) {
      throw new Error("DEEPSEEK_API_KEY is not configured");
    }

    const url = `${env.DEEPSEEK_BASE_URL}/v1/chat/completions`;
    const body = JSON.stringify({
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
    });

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      log.debug({ model: DEFAULT_MODEL, attempt }, "Calling DeepSeek API");

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
          },
          body,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (response.ok) {
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

        // 4xx errors — don't retry
        if (response.status >= 400 && response.status < 500) {
          const error = await response.text();
          log.error({ status: response.status, error }, "DeepSeek API client error");
          throw new Error(`DeepSeek API error: ${response.status}`);
        }

        // 5xx errors — retry with backoff
        if (response.status >= 500 && attempt < MAX_RETRIES) {
          const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
          log.warn(
            { status: response.status, attempt, delay },
            "DeepSeek server error, retrying with backoff"
          );
          await this._sleep(delay);
          continue;
        }

        // 5xx on last attempt
        const error = await response.text();
        log.error({ status: response.status, error }, "DeepSeek API error after retries");
        throw new Error(`DeepSeek API error: ${response.status}`);
      } catch (err) {
        clearTimeout(timeout);

        // Abort / network errors — retry
        if (
          err instanceof TypeError ||
          (err instanceof DOMException && err.name === "AbortError")
        ) {
          if (attempt < MAX_RETRIES) {
            const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
            log.warn(
              { error: err.message, attempt, delay },
              "DeepSeek request failed, retrying with backoff"
            );
            await this._sleep(delay);
            continue;
          }
          throw new Error(
            `DeepSeek API request failed after ${MAX_RETRIES + 1} attempts: ${err.message}`
          );
        }

        // Re-throw API errors (4xx, exhausted 5xx)
        throw err;
      }
    }

    throw new Error(`DeepSeek API request failed after ${MAX_RETRIES + 1} attempts`);
  }
}

export const deepseekProvider = new DeepSeekProvider();
