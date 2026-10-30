import { notFound } from "next/navigation";
import { PublicAreaDetail } from "@/components/checklist/public-area-detail";
import { PublicAreaList } from "@/components/checklist/public-area-list";
import { PublicUnavailable } from "@/components/checklist/public-shell";
import { getCurrentUser } from "@/lib/auth";
import { listChecklistConditions } from "@/lib/checklist-conditions";
import {
  getChecklistPublicArea,
  getChecklistPublicStaff,
  listChecklistPublicLocations,
  resolveChecklistQrToken,
} from "@/lib/checklist-qr";

export const dynamic = "force-dynamic";

export default async function PublicChecklistPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ inspection?: string | string[] }>;
}) {
  const [{ token }, search] = await Promise.all([params, searchParams]);
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

  const user = await getCurrentUser();

  if (qr.mode === "langsung" && qr.locationId) {
    if (qr.locationPublicEnabled === false || qr.locationActive === false) {
      return (
        <PublicUnavailable
          title="Area belum dipublikasikan"
          description="Pengelola belum mengaktifkan area ini untuk pengunjung. Silakan hubungi petugas gedung."
        />
      );
    }
    const area = await getChecklistPublicArea(
      qr.ownerId,
      qr.locationId,
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
          title="Area tidak tersedia"
          description="Area pada QR ini tidak ditemukan atau sudah tidak aktif."
        />
      );
    }
    const [staff, conditions] = await Promise.all([
      getChecklistPublicStaff(user, qr.ownerId, qr.locationId),
      listChecklistConditions({ includeInactive: true }),
    ]);
    return (
      <PublicAreaDetail
        qrName={qr.name}
        area={area}
        staff={staff}
        conditions={conditions}
        backHref={null}
        detailHref={`/p/${token}`}
        loginNext={`/p/${token}`}
      />
    );
  }

  const locations = await listChecklistPublicLocations(qr.ownerId);
  return (
    <PublicAreaList
      qrName={qr.name}
      token={token}
      locations={locations}
      loggedIn={Boolean(user)}
    />
  );
}
