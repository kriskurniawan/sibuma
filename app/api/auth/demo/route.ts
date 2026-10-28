import { isDemoMode, createSessionToken, sessionCookieOptions, toSessionUser } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/constants";
import { apiError, apiOk } from "@/lib/http";
import { canEmployeeLogin } from "@/lib/login-identity";
import { mutateDb, pushAudit } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isDemoMode()) {
    return apiError("Mode demo tidak aktif.", 403);
  }

  let body: { employeeId?: string };
  try {
    body = (await request.json()) as { employeeId?: string };
  } catch {
    return apiError("Permintaan tidak valid.");
  }

  if (!body.employeeId) return apiError("Pilih akun demo.");

  const result = await mutateDb({ kind: "login", id: body.employeeId }, (db) => {
    const employee = db.employees.find(
      (item) => item.id === body.employeeId && item.active,
    );
    if (!employee || !canEmployeeLogin(employee, db.employees)) return null;

    pushAudit(db, {
      actorId: employee.id,
      actorName: employee.name,
      action: "login_demo",
      objectType: "autentikasi",
      objectId: employee.id,
      summary: `${employee.name} masuk melalui akses cepat demo.`,
      after: { mode: "demo" },
    });

    return {
      employee,
      user: toSessionUser(employee, db.employees),
    };
  });

  if (!result) return apiError("Akun demo tidak ditemukan.", 404);

  const response = apiOk({ message: "Berhasil masuk.", user: result.user });
  response.cookies.set(
    SESSION_COOKIE,
    createSessionToken(result.employee.id),
    sessionCookieOptions,
  );
  return response;
}
