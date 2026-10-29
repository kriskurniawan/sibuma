import { apiError, apiOk, validationMessage } from "@/lib/http";
import { requestOtp } from "@/lib/otp";
import { otpRequestSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  let raw: unknown;
  try { raw = await request.json(); } catch { return apiError("Permintaan tidak valid."); }
  const parsed = otpRequestSchema.safeParse(raw);
  if (!parsed.success) return apiError(validationMessage(parsed.error));
  try {
    const result = await requestOtp(parsed.data.identifier);
    if ("error" in result && result.error) return apiError(result.error, result.status);
    return apiOk(result);
  } catch (error) {
    console.error("Permintaan OTP gagal diproses.", error);
    return apiError("Server gagal memproses permintaan OTP. Coba lagi beberapa saat lagi.", 500);
  }
}
