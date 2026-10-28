"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Crosshair,
  LocateFixed,
  LogIn,
  LogOut,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { MapView, type MapMarker } from "@/components/maps/map-view";
import { Modal } from "@/components/modal";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/reui/alert";
import { Badge } from "@/components/reui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatDistance, distanceMeters } from "@/lib/geo";
import type { GeoPoint } from "@/lib/types";
import { cn } from "@/lib/utils";

interface AttendanceDialogProps {
  open: boolean;
  onClose: () => void;
  mode: "checkin" | "checkout";
  spklId: string;
  attendanceId?: string;
  site: GeoPoint;
  radiusMeters: number;
  maxAccuracyMeters: number;
  requiresDocumentation?: boolean;
}

interface PositionState {
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt: number;
}

export function AttendanceDialog({
  open,
  onClose,
  mode,
  spklId,
  attendanceId,
  site,
  radiusMeters,
  maxAccuracyMeters,
  requiresDocumentation = false,
}: AttendanceDialogProps) {
  const router = useRouter();
  const [position, setPosition] = useState<PositionState | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locate = useCallback(() => {
    setError(null);
    setPosition(null);
    if (!("geolocation" in navigator)) {
      setError("Browser ini tidak mendukung GPS. Gunakan browser modern.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (result) => {
        setPosition({
          latitude: result.coords.latitude,
          longitude: result.coords.longitude,
          accuracy: result.coords.accuracy,
          capturedAt: result.timestamp,
        });
        setLocating(false);
      },
      (geoError) => {
        setLocating(false);
        const messages: Record<number, string> = {
          1: "Izin lokasi ditolak. Aktifkan izin lokasi untuk situs ini di pengaturan browser.",
          2: "Lokasi tidak tersedia saat ini. Pindah ke area terbuka dan coba lagi.",
          3: "Pengambilan lokasi terlalu lama. Coba lagi.",
        };
        setError(
          messages[geoError.code] ??
            "Lokasi tidak dapat diambil. Pastikan GPS aktif dan koneksi stabil.",
        );
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }, []);

  useEffect(() => {
    if (!open) {
      setPosition(null);
      setError(null);
      setSubmitting(false);
      return;
    }
    locate();
  }, [open, locate]);

  const distance = position
    ? distanceMeters(site, {
        latitude: position.latitude,
        longitude: position.longitude,
      })
    : null;
  const tooFar = distance !== null && distance > radiusMeters;
  const inaccurate =
    position !== null && position.accuracy > maxAccuracyMeters;
  const blocked = !position || tooFar || inaccurate;
  const markers: MapMarker[] = [
    {
      id: "site",
      latitude: site.latitude,
      longitude: site.longitude,
      label: "Titik lembur",
      showLabel: true,
      type: "site",
    },
    ...(position
      ? [
          {
            id: "current-position",
            latitude: position.latitude,
            longitude: position.longitude,
            label: "Posisi kamu sekarang",
            showLabel: true,
            type: "worker" as const,
          },
        ]
      : []),
  ];

  async function submit() {
    if (!position) return;
    setSubmitting(true);
    setError(null);
    try {
      const endpoint =
        mode === "checkin"
          ? `/api/spkl/${spklId}/attendance`
          : `/api/attendance/${attendanceId}/checkout`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: position.latitude,
          longitude: position.longitude,
          accuracy: position.accuracy,
        }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        message?: string;
      };
      if (!response.ok || !data.ok) {
        setError(data.message ?? "Absensi gagal disimpan.");
        return;
      }
      toast.success(
        data.message ??
          (mode === "checkin"
            ? "Absen masuk tercatat."
            : "Absen pulang tercatat."),
      );
      onClose();
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server. Periksa koneksi internetmu.");
    } finally {
      setSubmitting(false);
    }
  }

  const isCheckin = mode === "checkin";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isCheckin ? "Absen masuk lembur" : "Absen pulang lembur"}
      description={
        isCheckin
          ? "Posisi diambil dari GPS perangkat; waktu absensi dicatat oleh server."
          : "Pastikan seluruh dokumentasi pekerjaan sudah diunggah sebelum pulang."
      }
      size="md"
      dismissible={!submitting}
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
            className="sm:flex-1"
          >
            Batal
          </Button>
          <Button
            type="button"
            variant={isCheckin ? "default" : "destructive"}
            onClick={submit}
            disabled={blocked || submitting}
            className="sm:flex-1"
          >
            {submitting ? (
              <>
                <Spinner />
                Menyimpan…
              </>
            ) : isCheckin ? (
              <>
                <LogIn />
                Absen masuk
              </>
            ) : (
              <>
                <LogOut />
                Absen pulang
              </>
            )}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Alert
          role="status"
          variant={
            !position ? "info" : blocked ? "destructive" : "success"
          }
        >
          {locating ? (
            <Spinner />
          ) : !position ? (
            <Crosshair />
          ) : blocked ? (
            <AlertCircle />
          ) : (
            <CheckCircle2 />
          )}
          <AlertTitle>
            {locating
              ? "Mengambil titik GPS…"
              : !position
                ? "Lokasi belum terdeteksi"
                : tooFar
                  ? "Kamu berada di luar radius absen"
                  : inaccurate
                    ? "Akurasi GPS belum cukup"
                    : "Lokasi terverifikasi"}
          </AlertTitle>
          <AlertDescription>
            {!position
              ? "Izinkan akses lokasi saat browser meminta. GPS membutuhkan HTTPS atau localhost."
              : `Akurasi ±${Math.round(position.accuracy)} m · Jarak dari titik ${formatDistance(distance ?? 0)} · Radius ${radiusMeters} m`}
          </AlertDescription>
        </Alert>

        <div className="flex min-w-0 flex-col gap-2">
          <div className="relative isolate h-[220px] overflow-hidden rounded-lg bg-muted sm:h-[260px]">
            {open && (
              <MapView
                center={site}
                markers={markers}
                radiusMeters={radiusMeters}
                zoom={16}
                // The dialog may unmount during zoom; Leaflet 1.9 leaves a
                // pending zoom callback after removal when animation is on.
                zoomAnimation={false}
                interactive
                className="size-full"
              />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <MapPin className="size-4" aria-hidden="true" />
              Titik lembur
            </span>
            <span className="flex items-center gap-1.5">
              <LocateFixed className="size-4" aria-hidden="true" />
              {position ? "Posisi kamu sekarang" : "Posisi kamu belum tersedia"}
            </span>
            <span>Radius {formatDistance(radiusMeters)}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {position
              ? "Pin menandai titik lembur, bulatan menandai posisi GPS terakhir yang diambil."
              : "Titik lembur tetap ditampilkan. Izinkan lokasi atau tekan Ambil ulang untuk menampilkan posisimu."}
          </p>
        </div>

        {position && tooFar && (
          <Alert variant="destructive">
            <AlertDescription>
              Mendekatlah ke titik absen. Absensi di luar radius akan ditolak
              server meskipun tombol ditekan.
            </AlertDescription>
          </Alert>
        )}
        {position && inaccurate && !tooFar && (
          <Alert variant="destructive">
            <AlertDescription>
              Akurasi melebihi batas {maxAccuracyMeters} m. Coba di area
              terbuka, tunggu GPS stabil, lalu ambil titik ulang.
            </AlertDescription>
          </Alert>
        )}

        {!isCheckin && requiresDocumentation && (
          <Alert variant="warning">
            <ShieldCheck />
            <AlertDescription>
              SPKL ini mewajibkan minimal satu foto dokumentasi pekerjaan
              sebelum absen pulang.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/50 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <MapPin className="size-4 shrink-0 text-muted-foreground" />
            <p className="truncate text-xs font-medium text-muted-foreground">
              {site.address || "Titik absen SPKL"}
            </p>
            <Badge variant="outline">{radiusMeters} m</Badge>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={locate}
            disabled={locating || submitting}
          >
            {locating ? <Spinner /> : <LocateFixed />}
            Ambil ulang
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <p
          className={cn(
            "text-xs font-medium leading-relaxed text-muted-foreground",
          )}
        >
          Dengan menekan tombol absensi, kamu menyetujui penyimpanan koordinat,
          akurasi GPS, dan waktu server sebagai bukti kehadiran. Koordinat hanya
          dapat dilihat olehmu, anggota SPKL, dan atasan pembuat SPKL.
        </p>
      </div>
    </Modal>
  );
}
