import type { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "./db";

export async function logAudit(params: {
  documentId: string;
  action: AuditAction;
  field?: string;
  oldValue?: string | null;
  newValue?: string | null;
  actor?: string;
  meta?: Prisma.InputJsonValue;
}) {
  return prisma.auditLog.create({
    data: {
      documentId: params.documentId,
      action: params.action,
      field: params.field,
      oldValue: params.oldValue ?? null,
      newValue: params.newValue ?? null,
      actor: params.actor ?? "system",
      meta: params.meta,
    },
  });
}
