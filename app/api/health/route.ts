import { apiError, apiOk } from "@/lib/http";
import { query } from "@/lib/db";
import { isS3Configured } from "@/lib/storage-config";
export const runtime = "nodejs";
export async function GET() {
  if (!isS3Configured()) return apiError("Neon Object Storage belum dikonfigurasi.", 503);
  try {
    const [migration] = await query("SELECT id FROM schema_migrations WHERE id='001_relational'");
    if (!migration) return apiError("Migrasi database relasional belum selesai.", 503);
    const [counts] = await query("SELECT (SELECT count(*)::integer FROM employees) employees,(SELECT count(*)::integer FROM spkls) spkls");
    return apiOk({ status: "ok", time: new Date().toISOString(), database: "neon-postgres", schema: "relational-v1", storage: "neon-object-storage", ...counts });
  } catch { return apiError("Database belum tersedia. Periksa konfigurasi dan migrasi.", 503); }
}
