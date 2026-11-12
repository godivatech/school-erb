import {
  pgTable,
  text,
  varchar,
  integer,
  numeric,
  timestamp,
  date,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { schools, academicYears, users } from "./core";
import { classes, sections } from "./academics";

export const families = pgTable(
  "families",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    primaryParentName: text("primary_parent_name").notNull(),
    primaryPhone: varchar("primary_phone", { length: 20 }).notNull(), // Indexed for single parent login & sibling linking
    secondaryParentName: text("secondary_parent_name"),
    secondaryPhone: varchar("secondary_phone", { length: 20 }),
    email: varchar("email", { length: 255 }),
    address: text("address"),
    occupation: text("occupation"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("families_school_phone_idx").on(table.schoolId, table.primaryPhone),
  ]
);

export const students = pgTable(
  "students",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    familyId: varchar("family_id", { length: 36 }).notNull().references(() => families.id, { onDelete: "restrict" }),
    admissionNo: varchar("admission_no", { length: 50 }).notNull(), // Unique per school e.g. "ADM-2026-0041"
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    dob: date("dob").notNull(),
    gender: varchar("gender", { length: 10 }).$type<"MALE" | "FEMALE" | "OTHER">().notNull(),
    bloodGroup: varchar("blood_group", { length: 10 }),
    medicalFlags: text("medical_flags"), // Allergies, asthma, special needs
    status: varchar("status", { length: 20 }).$type<"ACTIVE" | "TC_ISSUED" | "ALUMNI" | "DROPOUT">().notNull().default("ACTIVE"),
    walletBalance: numeric("wallet_balance", { precision: 12, scale: 2 }).notNull().default("0.00"), // Credit for overpayments
    photoUrl: text("photo_url"),
    nationalId: varchar("national_id", { length: 50 }),
    emergencyContact: varchar("emergency_contact", { length: 20 }),
    tcIssuedDate: date("tc_issued_date"),
    tcReason: text("tc_reason"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("students_school_family_idx").on(table.schoolId, table.familyId),
    index("students_school_status_idx").on(table.schoolId, table.status),
    uniqueIndex("students_school_adm_unique").on(table.schoolId, table.admissionNo),
  ]
);

export const enrollments = pgTable(
  "enrollments",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    studentId: varchar("student_id", { length: 36 }).notNull().references(() => students.id, { onDelete: "cascade" }),
    academicYearId: varchar("academic_year_id", { length: 36 }).notNull().references(() => academicYears.id, { onDelete: "cascade" }),
    classId: varchar("class_id", { length: 36 }).notNull().references(() => classes.id, { onDelete: "cascade" }),
    sectionId: varchar("section_id", { length: 36 }).notNull().references(() => sections.id, { onDelete: "cascade" }),
    rollNo: integer("roll_no"),
    promotionStatus: varchar("promotion_status", { length: 20 }).$type<"ACTIVE" | "PROMOTED" | "DETAINED" | "GRADUATED">().notNull().default("ACTIVE"),
    enrollmentDate: date("enrollment_date").notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("enrollment_lookup_idx").on(table.schoolId, table.academicYearId, table.classId, table.sectionId),
    index("enrollment_student_idx").on(table.studentId),
    uniqueIndex("enrollment_student_year_unique").on(table.academicYearId, table.studentId),
  ]
);

export const studentDocuments = pgTable(
  "student_documents",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    studentId: varchar("student_id", { length: 36 }).notNull().references(() => students.id, { onDelete: "cascade" }),
    documentType: varchar("document_type", { length: 50 }).notNull(), // "BIRTH_CERTIFICATE" | "TRANSFER_CERTIFICATE" | "AADHAAR_CARD" | "COMMUNITY_CERTIFICATE" | "PREVIOUS_MARKSHEET" | "OTHER"
    title: text("title").notNull(),
    fileUrl: text("file_url").notNull(),
    fileSize: varchar("file_size", { length: 20 }),
    verificationStatus: varchar("verification_status", { length: 20 }).$type<"VERIFIED" | "PENDING" | "REJECTED">().notNull().default("VERIFIED"),
    uploadedById: varchar("uploaded_by_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("student_docs_lookup_idx").on(table.schoolId, table.studentId),
  ]
);
