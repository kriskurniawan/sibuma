import "server-only";
import { sendOtpWhatsApp } from "./notifications";
import type { Employee } from "./types";
import type { OtpChannel } from "./login-identity";

export interface OtpDelivery {
  status: "terkirim" | "gagal";
  channel: OtpChannel;
  destination: string;
  fallback: boolean;
}
async function sendEmail(email: string, code: string, challengeId: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!apiKey || !from) return false;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `otp/${challengeId}`,
      },
      body: JSON.stringify({ from, to: [email], subject: "Kode OTP SIBUMA", text: `Kode OTP SIBUMA kamu adalah ${code}. Kode berlaku selama 5 menit. Jangan bagikan kode ini kepada siapa pun, termasuk yang mengaku dari perusahaan. Abaikan email ini jika kamu tidak meminta kode.` }),
      signal: AbortSignal.timeout(8_000),
      redirect: "error",
    });
    const json = await response.json().catch(() => null) as { id?: string } | null;
    return response.ok && Boolean(json?.id);
  } catch {
    return false;
  }
}
export async function deliverOtp(employee: Employee, channel: OtpChannel, code: string, challengeId: string): Promise<OtpDelivery> {
  const destination = channel === "email" ? employee.email! : employee.phone;
  if (channel === "whatsapp") {
    const wa = await sendOtpWhatsApp(employee.phone, code);
    if (wa.status === "terkirim") return { status: "terkirim", channel, destination, fallback: false };
  }
  if (employee.email && await sendEmail(employee.email, code, challengeId)) {
    return { status: "terkirim", channel: "email", destination: employee.email, fallback: channel === "whatsapp" };
  }
  return { status: "gagal", channel, destination, fallback: channel === "whatsapp" };
}
