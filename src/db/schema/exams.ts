import {
  pgTable,
  text,
  varchar,
  integer,
  numeric,
  boolean,
  timestamp,
  date,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { schools, academicYears, users } from "./core";
import { classes, subjects } from "./academics";
import { enrollments } from "./students";

export const examTerms = pgTable(
  "exam_terms",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    academicYearId: varchar("academic_year_id", { length: 36 }).notNull().references(() => academicYears.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 50 }).notNull(), // e.g., "Term 1", "Final Term"
    weightagePercent: numeric("weightage_percent", { precision: 5, scale: 2 }).notNull().default("100.00"),
    orderIndex: integer("order_index").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("exam_terms_year_idx").on(table.schoolId, table.academicYearId),
  ]
);

export const exams = pgTable(
  "exams",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    termId: varchar("term_id", { length: 36 }).notNull().references(() => examTerms.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // e.g., "Unit Test 1", "Midterm"
    aggregationRule: varchar("aggregation_rule", { length: 20 }).$type<"SUM" | "AVERAGE" | "WEIGHTED" | "BEST_OF_N">().notNull().default("SUM"),
    weightage: numeric("weightage", { precision: 5, scale: 2 }).default("100.00"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("exams_term_idx").on(table.schoolId, table.termId),
  ]
);

export const examSchedules = pgTable(
  "exam_schedules",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    examId: varchar("exam_id", { length: 36 }).notNull().references(() => exams.id, { onDelete: "cascade" }),
    classId: varchar("class_id", { length: 36 }).notNull().references(() => classes.id, { onDelete: "cascade" }),
    subjectId: varchar("subject_id", { length: 36 }).notNull().references(() => subjects.id, { onDelete: "cascade" }),
    examDate: date("exam_date"),
    maxTheoryMarks: numeric("max_theory_marks", { precision: 6, scale: 2 }).notNull(),
    maxPracticalMarks: numeric("max_practical_marks", { precision: 6, scale: 2 }).notNull().default("0.00"),
    passMarks: numeric("pass_marks", { precision: 6, scale: 2 }).notNull(),
    isLocked: boolean("is_locked").notNull().default(false),
    lockedById: varchar("locked_by_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("exam_sched_lookup_idx").on(table.examId, table.classId, table.subjectId),
    uniqueIndex("exam_sched_unique").on(table.examId, table.classId, table.subjectId),
  ]
);

export const examMarks = pgTable(
  "exam_marks",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    examScheduleId: varchar("exam_schedule_id", { length: 36 }).notNull().references(() => examSchedules.id, { onDelete: "cascade" }),
    enrollmentId: varchar("enrollment_id", { length: 36 }).notNull().references(() => enrollments.id, { onDelete: "cascade" }),
    theoryMarks: numeric("theory_marks", { precision: 6, scale: 2 }), // null if absent/exempt
    practicalMarks: numeric("practical_marks", { precision: 6, scale: 2 }),
    graceMarks: numeric("grace_marks", { precision: 6, scale: 2 }).notNull().default("0.00"),
    attendanceStatus: varchar("attendance_status", { length: 10 }).$type<"PRESENT" | "AB" | "ML" | "EX">().notNull().default("PRESENT"),
    enteredById: varchar("entered_by_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    remarks: text("remarks"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("exam_marks_sched_enrollment_unique").on(table.examScheduleId, table.enrollmentId),
    index("exam_marks_enrollment_idx").on(table.enrollmentId),
  ]
);
