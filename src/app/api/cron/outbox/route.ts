import { NextResponse } from "next/server";
import { drainOutboxEvents } from "@/lib/queue";

export const dynamic = "force-dynamic";

/**
 * Validates request authorization using CRON_SECRET bearer token or header.
 */
function isAuthorized(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  const secretHeader = request.headers.get("x-cron-secret");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    const token = authHeader?.replace(/^Bearer\s+/i, "") || secretHeader;
    return token === cronSecret;
  }

  // In production, CRON_SECRET must be configured
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  // Allowed in development or testing environments when CRON_SECRET is unset
  return true;
}

async function handleDrainRequest(request: Request) {
  const startTime = Date.now();

  if (!isAuthorized(request)) {
    return NextResponse.json(
      {
        success: false,
        error: "UNAUTHORIZED",
        message: "Invalid or missing CRON_SECRET bearer authorization token.",
      },
      { status: 401 }
    );
  }

  try {
    const url = new URL(request.url);
    const rawBatch = parseInt(url.searchParams.get("batchSize") || "50", 10);
    const batchSize = Math.min(200, Math.max(1, isNaN(rawBatch) ? 50 : rawBatch));

    const result = await drainOutboxEvents(batchSize);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      batchSize,
      processed: result.processed,
      failed: result.failed,
    });
  } catch (error: any) {
    console.error("[CRON OUTBOX ERROR]:", error);
    return NextResponse.json(
      {
        success: false,
        error: "INTERNAL_ERROR",
        message: error?.message || "Failed to drain transactional outbox events",
        durationMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return handleDrainRequest(request);
}

export async function POST(request: Request) {
  return handleDrainRequest(request);
}

