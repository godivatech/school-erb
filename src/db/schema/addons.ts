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
import { students } from "./students";

export const staffProfiles = pgTable(
  "staff_profiles",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    employeeCode: varchar("employee_code", { length: 50 }).notNull(),
    designation: text("designation").notNull(),
    basicSalary: numeric("basic_salary", { precision: 12, scale: 2 }).notNull(),
    hra: numeric("hra", { precision: 12, scale: 2 }).notNull().default("0.00"),
    allowances: numeric("allowances", { precision: 12, scale: 2 }).notNull().default("0.00"),
    pfDeduction: numeric("pf_deduction", { precision: 12, scale: 2 }).notNull().default("0.00"),
    casualLeaveBalance: numeric("casual_leave_balance", { precision: 4, scale: 1 }).notNull().default("12.0"),
    sickLeaveBalance: numeric("sick_leave_balance", { precision: 4, scale: 1 }).notNull().default("10.0"),
    bankAccountNumber: varchar("bank_account_number", { length: 50 }),
    bankIfsc: varchar("bank_ifsc", { length: 20 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("staff_employee_code_unique").on(table.schoolId, table.employeeCode),
    uniqueIndex("staff_user_unique").on(table.userId),
  ]
);

export const staffLeaves = pgTable(
  "staff_leaves",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    staffId: varchar("staff_id", { length: 36 }).notNull().references(() => staffProfiles.id, { onDelete: "cascade" }),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    leaveType: varchar("leave_type", { length: 10 }).$type<"CL" | "SL" | "LOP">().notNull(),
    daysCount: numeric("days_count", { precision: 4, scale: 1 }).notNull().default("1.0"),
    reason: text("reason"),
    status: varchar("status", { length: 20 }).$type<"PENDING" | "APPROVED" | "REJECTED">().notNull().default("PENDING"),
    approvedById: varchar("approved_by_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("staff_leaves_school_staff_idx").on(table.schoolId, table.staffId),
  ]
);

export const staffAdvances = pgTable(
  "staff_advances",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    staffId: varchar("staff_id", { length: 36 }).notNull().references(() => staffProfiles.id, { onDelete: "cascade" }),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
    monthlyEmi: numeric("monthly_emi", { precision: 12, scale: 2 }).notNull(),
    remainingBalance: numeric("remaining_balance", { precision: 12, scale: 2 }).notNull(),
    disbursedDate: date("disbursed_date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("staff_advances_school_idx").on(table.schoolId, table.staffId),
  ]
);

export const payrollRuns = pgTable(
  "payroll_runs",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    monthYear: varchar("month_year", { length: 10 }).notNull(), // e.g., "2026-10"
    staffId: varchar("staff_id", { length: 36 }).notNull().references(() => staffProfiles.id, { onDelete: "cascade" }),
    grossPay: numeric("gross_pay", { precision: 12, scale: 2 }).notNull(),
    lopDays: numeric("lop_days", { precision: 4, scale: 1 }).notNull().default("0.0"),
    lopDeduction: numeric("lop_deduction", { precision: 12, scale: 2 }).notNull().default("0.00"),
    advanceEmiDeduction: numeric("advance_emi_deduction", { precision: 12, scale: 2 }).notNull().default("0.00"),
    pfDeduction: numeric("pf_deduction", { precision: 12, scale: 2 }).notNull().default("0.00"),
    epfDeduction: numeric("epf_deduction", { precision: 12, scale: 2 }).notNull().default("0.00"),
    esiDeduction: numeric("esi_deduction", { precision: 12, scale: 2 }).notNull().default("0.00"),
    professionalTax: numeric("professional_tax", { precision: 12, scale: 2 }).notNull().default("0.00"),
    otherDeductions: numeric("other_deductions", { precision: 12, scale: 2 }).notNull().default("0.00"),
    netPay: numeric("net_pay", { precision: 12, scale: 2 }).notNull(),
    status: varchar("status", { length: 20 }).$type<"DRAFT" | "APPROVED" | "PAID">().notNull().default("DRAFT"),
    paymentDate: date("payment_date"),
    transactionRef: varchar("transaction_ref", { length: 100 }),
    processedById: varchar("processed_by_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("payroll_unique").on(table.schoolId, table.monthYear, table.staffId),
  ]
);

export const transportRoutes = pgTable(
  "transport_routes",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    routeName: text("route_name").notNull(),
    vehicleNo: varchar("vehicle_no", { length: 50 }).notNull(),
    driverName: text("driver_name").notNull(),
    driverPhone: varchar("driver_phone", { length: 20 }).notNull(),
    capacity: integer("capacity").notNull().default(30),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("transport_routes_school_idx").on(table.schoolId),
  ]
);

export const transportStops = pgTable(
  "transport_stops",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    routeId: varchar("route_id", { length: 36 }).notNull().references(() => transportRoutes.id, { onDelete: "cascade" }),
    stopName: text("stop_name").notNull(),
    pickupTime: varchar("pickup_time", { length: 10 }).notNull(), // e.g., "07:15 AM"
    dropTime: varchar("drop_time", { length: 10 }).notNull(), // e.g., "02:45 PM"
    monthlyFee: numeric("monthly_fee", { precision: 10, scale: 2 }).notNull(),
    orderIndex: integer("order_index").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("transport_stops_route_idx").on(table.routeId, table.orderIndex),
  ]
);

export const studentTransport = pgTable(
  "student_transport",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    academicYearId: varchar("academic_year_id", { length: 36 }).notNull().references(() => academicYears.id, { onDelete: "cascade" }),
    studentId: varchar("student_id", { length: 36 }).notNull().references(() => students.id, { onDelete: "cascade" }),
    pickupStopId: varchar("pickup_stop_id", { length: 36 }).references(() => transportStops.id, { onDelete: "set null" }),
    dropStopId: varchar("drop_stop_id", { length: 36 }).references(() => transportStops.id, { onDelete: "set null" }),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("student_transport_unique").on(table.academicYearId, table.studentId),
  ]
);

export const notices = pgTable(
  "notices",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    academicYearId: varchar("academic_year_id", { length: 36 }).notNull().references(() => academicYears.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content").notNull(),
    targetAudience: varchar("target_audience", { length: 20 }).$type<"ALL" | "TEACHERS" | "PARENTS" | "STUDENTS">().notNull().default("ALL"),
    applicableClassIds: text("applicable_class_ids").array().default([]),
    priority: varchar("priority", { length: 10 }).$type<"NORMAL" | "URGENT">().notNull().default("NORMAL"),
    attachmentUrl: text("attachment_url"),
    authorId: varchar("author_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("notices_school_year_idx").on(table.schoolId, table.academicYearId, table.priority),
  ]
);
