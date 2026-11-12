"use server";

import { db } from "@/db";
import { notices, auditLogs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { safeRevalidatePath } from "@/lib/safe-revalidate";
import { resolveVerifiedSession, assertRole, type Role } from "@/lib/guards";

export interface CreateNoticeInput {
  schoolId?: string;
  userId?: string;
  userRole?: Role;
  academicYearId: string;
  authorId?: string;
  title: string;
  content: string;
  targetAudience: "ALL" | "TEACHERS" | "PARENTS" | "STUDENTS";
  applicableClassIds?: string[];
  priority: "NORMAL" | "URGENT";
  attachmentUrl?: string;
}

export async function createNotice(input: CreateNoticeInput) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL", "TEACHER"]);

  return await db.transaction(async (tx) => {
    const [notice] = await tx
      .insert(notices)
      .values({
        schoolId: session.schoolId,
        academicYearId: input.academicYearId,
        title: input.title,
        content: input.content,
        targetAudience: input.targetAudience,
        applicableClassIds: input.applicableClassIds || [],
        priority: input.priority,
        attachmentUrl: input.attachmentUrl || null,
        authorId: session.userId,
      })
      .returning();

    // Audit Log
    await tx.insert(auditLogs).values({
      schoolId: session.schoolId,
      userId: session.userId,
      entityType: "NOTICE",
      entityId: notice.id,
      action: "CREATE",
      newValueJson: {
        title: notice.title,
        targetAudience: notice.targetAudience,
        priority: notice.priority,
      },
      reason: `Published notice: ${notice.title}`,
    });

    safeRevalidatePath("/notices");
    safeRevalidatePath("/parent");
    return { success: true, notice };
  });
}

export interface UpdateNoticeInput {
  id: string;
  schoolId?: string;
  userId?: string;
  userRole?: Role;
  title: string;
  content: string;
  targetAudience: "ALL" | "TEACHERS" | "PARENTS" | "STUDENTS";
  applicableClassIds?: string[];
  priority: "NORMAL" | "URGENT";
  attachmentUrl?: string;
}

export async function updateNotice(input: UpdateNoticeInput) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL", "TEACHER"]);

  if (!input.title?.trim() || !input.content?.trim()) {
    throw new Error("Title and content are required.");
  }

  return await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(notices)
      .set({
        title: input.title.trim(),
        content: input.content.trim(),
        targetAudience: input.targetAudience,
        applicableClassIds: input.applicableClassIds || [],
        priority: input.priority,
        attachmentUrl: input.attachmentUrl?.trim() || null,
      })
      .where(and(eq(notices.id, input.id), eq(notices.schoolId, session.schoolId)))
      .returning();

    if (!updated) {
      throw new Error("Notice not found or does not belong to your school.");
    }

    await tx.insert(auditLogs).values({
      schoolId: session.schoolId,
      userId: session.userId,
      entityType: "NOTICE",
      entityId: updated.id,
      action: "UPDATE",
      newValueJson: {
        title: updated.title,
        targetAudience: updated.targetAudience,
        priority: updated.priority,
      },
      reason: `Updated notice: ${updated.title}`,
    });

    safeRevalidatePath("/notices");
    safeRevalidatePath("/parent");
    return { success: true, notice: updated };
  });
}

export async function deleteNotice(input: {
  id: string;
  schoolId?: string;
  userId?: string;
  userRole?: Role;
}) {
  const session = await resolveVerifiedSession(input);
  assertRole(session.userRole, ["SUPER_ADMIN", "PRINCIPAL"]);

  return await db.transaction(async (tx) => {
    const [deleted] = await tx
      .delete(notices)
      .where(and(eq(notices.id, input.id), eq(notices.schoolId, session.schoolId)))
      .returning();

    if (!deleted) {
      throw new Error("Notice not found or already deleted.");
    }

    await tx.insert(auditLogs).values({
      schoolId: session.schoolId,
      userId: session.userId,
      entityType: "NOTICE",
      entityId: input.id,
      action: "DELETE",
      oldValueJson: { title: deleted.title },
      reason: `Removed notice: ${deleted.title}`,
    });

    safeRevalidatePath("/notices");
    return { success: true };
  });
}
