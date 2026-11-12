"use server";

import { db } from "@/db";
import {
  students,
  families,
  feeReceipts,
  classes,
  sections,
  enrollments,
  feeInvoices,
} from "@/db/schema";
import { ilike, or, eq, and, sql, desc, inArray } from "drizzle-orm";
import { resolveVerifiedSession } from "@/lib/guards";

export interface GlobalSearchResult {
  id: string;
  type: "student" | "family" | "receipt" | "action" | "navigation";
  title: string;
  subtitle: string;
  tag?: string;
  tagVariant?: "primary" | "warning" | "danger" | "neutral" | "success";
  url: string;
  studentId?: string;
  familyId?: string;
  receiptId?: string;
}

export async function searchGlobalEntities(query: string): Promise<GlobalSearchResult[]> {
  const q = query.trim();
  if (!q || q.length < 2) {
    return [];
  }

  const session = await resolveVerifiedSession();
  const results: GlobalSearchResult[] = [];
  const searchPattern = `%${q}%`;

  try {
    // 1. Search Students by firstName, lastName, or admissionNo within current school
    const matchedStudents = await db
      .select({
        id: students.id,
        admissionNo: students.admissionNo,
        firstName: students.firstName,
        lastName: students.lastName,
        walletBalance: students.walletBalance,
        familyId: students.familyId,
        parentPhone: families.primaryPhone,
        parentName: families.primaryParentName,
        className: classes.name,
        sectionName: sections.name,
      })
      .from(students)
      .leftJoin(families, eq(students.familyId, families.id))
      .leftJoin(enrollments, eq(students.id, enrollments.studentId))
      .leftJoin(classes, eq(enrollments.classId, classes.id))
      .leftJoin(sections, eq(enrollments.sectionId, sections.id))
      .where(
        and(
          eq(students.schoolId, session.schoolId),
          or(
            ilike(students.firstName, searchPattern),
            ilike(students.lastName, searchPattern),
            ilike(students.admissionNo, searchPattern),
            ilike(
              sql`concat(${students.firstName}, ' ', ${students.lastName})`,
              searchPattern
            )
          )
        )
      )
      .limit(6);

    for (const s of matchedStudents) {
      const studentName = `${s.firstName} ${s.lastName}`;
      const classSec = s.className && s.sectionName ? `${s.className}-${s.sectionName}` : "Enrolled";

      // Jump Link 1: Open Student 360° Drawer
      results.push({
        id: `stu_drawer_${s.id}`,
        type: "student",
        title: `${studentName} (${s.admissionNo})`,
        subtitle: `${classSec} • Parent: ${s.parentPhone || "N/A"} • Open Student 360° Profile`,
        tag: "SIS Profile",
        tagVariant: "neutral",
        url: `/students?studentId=${s.id}`,
        studentId: s.id,
      });

      // Jump Link 2: Collect Fee in POS
      results.push({
        id: `stu_pos_${s.id}`,
        type: "action",
        title: `Collect Fee: ${studentName}`,
        subtitle: `Adm: ${s.admissionNo} • Quick Supermarket Cashier POS collection`,
        tag: "Fee POS",
        tagVariant: "primary",
        url: `/finance/pos?studentId=${s.id}`,
        studentId: s.id,
      });
    }

    // 2. Search Families by primaryPhone or primaryParentName within current school
    const matchedFamilies = await db
      .select({
        id: families.id,
        primaryParentName: families.primaryParentName,
        primaryPhone: families.primaryPhone,
        email: families.email,
        address: families.address,
      })
      .from(families)
      .where(
        and(
          eq(families.schoolId, session.schoolId),
          or(
            ilike(families.primaryPhone, searchPattern),
            ilike(families.primaryParentName, searchPattern)
          )
        )
      )
      .limit(3);

    for (const f of matchedFamilies) {
      results.push({
        id: `fam_${f.id}`,
        type: "family",
        title: `Family: ${f.primaryParentName} (${f.primaryPhone})`,
        subtitle: `Address: ${f.address || "N/A"} • View Unified Parent Mobile Portal`,
        tag: "Parent Portal",
        tagVariant: "success",
        url: `/parent?familyId=${f.id}`,
        familyId: f.id,
      });
    }

    // 3. Search Receipts by receiptNo within current school
    const matchedReceipts = await db
      .select({
        id: feeReceipts.id,
        receiptNo: feeReceipts.receiptNo,
        amountReceived: feeReceipts.amountReceived,
        paymentMode: feeReceipts.paymentMode,
        clearanceStatus: feeReceipts.clearanceStatus,
        studentId: feeReceipts.studentId,
        studentName: sql<string>`concat(${students.firstName}, ' ', ${students.lastName})`,
      })
      .from(feeReceipts)
      .leftJoin(students, eq(feeReceipts.studentId, students.id))
      .where(
        and(
          eq(feeReceipts.schoolId, session.schoolId),
          ilike(feeReceipts.receiptNo, searchPattern)
        )
      )
      .orderBy(desc(feeReceipts.createdAt))
      .limit(3);

    for (const r of matchedReceipts) {
      results.push({
        id: `rcpt_${r.id}`,
        type: "receipt",
        title: `Receipt ${r.receiptNo} — ₹${r.amountReceived}`,
        subtitle: `Student: ${r.studentName || "N/A"} • Mode: ${r.paymentMode} • Status: ${r.clearanceStatus}`,
        tag: r.clearanceStatus,
        tagVariant: r.clearanceStatus === "CLEARED" ? "success" : "warning",
        url: `/finance?receiptId=${r.id}`,
        receiptId: r.id,
      });
    }
  } catch (err) {
    console.error("Search error in searchGlobalEntities:", err);
  }

  // Capped at 10 results for lightning speed
  return results.slice(0, 10);
}
