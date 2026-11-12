import { z } from "zod";

export const studentAdmissionSchema = z.object({
  admissionNo: z.string().min(3, "Admission No is required (e.g., ADM-2026-0041)"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format: YYYY-MM-DD"),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  bloodGroup: z.string().optional().nullable(),
  medicalFlags: z.string().optional().nullable(),
  nationalId: z.string().optional().nullable(),
  emergencyContact: z.string().optional().nullable(),
  
  // Family Information (Sibling Linking Key: primaryPhone)
  primaryParentName: z.string().min(2, "Parent/Guardian name is required"),
  primaryPhone: z
    .string()
    .min(10, "Phone number must be at least 10 digits")
    .max(15)
    .regex(/^[0-9+\-\s]+$/, "Invalid phone number"),
  secondaryParentName: z.string().optional().nullable(),
  secondaryPhone: z.string().optional().nullable(),
  email: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
  address: z.string().optional().nullable(),
  occupation: z.string().optional().nullable(),

  // Enrollment (Academic Year Scoped)
  academicYearId: z.string().min(1, "Academic Year is required"),
  classId: z.string().min(1, "Class is required"),
  sectionId: z.string().min(1, "Section is required"),
  rollNo: z.coerce.number().int().optional().nullable(),
  enrollmentDate: z.string().default(() => new Date().toISOString().split("T")[0]),
});

export const transferCertificateSchema = z.object({
  studentId: z.string().min(1, "Student ID is required"),
  academicYearId: z.string().min(1, "Academic Year ID is required"),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format: YYYY-MM-DD"),
  reason: z.string().min(3, "Reason for TC is required (e.g., Parent Transfer, Completed Studies)"),
  conduct: z.string().default("Good"),
  duesCleared: z.boolean().default(true),
  remarks: z.string().optional().nullable(),
});

export const promotionBatchSchema = z.object({
  sourceAcademicYearId: z.string().min(1),
  targetAcademicYearId: z.string().min(1),
  sourceClassId: z.string().min(1),
  targetClassId: z.string().min(1),
  promotions: z.array(
    z.object({
      studentId: z.string().min(1),
      targetSectionId: z.string().min(1),
      rollNo: z.number().int().optional().nullable(),
      promotionStatus: z.enum(["PROMOTED", "DETAINED", "GRADUATED"]),
    })
  ),
});

export type StudentAdmissionInput = z.infer<typeof studentAdmissionSchema>;
export type TransferCertificateInput = z.infer<typeof transferCertificateSchema>;
export type PromotionBatchInput = z.infer<typeof promotionBatchSchema>;
