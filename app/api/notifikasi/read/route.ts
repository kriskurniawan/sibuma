import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { apiError, apiOk, validationMessage } from "@/lib/http";
import { markNotificationsRead } from "@/lib/notification-store";

export const runtime = "nodejs";

const readSchema = z
  .object({
    ids: z.array(z.string().trim().min(1)).max(200).optional(),
    all: z.boolean().optional(),
  })
  .refine((value) => value.all === true || (value.ids?.length ?? 0) > 0, {
    message: "Pilih notifikasi yang akan ditandai dibaca.",
  });

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError("Permintaan tidak valid.");
  }
  const parsed = readSchema.safeParse(raw);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  const unreadCount = await markNotificationsRead(
    user.id,
    parsed.data.all ? undefined : parsed.data.ids,
  );
  return apiOk({ unreadCount, message: "Notifikasi ditandai sudah dibaca." });
}
