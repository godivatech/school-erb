import { z } from "zod";

export const academicYearSchema = z.object({
  name: z.string().min(4, "Name must be like '2026-2027'"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format: YYYY-MM-DD"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format: YYYY-MM-DD"),
  status: z.enum(["UPCOMING", "ACTIVE", "LOCKED"]).default("UPCOMING"),
  cloneFromYearId: z.string().optional(), // For "Clone Previous Year Structure"
});

export const classSchema = z.object({
  name: z.string().min(1, "Class name is required (e.g., Grade 10)"),
  numericOrder: z.coerce.number().int().min(1).max(12),
  stream: z.enum(["SCIENCE", "COMMERCE", "ARTS", "GENERAL"]).default("GENERAL"),
});

export const sectionSchema = z.object({
  classId: z.string().min(1, "Class is required"),
  name: z.string().min(1, "Section name is required (e.g., A, B)"),
  capacity: z.coerce.number().int().min(1).default(40),
  classTeacherId: z.string().optional().nullable(),
});

export const subjectSchema = z.object({
  name: z.string().min(1, "Subject name is required"),
  code: z.string().min(2, "Subject code is required (e.g., MATH-10)"),
  type: z.enum(["CORE", "ELECTIVE", "CO_SCHOLASTIC"]).default("CORE"),
  includeInCgpa: z.boolean().default(true),
});

export const holidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format: YYYY-MM-DD"),
  title: z.string().min(2, "Holiday title is required"),
  applicableClassIds: z.array(z.string()).nullable().default(null),
  isEmergencyHoliday: z.boolean().default(false),
});

export type AcademicYearInput = z.infer<typeof academicYearSchema>;
export type ClassInput = z.infer<typeof classSchema>;
export type SectionInput = z.infer<typeof sectionSchema>;
export type SubjectInput = z.infer<typeof subjectSchema>;
export type HolidayInput = z.infer<typeof holidaySchema>;
