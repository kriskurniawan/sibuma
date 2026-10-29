import "server-only";

import { mutateDb } from "./store";
import type {
  Employee,
  NotificationLog,
  NotificationStatus,
  Spkl,
} from "./types";
import { formatDateHuman, formatTime } from "./time";

interface DeliveryResult {
  status: NotificationStatus;
  providerMessageId?: string;
  error?: string;
}

async function deliverWhatsApp(
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

    const json = (await response.json().catch(() => null)) as
      | { success?: boolean; error?: unknown; data?: { id?: string; messageId?: string } }
      | null;

    if (!response.ok || json?.success === false || json?.error) {
      return {
        status: "gagal",
        error: `Chatery membalas HTTP ${response.status}`,
      };
    }

    return {
      status: "terkirim",
      providerMessageId: json?.data?.id ?? json?.data?.messageId,
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
  type: "spkl_baru" | "spkl_diubah" | "spkl_dibatalkan",
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

export async function notifySpkl(
  type: "spkl_baru" | "spkl_diubah" | "spkl_dibatalkan",
  spkl: Spkl,
  employees: Employee[],
  extra?: string,
) {
  const results = await Promise.all(
    employees.map(async (employee) => {
      const message = spklMessage(type, employee, spkl, extra);
      const delivery = await deliverWhatsApp(employee.phone, message);
      return { employee, message, delivery };
    }),
  );

  await mutateDb({ kind: "notification" }, (db) => {
    for (const item of results) {
      const log: NotificationLog = {
        id: crypto.randomUUID(),
        recipientId: item.employee.id,
        recipientPhone: item.employee.phone,
        type,
        message: item.message,
        status: item.delivery.status,
        providerMessageId: item.delivery.providerMessageId,
        error: item.delivery.error,
        createdAt: new Date().toISOString(),
      };
      db.notifications.unshift(log);
    }
  });

  return results;
}
