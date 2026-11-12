import {
  pgTable,
  text,
  varchar,
  integer,
  numeric,
  boolean,
  timestamp,
  date,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { schools, academicYears, users } from "./core";
import { classes } from "./academics";
import { students, enrollments } from "./students";

export const feeHeads = pgTable(
  "fee_heads",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // e.g., "Tuition", "Transport", "Admission", "Late Fine"
    frequency: varchar("frequency", { length: 20 }).$type<"ONE_TIME" | "MONTHLY" | "QUARTERLY" | "ANNUAL">().notNull(),
    priorityOrder: integer("priority_order").notNull(), // Priority for partial payment allocation (1 = highest)
    isMandatory: boolean("is_mandatory").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("fee_heads_school_priority_idx").on(table.schoolId, table.priorityOrder),
    uniqueIndex("fee_heads_school_name_unique").on(table.schoolId, table.name),
  ]
);

export const feeStructures = pgTable(
  "fee_structures",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    academicYearId: varchar("academic_year_id", { length: 36 }).notNull().references(() => academicYears.id, { onDelete: "cascade" }),
    classId: varchar("class_id", { length: 36 }).notNull().references(() => classes.id, { onDelete: "cascade" }),
    feeHeadId: varchar("fee_head_id", { length: 36 }).notNull().references(() => feeHeads.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    dueDateDay: integer("due_date_day").notNull().default(10),
    lateFinePerDay: numeric("late_fine_per_day", { precision: 10, scale: 2 }).notNull().default("0.00"),
    maxLateFine: numeric("max_late_fine", { precision: 10, scale: 2 }).notNull().default("0.00"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("fee_struct_school_year_class_idx").on(table.schoolId, table.academicYearId, table.classId),
    uniqueIndex("fee_struct_unique").on(table.academicYearId, table.classId, table.feeHeadId),
  ]
);

export const studentConcessions = pgTable(
  "student_concessions",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    academicYearId: varchar("academic_year_id", { length: 36 }).notNull().references(() => academicYears.id, { onDelete: "cascade" }),
    studentId: varchar("student_id", { length: 36 }).notNull().references(() => students.id, { onDelete: "cascade" }),
    feeHeadId: varchar("fee_head_id", { length: 36 }).notNull().references(() => feeHeads.id, { onDelete: "cascade" }),
    discountType: varchar("discount_type", { length: 20 }).$type<"PERCENTAGE" | "FLAT">().notNull(),
    discountValue: numeric("discount_value", { precision: 10, scale: 2 }).notNull(),
    reason: varchar("reason", { length: 30 }).$type<"SIBLING" | "STAFF_WARD" | "SCHOLARSHIP" | "PRINCIPAL_WAIVER">().notNull(),
    approvedById: varchar("approved_by_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    remarks: text("remarks"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("concessions_student_idx").on(table.schoolId, table.academicYearId, table.studentId),
  ]
);

export const feeInvoices = pgTable(
  "fee_invoices",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    academicYearId: varchar("academic_year_id", { length: 36 }).notNull().references(() => academicYears.id, { onDelete: "cascade" }),
    studentId: varchar("student_id", { length: 36 }).notNull().references(() => students.id, { onDelete: "cascade" }),
    enrollmentId: varchar("enrollment_id", { length: 36 }).notNull().references(() => enrollments.id, { onDelete: "cascade" }),
    invoiceNo: varchar("invoice_no", { length: 50 }).notNull(), // e.g., "INV-2026-00012"
    installmentLabel: varchar("installment_label", { length: 50 }).notNull(), // e.g., "Q1 - Apr to Jun"
    dueDate: date("due_date").notNull(),
    baseAmount: numeric("base_amount", { precision: 12, scale: 2 }).notNull(),
    discountAmount: numeric("discount_amount", { precision: 12, scale: 2 }).notNull().default("0.00"),
    lateFineAmount: numeric("late_fine_amount", { precision: 12, scale: 2 }).notNull().default("0.00"),
    netAmount: numeric("net_amount", { precision: 12, scale: 2 }).notNull(),
    paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }).notNull().default("0.00"),
    status: varchar("status", { length: 20 }).$type<"UNPAID" | "PARTIAL" | "PAID" | "CANCELLED">().notNull().default("UNPAID"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("invoices_school_student_idx").on(table.schoolId, table.academicYearId, table.studentId),
    index("invoices_status_idx").on(table.schoolId, table.status),
    uniqueIndex("invoices_school_no_unique").on(table.schoolId, table.invoiceNo),
  ]
);

export const feeInvoiceItems = pgTable(
  "fee_invoice_items",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    invoiceId: varchar("invoice_id", { length: 36 }).notNull().references(() => feeInvoices.id, { onDelete: "cascade" }),
    feeHeadId: varchar("fee_head_id", { length: 36 }).notNull().references(() => feeHeads.id, { onDelete: "restrict" }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }).notNull().default("0.00"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("inv_items_invoice_idx").on(table.invoiceId),
  ]
);

// IMMUTABLE LEDGER: Rule - NEVER DELETE or UPDATE amount on fee_receipts
export const feeReceipts = pgTable(
  "fee_receipts",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    academicYearId: varchar("academic_year_id", { length: 36 }).notNull().references(() => academicYears.id, { onDelete: "cascade" }),
    receiptNo: varchar("receipt_no", { length: 50 }).notNull(), // Sequential per school e.g. "REC-2026-0001"
    studentId: varchar("student_id", { length: 36 }).notNull().references(() => students.id, { onDelete: "restrict" }),
    amountReceived: numeric("amount_received", { precision: 12, scale: 2 }).notNull(),
    paymentMode: varchar("payment_mode", { length: 20 }).$type<"CASH" | "UPI" | "CARD" | "CHEQUE" | "ONLINE">().notNull(),
    chequeOrTxnRef: varchar("cheque_or_txn_ref", { length: 100 }),
    clearanceStatus: varchar("clearance_status", { length: 20 }).$type<"CLEARED" | "PENDING_CHEQUE" | "BOUNCED" | "VOIDED">().notNull().default("CLEARED"),
    voidReason: text("void_reason"),
    voidedById: varchar("voided_by_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    collectedById: varchar("collected_by_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "restrict" }),
    idempotencyKey: varchar("idempotency_key", { length: 64 }).notNull().unique(),
    allocationsJson: jsonb("allocations_json").$type<
      Array<{
        invoiceId: string;
        invoiceItemId?: string;
        feeHeadName: string;
        allocatedAmount: number;
      }>
    >().notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("receipts_school_student_idx").on(table.schoolId, table.academicYearId, table.studentId),
    index("receipts_status_idx").on(table.schoolId, table.clearanceStatus),
    uniqueIndex("receipts_school_no_unique").on(table.schoolId, table.receiptNo),
  ]
);
