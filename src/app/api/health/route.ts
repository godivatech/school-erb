import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // Perform a lightweight ping to PostgreSQL
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: "connected",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: "unhealthy",
        error: error?.message || "Database connection error",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
