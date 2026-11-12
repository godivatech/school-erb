import * as React from "react";
import { db } from "@/db";
import { classes, sections, academicYears } from "@/db/schema";
import { eq } from "drizzle-orm";
import { BulkCsvImportClient } from "./import-client";

export const dynamic = "force-dynamic";

export default async function BulkCsvImportWizardPage() {
  // 1. Fetch active academic year
  const [activeYear] = await db
    .select()
    .from(academicYears)
    .where(eq(academicYears.status, "ACTIVE"))
    .limit(1);

  const yearId = activeYear?.id || "ay_2026_2027";
  const schoolId = activeYear?.schoolId || "sch_oxford_001";

  // 2. Fetch classes and sections
  const allClasses = await db
    .select()
    .from(classes)
    .where(eq(classes.schoolId, schoolId))
    .orderBy(classes.numericOrder);

  const allSections = await db
    .select()
    .from(sections)
    .where(eq(sections.schoolId, schoolId));

  const options = allClasses.map((cls) => ({
    id: cls.id,
    name: cls.name,
    sections: allSections
      .filter((s) => s.classId === cls.id)
      .map((s) => ({ id: s.id, name: s.name })),
  }));

  return (
    <BulkCsvImportClient
      classes={options}
      academicYearId={yearId}
      schoolId={schoolId}
      isLocked={activeYear?.status === "LOCKED"}
    />
  );
}
