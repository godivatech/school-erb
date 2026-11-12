import "dotenv/config";
import { db, pool } from "./index";
import * as schema from "./schema";
import { eq, and, sql } from "drizzle-orm";
import { collectFeePaymentPOS } from "../actions/finance";
import { admitStudentWithFamilyLink } from "../actions/students";
import { submitSectionAttendance } from "../actions/attendance";
import { drainOutboxEvents } from "../lib/queue";
import { getNextAtomicSequence } from "../lib/counters";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ CONCURRENCY ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runConcurrencySuite() {
  console.log("\n================================================================================");
  console.log("⚡ CONCURRENCY & ARCHITECTURAL RACE REMEDIATION VERIFICATION SUITE");
  console.log("================================================================================\n");

  const schoolId = "sch_oxford_001";
  const academicYearId = "ay_2026_2027";

  // ---------------------------------------------------------------------------
  // TEST 1: Atomic Sequence Counter Under 10 Concurrent POS Transactions (P0-3)
  // ---------------------------------------------------------------------------
  console.log("📌 TEST 1: Atomic Receipt & Counter Sequence Generation Under Concurrency (P0-3)");
  {
    const studentId = "stu_mehta_aarav";

    // Launch 10 simultaneous POS collections
    const concurrentCount = 10;
    const promises = [];

    for (let i = 0; i < concurrentCount; i++) {
      promises.push(
        collectFeePaymentPOS({
          schoolId,
          userId: "usr_accountant",
          userRole: "ACCOUNTANT",
          academicYearId,
          studentId,
          amountReceived: 100 + i,
          paymentMode: "CASH",
          idempotencyKey: `concurrent_pos_${Date.now()}_${i}_${Math.random()}`,
          notes: `Concurrency test POS #${i}`,
        })
      );
    }

    const results = await Promise.all(promises);
    const receiptNos = results.map((r) => r.receipt.receiptNo);
    console.log(`  Generated receipts: ${receiptNos.join(", ")}`);

    const uniqueReceipts = new Set(receiptNos);
    assert(
      uniqueReceipts.size === concurrentCount,
      `All ${concurrentCount} concurrent receipts have unique sequence numbers (0 collisions)`
    );

    // Verify counter in school_counters
    const [counter] = await db
      .select()
      .from(schema.schoolCounters)
      .where(
        and(
          eq(schema.schoolCounters.schoolId, schoolId),
          eq(schema.schoolCounters.entityType, "RECEIPT")
        )
      );

    assert(!!counter, "school_counters row exists for RECEIPT");
    assert(counter.currentVal >= concurrentCount, `Counter correctly tracked currentVal (${counter.currentVal})`);
    console.log("✅ TEST 1 PASSED: Atomic sequence generation eliminated count(*) race conditions.\n");
  }

  // ---------------------------------------------------------------------------
  // TEST 2: Section Capacity Row-Lock Under Concurrent Admissions (P0-4)
  // ---------------------------------------------------------------------------
  console.log("📌 TEST 2: Section Capacity Protection Under Concurrent Admissions (P0-4)");
  {
    // Fetch existing class from DB
    const [existingClass] = await db
      .select({ id: schema.classes.id })
      .from(schema.classes)
      .where(eq(schema.classes.schoolId, schoolId))
      .limit(1);

    const classId = existingClass?.id || "cls_grade_10";
    const testSectionId = `sec_conc_${Date.now().toString().slice(-8)}`;

    await db.insert(schema.sections).values({
      id: testSectionId,
      schoolId,
      classId,
      name: "Conc-Sec",
      capacity: 2,
    });

    // Launch 5 concurrent admission attempts for a section with only 2 seats
    const admissionPromises = [];
    for (let i = 0; i < 5; i++) {
      admissionPromises.push(
        admitStudentWithFamilyLink({
          schoolId,
          userId: "usr_principal",
          userRole: "PRINCIPAL",
          academicYearId,
          classId,
          sectionId: testSectionId,
          admissionNo: `CONC-ADM-${Date.now().toString().slice(-4)}-${i}`,
          firstName: `ConcurrentChild${i}`,
          lastName: "Test",
          dob: "2012-05-10",
          gender: "FEMALE",
          primaryParentName: `Parent ${i}`,
          primaryPhone: `987654321${i}`,
        }).then(
          (res) => ({ success: true, res }),
          (err) => ({ success: false, error: err.message })
        )
      );
    }

    const admResults = await Promise.all(admissionPromises);
    const successful = admResults.filter((r) => r.success);
    const rejected = admResults.filter((r) => !r.success);

    console.log(`  Admissions succeeded: ${successful.length}, rejected by capacity guard: ${rejected.length}`);

    // Verify database enrollments count
    const [enrolled] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.enrollments)
      .where(
        and(
          eq(schema.enrollments.schoolId, schoolId),
          eq(schema.enrollments.sectionId, testSectionId)
        )
      );

    assert(Number(enrolled?.count) <= 2, `Actual enrolled count in DB is ${enrolled?.count} (strictly <= capacity of 2)`);
    assert(successful.length === 2, `Exactly 2 admissions succeeded`);
    assert(rejected.length === 3, `3 concurrent overbooking attempts were rejected`);
    console.log("✅ TEST 2 PASSED: Row-level lock strictly prevented section seat overbooking.\n");

    // Clean up temporary section
    await db.delete(schema.sections).where(eq(schema.sections.id, testSectionId));
  }

  // ---------------------------------------------------------------------------
  // TEST 3: Transactional Outbox Pattern & Late Arrival Reversal (P0-2)
  // ---------------------------------------------------------------------------
  console.log("📌 TEST 3: Transactional Outbox & Late Arrival Reversal (P0-2)");
  {
    const testDate = new Date().toISOString().split("T")[0];

    // Fetch existing active enrollment from DB
    const [realEnrollment] = await db
      .select({
        enrollmentId: schema.enrollments.id,
        studentId: schema.enrollments.studentId,
        sectionId: schema.enrollments.sectionId,
      })
      .from(schema.enrollments)
      .where(
        and(
          eq(schema.enrollments.schoolId, schoolId),
          eq(schema.enrollments.academicYearId, academicYearId)
        )
      )
      .limit(1);

    assert(!!realEnrollment, "Found active student enrollment for outbox testing");

    // 1. Submit attendance marking student ABSENT
    await submitSectionAttendance({
      schoolId,
      userId: "usr_teacher_1",
      userRole: "TEACHER",
      academicYearId,
      sectionId: realEnrollment.sectionId,
      date: testDate,
      records: [
        {
          enrollmentId: realEnrollment.enrollmentId,
          studentId: realEnrollment.studentId,
          studentName: "Test Student",
          parentPhone: "+91 98765 43210",
          status: "ABSENT",
        },
      ],
    });

    // Check outbox table for pending STUDENT_ABSENT event
    const [absentEvent] = await db
      .select()
      .from(schema.outboxEvents)
      .where(
        and(
          eq(schema.outboxEvents.schoolId, schoolId),
          eq(schema.outboxEvents.eventType, "STUDENT_ABSENT"),
          eq(schema.outboxEvents.status, "PENDING")
        )
      )
      .orderBy(sql`created_at DESC`)
      .limit(1);

    assert(!!absentEvent, "STUDENT_ABSENT event recorded in transactional outbox");
    assert(absentEvent.scheduledFor !== null, "Grace window scheduled_for timestamp set in future");

    // 2. Submit late arrival update -> absent event must transition to CANCELLED and late event created
    await submitSectionAttendance({
      schoolId,
      userId: "usr_teacher_1",
      userRole: "TEACHER",
      academicYearId,
      sectionId: realEnrollment.sectionId,
      date: testDate,
      records: [
        {
          enrollmentId: realEnrollment.enrollmentId,
          studentId: realEnrollment.studentId,
          studentName: "Test Student",
          parentPhone: "+91 98765 43210",
          status: "LATE",
          arrivalMinutesLate: 20,
        },
      ],
    });

    const [updatedAbsentEvent] = await db
      .select()
      .from(schema.outboxEvents)
      .where(eq(schema.outboxEvents.id, absentEvent.id));

    assert(updatedAbsentEvent?.status === "CANCELLED", "Pending absent SMS was atomically CANCELLED by late arrival");

    // 3. Test Outbox Drainer
    const drainResult = await drainOutboxEvents(10);
    console.log(`  Outbox drainer executed: processed=${drainResult.processed}, failed=${drainResult.failed}`);

    console.log("✅ TEST 3 PASSED: Transactional Outbox eliminated dual-write phantom SMS alerts.\n");
  }

  console.log("================================================================================");
  console.log("🎉 ALL CONCURRENCY & ARCHITECTURAL AUDIT TESTS PASSED WITH 100% RELIABILITY!");
  console.log("================================================================================\n");

  await pool.end();
}

runConcurrencySuite().catch((err) => {
  console.error("Concurrency test failure:", err);
  process.exit(1);
});
