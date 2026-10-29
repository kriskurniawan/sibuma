import { SESSION_COOKIE } from "@/lib/constants";
import { createSessionToken, sessionCookieOptions, toSessionUser } from "@/lib/auth";
import { apiError, apiOk, validationMessage } from "@/lib/http";
import { verifyOtp } from "@/lib/otp";
import { otpVerifySchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let raw: unknown;
  try { raw = await request.json(); } catch { return apiError("Permintaan tidak valid."); }
  const parsed = otpVerifySchema.safeParse(raw);
  if (!parsed.success) return apiError(validationMessage(parsed.error));
  try {
    const result = await verifyOtp(parsed.data.identifier, parsed.data.challengeId, parsed.data.code);
    if ("error" in result && result.error) return apiError(result.error, result.status);
    if (!("employee" in result)) return apiError("Gagal membuat sesi.");
    const response = apiOk({ message: "Berhasil masuk.", user: toSessionUser(result.employee, result.employees) });
    response.cookies.set(SESSION_COOKIE, createSessionToken(result.employee.id), sessionCookieOptions);
    return response;
  } catch (error) {
    console.error("Verifikasi OTP gagal diproses.", error);
    return apiError("Server gagal memproses verifikasi OTP. Coba lagi beberapa saat lagi.", 500);
  }
}
