import { normalizePhone } from "./phone";
import type { Employee } from "./types";

export type OtpChannel = "whatsapp" | "email";
export function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}
export function normalizeLoginIdentifier(value: string) {
  if (value.includes("@")) {
    const identifier = normalizeEmail(value);
    return identifier ? { identifier, channel: "email" as const } : null;
  }
  const identifier = normalizePhone(value);
  return identifier ? { identifier, channel: "whatsapp" as const } : null;
}
export function canEmployeeLogin(employee: Employee | undefined, employees: Employee[]) {
  if (!employee?.active || !employee.nik.trim()) return false;
  if (employee.role === "atasan") return true;
  return Boolean(employee.divisionId && employee.supervisorId && employees.some(
    (item) => item.id === employee.supervisorId && item.role === "atasan" && item.active,
  ));
}
export function maskDestination(destination: string, channel: OtpChannel) {
  if (channel === "whatsapp") return `${destination.slice(0, 5)}••••${destination.slice(-3)}`;
  const [local, domain] = destination.split("@");
  return `${local.slice(0, 1)}••••@${domain}`;
}
