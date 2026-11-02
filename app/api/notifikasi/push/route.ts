import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { apiError, apiOk, validationMessage } from "@/lib/http";
import {
  countPushSubscriptions,
  deletePushSubscription,
  savePushSubscription,
} from "@/lib/notification-store";
import { getPushConfig } from "@/lib/push-delivery";

export const runtime = "nodejs";

const subscriptionSchema = z.object({
  endpoint: z.string().trim().url().max(2048),
  keys: z.object({
    p256dh: z.string().trim().min(1).max(512),
    auth: z.string().trim().min(1).max(512),
  }),
  expirationTime: z.number().nullable().optional(),
});

const detachSchema = z.object({
  endpoint: z.string().trim().min(1).max(2048),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);

  const config = getPushConfig();
  const subscriptions = await countPushSubscriptions(user.id);
  return apiOk({
    configured: config.configured,
    publicKey: config.publicKey,
    subscriptions,
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError("Data perangkat tidak valid.");
  }
  const parsed = subscriptionSchema.safeParse(raw);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  const id = await savePushSubscription(
    user.id,
    parsed.data,
    request.headers.get("user-agent") ?? "",
  );
  if (!id) return apiError("Perangkat gagal didaftarkan. Coba lagi.", 503);
  return apiOk({ id, message: "Notifikasi perangkat diaktifkan." }, 201);
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError("Data perangkat tidak valid.");
  }
  const parsed = detachSchema.safeParse(raw);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  await deletePushSubscription(user.id, parsed.data.endpoint);
  return apiOk({ message: "Notifikasi perangkat dimatikan." });
}
