import { NextRequest, NextResponse } from "next/server";
import { executeAnalysis } from "@/domain/analysis/analysis.service";
import { createLogger } from "@/infrastructure/logger/logger";
import type { PRData } from "@/types/github";

const log = createLogger("api.webhook.analyze");

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { analysisId, prData } = body as {
      analysisId: string;
      prData: PRData;
    };

    if (!analysisId || !prData) {
      return NextResponse.json(
        { error: "analysisId and prData are required" },
        { status: 400 }
      );
    }

    log.info({ analysisId }, "Received QStash callback, executing analysis");

    await executeAnalysis(analysisId, prData);

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, "Webhook processing failed");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
