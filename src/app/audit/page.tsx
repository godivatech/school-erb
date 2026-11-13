import * as React from "react";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { AuditClient, AuditLogItem } from "./audit-client";
import { redirect } from "next/navigation";
import { getActiveContext } from "@/lib/context";

export const dynamic = "force-dynamic";

export default async function AuditLogPage() {
  const context = await getActiveContext();

  // Role guard: Only Super Admin and Principal
  if (context.user.role === "PARENT") {
    redirect("/parent");
  }
  if (context.user.role === "TEACHER") {
    redirect("/attendance");
  }
  if (context.user.role === "ACCOUNTANT") {
    redirect("/finance");
  }

  const rawLogs = await db
    .select({
      id: auditLogs.id,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      action: auditLogs.action,
      oldValueJson: auditLogs.oldValueJson,
      newValueJson: auditLogs.newValueJson,
      reason: auditLogs.reason,
      createdAt: auditLogs.createdAt,
      actorName: users.name,
      actorRole: users.role,
    })
    .from(auditLogs)
    .innerJoin(users, eq(auditLogs.userId, users.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(100);

  const logs: AuditLogItem[] = rawLogs.map((l) => ({
    id: l.id,
    entityType: l.entityType,
    entityId: l.entityId,
    action: l.action,
    oldValueJson: l.oldValueJson,
    newValueJson: l.newValueJson,
    reason: l.reason,
    createdAt: l.createdAt.toISOString(),
    actorName: l.actorName,
    actorRole: l.actorRole,
  }));

  return <AuditClient logs={logs} />;
}
