import { getCurrentUser } from "@/lib/auth";
import { apiError, apiOk, validationMessage } from "@/lib/http";
import { readOnlyWrite } from "@/lib/read-only";
import { WorkDocumentError } from "@/lib/work-document-errors";
import {
  moveWorkDocumentToTrash,
  purgeWorkDocument,
  restoreWorkDocument,
} from "@/lib/work-document-mutations";
import { workDocumentBulkSchema } from "@/lib/work-document-validation";

export const maxDuration = 30;

/** Jumlah dokumen yang diproses bersamaan; pool database dibatasi 4. */
const BULK_CONCURRENCY = 4;

interface BulkResult {
  id: string;
  ok: boolean;
  message?: string;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const parsed = workDocumentBulkSchema.safeParse(body);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  const { action, ids } = parsed.data;
  const results: BulkResult[] = [];

  for (let index = 0; index < ids.length; index += BULK_CONCURRENCY) {
    const chunk = ids.slice(index, index + BULK_CONCURRENCY);
    const chunkResults = await Promise.all(
      chunk.map(async (id): Promise<BulkResult> => {
        try {
          if (action === "trash") {
            await moveWorkDocumentToTrash(user, id);
          } else if (action === "restore") {
            await restoreWorkDocument(user, id);
          } else {
            await purgeWorkDocument(user, id);
          }
          return { id, ok: true };
        } catch (error) {
          if (error instanceof WorkDocumentError) {
            return { id, ok: false, message: error.message };
          }
          console.error(
            `Aksi massal dokumen "${action}" gagal untuk ${id}:`,
            error,
          );
          return {
            id,
            ok: false,
            message: "Dokumen gagal diproses. Silakan coba lagi.",
          };
        }
      }),
    );
    results.push(...chunkResults);
  }

  const failed = results.filter((result) => !result.ok).length;
  return apiOk({
    results,
    succeeded: results.length - failed,
    failed,
  });
}
