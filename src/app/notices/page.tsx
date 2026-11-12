import * as React from "react";
import { db } from "@/db";
import { notices, users, classes } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getActiveContext } from "@/lib/context";
import { NoticesClient, NoticeItem } from "./notices-client";

export const dynamic = "force-dynamic";

export default async function NoticesPage() {
  const context = await getActiveContext();
  const schoolId = context.schoolId;
  const yearId = context.academicYearId;

  const rawNotices = await db
    .select({
      id: notices.id,
      title: notices.title,
      content: notices.content,
      targetAudience: notices.targetAudience,
      applicableClassIds: notices.applicableClassIds,
      priority: notices.priority,
      attachmentUrl: notices.attachmentUrl,
      createdAt: notices.createdAt,
      authorName: users.name,
    })
    .from(notices)
    .leftJoin(users, eq(notices.authorId, users.id))
    .where(eq(notices.schoolId, schoolId))
    .orderBy(desc(notices.createdAt));

  const rawClasses = await db
    .select({
      id: classes.id,
      name: classes.name,
    })
    .from(classes)
    .where(eq(classes.schoolId, schoolId))
    .orderBy(classes.numericOrder);

  const initialNotices: NoticeItem[] = rawNotices.map((n) => ({
    id: n.id,
    title: n.title,
    content: n.content,
    targetAudience: n.targetAudience as any,
    applicableClassIds: n.applicableClassIds || [],
    priority: n.priority as any,
    attachmentUrl: n.attachmentUrl,
    createdAt: n.createdAt.toISOString(),
    authorName: n.authorName,
  }));

  return (
    <NoticesClient
      schoolId={schoolId}
      academicYearId={yearId}
      academicYearName={context.academicYearName}
      isLocked={context.isLocked}
      currentUserId={context.user.id}
      currentUserRole={context.user.role}
      initialNotices={initialNotices}
      classesList={rawClasses}
    />
  );
}
