import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  GitHubApiError,
  RateLimitExceededError,
  GitHubAuthError,
} from "@/integrations/github/github.types";

const mockFetchFullPRData = vi.fn();
const mockStartAnalysis = vi.fn();

vi.mock("@/integrations/github/github.client", () => ({
  fetchFullPRData: mockFetchFullPRData,
}));

vi.mock("@/domain/analysis/analysis.service", () => ({
  startAnalysis: mockStartAnalysis,
}));

vi.mock("@/infrastructure/logger/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

// Import after mocks
const { POST } = await import("../analyze/route");

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/analyze", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/analyze", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns analysisId on success", async () => {
    mockFetchFullPRData.mockResolvedValue({ info: {}, files: [] });
    mockStartAnalysis.mockResolvedValue("analysis-123");

    const response = await POST(makeRequest({ prUrl: "https://github.com/owner/repo/pull/1" }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.analysisId).toBe("analysis-123");
    expect(mockFetchFullPRData).toHaveBeenCalledWith("https://github.com/owner/repo/pull/1");
    expect(mockStartAnalysis).toHaveBeenCalledTimes(1);
  });

  it("returns 400 when prUrl is missing", async () => {
    const response = await POST(makeRequest({}));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe("prUrl is required");
    expect(mockFetchFullPRData).not.toHaveBeenCalled();
  });

  it("returns 400 when prUrl is not a string", async () => {
    const response = await POST(makeRequest({ prUrl: 123 }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe("prUrl is required");
  });

  it("returns 429 on GitHub rate limit", async () => {
    const resetAt = new Date("2026-01-01T00:00:00Z");
    mockFetchFullPRData.mockRejectedValue(
      new RateLimitExceededError(resetAt, "/repos/owner/repo/pulls/1")
    );

    const response = await POST(makeRequest({ prUrl: "https://github.com/owner/repo/pull/1" }));
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.success).toBe(false);
    expect(data.error).toContain("rate limit");
  });

  it("returns 502 on GitHub auth error", async () => {
    mockFetchFullPRData.mockRejectedValue(
      new GitHubAuthError("/repos/owner/repo/pulls/1")
    );

    const response = await POST(makeRequest({ prUrl: "https://github.com/owner/repo/pull/1" }));
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.success).toBe(false);
    expect(data.error).toContain("authentication");
  });

  it("returns 404 on GitHub not found", async () => {
    mockFetchFullPRData.mockRejectedValue(
      new GitHubApiError("Not found", 404, "/repos/owner/repo/pulls/999")
    );

    const response = await POST(makeRequest({ prUrl: "https://github.com/owner/repo/pull/999" }));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
  });

  it("returns 500 on unexpected errors", async () => {
    mockFetchFullPRData.mockRejectedValue(new Error("database down"));

    const response = await POST(makeRequest({ prUrl: "https://github.com/owner/repo/pull/1" }));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe("database down");
  });
});
