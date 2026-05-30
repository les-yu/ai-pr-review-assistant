import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/db/prisma";
import { createLogger } from "@/infrastructure/logger/logger";

const log = createLogger("api.health");

export async function GET() {
  try {
    log.info({ databaseUrl: process.env.DATABASE_URL ? "set" : "unset" }, "Health check");
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error({ err: error }, "Health check failed");
    return NextResponse.json(
      {
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
