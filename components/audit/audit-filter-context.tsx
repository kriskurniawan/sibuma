"use client";

import { createContext, useContext } from "react";
import type { AuditLog, NotificationStatus } from "@/lib/types";

type AuditTab = "audit" | "notifikasi";
type AuditType = AuditLog["objectType"];

interface AuditFilters {
  tab: AuditTab;
  setTab: (tab: AuditTab) => void;
  typeFilter: "semua" | AuditType;
  setTypeFilter: (type: "semua" | AuditType) => void;
  search: string;
  setSearch: (search: string) => void;
  notificationSearch: string;
  setNotificationSearch: (search: string) => void;
  notificationStatus: "semua" | NotificationStatus;
  setNotificationStatus: (status: "semua" | NotificationStatus) => void;
}

export const AuditFilterContext = createContext<AuditFilters | null>(null);

export function useAuditFilters() {
  const filters = useContext(AuditFilterContext);
  if (!filters) throw new Error("AuditShell is required");
  return filters;
}
