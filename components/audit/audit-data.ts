import type { AuditLog, NotificationLog } from "@/lib/types";

export type AuditDataResult = {
  logs: AuditLog[];
  notifications: NotificationLog[];
} | null;
export type AuditDataPromise = Promise<AuditDataResult>;
