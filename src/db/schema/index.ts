import { relations } from "drizzle-orm";
import * as core from "./core";
import * as academics from "./academics";
import * as students from "./students";
import * as operations from "./operations";
import * as finance from "./finance";
import * as exams from "./exams";
import * as addons from "./addons";

export * from "./core";
export * from "./academics";
export * from "./students";
export * from "./operations";
export * from "./finance";
export * from "./exams";
export * from "./addons";

// Core Relations
export const schoolsRelations = relations(core.schools, ({ many }) => ({
  academicYears: many(core.academicYears),
  users: many(core.users),
  auditLogs: many(core.auditLogs),
  classes: many(academics.classes),
  students: many(students.students),
  feeHeads: many(finance.feeHeads),
  notices: many(addons.notices),
}));

export const academicYearsRelations = relations(core.academicYears, ({ one, many }) => ({
  school: one(core.schools, {
    fields: [core.academicYears.schoolId],
    references: [core.schools.id],
  }),
  enrollments: many(students.enrollments),
  feeInvoices: many(finance.feeInvoices),
  feeReceipts: many(finance.feeReceipts),
  attendance: many(operations.attendance),
  examTerms: many(exams.examTerms),
}));

export const usersRelations = relations(core.users, ({ one, many }) => ({
  school: one(core.schools, {
    fields: [core.users.schoolId],
    references: [core.schools.id],
  }),
  staffProfile: one(addons.staffProfiles, {
    fields: [core.users.id],
    references: [addons.staffProfiles.userId],
  }),
  classTeacherSections: many(academics.sections),
  auditLogs: many(core.auditLogs),
}));

// Academic Relations
export const classesRelations = relations(academics.classes, ({ one, many }) => ({
  school: one(core.schools, {
    fields: [academics.classes.schoolId],
    references: [core.schools.id],
  }),
  sections: many(academics.sections),
  enrollments: many(students.enrollments),
  feeStructures: many(finance.feeStructures),
}));

export const sectionsRelations = relations(academics.sections, ({ one, many }) => ({
  class: one(academics.classes, {
    fields: [academics.sections.classId],
    references: [academics.classes.id],
  }),
  classTeacher: one(core.users, {
    fields: [academics.sections.classTeacherId],
    references: [core.users.id],
  }),
  enrollments: many(students.enrollments),
  timetableSlots: many(operations.timetableSlots),
  classSubjects: many(academics.classSubjects),
}));

// Student Relations
export const familiesRelations = relations(students.families, ({ one, many }) => ({
  school: one(core.schools, {
    fields: [students.families.schoolId],
    references: [core.schools.id],
  }),
  students: many(students.students),
}));

export const studentsRelations = relations(students.students, ({ one, many }) => ({
  school: one(core.schools, {
    fields: [students.students.schoolId],
    references: [core.schools.id],
  }),
  family: one(students.families, {
    fields: [students.students.familyId],
    references: [students.families.id],
  }),
  enrollments: many(students.enrollments),
  invoices: many(finance.feeInvoices),
  receipts: many(finance.feeReceipts),
  concessions: many(finance.studentConcessions),
  transport: one(addons.studentTransport, {
    fields: [students.students.id],
    references: [addons.studentTransport.studentId],
  }),
}));

export const enrollmentsRelations = relations(students.enrollments, ({ one, many }) => ({
  student: one(students.students, {
    fields: [students.enrollments.studentId],
    references: [students.students.id],
  }),
  academicYear: one(core.academicYears, {
    fields: [students.enrollments.academicYearId],
    references: [core.academicYears.id],
  }),
  class: one(academics.classes, {
    fields: [students.enrollments.classId],
    references: [academics.classes.id],
  }),
  section: one(academics.sections, {
    fields: [students.enrollments.sectionId],
    references: [academics.sections.id],
  }),
  attendance: many(operations.attendance),
  examMarks: many(exams.examMarks),
  feeInvoices: many(finance.feeInvoices),
}));

// Finance Relations
export const feeInvoicesRelations = relations(finance.feeInvoices, ({ one, many }) => ({
  student: one(students.students, {
    fields: [finance.feeInvoices.studentId],
    references: [students.students.id],
  }),
  enrollment: one(students.enrollments, {
    fields: [finance.feeInvoices.enrollmentId],
    references: [students.enrollments.id],
  }),
  items: many(finance.feeInvoiceItems),
}));

export const feeInvoiceItemsRelations = relations(finance.feeInvoiceItems, ({ one }) => ({
  invoice: one(finance.feeInvoices, {
    fields: [finance.feeInvoiceItems.invoiceId],
    references: [finance.feeInvoices.id],
  }),
  feeHead: one(finance.feeHeads, {
    fields: [finance.feeInvoiceItems.feeHeadId],
    references: [finance.feeHeads.id],
  }),
}));

export const feeReceiptsRelations = relations(finance.feeReceipts, ({ one }) => ({
  student: one(students.students, {
    fields: [finance.feeReceipts.studentId],
    references: [students.students.id],
  }),
  collectedBy: one(core.users, {
    fields: [finance.feeReceipts.collectedById],
    references: [core.users.id],
  }),
}));

// Operations & Exams Relations
export const attendanceRelations = relations(operations.attendance, ({ one }) => ({
  enrollment: one(students.enrollments, {
    fields: [operations.attendance.enrollmentId],
    references: [students.enrollments.id],
  }),
  markedBy: one(core.users, {
    fields: [operations.attendance.markedById],
    references: [core.users.id],
  }),
}));

export const examMarksRelations = relations(exams.examMarks, ({ one }) => ({
  schedule: one(exams.examSchedules, {
    fields: [exams.examMarks.examScheduleId],
    references: [exams.examSchedules.id],
  }),
  enrollment: one(students.enrollments, {
    fields: [exams.examMarks.enrollmentId],
    references: [students.enrollments.id],
  }),
}));
