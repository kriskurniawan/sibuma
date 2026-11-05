import { notFound } from "next/navigation";
import { PublicEquipmentDetail } from "@/components/checklist/public-equipment-detail";
import { PublicUnavailable } from "@/components/checklist/public-shell";
import { getCurrentUser } from "@/lib/auth";
import { getChecklistPublicEquipmentDetail } from "@/lib/checklist-equipment";
import { resolveChecklistQrToken } from "@/lib/checklist-qr";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Riwayat peralatan",
};

export default async function PublicChecklistEquipmentPage({
  params,
}: {
  params: Promise<{
    token: string;
    locationId: string;
    equipmentId: string;
  }>;
}) {
  const { token, locationId, equipmentId } = await params;
  const qr = await resolveChecklistQrToken(token);
  if (!qr) notFound();

  const user = await getCurrentUser();
  const loginNext = `/p/${token}/area/${locationId}/peralatan/${equipmentId}`;
  if (!qr.active) {
    return (
      <PublicUnavailable
        title="QR tidak aktif"
        description="QR ini sudah dinonaktifkan oleh pengelola. Minta QR terbaru kepada petugas gedung."
        loggedIn={Boolean(user)}
        loginNext={loginNext}
      />
    );
  }
  if (qr.mode === "langsung" && qr.locationId !== locationId) notFound();

  // QR pengamat mencakup seluruh area publik perusahaan.
  const ownerId = qr.companyWide ? null : qr.ownerId;
  const detail = await getChecklistPublicEquipmentDetail(
    ownerId,
    locationId,
    equipmentId,
  );
  if (!detail) {
    return (
      <PublicUnavailable
        title="Peralatan tidak ditemukan"
        description="Peralatan ini tidak tersedia untuk pengunjung atau sudah dinonaktifkan pengelola."
        loggedIn={Boolean(user)}
        loginNext={loginNext}
      />
    );
  }

  return (
    <PublicEquipmentDetail
      detail={detail}
      qrName={qr.name}
      loggedIn={Boolean(user)}
      backHref={`/p/${token}/area/${locationId}`}
      loginNext={loginNext}
    />
  );
}
