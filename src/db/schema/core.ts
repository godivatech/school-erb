import {
  pgTable,
  text,
  varchar,
  timestamp,
  boolean,
  jsonb,
  date,
  integer,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const schools = pgTable(
  "schools",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    code: varchar("code", { length: 20 }).notNull().unique(),
    address: text("address"),
    phone: varchar("phone", { length: 20 }),
    email: varchar("email", { length: 255 }),
    logoUrl: text("logo_url"),
    settingsJson: jsonb("settings_json").$type<{
      currencySymbol?: string;
      dateFormat?: string;
      timezone?: string;
      holdResultsForDefaulters?: boolean;
      defaulterThresholdAmount?: number;
      chequeBouncePenalty?: number;
      smsSenderId?: string;
    }>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("school_code_idx").on(table.code),
  ]
);

export const academicYears = pgTable(
  "academic_years",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 50 }).notNull(), // e.g., "2026-2027"
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    status: varchar("status", { length: 20 }).$type<"UPCOMING" | "ACTIVE" | "LOCKED">().notNull().default("UPCOMING"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("ay_school_status_idx").on(table.schoolId, table.status),
    uniqueIndex("ay_school_name_idx").on(table.schoolId, table.name),
  ]
);

export const users = pgTable(
  "users",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 20 }),
    role: varchar("role", { length: 30 }).$type<"SUPER_ADMIN" | "PRINCIPAL" | "ACCOUNTANT" | "TEACHER" | "PARENT">().notNull(),
    passwordHash: text("password_hash"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("users_school_role_idx").on(table.schoolId, table.role),
    index("users_school_email_idx").on(table.schoolId, table.email),
    index("users_school_phone_idx").on(table.schoolId, table.phone),
    uniqueIndex("users_school_email_unique").on(table.schoolId, table.email),
  ]
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    entityId: varchar("entity_id", { length: 100 }).notNull(),
    action: varchar("action", { length: 50 }).notNull(), // CREATE, UPDATE, DELETE, VOID, BOUNCE, OVERRIDE
    oldValueJson: jsonb("old_value_json"),
    newValueJson: jsonb("new_value_json"),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("audit_school_entity_idx").on(table.schoolId, table.entityType, table.entityId),
    index("audit_school_created_idx").on(table.schoolId, table.createdAt),
  ]
);

// Better-Auth Tables
export const sessions = pgTable(
  "sessions",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("session_user_idx").on(table.userId),
  ]
);

export const accounts = pgTable(
  "accounts",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("accounts_user_idx").on(table.userId),
  ]
);

export const verifications = pgTable(
  "verifications",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("verifications_ident_idx").on(table.identifier),
  ]
);

// Atomic Sequences Counter (P0-3 Race Condition Prevention)
export const schoolCounters = pgTable(
  "school_counters",
  {
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    entityType: varchar("entity_type", { length: 30 }).notNull(), // 'RECEIPT', 'INVOICE', 'ADMISSION'
    currentVal: integer("current_val").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.schoolId, table.entityType] }),
  ]
);

// Transactional Outbox Events (P0-2 Dual-Write Prevention)
export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    schoolId: varchar("school_id", { length: 36 }).notNull().references(() => schools.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 50 }).notNull(), // 'STUDENT_ABSENT', 'STUDENT_LATE', 'PDF_GENERATION'
    payloadJson: jsonb("payload_json").notNull(),
    status: varchar("status", { length: 20 }).$type<"PENDING" | "PROCESSING" | "PROCESSED" | "FAILED" | "CANCELLED">().notNull().default("PENDING"),
    retryCount: integer("retry_count").notNull().default(0),
    errorMessage: text("error_message"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => [
    index("outbox_status_scheduled_idx").on(table.status, table.scheduledFor),
    index("outbox_school_event_idx").on(table.schoolId, table.eventType),
  ]
);
