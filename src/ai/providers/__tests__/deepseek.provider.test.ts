import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { LLMChatParams } from "../provider.interface";

vi.mock("@/infrastructure/config/env", () => ({
  env: {
    DEEPSEEK_API_KEY: "test-key",
    DEEPSEEK_BASE_URL: "https://api.deepseek.com",
  },
}));

vi.mock("@/infrastructure/logger/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

import { DeepSeekProvider } from "../deepseek.provider";

const noSleep = vi.fn().mockResolvedValue(undefined);

function makeProvider() {
  return new DeepSeekProvider({ sleep: noSleep });
}

function makeParams(): LLMChatParams {
  return {
    systemPrompt: "You are a code reviewer",
    userPrompt: "Review this code",
  };
}

function makeSuccessResponse(data: Record<string, unknown> = {}) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        choices: [{ message: { content: "response" } }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        },
        model: "deepseek-chat",
        ...data,
      }),
  };
}

function makeErrorResponse(status: number, body = "error") {
  return {
    ok: false,
    status,
    text: () => Promise.resolve(body),
  };
}

describe("DeepSeekProvider", () => {
  let provider: DeepSeekProvider;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    provider = makeProvider();
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    noSleep.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns response on successful request", async () => {
    fetchSpy.mockResolvedValueOnce(makeSuccessResponse());

    const result = await provider.chat(makeParams());

    expect(result.content).toBe("response");
    expect(result.usage.totalTokens).toBe(150);
    expect(result.model).toBe("deepseek-chat");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(noSleep).not.toHaveBeenCalled();
  });

  it("sends correct request body", async () => {
    fetchSpy.mockResolvedValueOnce(makeSuccessResponse());

    await provider.chat({
      systemPrompt: "system",
      userPrompt: "user",
      temperature: 0.5,
      maxTokens: 1024,
      responseFormat: "json",
    });

    const [, options] = fetchSpy.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.messages).toEqual([
      { role: "system", content: "system" },
      { role: "user", content: "user" },
    ]);
    expect(body.temperature).toBe(0.5);
    expect(body.max_tokens).toBe(1024);
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("throws on 4xx errors without retry", async () => {
    fetchSpy.mockResolvedValueOnce(makeErrorResponse(400, "bad request"));

    await expect(provider.chat(makeParams())).rejects.toThrow(
      "DeepSeek API error: 400"
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(noSleep).not.toHaveBeenCalled();
  });

  it("throws on 401 without retry", async () => {
    fetchSpy.mockResolvedValueOnce(makeErrorResponse(401, "unauthorized"));

    await expect(provider.chat(makeParams())).rejects.toThrow(
      "DeepSeek API error: 401"
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(noSleep).not.toHaveBeenCalled();
  });

  it("retries on 5xx errors and succeeds", async () => {
    fetchSpy
      .mockResolvedValueOnce(makeErrorResponse(500, "server error"))
      .mockResolvedValueOnce(makeErrorResponse(502, "bad gateway"))
      .mockResolvedValueOnce(makeSuccessResponse());

    const result = await provider.chat(makeParams());

    expect(result.content).toBe("response");
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(noSleep).toHaveBeenCalledTimes(2);
    expect(noSleep).toHaveBeenCalledWith(1000); // 1s
    expect(noSleep).toHaveBeenCalledWith(2000); // 2s
  });

  it("throws after exhausting all retries on 5xx", async () => {
    fetchSpy.mockResolvedValue(makeErrorResponse(503, "service unavailable"));

    await expect(provider.chat(makeParams())).rejects.toThrow(
      "DeepSeek API error: 503"
    );
    expect(fetchSpy).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    expect(noSleep).toHaveBeenCalledTimes(3);
    expect(noSleep).toHaveBeenCalledWith(1000); // 1s
    expect(noSleep).toHaveBeenCalledWith(2000); // 2s
    expect(noSleep).toHaveBeenCalledWith(4000); // 4s
  });

  it("retries on network errors (TypeError) and succeeds", async () => {
    fetchSpy
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(makeSuccessResponse());

    const result = await provider.chat(makeParams());

    expect(result.content).toBe("response");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(noSleep).toHaveBeenCalledWith(1000);
  });

  it("retries on timeout (AbortError) and succeeds", async () => {
    const abortError = new DOMException("The operation was aborted", "AbortError");
    fetchSpy
      .mockRejectedValueOnce(abortError)
      .mockResolvedValueOnce(makeSuccessResponse());

    const result = await provider.chat(makeParams());

    expect(result.content).toBe("response");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(noSleep).toHaveBeenCalledWith(1000);
  });

  it("throws after exhausting retries on network errors", async () => {
    fetchSpy.mockRejectedValue(new TypeError("fetch failed"));

    await expect(provider.chat(makeParams())).rejects.toThrow(
      "DeepSeek API request failed after 4 attempts"
    );
    expect(fetchSpy).toHaveBeenCalledTimes(4);
    expect(noSleep).toHaveBeenCalledTimes(3);
    expect(noSleep).toHaveBeenCalledWith(1000);
    expect(noSleep).toHaveBeenCalledWith(2000);
    expect(noSleep).toHaveBeenCalledWith(4000);
  });

  it("does not retry non-network errors", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("unexpected"));

    await expect(provider.chat(makeParams())).rejects.toThrow("unexpected");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(noSleep).not.toHaveBeenCalled();
  });
});
