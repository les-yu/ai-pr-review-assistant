export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface AnalyzeRequest {
  prUrl: string;
}

export interface AnalyzeResponse {
  analysisId: string;
  status: string;
}

export interface AnalysisResultResponse {
  id: string;
  status: string;
  riskScore: {
    overall: number;
    level: string;
    breakdown: Record<string, number>;
  } | null;
  summary: string | null;
  comments: Array<{
    id: string;
    filePath: string;
    lineStart: number | null;
    lineEnd: number | null;
    severity: string;
    category: string;
    message: string;
    suggestion: string | null;
    source: string;
  }>;
  completedAt: string | null;
  errorMessage: string | null;
}

export function successResponse<T>(data: T): ApiResponse<T> {
  return { success: true, data };
}

export function errorResponse(error: string): ApiResponse<never> {
  return { success: false, error };
}
