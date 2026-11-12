import { cookies } from "next/headers";
import { db } from "@/db";
import { academicYears, schools, users } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { Role } from "./guards";
import {
  ActiveContext,
  AcademicYearItem,
  RoleOption,
  PRESET_ROLES,
} from "./context-types";

export type { ActiveContext, AcademicYearItem, RoleOption };
export { PRESET_ROLES };
export { switchAcademicYear, switchUserRole } from "@/actions/context";

/**
 * Server helper to read active academic year and demo role from cookies,
 * falling back to the ACTIVE year and SUPER_ADMIN.
 */
export async function getActiveContext(): Promise<ActiveContext> {
  let cookieYearId: string | undefined;
  let cookieRole: Role | undefined;

  try {
    const cookieStore = await cookies();
    cookieYearId = cookieStore.get("erp_academic_year_id")?.value;
    cookieRole = cookieStore.get("erp_active_role")?.value as Role | undefined;
  } catch {
    // Graceful fallback when invoked outside Next.js HTTP request scope (CLI/tests/workers)
  }

  // 1. Fetch School
  const [school] = await db
    .select({
      id: schools.id,
      name: schools.name,
      code: schools.code,
    })
    .from(schools)
    .limit(1);

  const schoolId = school?.id || "sch_oxford_001";
  const schoolName = school?.name || "Crescent Matriculation Higher Secondary School, Chennai";
  const schoolCode = school?.code || "CMS-CHENNAI";

  // 2. Fetch all Academic Years for this school
  const rawYears = await db
    .select({
      id: academicYears.id,
      name: academicYears.name,
      status: academicYears.status,
      startDate: academicYears.startDate,
      endDate: academicYears.endDate,
    })
    .from(academicYears)
    .where(eq(academicYears.schoolId, schoolId))
    .orderBy(desc(academicYears.startDate));

  const availableYears: AcademicYearItem[] =
    rawYears.length > 0
      ? rawYears
      : [
          {
            id: "ay_2026_2027",
            name: "2026-2027",
            status: "ACTIVE",
            startDate: "2026-04-01",
            endDate: "2027-03-31",
          },
          {
            id: "ay_2025_2026",
            name: "2025-2026",
            status: "LOCKED",
            startDate: "2025-04-01",
            endDate: "2026-03-31",
          },
        ];

  // 3. Resolve active academic year
  let activeYear = availableYears.find((y) => y.id === cookieYearId);
  if (!activeYear) {
    activeYear =
      availableYears.find((y) => y.status === "ACTIVE") || availableYears[0];
  }

  // 4. Resolve active user / role
  const targetRole: Role = cookieRole && PRESET_ROLES.some((r) => r.role === cookieRole)
    ? cookieRole
    : "SUPER_ADMIN";

  const preset = PRESET_ROLES.find((r) => r.role === targetRole)!;

  // Query live user if exists
  const [dbUser] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      role: users.role,
    })
    .from(users)
    .where(and(eq(users.schoolId, schoolId), eq(users.role, targetRole)))
    .limit(1);

  const activeUser = dbUser
    ? {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        phone: dbUser.phone,
        role: targetRole,
      }
    : {
        id: preset.userId,
        name: preset.userName,
        email: `${targetRole.toLowerCase()}@crescent.internal`,
        phone: "+91 98765 00000",
        role: targetRole,
      };

  return {
    schoolId,
    schoolName,
    schoolCode,
    academicYearId: activeYear.id,
    academicYearName: activeYear.name,
    academicYearStatus: activeYear.status,
    isLocked: activeYear.status === "LOCKED",
    user: activeUser,
    availableYears,
    availableRoles: PRESET_ROLES,
  };
}
