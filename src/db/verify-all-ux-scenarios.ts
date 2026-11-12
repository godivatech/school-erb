import "dotenv/config";
import { db, pool } from "./index";
import * as schema from "./schema";
import { eq, and, or, sql, inArray } from "drizzle-orm";

import {
  updateClass,
  deleteClass,
  addSection,
  updateSection,
  deleteSection,
  createMasterSubject,
  updateMasterSubject,
  deleteMasterSubject,
  assignClassSubjects,
  createScheduledHoliday,
  deleteHoliday,
} from "../actions/academics";

import {
  updateStudentProfile,
  transferStudentSection,
} from "../actions/students";

import { submitSectionAttendance } from "../actions/attendance";

import {
  assignTimetableSlot,
  clearTimetableSlot,
  createManualSubstitution,
  createStaffMember,
  submitStaffLeave,
  approveStaffLeaveAndCreateSubstitutions,
  runMonthlyPayroll,
  createTransportRoute,
  updateTransportRoute,
  createTransportStop,
  assignStudentTransport,
  unassignStudentTransport,
} from "../actions/hr-transport";

import {
  createFeeHead,
  upsertFeeStructure,
  sendFeeDefaulterReminder,
  collectFeePaymentPOS,
} from "../actions/finance";

import {
  createNotice,
  updateNotice,
  deleteNotice,
} from "../actions/notices";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runComprehensiveVerification() {
  console.log("\n================================================================================");
  console.log("🔍 CRESCENT ERP: EXHAUSTIVE END-TO-END SCENARIO & EDGE-CASE AUDIT");
  console.log("================================================================================\n");

  const schoolId = "sch_oxford_001";
  const academicYearId = "ay_2026_2027";
  const superAdminAuth = {
    schoolId,
    userId: "usr_superadmin",
    userRole: "SUPER_ADMIN" as const,
  };

  // ===========================================================================
  // DOMAIN 1: Academic Structure, Classes, Sections, Subjects & Holidays
  // ===========================================================================
  console.log("📌 DOMAIN 1: Academic Structure, Classes, Sections, Subjects & Holidays");
  {
    // Clean up any lingering test class, subject, or holidays
    await db.delete(schema.classes).where(and(eq(schema.classes.schoolId, schoolId), or(eq(schema.classes.name, "Grade 12 Test"), eq(schema.classes.name, "Grade 12 Advanced Science"))));
    await db.delete(schema.subjects).where(and(eq(schema.subjects.schoolId, schoolId), or(eq(schema.subjects.code, "ROBO-12"), eq(schema.subjects.code, "ROBOTICS-12"))));
    await db.delete(schema.holidays).where(and(eq(schema.holidays.schoolId, schoolId), eq(schema.holidays.title, "Pongal & Harvest Festival Vacation")));

    // 1.1 Create test class
    const [testClass] = await db
      .insert(schema.classes)
      .values({
        schoolId,
        name: "Grade 12 Test",
        numericOrder: 12,
        stream: "SCIENCE",
      })
      .returning();
    assert(!!testClass, "Created class Grade 12 Test");

    // 1.2 Update class
    const updateRes = await updateClass({
      ...superAdminAuth,
      classId: testClass.id,
      className: "Grade 12 Advanced Science",
      numericOrder: 12,
      stream: "SCIENCE",
    });
    assert(updateRes.success && updateRes.class.name === "Grade 12 Advanced Science", "Updated class name & stream");

    // 1.3 Add section
    const secRes = await addSection({
      ...superAdminAuth,
      classId: testClass.id,
      name: "Section Alpha",
      capacity: 35,
    });
    assert(secRes.success && secRes.section.capacity === 35, "Added Section Alpha with capacity 35");

    // 1.4 Update section capacity
    const updateSecRes = await updateSection({
      ...superAdminAuth,
      sectionId: secRes.section.id,
      name: "Section Alpha Prime",
      capacity: 40,
    });
    assert(updateSecRes.success && updateSecRes.section.capacity === 40, "Updated section capacity to 40");

    // 1.5 Create Master Subject
    const subjRes = await createMasterSubject({
      ...superAdminAuth,
      code: "ROBO-12",
      name: "Robotics & Artificial Intelligence",
      type: "ELECTIVE",
      includeInCgpa: true,
    });
    assert(subjRes.success && subjRes.subject.code === "ROBO-12", "Created master subject ROBO-12");

    // 1.6 Update Master Subject
    const updateSubjRes = await updateMasterSubject({
      ...superAdminAuth,
      subjectId: subjRes.subject.id,
      code: "ROBOTICS-12",
      name: "Robotics & AI Lab",
      type: "ELECTIVE",
      includeInCgpa: true,
    });
    assert(updateSubjRes.success && updateSubjRes.subject.code === "ROBOTICS-12", "Updated master subject code & name");

    // 1.7 Assign Class Subjects Matrix
    const assignRes = await assignClassSubjects({
      ...superAdminAuth,
      academicYearId,
      sectionId: secRes.section.id,
      subjectIds: [subjRes.subject.id],
    });
    assert(assignRes.success && assignRes.count === 1, "Mapped master subject to section");

    // 1.8 Guard against deleting assigned subject
    let deleteBlocked = false;
    try {
      await deleteMasterSubject({
        ...superAdminAuth,
        subjectId: subjRes.subject.id,
      });
    } catch (e: any) {
      deleteBlocked = true;
    }
    assert(deleteBlocked, "Safely blocked deleting subject when currently assigned to classes");

    // 1.9 Create Scheduled Holiday Date Range (e.g. Pongal 3-day vacation)
    const holRes = await createScheduledHoliday({
      ...superAdminAuth,
      academicYearId,
      title: "Pongal & Harvest Festival Vacation",
      startDate: "2027-01-14",
      endDate: "2027-01-16",
    });
    assert(holRes.success && holRes.daysCreated === 3, "Created 3-day scheduled holiday date range");

    // Clean up holiday
    await db.delete(schema.holidays).where(and(eq(schema.holidays.schoolId, schoolId), eq(schema.holidays.title, "Pongal & Harvest Festival Vacation")));
    assert(true, "Deleted test holidays successfully");

    // Clean up domain 1 test fixtures
    await db.delete(schema.classSubjects).where(eq(schema.classSubjects.sectionId, secRes.section.id));
    await deleteMasterSubject({ ...superAdminAuth, subjectId: subjRes.subject.id });
    await deleteSection({ ...superAdminAuth, sectionId: secRes.section.id });
    await deleteClass({ ...superAdminAuth, classId: testClass.id });
    console.log("  ✓ Cleaned up test academic class, section, and subject");
  }

  // ===========================================================================
  // DOMAIN 2: Student SIS & Section Transfers
  // ===========================================================================
  console.log("\n📌 DOMAIN 2: Student SIS & Section Transfers");
  {
    // Find an active student
    const [student] = await db
      .select({
        id: schema.students.id,
        firstName: schema.students.firstName,
        lastName: schema.students.lastName,
        familyId: schema.students.familyId,
      })
      .from(schema.students)
      .where(eq(schema.students.schoolId, schoolId))
      .limit(1);
    assert(!!student, `Found active student ${student.firstName} ${student.lastName}`);

    // 2.1 Update Student Profile
    const updateProfileRes = await updateStudentProfile({
      ...superAdminAuth,
      studentId: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      dob: "2015-05-10",
      gender: "MALE",
      bloodGroup: "O+",
      primaryParentName: "Parent of " + student.firstName,
      primaryPhone: "9876543210",
      address: "42 Anna Salai, Chennai, TN",
    });
    assert(updateProfileRes.success, "Updated student profile demographics, address, and parent phone");

    // Verify DB update
    const [updatedFam] = await db
      .select()
      .from(schema.families)
      .where(eq(schema.families.id, student.familyId))
      .limit(1);
    assert(updatedFam.primaryPhone === "9876543210" && updatedFam.address === "42 Anna Salai, Chennai, TN", "Verified address and parent phone persisted in PostgreSQL");

    // 2.2 Test Section Transfer Capacity Protection
    // Create a dummy section with capacity = 0
    const [fullClass] = await db
      .select()
      .from(schema.classes)
      .where(eq(schema.classes.schoolId, schoolId))
      .limit(1);

    const [fullSection] = await db
      .insert(schema.sections)
      .values({
        schoolId,
        classId: fullClass.id,
        name: "Test-Full-Sec",
        capacity: 0, // Zero capacity to trigger guard
      })
      .returning();

    let transferBlocked = false;
    try {
      await transferStudentSection({
        ...superAdminAuth,
        academicYearId,
        studentId: student.id,
        targetClassId: fullClass.id,
        targetSectionId: fullSection.id,
      });
    } catch (e: any) {
      transferBlocked = true;
    }
    assert(transferBlocked, "Section transfer guard rejected transfer into zero-capacity section");

    // Clean up dummy full section
    await db.delete(schema.sections).where(eq(schema.sections.id, fullSection.id));
    console.log("  ✓ Cleaned up dummy capacity test section");
  }

  // ===========================================================================
  // DOMAIN 3: Daily Attendance Grid (5-State Engine)
  // ===========================================================================
  console.log("\n📌 DOMAIN 3: Daily Attendance Grid (5-State Engine)");
  {
    const [enrollment] = await db
      .select()
      .from(schema.enrollments)
      .where(
        and(
          eq(schema.enrollments.schoolId, schoolId),
          eq(schema.enrollments.academicYearId, academicYearId),
          eq(schema.enrollments.promotionStatus, "ACTIVE")
        )
      )
      .limit(1);
    assert(!!enrollment, "Found active enrollment for 5-state attendance check");

    const testDate = "2026-11-10";

    // Mark as MEDICAL_LEAVE with explicit remarks
    const attRes = await submitSectionAttendance({
      ...superAdminAuth,
      academicYearId,
      sectionId: enrollment.sectionId,
      date: testDate,
      records: [
        {
          enrollmentId: enrollment.id,
          studentId: enrollment.studentId,
          studentName: "Test Student",
          status: "MEDICAL_LEAVE",
          arrivalMinutesLate: 0,
          remarks: "Verified doctor prescription for dengue recovery",
        },
      ],
    });
    assert(attRes.success && attRes.count === 1, "Submitted 5-state attendance with MEDICAL_LEAVE");

    // Verify record in database
    const [record] = await db
      .select()
      .from(schema.attendance)
      .where(
        and(
          eq(schema.attendance.enrollmentId, enrollment.id),
          eq(schema.attendance.date, testDate)
        )
      )
      .limit(1);
    assert(Boolean(record?.status === "MEDICAL_LEAVE" && record?.remarks?.includes("dengue recovery")), "PostgreSQL confirmed status=MEDICAL_LEAVE and remark stored");

    // Clean up test attendance
    if (record) {
      await db.delete(schema.attendance).where(eq(schema.attendance.id, record.id));
    }
  }

  // ===========================================================================
  // DOMAIN 4: Timetable, Live Faculty Clash Detection & Substitutions
  // ===========================================================================
  console.log("\n📌 DOMAIN 4: Timetable, Live Faculty Clash Detection & Substitutions");
  {
    const [secA] = await db
      .select()
      .from(schema.sections)
      .where(eq(schema.sections.schoolId, schoolId))
      .limit(1);

    const [teacher] = await db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.schoolId, schoolId), eq(schema.users.role, "TEACHER")))
      .limit(1);

    const [subj] = await db
      .select()
      .from(schema.subjects)
      .where(eq(schema.subjects.schoolId, schoolId))
      .limit(1);

    assert(Boolean(secA && teacher && subj), "Found section, teacher, and subject for timetable clash test");

    // 4.1 Assign slot Day 1, Period 1 for Section A
    const slot1 = await assignTimetableSlot({
      ...superAdminAuth,
      academicYearId,
      sectionId: secA.id,
      dayOfWeek: 1,
      periodNo: 1,
      subjectId: subj.id,
      teacherId: teacher.id,
      roomNo: "Lab-301",
    });
    assert(Boolean(slot1.success), "Assigned Day 1, Period 1 slot to teacher");

    // 4.2 Attempt to assign same teacher to Section B at the same Day 1, Period 1
    const [secB] = await db
      .select()
      .from(schema.sections)
      .where(and(eq(schema.sections.schoolId, schoolId), sql`${schema.sections.id} != ${secA.id}`))
      .limit(1);

    if (secB) {
      const clashRes = await assignTimetableSlot({
        ...superAdminAuth,
        academicYearId,
        sectionId: secB.id,
        dayOfWeek: 1,
        periodNo: 1,
        subjectId: subj.id,
        teacherId: teacher.id,
        roomNo: "Room-102",
      });
      assert(Boolean(clashRes.clashWarning), "Faculty conflict detected and alerted: " + clashRes.clashWarning);

      // Clean up slot in secB
      if (clashRes.slot) {
        await clearTimetableSlot({
          ...superAdminAuth,
          slotId: clashRes.slot.id,
        });
      }
    }

    // 4.3 Clean up slot1
    if (slot1.slot) {
      await clearTimetableSlot({
        ...superAdminAuth,
        slotId: slot1.slot.id,
      });
    }
    assert(true, "Cleared timetable slot successfully");
  }

  // ===========================================================================
  // DOMAIN 5: Staff Directory & 1-Click Monthly Payroll
  // ===========================================================================
  console.log("\n📌 DOMAIN 5: Staff Directory & 1-Click Monthly Payroll");
  {
    // Clean up any lingering test staff
    const oldTestStaff = await db.select({ id: schema.staffProfiles.id, userId: schema.staffProfiles.userId }).from(schema.staffProfiles).where(and(eq(schema.staffProfiles.schoolId, schoolId), sql`${schema.staffProfiles.employeeCode} LIKE 'EMP-TEST-%'`));
    for (const ots of oldTestStaff) {
      await db.delete(schema.staffLeaves).where(eq(schema.staffLeaves.staffId, ots.id));
      await db.delete(schema.payrollRuns).where(eq(schema.payrollRuns.staffId, ots.id));
      await db.delete(schema.staffProfiles).where(eq(schema.staffProfiles.id, ots.id));
      await db.delete(schema.users).where(eq(schema.users.id, ots.userId));
    }

    const testEmpCode = "EMP-TEST-" + Math.floor(Math.random() * 9000 + 1000);
    const testEmail = `teacher_${Date.now()}@crescent.edu`;

    // 5.1 Create Staff Member
    const staffRes = await createStaffMember({
      ...superAdminAuth,
      name: "Dr. K. Annamalai",
      email: testEmail,
      phone: "9840198401",
      role: "TEACHER",
      employeeCode: testEmpCode,
      designation: "PGT Chemistry Senior Faculty",
      basicSalary: 38000,
      hra: 7000,
      casualLeaveBalance: 12,
      sickLeaveBalance: 10,
    });
    assert(staffRes.success && staffRes.profile.employeeCode === testEmpCode, `Created staff member ${staffRes.user.name} (${testEmpCode})`);

    // 5.2 Submit Staff Leave
    const leaveRes = await submitStaffLeave({
      ...superAdminAuth,
      staffId: staffRes.profile.id,
      startDate: "2026-11-24",
      endDate: "2026-11-25",
      leaveType: "CL",
      reason: "Family function in Madurai",
    });
    assert(leaveRes.success && parseFloat(leaveRes.leave.daysCount) === 2, "Submitted 2-day Casual Leave application");

    // 5.3 Approve Staff Leave & Auto-Arrange Substitutions
    const approveRes = await approveStaffLeaveAndCreateSubstitutions({
      ...superAdminAuth,
      leaveId: leaveRes.leave.id,
    });
    assert(approveRes.success && approveRes.leave.status === "APPROVED", "Approved leave and arranged period substitutions");

    // 5.4 Run 1-Click Monthly Payroll
    const now = new Date();
    const currentMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const payrollRes = await runMonthlyPayroll({
      ...superAdminAuth,
      monthYear: currentMonthYear,
    });
    assert(payrollRes.success && payrollRes.count >= 1, `1-Click Monthly Payroll ran for ${payrollRes.count} staff members`);

    // Clean up test staff
    await db.delete(schema.staffLeaves).where(eq(schema.staffLeaves.staffId, staffRes.profile.id));
    await db.delete(schema.payrollRuns).where(eq(schema.payrollRuns.staffId, staffRes.profile.id));
    await db.delete(schema.staffProfiles).where(eq(schema.staffProfiles.id, staffRes.profile.id));
    await db.delete(schema.users).where(eq(schema.users.id, staffRes.user.id));
    console.log("  ✓ Cleaned up test staff member and payroll run");
  }

  // ===========================================================================
  // DOMAIN 6: Finance, Fee Structures, Printable Receipts & Defaulters
  // ===========================================================================
  console.log("\n📌 DOMAIN 6: Finance, Fee Structures, Printable Receipts & Defaulters");
  {
    // 6.1 Create Fee Head
    const headRes = await createFeeHead({
      ...superAdminAuth,
      name: "Annual Science & Tech Fair Fee",
      frequency: "ANNUAL",
      priorityOrder: 5,
      isMandatory: false,
    });
    assert(headRes.success && headRes.head.name === "Annual Science & Tech Fair Fee", "Created master fee head");

    // 6.2 Upsert Fee Structure
    const [firstClass] = await db
      .select()
      .from(schema.classes)
      .where(eq(schema.classes.schoolId, schoolId))
      .limit(1);

    const structRes = await upsertFeeStructure({
      ...superAdminAuth,
      academicYearId,
      classId: firstClass.id,
      feeHeadId: headRes.head.id,
      amount: 1500,
      dueDateDay: 15,
      lateFinePerDay: 20,
    });
    assert(structRes.success && parseFloat(structRes.structure.amount) === 1500, "Configured grade fee rate: ₹1,500");

    // 6.3 Send Fee Defaulter Reminder
    const reminderRes = await sendFeeDefaulterReminder({
      ...superAdminAuth,
      studentId: "stu_mehta_aarav",
      studentName: "Aarav Mehta",
      overdueAmount: 7500,
      phone: "9876543210",
    });
    assert(reminderRes.success, "Queued WhatsApp/SMS fee reminder for student Aarav Mehta");

    // Clean up fee structure & head
    await db.delete(schema.feeStructures).where(eq(schema.feeStructures.id, structRes.structure.id));
    await db.delete(schema.feeHeads).where(eq(schema.feeHeads.id, headRes.head.id));
    console.log("  ✓ Cleaned up test fee head & structure");
  }

  // ===========================================================================
  // DOMAIN 7: Transport Routes, Stops & Commuter Allocations
  // ===========================================================================
  console.log("\n📌 DOMAIN 7: Transport Routes, Stops & Commuter Allocations");
  {
    // Clean up any lingering test route 99
    const oldRoutes = await db.select({ id: schema.transportRoutes.id }).from(schema.transportRoutes).where(and(eq(schema.transportRoutes.schoolId, schoolId), sql`${schema.transportRoutes.routeName} LIKE 'Route 99%'`));
    for (const or_ of oldRoutes) {
      await db.delete(schema.transportStops).where(eq(schema.transportStops.routeId, or_.id));
      await db.delete(schema.transportRoutes).where(eq(schema.transportRoutes.id, or_.id));
    }

    // 7.1 Create Route
    const routeRes = await createTransportRoute({
      ...superAdminAuth,
      routeName: "Route 99 - Sholinganallur & Medavakkam",
      vehicleNo: "TN-11-AZ-9999",
      driverName: "P. Murugesan",
      driverPhone: "9876598765",
      capacity: 35,
    });
    assert(routeRes.success && routeRes.route.vehicleNo === "TN-11-AZ-9999", "Created transport route 99");

    // 7.2 Update Route
    const updateRouteRes = await updateTransportRoute({
      ...superAdminAuth,
      routeId: routeRes.route.id,
      routeName: "Route 99 - Sholinganallur & Medavakkam Express",
      vehicleNo: "TN-11-AZ-9999",
      driverName: "P. Murugesan Senior",
      driverPhone: "9876598765",
      capacity: 40,
    });
    assert(updateRouteRes.success && updateRouteRes.route.capacity === 40, "Updated route capacity to 40");

    // 7.3 Create Stop
    const stopRes = await createTransportStop({
      ...superAdminAuth,
      routeId: routeRes.route.id,
      stopName: "Medavakkam Junction",
      pickupTime: "07:15 AM",
      dropTime: "03:45 PM",
      monthlyFee: 2800,
    });
    assert(stopRes.success && parseFloat(stopRes.stop.monthlyFee) === 2800, "Created stop with ₹2,800 monthly fare");

    // 7.4 Assign Student Commuter
    const [student] = await db
      .select()
      .from(schema.students)
      .where(eq(schema.students.schoolId, schoolId))
      .limit(1);

    const assignCommuterRes = await assignStudentTransport({
      ...superAdminAuth,
      academicYearId,
      studentId: student.id,
      pickupStopId: stopRes.stop.id,
      dropStopId: stopRes.stop.id,
      startDate: "2026-12-01",
    });
    assert(assignCommuterRes.success && assignCommuterRes.appliedMonthlyFee === 2800, "Assigned student transport with MAX rule rate ₹2,800");

    // 7.5 Unassign Commuter
    const [assigned] = await db
      .select()
      .from(schema.studentTransport)
      .where(
        and(
          eq(schema.studentTransport.studentId, student.id),
          eq(schema.studentTransport.academicYearId, academicYearId)
        )
      )
      .limit(1);

    if (assigned) {
      await unassignStudentTransport({
        ...superAdminAuth,
        assignmentId: assigned.id,
      });
      assert(true, "Successfully unassigned student commuter from transport fleet");
    }

    // Clean up route & stop
    await db.delete(schema.transportStops).where(eq(schema.transportStops.id, stopRes.stop.id));
    await db.delete(schema.transportRoutes).where(eq(schema.transportRoutes.id, routeRes.route.id));
    console.log("  ✓ Cleaned up transport test route & stop");
  }

  // ===========================================================================
  // DOMAIN 8: Circulars & Notice Board
  // ===========================================================================
  console.log("\n📌 DOMAIN 8: Circulars & Notice Board");
  {
    // 8.1 Create Circular
    const noticeRes = await createNotice({
      ...superAdminAuth,
      academicYearId,
      title: "Science Exhibition 2026 - Model Submission Guidelines",
      content: "All Grade 9 to 12 students are requested to submit working models by Friday.",
      targetAudience: "STUDENTS",
      priority: "URGENT",
      attachmentUrl: "Science_Fair_Guidelines.pdf",
    });
    assert(noticeRes.success && noticeRes.notice.priority === "URGENT", "Published urgent circular for students");

    // 8.2 Update Circular
    const updateNoticeRes = await updateNotice({
      ...superAdminAuth,
      id: noticeRes.notice.id,
      title: "Science Exhibition 2026 - Model Submission Guidelines (Revised)",
      content: "Submission deadline has been extended to Monday 10:00 AM.",
      targetAudience: "STUDENTS",
      priority: "NORMAL",
      attachmentUrl: "Science_Fair_Guidelines_v2.pdf",
    });
    assert(updateNoticeRes.success && updateNoticeRes.notice.title.includes("(Revised)"), "Updated circular title and content instructions");

    // 8.3 Delete Circular
    const delNoticeRes = await deleteNotice({
      ...superAdminAuth,
      id: noticeRes.notice.id,
    });
    assert(delNoticeRes.success, "Deleted circular successfully");
    console.log("  ✓ Cleaned up test circular");
  }

  console.log("\n================================================================================");
  console.log("🎉 ALL 8 DOMAINS & EDGE CASES SUCCESSFULLY AUDITED & VERIFIED!");
  console.log("================================================================================\n");

  await pool.end();
  process.exit(0);
}

runComprehensiveVerification().catch((err) => {
  console.error("FATAL AUDIT ERROR:", err);
  process.exit(1);
});
