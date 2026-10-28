import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE, SESSION_DAYS } from "./constants";
import { select } from "./db";
import { canEmployeeLogin } from "./login-identity";
import { serverSecret } from "./server-secret";
import type { Employee, SessionPayload, SessionUser } from "./types";

function sessionSecret() {
  return serverSecret();
}

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function base64UrlDecode(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function signature(payload: string) {
  return createHmac("sha256", sessionSecret())
    .update(payload)
    .digest("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export function createSessionToken(employeeId: string) {
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload: SessionPayload = { employeeId, exp: expires };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  return `${encoded}.${signature(encoded)}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const [encoded, providedSignature] = token.split(".");
  if (!encoded || !providedSignature) return null;

  const expectedSignature = signature(encoded);
  const a = Buffer.from(providedSignature);
  const b = Buffer.from(expectedSignature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encoded)) as SessionPayload;
    if (
      typeof payload.employeeId !== "string" ||
      typeof payload.exp !== "number" ||
      payload.exp < Date.now()
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_DAYS * 24 * 60 * 60,
};

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = verifySessionToken(token);
  if (!payload) return null;

  const employees = await select("employees", "id=$1 OR id=(SELECT supervisor_id FROM employees WHERE id=$1)", [payload.employeeId]);
  const employee = employees.find((item) => item.id === payload.employeeId);
  if (!employee || !canEmployeeLogin(employee, employees)) return null;
  return toSessionUser(employee, employees);
}

export function toSessionUser(
  employee: Employee,
  employees: Employee[],
): SessionUser {
  const supervisor = employee.supervisorId
    ? employees.find((item) => item.id === employee.supervisorId)
    : null;
  return {
    id: employee.id,
    name: employee.name,
    nik: employee.nik,
    phone: employee.phone,
    email: employee.email ?? null,
    role: employee.role,
    supervisorId: employee.supervisorId,
    supervisorName: supervisor?.name ?? null,
  };
}

export function isDemoMode() {
  return process.env.DEMO_MODE === "true";
}
