import { schoolCounters, feeReceipts, feeInvoices, students } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

export type EntityCounterType = "RECEIPT" | "INVOICE" | "ADMISSION" | "ROLL_NUMBER";

/**
 * Atomically generates the next sequential number for an entity in a school.
 * Uses PostgreSQL row-level locking via UPDATE ... RETURNING or ON CONFLICT DO UPDATE
 * to guarantee monotonic uniqueness without race conditions under concurrent load.
 */
export async function getNextAtomicSequence(
  tx: any,
  schoolId: string,
  entityType: EntityCounterType
): Promise<number> {
  // 1. Try to lock and increment the existing counter atomically
  const [updated] = await tx
    .update(schoolCounters)
    .set({
      currentVal: sql`${schoolCounters.currentVal} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schoolCounters.schoolId, schoolId),
        eq(schoolCounters.entityType, entityType)
      )
    )
    .returning({ currentVal: schoolCounters.currentVal });

  if (updated) {
    return updated.currentVal;
  }

  // 2. If row does not exist yet, determine the initial seed from existing records to avoid collisions
  let initialVal = 0;
  if (entityType === "RECEIPT") {
    const [res] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(feeReceipts)
      .where(eq(feeReceipts.schoolId, schoolId));
    initialVal = Number(res?.count || 0);
  } else if (entityType === "INVOICE") {
    const [res] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(feeInvoices)
      .where(eq(feeInvoices.schoolId, schoolId));
    initialVal = Number(res?.count || 0);
  } else if (entityType === "ADMISSION") {
    const [res] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(students)
      .where(eq(students.schoolId, schoolId));
    initialVal = Number(res?.count || 0);
  }

  const nextVal = initialVal + 1;

  // Insert or increment on conflict if another worker created it simultaneously
  const [upserted] = await tx
    .insert(schoolCounters)
    .values({
      schoolId,
      entityType,
      currentVal: nextVal,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [schoolCounters.schoolId, schoolCounters.entityType],
      set: {
        currentVal: sql`${schoolCounters.currentVal} + 1`,
        updatedAt: new Date(),
      },
    })
    .returning({ currentVal: schoolCounters.currentVal });

  return upserted.currentVal;
}

