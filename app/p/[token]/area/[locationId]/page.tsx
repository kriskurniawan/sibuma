import { notFound } from "next/navigation";
import { PublicAreaDetail } from "@/components/checklist/public-area-detail";
import { PublicUnavailable } from "@/components/checklist/public-shell";
import { getCurrentUser } from "@/lib/auth";
import { listChecklistConditions } from "@/lib/checklist-conditions";
import {
  getChecklistPublicArea,
  getChecklistPublicStaff,
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
  if (!qr.active) {
    return (
      <PublicUnavailable
        title="QR tidak aktif"
        description="QR ini sudah dinonaktifkan oleh pengelola. Minta QR terbaru kepada petugas gedung."
      />
    );
  }
  if (qr.mode === "langsung" && qr.locationId !== locationId) notFound();

  const area = await getChecklistPublicArea(
    qr.ownerId,
    locationId,
    inspectionId,
  );
  if (!area) {
    if (inspectionId) {
      return (
        <PublicUnavailable
          title="Hasil tidak ditemukan"
          description="Periode pemeriksaan ini tidak tersedia untuk area tersebut."
        />
      );
    }
    return (
      <PublicUnavailable
        title="Area belum dipublikasikan"
        description="Area ini tidak ditemukan atau belum diaktifkan untuk pengunjung."
      />
    );
  }

  const user = await getCurrentUser();
  const [staff, conditions] = await Promise.all([
    getChecklistPublicStaff(user, qr.ownerId, locationId),
    listChecklistConditions({ includeInactive: true }),
  ]);

  return (
    <PublicAreaDetail
      qrName={qr.name}
      area={area}
      staff={staff}
      conditions={conditions}
      backHref={qr.mode === "langsung" ? null : `/p/${token}`}
      detailHref={`/p/${token}/area/${locationId}`}
      loginNext={`/p/${token}/area/${locationId}`}
    />
  );
}
