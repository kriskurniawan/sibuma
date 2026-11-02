import { getCurrentUser } from "@/lib/auth";
import { apiError, apiOk } from "@/lib/http";
import { getNotificationInbox } from "@/lib/notification-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);

  const params = new URL(request.url).searchParams;
  if (params.get("count") === "1") {
    const inbox = await getNotificationInbox(user.id, { limit: 1 });
    return apiOk({ unreadCount: inbox.unreadCount });
  }

  const requestedLimit = Number(params.get("limit") ?? "50");
  const limit = Number.isFinite(requestedLimit) ? requestedLimit : 50;
  const cursor = params.get("cursor");
  const inbox = await getNotificationInbox(user.id, { limit, cursor });
  return apiOk(inbox);
}
