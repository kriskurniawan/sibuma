import type { EmployeeRole, SessionUser } from "./types";

/**
 * Izin aplikasi dipusatkan di sini agar pembatasan global tidak tersebar dan
 * tidak melebar menjadi "semua yang bukan pekerja".
 */
export type Capability =
  | "policy.manage"
  | "checklistConditions.manage"
  | "supervisors.manage"
  | "audit.read.all"
  | "reports.read.all";

/** Cakupan data menentukan query mana yang boleh dipakai, bukan hanya UI. */
export type DataScope = "self" | "owner" | "all";

const ROLE_CAPABILITIES: Record<EmployeeRole, readonly Capability[]> = {
  pekerja: [],
  atasan: [],
  super_admin: [
    "policy.manage",
    "checklistConditions.manage",
    "supervisors.manage",
    "audit.read.all",
    "reports.read.all",
  ],
};

const ROLE_SCOPE: Record<EmployeeRole, DataScope> = {
  pekerja: "self",
  atasan: "owner",
  super_admin: "all",
};

export function can(role: EmployeeRole, capability: Capability) {
  return ROLE_CAPABILITIES[role].includes(capability);
}

export function dataScopeFor(role: EmployeeRole): DataScope {
  return ROLE_SCOPE[role];
}

export function isSuperAdmin(user: Pick<SessionUser, "role">) {
  return user.role === "super_admin";
}

export function isAtasan(user: Pick<SessionUser, "role">) {
  return user.role === "atasan";
}
