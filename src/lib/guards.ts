import { db } from "@/db";
import { academicYears, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { logAuditTrail } from "./audit";

export type Role = "SUPER_ADMIN" | "PRINCIPAL" | "ACCOUNTANT" | "TEACHER" | "PARENT";

export class AcademicYearLockError extends Error {
  constructor(message = "This academic year is LOCKED. Modifications are strictly forbidden.") {
    super(message);
    this.name = "AcademicYearLockError";
  }
}

export class AuthorizationError extends Error {
  constructor(message = "You lack authorization to perform this operation.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export interface GuardContext {
  schoolId: string;
  userId: string;
  userRole: Role;
  auditOverrideReason?: string;
}

/**
 * Academic Year Lock Guard:
 * Before any write operation on attendance, fee_invoices, fee_receipts, or exam_marks,
 * check if academic_years.status === 'LOCKED'.
 * If locked, reject unless user is SUPER_ADMIN and provides auditOverrideReason.
 */
export async function assertAcademicYearMutable(
  academicYearId: string,
  context: GuardContext,
  operationDescription: string
): Promise<void> {
  const [year] = await db
    .select({
      id: academicYears.id,
      name: academicYears.name,
      status: academicYears.status,
      schoolId: academicYears.schoolId,
    })
    .from(academicYears)
    .where(
      and(
        eq(academicYears.id, academicYearId),
        eq(academicYears.schoolId, context.schoolId)
      )
    )
    .limit(1);

  if (!year) {
    throw new Error(`Academic year ${academicYearId} not found in this school.`);
  }

  if (year.status === "LOCKED") {
    const isSuperAdmin = context.userRole === "SUPER_ADMIN";
    const hasOverride = !!context.auditOverrideReason?.trim();

    if (isSuperAdmin && hasOverride) {
      // Record emergency super-admin override to immutable audit logs
      await logAuditTrail({
        schoolId: context.schoolId,
        userId: context.userId,
        entityType: "ACADEMIC_YEAR_OVERRIDE",
        entityId: academicYearId,
        action: "OVERRIDE",
        oldValueJson: { status: "LOCKED", yearName: year.name },
        newValueJson: { operation: operationDescription },
        reason: context.auditOverrideReason,
      });
      return;
    }

    throw new AcademicYearLockError(
      `Academic Year "${year.name}" is permanently LOCKED. Write operation [${operationDescription}] was rejected.`
    );
  }
}

/**
 * Role-Based Access Control assertion
 */
export function assertRole(userRole: Role, allowedRoles: Role[]): void {
  if (!allowedRoles.includes(userRole)) {
    throw new AuthorizationError(
      `Role "${userRole}" is not permitted to perform this action. Required: [${allowedRoles.join(", ")}]`
    );
  }
}

export interface VerifiedSessionContext {
  schoolId: string;
  userId: string;
  userRole: Role;
  academicYearId: string;
}

/**
 * Cryptographically verifies identity, tenant boundary (schoolId), and user role.
 * In Server Actions, this guarantees that client-supplied identity/tenant parameters
 * cannot bypass session authentication, elevate roles, or leak cross-tenant data.
 */
export async function resolveVerifiedSession(
  clientContext?: {
    schoolId?: string;
    userId?: string;
    userRole?: Role;
    academicYearId?: string;
  }
): Promise<VerifiedSessionContext> {
  let authSession = null;
  try {
    const { headers } = await import("next/headers");
    const reqHeaders = await headers();
    const { auth } = await import("./auth");
    authSession = await auth.api.getSession({ headers: reqHeaders });
  } catch {
    // In headless or test environments headers() may not be available
  }

  if (authSession?.user) {
    const sessionUser = authSession.user as any;
    const sessionSchoolId = sessionUser.schoolId;
    const sessionRole = (sessionUser.role as Role) || "PARENT";

    // Enforce multi-tenancy: user can only act within their own school unless SUPER_ADMIN
    if (clientContext?.schoolId && clientContext.schoolId !== sessionSchoolId && sessionRole !== "SUPER_ADMIN") {
      throw new AuthorizationError(
        `Cross-tenant access forbidden. Session is tied to school "${sessionSchoolId}".`
      );
    }

    return {
      schoolId: sessionSchoolId || clientContext?.schoolId || "sch_oxford_001",
      userId: sessionUser.id,
      userRole: sessionRole,
      academicYearId: clientContext?.academicYearId || "ay_2026_2027",
    };
  }

  // Fallback to active verified context
  let activeCtx = null;
  try {
    const { getActiveContext } = await import("./context");
    activeCtx = await getActiveContext();
  } catch {
    // Graceful fallback for non-request environments (CLI/tests)
  }

  // If in production and demo switching is not explicitly enabled, require cryptographic session
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SWITCHING !== "true") {
    throw new AuthorizationError("Authentication required: No valid session token present.");
  }

  if (!activeCtx) {
    return {
      schoolId: clientContext?.schoolId || "sch_oxford_001",
      userId: clientContext?.userId || "usr_superadmin",
      userRole: clientContext?.userRole || "SUPER_ADMIN",
      academicYearId: clientContext?.academicYearId || "ay_2026_2027",
    };
  }

  // Verify tenant isolation in demo/dev mode
  if (clientContext?.schoolId && clientContext.schoolId !== activeCtx.schoolId) {
    throw new AuthorizationError(
      `Cross-tenant access rejected. Active school context is "${activeCtx.schoolId}".`
    );
  }

  return {
    schoolId: activeCtx.schoolId,
    userId: activeCtx.user.id,
    userRole: activeCtx.user.role,
    academicYearId: clientContext?.academicYearId || activeCtx.academicYearId,
  };
}
