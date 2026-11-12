"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { Role } from "@/lib/guards";

/**
 * Server Action: Switch Active Academic Year via cookie and revalidate layout
 */
export async function switchAcademicYear(academicYearId: string) {
  const cookieStore = await cookies();
  cookieStore.set("erp_academic_year_id", academicYearId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });

  try {
    revalidatePath("/", "layout");
  } catch {
    // Safe when invoked in test or headless context
  }

  return { success: true, academicYearId };
}

/**
 * Server Action: Switch Active Demo Role via cookie and revalidate layout.
 * Disabled in production unless explicitly enabled via ALLOW_DEMO_SWITCHING.
 */
export async function switchUserRole(role: Role) {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SWITCHING !== "true") {
    throw new Error("Role switching via demo cookie is strictly forbidden in production.");
  }

  const cookieStore = await cookies();
  cookieStore.set("erp_active_role", role, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });

  try {
    revalidatePath("/", "layout");
  } catch {
    // Safe when invoked in test or headless context
  }

  return { success: true, role };
}
