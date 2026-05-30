import { NextResponse } from "next/server";
import { Pool } from "pg";
import { createLogger } from "@/infrastructure/logger/logger";

const log = createLogger("api.health");

export async function GET() {
  const connectionString = process.env.DATABASE_URL;
  log.info({ connectionString: connectionString ? connectionString.substring(0, 50) + "..." : "unset" }, "Health check");

  if (!connectionString) {
    return NextResponse.json(
      { status: "unhealthy", error: "DATABASE_URL not set", timestamp: new Date().toISOString() },
      { status: 503 }
    );
  }

  const pool = new Pool({ connectionString });

  try {
    const result = await pool.query("SELECT 1");
    log.info({ result: result.rows }, "Database query successful");
    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error({ err: error, connectionString: connectionString.substring(0, 50) + "..." }, "Health check failed");
    return NextResponse.json(
      {
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  } finally {
    await pool.end();
  }
}
