import { db } from "@/db";
import { auditLogs } from "@/db/schema";

export interface AuditLogParams {
  schoolId: string;
  userId: string;
  entityType: string;
  entityId: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "VOID" | "BOUNCE" | "OVERRIDE" | "PROMOTE" | "CONCESSION";
  oldValueJson?: Record<string, unknown> | null;
  newValueJson?: Record<string, unknown> | null;
  reason?: string | null;
}

/**
 * Log immutable audit trail entry to audit_logs table
 */
export async function logAuditTrail(params: AuditLogParams) {
  try {
    const [entry] = await db
      .insert(auditLogs)
      .values({
        schoolId: params.schoolId,
        userId: params.userId,
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        oldValueJson: params.oldValueJson ?? null,
        newValueJson: params.newValueJson ?? null,
        reason: params.reason ?? null,
      })
      .returning();

    return entry;
  } catch (error) {
    // In production, log to stderr; never swallow silently without logging
    console.error("[AUDIT LOG FAILURE]: Failed to persist audit trail entry", {
      params,
      error,
    });
    throw error;
  }
}
