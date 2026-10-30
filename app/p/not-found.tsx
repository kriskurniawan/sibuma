import { PublicUnavailable } from "@/components/checklist/public-shell";

export default function PublicNotFound() {
  return (
    <PublicUnavailable
      title="QR tidak ditemukan"
      description="Tautan QR ini tidak tersedia. Periksa hasil scan atau minta QR terbaru kepada petugas gedung."
    />
  );
}
