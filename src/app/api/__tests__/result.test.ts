import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetAnalysisResult = vi.fn();

vi.mock("@/domain/analysis/analysis.service", () => ({
  getAnalysisResult: mockGetAnalysisResult,
}));

vi.mock("@/infrastructure/logger/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

const { GET } = await import("../result/[id]/route");

function makeRequest(id: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/result/${id}`, {
    method: "GET",
  });
}

describe("GET /api/result/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns analysis result on success", async () => {
    const mockResult = {
      id: "abc-123",
      status: "COMPLETED",
      riskScore: { overall: 75, level: "high", breakdown: {} },
      summary: "Found issues",
      comments: [],
      completedAt: "2026-01-01T00:00:00Z",
      errorMessage: null,
    };
    mockGetAnalysisResult.mockResolvedValue(mockResult);

    const response = await GET(makeRequest("abc-123"), { params: Promise.resolve({ id: "abc-123" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.id).toBe("abc-123");
    expect(data.data.status).toBe("COMPLETED");
    expect(mockGetAnalysisResult).toHaveBeenCalledWith("abc-123");
  });

  it("returns 404 when analysis not found", async () => {
    mockGetAnalysisResult.mockResolvedValue(null);

    const response = await GET(makeRequest("nonexistent"), { params: Promise.resolve({ id: "nonexistent" }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Analysis not found");
  });

  it("returns 500 on service error", async () => {
    mockGetAnalysisResult.mockRejectedValue(new Error("database connection failed"));

    const response = await GET(makeRequest("abc-123"), { params: Promise.resolve({ id: "abc-123" }) });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe("database connection failed");
  });
});
