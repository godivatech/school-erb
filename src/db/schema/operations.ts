import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  date,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { schools, academicYears, users } from "./core";
import { sections, subjects } from "./academics";
import { enrollments, students } from "./students";

export const attendance = pgTable(
  "attendance",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    academicYearId: varchar("academic_year_id", { length: 36 }).notNull().references(() => academicYears.id, { onDelete: "cascade" }),
    enrollmentId: varchar("enrollment_id", { length: 36 }).notNull().references(() => enrollments.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    status: varchar("status", { length: 20 }).$type<"PRESENT" | "ABSENT" | "LATE" | "HALF_DAY" | "MEDICAL_LEAVE">().notNull(),
    remarks: text("remarks"),
    arrivalMinutesLate: integer("arrival_minutes_late").default(0),
    markedById: varchar("marked_by_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("attendance_enrollment_date_unique").on(table.enrollmentId, table.date),
    index("attendance_school_date_idx").on(table.schoolId, table.academicYearId, table.date, table.status),
  ]
);

export const timetableSlots = pgTable(
  "timetable_slots",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    academicYearId: varchar("academic_year_id", { length: 36 }).notNull().references(() => academicYears.id, { onDelete: "cascade" }),
    sectionId: varchar("section_id", { length: 36 }).notNull().references(() => sections.id, { onDelete: "cascade" }),
    dayOfWeek: integer("day_of_week").notNull(), // 1 (Mon) - 6 (Sat)
    periodNo: integer("period_no").notNull(), // 1 - 8
    subjectId: varchar("subject_id", { length: 36 }).notNull().references(() => subjects.id, { onDelete: "cascade" }),
    teacherId: varchar("teacher_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    roomNo: varchar("room_no", { length: 20 }),
    isCombinedClass: boolean("is_combined_class").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("timetable_section_slot_idx").on(table.schoolId, table.academicYearId, table.sectionId, table.dayOfWeek, table.periodNo),
    index("timetable_teacher_slot_idx").on(table.schoolId, table.academicYearId, table.teacherId, table.dayOfWeek, table.periodNo),
    uniqueIndex("timetable_section_day_period_unique").on(table.academicYearId, table.sectionId, table.dayOfWeek, table.periodNo),
  ]
);

export const substitutions = pgTable(
  "substitutions",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    timetableSlotId: varchar("timetable_slot_id", { length: 36 }).notNull().references(() => timetableSlots.id, { onDelete: "cascade" }),
    absentTeacherId: varchar("absent_teacher_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    substituteTeacherId: varchar("substitute_teacher_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 20 }).$type<"PENDING" | "ACCEPTED" | "COMPLETED" | "CANCELLED">().notNull().default("ACCEPTED"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("substitutions_date_absent_idx").on(table.schoolId, table.date, table.absentTeacherId),
    index("substitutions_date_sub_idx").on(table.schoolId, table.date, table.substituteTeacherId),
  ]
);

export const studentLeaves = pgTable(
  "student_leaves",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    studentId: varchar("student_id", { length: 36 }).notNull().references(() => students.id, { onDelete: "cascade" }),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    leaveType: varchar("leave_type", { length: 30 }).$type<"MEDICAL" | "PLANNED" | "CASUAL">().notNull(),
    reason: text("reason").notNull(),
    status: varchar("status", { length: 20 }).$type<"PENDING" | "APPROVED" | "REJECTED">().notNull().default("PENDING"),
    appliedBy: text("applied_by"),
    approvedById: varchar("approved_by_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("student_leaves_lookup_idx").on(table.schoolId, table.studentId, table.startDate, table.endDate),
  ]
);

export const notificationOutbox = pgTable(
  "notification_outbox",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    channel: varchar("channel", { length: 20 }).$type<"WHATSAPP" | "SMS" | "EMAIL">().notNull(),
    recipientPhone: varchar("recipient_phone", { length: 30 }),
    recipientName: text("recipient_name"),
    message: text("message").notNull(),
    status: varchar("status", { length: 20 }).$type<"SENT" | "PENDING" | "FAILED">().notNull().default("SENT"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("outbox_school_status_idx").on(table.schoolId, table.status, table.createdAt),
  ]
);
