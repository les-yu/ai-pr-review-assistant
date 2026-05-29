import { NextRequest, NextResponse } from "next/server";
import { getAnalysisResult } from "@/domain/analysis/analysis.service";
import { successResponse, errorResponse } from "@/types/api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await getAnalysisResult(id);

    if (!result) {
      return NextResponse.json(errorResponse("Analysis not found"), {
        status: 404,
      });
    }

    return NextResponse.json(successResponse(result));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(errorResponse(message), { status: 500 });
  }
}
