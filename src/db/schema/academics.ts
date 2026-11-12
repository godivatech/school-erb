import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  date,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { schools, academicYears, users } from "./core";

export const classes = pgTable(
  "classes",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 50 }).notNull(), // e.g., "Grade 10"
    numericOrder: integer("numeric_order").notNull(), // e.g., 10
    stream: varchar("stream", { length: 30 }).$type<"SCIENCE" | "COMMERCE" | "ARTS" | "GENERAL">().notNull().default("GENERAL"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("classes_school_order_idx").on(table.schoolId, table.numericOrder),
    uniqueIndex("classes_school_name_idx").on(table.schoolId, table.name),
  ]
);

export const sections = pgTable(
  "sections",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    classId: varchar("class_id", { length: 36 }).notNull().references(() => classes.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 20 }).notNull(), // e.g., "A", "B", "Rose"
    capacity: integer("capacity").notNull().default(40),
    classTeacherId: varchar("class_teacher_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("sections_school_class_idx").on(table.schoolId, table.classId),
    uniqueIndex("sections_class_name_unique").on(table.classId, table.name),
  ]
);

export const subjects = pgTable(
  "subjects",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // e.g., "Mathematics"
    code: varchar("code", { length: 30 }).notNull(), // e.g., "MATH-10"
    type: varchar("type", { length: 30 }).$type<"CORE" | "ELECTIVE" | "CO_SCHOLASTIC">().notNull().default("CORE"),
    includeInCgpa: boolean("include_in_cgpa").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("subjects_school_idx").on(table.schoolId),
    uniqueIndex("subjects_school_code_unique").on(table.schoolId, table.code),
  ]
);

export const classSubjects = pgTable(
  "class_subjects",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    academicYearId: varchar("academic_year_id", { length: 36 }).notNull().references(() => academicYears.id, { onDelete: "cascade" }),
    sectionId: varchar("section_id", { length: 36 }).notNull().references(() => sections.id, { onDelete: "cascade" }),
    subjectId: varchar("subject_id", { length: 36 }).notNull().references(() => subjects.id, { onDelete: "cascade" }),
    teacherId: varchar("teacher_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("cs_school_year_sec_idx").on(table.schoolId, table.academicYearId, table.sectionId),
    index("cs_teacher_idx").on(table.teacherId),
    uniqueIndex("cs_year_sec_sub_unique").on(table.academicYearId, table.sectionId, table.subjectId),
  ]
);

export const studentElectives = pgTable(
  "student_electives",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    academicYearId: varchar("academic_year_id", { length: 36 }).notNull().references(() => academicYears.id, { onDelete: "cascade" }),
    studentId: varchar("student_id", { length: 36 }).notNull(), // references students.id
    subjectId: varchar("subject_id", { length: 36 }).notNull().references(() => subjects.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("electives_student_idx").on(table.schoolId, table.academicYearId, table.studentId),
    uniqueIndex("electives_student_sub_unique").on(table.academicYearId, table.studentId, table.subjectId),
  ]
);

export const holidays = pgTable(
  "holidays",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    academicYearId: varchar("academic_year_id", { length: 36 }).notNull().references(() => academicYears.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    title: text("title").notNull(),
    applicableClassIds: jsonb("applicable_class_ids").$type<string[] | null>().default(null), // null = all school
    isEmergencyHoliday: boolean("is_emergency_holiday").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("holidays_school_year_date_idx").on(table.schoolId, table.academicYearId, table.date),
  ]
);

export const dailyHomework = pgTable(
  "daily_homework",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    academicYearId: varchar("academic_year_id", { length: 36 }).notNull().references(() => academicYears.id, { onDelete: "cascade" }),
    sectionId: varchar("section_id", { length: 36 }).notNull().references(() => sections.id, { onDelete: "cascade" }),
    subjectId: varchar("subject_id", { length: 36 }).notNull().references(() => subjects.id, { onDelete: "cascade" }),
    teacherId: varchar("teacher_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    assignedDate: date("assigned_date").notNull(),
    dueDate: date("due_date").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    attachmentUrl: text("attachment_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("homework_lookup_idx").on(table.schoolId, table.academicYearId, table.sectionId, table.assignedDate),
  ]
);
