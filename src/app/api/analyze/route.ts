import { NextRequest, NextResponse } from "next/server";
import { fetchFullPRData } from "@/integrations/github/github.client";
import { startAnalysis } from "@/domain/analysis/analysis.service";
import { successResponse, errorResponse } from "@/types/api";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prUrl } = body;

    if (!prUrl || typeof prUrl !== "string") {
      return NextResponse.json(errorResponse("prUrl is required"), {
        status: 400,
      });
    }

    const prData = await fetchFullPRData(prUrl);
    const analysisId = await startAnalysis(prData);

    return NextResponse.json(successResponse({ analysisId }));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(errorResponse(message), { status: 500 });
  }
}
