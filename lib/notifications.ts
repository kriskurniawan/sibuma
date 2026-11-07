import "server-only";

import type { Employee, NotificationStatus, Spkl } from "./types";
import { formatDateHuman, formatTime } from "./time";

export type SpklNotificationType =
  | "spkl_baru"
  | "spkl_diubah"
  | "spkl_dibatalkan";

interface DeliveryResult {
  status: NotificationStatus;
  providerMessageId?: string;
  error?: string;
}

export async function deliverWhatsApp(
  phone: string,
  message: string,
): Promise<DeliveryResult> {
  const apiUrl = process.env.CHATERY_API_URL?.trim();
  const apiKey = process.env.CHATERY_API_KEY?.trim();
  const sessionId = process.env.CHATERY_SESSION_ID?.trim();

  if (!apiUrl || !apiKey || !sessionId) {
    return {
      status: "gagal",
      error: "Chatery belum dikonfigurasi. Isi CHATERY_API_URL, CHATERY_API_KEY, dan CHATERY_SESSION_ID.",
    };
  }

  try {
    const baseUrl = apiUrl.replace(/\/$/, "");
    const response = await fetch(`${baseUrl}/chats/send-text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify({
        sessionId,
        chatId: phone,
        message,
        typingTime: 500,
      }),
      signal: AbortSignal.timeout(12_000),
      redirect: "error",
    });

    // Chatery dapat membalas HTTP 200 dengan body kosong atau bukan JSON saat
    // sesi perangkat bermasalah. Hanya respons yang memuat ID pesan dianggap
    // benar-benar terkirim.
    const text = await response.text().catch(() => "");
    let json: {
      success?: unknown;
      error?: unknown;
      message?: unknown;
      data?: { id?: unknown; messageId?: unknown } | null;
      id?: unknown;
      messageId?: unknown;
    } | null = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    const messageId = [
      json?.data?.id,
      json?.data?.messageId,
      json?.id,
      json?.messageId,
    ].find((value): value is string => typeof value === "string" && value.length > 0);
    const providerError = json?.error;
    const hasProviderError =
      providerError !== undefined &&
      providerError !== null &&
      (typeof providerError !== "string" || providerError.trim().length > 0);
    const explicitlyFailed = json?.success === false || hasProviderError;
    const providerDetail = (() => {
      const detail = json?.error ?? json?.message;
      if (typeof detail === "string" && detail.trim()) {
        return detail.trim().slice(0, 300);
      }
      if (detail && typeof detail === "object") {
        try {
          return JSON.stringify(detail).slice(0, 300);
        } catch {
          return "";
        }
      }
      return "";
    })();

    if (!response.ok || explicitlyFailed || !messageId) {
      const reason = !response.ok
        ? `Chatery membalas HTTP ${response.status}`
        : explicitlyFailed
          ? `Chatery menolak pesan${providerDetail ? `: ${providerDetail}` : "."}`
          : json === null
            ? "Respons Chatery bukan JSON yang valid."
            : "Respons Chatery tidak memuat ID pesan, jadi status pengiriman tidak dapat dipastikan.";
      return {
        status: "gagal",
        error: reason.slice(0, 400),
      };
    }

    return {
      status: "terkirim",
      providerMessageId: messageId,
    };
  } catch (error) {
    return {
      status: "gagal",
      error: error instanceof Error ? error.message : "Gagal menghubungi Chatery",
    };
  }
}

export async function sendOtpWhatsApp(phone: string, code: string) {
  const message = `Kode OTP SIBUMA kamu adalah ${code}. Kode berlaku selama 5 menit. Jangan bagikan kode ini kepada siapa pun, termasuk yang mengaku dari perusahaan.`;
  return deliverWhatsApp(phone, message);
}

function spklMessage(
  type: SpklNotificationType,
  employee: Employee,
  spkl: Spkl,
  extra?: string,
) {
  const firstName = employee.name.split(" ")[0];
  const schedule = `${formatDateHuman(spkl.startAt, "EEEE, d MMMM yyyy")}, pukul ${formatTime(spkl.startAt)}–${formatTime(spkl.endAt)}`;
  const intro = {
    spkl_baru: "Kamu mendapat penugasan lembur baru.",
    spkl_diubah: "Jadwal SPKL kamu diperbarui.",
    spkl_dibatalkan: "SPKL yang menugaskanmu dibatalkan.",
  }[type];

  return `Halo ${firstName}, ${intro}\n\n${spkl.title}\n${spkl.number}\n${schedule}\n\n${extra ? `${extra}\n\n` : ""}Buka aplikasi SIBUMA untuk melihat detail dan melakukan absensi.`;
}

/**
 * Pesan per penerima dipakai baik oleh outbox (pengiriman tertunda) maupun
 * pengujian. Isi pesan dibentuk di satu tempat agar perubahan format tidak
 * berbeda antar jalur.
 */
export function spklMessages(
  type: SpklNotificationType,
  spkl: Spkl,
  employees: Employee[],
  extra?: string,
) {
  return employees.map((employee) => ({
    employee,
    message: spklMessage(type, employee, spkl, extra),
  }));
}
