import { notFound } from "next/navigation";
import { PublicAreaDetail } from "@/components/checklist/public-area-detail";
import { PublicUnavailable } from "@/components/checklist/public-shell";
import { getCurrentUser } from "@/lib/auth";
import { listChecklistConditions } from "@/lib/checklist-conditions";
import {
  getChecklistPublicArea,
  resolveChecklistQrToken,
} from "@/lib/checklist-qr";

export const dynamic = "force-dynamic";

export default async function PublicChecklistAreaPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string; locationId: string }>;
  searchParams: Promise<{ inspection?: string | string[] }>;
}) {
  const [{ token, locationId }, search] = await Promise.all([
    params,
    searchParams,
  ]);
  const inspectionId =
    typeof search.inspection === "string" && search.inspection.length <= 80
      ? search.inspection
      : null;
  const qr = await resolveChecklistQrToken(token);
  if (!qr) notFound();
  const user = await getCurrentUser();
  if (!qr.active) {
    return (
      <PublicUnavailable
        title="QR tidak aktif"
        description="QR ini sudah dinonaktifkan oleh pengelola. Minta QR terbaru kepada petugas gedung."
        loggedIn={Boolean(user)}
        loginNext={`/p/${token}/area/${locationId}`}
      />
    );
  }
  if (qr.mode === "langsung" && qr.locationId !== locationId) notFound();

  // QR pengamat mencakup seluruh area publik perusahaan.
  const ownerId = qr.companyWide ? null : qr.ownerId;
  const area = await getChecklistPublicArea(ownerId, locationId, inspectionId);
  if (!area) {
    if (inspectionId) {
      return (
        <PublicUnavailable
          title="Hasil tidak ditemukan"
          description="Periode pemeriksaan ini tidak tersedia untuk area tersebut."
          loggedIn={Boolean(user)}
          loginNext={`/p/${token}/area/${locationId}`}
        />
      );
    }
    return (
      <PublicUnavailable
        title="Area belum dipublikasikan"
        description="Area ini tidak ditemukan atau belum diaktifkan untuk pengunjung."
        loggedIn={Boolean(user)}
        loginNext={`/p/${token}/area/${locationId}`}
      />
    );
  }

  const conditions = await listChecklistConditions({ includeInactive: true });
  return (
    <PublicAreaDetail
      qrName={qr.name}
      area={area}
      loggedIn={Boolean(user)}
      conditions={conditions}
      backHref={qr.mode === "langsung" ? null : `/p/${token}`}
      detailHref={`/p/${token}/area/${locationId}`}
      equipmentHref={`/p/${token}/area/${locationId}/peralatan`}
      loginNext={`/p/${token}/area/${locationId}`}
    />
  );
}
