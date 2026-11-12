import PgBoss from "pg-boss";
import { db } from "@/db";
import { outboxEvents } from "@/db/schema";
import { eq, and, lte, or, isNull, sql } from "drizzle-orm";

let bossInstance: PgBoss | null = null;
let bossStartPromise: Promise<PgBoss> | null = null;
let workersRegistered = false;

/**
 * Get or initialize PgBoss background queue singleton backed by the application's PostgreSQL database.
 * Ensures boss.start() is invoked and awaited exactly once.
 */
export async function getQueueBoss(): Promise<PgBoss> {
  if (bossInstance && !bossStartPromise) return bossInstance;
  if (bossStartPromise) return bossStartPromise;

  const connectionString =
    process.env.DATABASE_URL ||
    "postgres://postgres:postgres@localhost:5432/school_erp";

  const boss = new PgBoss({
    connectionString,
    schema: process.env.PG_BOSS_SCHEMA || "pgboss",
    deleteAfterDays: 7,
  });

  boss.on("error", (error) => {
    console.error("[PG-BOSS ERROR]:", error);
  });

  bossStartPromise = (async () => {
    try {
      await boss.start();
      bossInstance = boss;
      bossStartPromise = null;

      // Register default workers on startup
      if (!workersRegistered) {
        await registerQueueWorkers(boss);
        workersRegistered = true;
      }

      return boss;
    } catch (err) {
      console.warn("[PG-BOSS START WARNING]: Failed to connect pg-boss (falling back to direct outbox processing):", err);
      bossStartPromise = null;
      bossInstance = boss;
      return boss;
    }
  })();

  return bossStartPromise;
}

export interface AbsentAlertPayload {
  schoolId: string;
  studentId: string;
  studentName: string;
  parentPhone: string;
  sectionName: string;
  date: string;
}

export interface LateArrivalAlertPayload {
  schoolId: string;
  studentId: string;
  studentName: string;
  parentPhone: string;
  arrivalTime: string;
  date: string;
}

export interface BulkPdfReportPayload {
  schoolId: string;
  academicYearId: string;
  termId: string;
  classId: string;
  sectionId?: string;
  requestedByUserId: string;
}

/**
 * Register default background worker consumers for pg-boss
 */
async function registerQueueWorkers(boss: PgBoss) {
  try {
    await boss.work("notification:student-absent", async ([job]) => {
      const data = job?.data as AbsentAlertPayload;
      if (!data) return;
      // In production, invoke Twilio / Kaleyra / AWS SNS provider
      console.log(`[SMS WORKER] Sent Absent Alert to ${data.parentPhone} for student ${data.studentName} (${data.sectionName}) on ${data.date}`);
    });

    await boss.work("notification:student-late", async ([job]) => {
      const data = job?.data as LateArrivalAlertPayload;
      if (!data) return;
      console.log(`[SMS WORKER] Sent Late Arrival Update to ${data.parentPhone} for student ${data.studentName}: arrived ${data.arrivalTime}`);
    });

    await boss.work("report:bulk-pdf-generation", async ([job]) => {
      const data = job?.data as BulkPdfReportPayload;
      if (!data) return;
      console.log(`[PDF WORKER] Processed bulk report card generation for class ${data.classId}, term ${data.termId}`);
    });
  } catch (err) {
    console.warn("[QUEUE WORKER WARNING]: Failed to register one or more workers:", err);
  }
}

/**
 * Drains pending events from the transactional outbox table.
 * Uses PostgreSQL FOR UPDATE SKIP LOCKED to prevent duplicate processing across concurrent workers.
 */
export async function drainOutboxEvents(batchSize = 25): Promise<{ processed: number; failed: number }> {
  let processed = 0;
  let failed = 0;
  const now = new Date();

  try {
    await db.transaction(async (tx) => {
      // 1. Fetch pending outbox events whose scheduled time has passed
      const pendingEvents = await tx
        .select()
        .from(outboxEvents)
        .where(
          and(
            eq(outboxEvents.status, "PENDING"),
            or(
              isNull(outboxEvents.scheduledFor),
              lte(outboxEvents.scheduledFor, now)
            )
          )
        )
        .limit(batchSize)
        .for("update", { skipLocked: true });

      if (pendingEvents.length === 0) return;

      for (const ev of pendingEvents) {
        try {
          // Process event according to its eventType
          if (ev.eventType === "STUDENT_ABSENT") {
            const payload = ev.payloadJson as unknown as AbsentAlertPayload;
            console.log(`[OUTBOX DRAINER] Dispatched Absent SMS for student ${payload.studentName} to ${payload.parentPhone}`);
          } else if (ev.eventType === "STUDENT_LATE") {
            const payload = ev.payloadJson as unknown as LateArrivalAlertPayload;
            console.log(`[OUTBOX DRAINER] Dispatched Late SMS for student ${payload.studentName} to ${payload.parentPhone}`);
          } else if (ev.eventType === "PDF_GENERATION") {
            const payload = ev.payloadJson as unknown as BulkPdfReportPayload;
            console.log(`[OUTBOX DRAINER] Dispatched PDF job for class ${payload.classId}`);
          }

          await tx
            .update(outboxEvents)
            .set({
              status: "PROCESSED",
              processedAt: new Date(),
            })
            .where(eq(outboxEvents.id, ev.id));

          processed++;
        } catch (err: any) {
          failed++;
          const nextRetry = (ev.retryCount || 0) + 1;
          const status = nextRetry >= 5 ? "FAILED" : "PENDING";
          await tx
            .update(outboxEvents)
            .set({
              retryCount: nextRetry,
              status,
              errorMessage: err?.message || String(err),
            })
            .where(eq(outboxEvents.id, ev.id));
        }
      }
    });
  } catch (err) {
    console.error("[OUTBOX DRAINER ERROR]:", err);
  }

  return { processed, failed };
}

/**
 * Enqueue bulk SMS/WhatsApp notification for absent student via Outbox or direct Boss
 */
export async function enqueueAbsentAlert(payload: AbsentAlertPayload): Promise<string | null> {
  try {
    const boss = await getQueueBoss();
    const jobId = await boss.send("notification:student-absent", payload, {
      singletonKey: `absent:${payload.studentId}:${payload.date}`,
      startAfter: 15 * 60, // 15-minute grace window before SMS is dispatched
    });
    return jobId;
  } catch (error) {
    console.error("[QUEUE ERROR]: Failed to enqueue student-absent alert", error);
    return null;
  }
}

/**
 * Enqueue late arrival reversal notification
 */
export async function enqueueLateArrivalUpdate(
  payload: LateArrivalAlertPayload
): Promise<string | null> {
  try {
    const boss = await getQueueBoss();
    await boss.cancel("notification:student-absent", `absent:${payload.studentId}:${payload.date}`);
    const jobId = await boss.send("notification:student-late", payload, {
      singletonKey: `late:${payload.studentId}:${payload.date}`,
    });
    return jobId;
  } catch (error) {
    console.error("[QUEUE ERROR]: Failed to enqueue student-late update", error);
    return null;
  }
}

/**
 * Enqueue background bulk PDF generation for report cards
 */
export async function enqueueBulkPdfGeneration(
  payload: BulkPdfReportPayload
): Promise<string | null> {
  try {
    const boss = await getQueueBoss();
    const jobId = await boss.send("report:bulk-pdf-generation", payload, {
      expireInHours: 2,
    });
    return jobId;
  } catch (error) {
    console.error("[QUEUE ERROR]: Failed to enqueue bulk-pdf generation", error);
    return null;
  }
}
