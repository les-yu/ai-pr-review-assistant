import { NextRequest, NextResponse } from "next/server";
import { Client } from "@upstash/qstash";
import { fetchFullPRData } from "@/integrations/github/github.client";
import { createAnalysisRecord } from "@/domain/analysis/analysis.service";
import { successResponse, errorResponse } from "@/types/api";
import {
  GitHubApiError,
  RateLimitExceededError,
  GitHubAuthError,
} from "@/integrations/github/github.types";
import { createLogger } from "@/infrastructure/logger/logger";
import { env } from "@/infrastructure/config/env";

const log = createLogger("api.analyze");

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
    const analysisId = await createAnalysisRecord(prData);

    const qstash = new Client({ token: env.QSTASH_TOKEN });
    const baseUrl = env.NEXT_PUBLIC_APP_URL;

    await qstash.publishJSON({
      url: `${baseUrl}/api/webhook/analyze`,
      body: { analysisId, prData },
    });

    log.info({ analysisId }, "Analysis task queued via QStash");

    return NextResponse.json(successResponse({ analysisId }));
  } catch (error) {
    log.error({ err: error }, "Analysis request failed");

    if (error instanceof RateLimitExceededError) {
      return NextResponse.json(
        errorResponse(`GitHub API rate limit exceeded. Try again after ${error.resetAt.toISOString()}`),
        { status: 429 }
      );
    }

    if (error instanceof GitHubAuthError) {
      return NextResponse.json(
        errorResponse("GitHub authentication failed. Please configure a valid GITHUB_TOKEN."),
        { status: 502 }
      );
    }

    if (error instanceof GitHubApiError) {
      return NextResponse.json(errorResponse(error.message), {
        status: error.status === 404 ? 404 : 502,
      });
    }

    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(errorResponse(message), { status: 500 });
  }
}
