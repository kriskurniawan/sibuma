"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RefreshCw } from "lucide-react";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type CameraStatus = "idle" | "starting" | "ready" | "error";

function cameraErrorMessage(error: unknown) {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Akses kamera ditolak. Izinkan kamera di pengaturan browser, lalu coba lagi.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "Kamera tidak ditemukan. Tutup dialog lalu gunakan tombol Galeri.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "Kamera sedang dipakai aplikasi lain. Tutup aplikasi tersebut lalu coba lagi.";
  }
  if (name === "OverconstrainedError") {
    return "Kamera perangkat ini tidak mendukung mode yang diminta. Coba lagi atau gunakan Galeri.";
  }
  return "Kamera tidak dapat dibuka. Periksa izin kamera, lalu coba lagi atau gunakan Galeri.";
}

/**
 * Pratinjau kamera langsung lewat getUserMedia. Berbeda dari input file
 * `capture`, dialog ini tidak jatuh ke pemilih file di desktop: pengguna
 * melihat pratinjau dan menekan tombol ambil saat objek sudah terlihat.
 */
export function CameraCaptureDialog({
  open,
  onClose,
  onCapture,
  disabled = false,
  disabledReason,
  title = "Ambil foto",
  description = "Arahkan kamera ke objek, lalu tekan Ambil foto.",
}: {
  open: boolean;
  onClose: () => void;
  /** Dipanggil dengan file JPEG dan waktu tombol ambil ditekan. */
  onCapture: (file: File, capturedAt: string) => void | Promise<void>;
  /** Nonaktifkan tombol ambil, misalnya karena batas foto tercapai. */
  disabled?: boolean;
  disabledReason?: string;
  title?: string;
  description?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const openRef = useRef(false);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [shotCount, setShotCount] = useState(0);

  const stopCamera = useCallback(() => {
    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
    }
    const video = videoRef.current;
    if (video) video.srcObject = null;
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setError(null);
    setStatus("starting");

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      setError(
        "Kamera browser hanya tersedia di koneksi HTTPS atau localhost. Gunakan tombol Galeri untuk memilih foto.",
      );
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
    } catch (firstError) {
      // Sebagian webcam desktop menolak facingMode/ukuran ideal. Coba permintaan
      // paling sederhana sebelum menampilkan error ke pengguna.
      const name =
        firstError instanceof DOMException ? firstError.name : "";
      if (name !== "OverconstrainedError") {
        if (openRef.current) {
          setStatus("error");
          setError(cameraErrorMessage(firstError));
        }
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      } catch (retryError) {
        if (openRef.current) {
          setStatus("error");
          setError(cameraErrorMessage(retryError));
        }
        return;
      }
    }

    if (!openRef.current) {
      for (const track of stream.getTracks()) track.stop();
      return;
    }

    streamRef.current = stream;
    const video = videoRef.current;
    if (!video) {
      stopCamera();
      setStatus("error");
      setError("Pratinjau kamera tidak tersedia. Tutup lalu coba lagi.");
      return;
    }

    video.srcObject = stream;
    try {
      await video.play();
    } catch {
      if (openRef.current) {
        stopCamera();
        setStatus("error");
        setError("Kamera tidak dapat menampilkan pratinjau. Coba lagi.");
      }
      return;
    }

    if (!openRef.current) return;
    setStatus("ready");
  }, [stopCamera]);

  useEffect(() => {
    if (!open) {
      openRef.current = false;
      stopCamera();
      setStatus("idle");
      setError(null);
      setShotCount(0);
      return;
    }
    openRef.current = true;
    setShotCount(0);
    void startCamera();
    return () => {
      openRef.current = false;
      stopCamera();
    };
  }, [open, startCamera, stopCamera]);

  async function capture() {
    const video = videoRef.current;
    if (!video || status !== "ready" || capturing || disabled) return;
    if (!video.videoWidth || !video.videoHeight) {
      setError("Kamera belum siap. Tunggu sebentar lalu coba lagi.");
      return;
    }

    setCapturing(true);
    setError(null);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas tidak tersedia.");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.92),
      );
      if (!blob) throw new Error("Foto gagal dibuat.");
      const capturedAt = new Date().toISOString();
      const file = new File([blob], `kamera-${Date.now()}.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now(),
      });
      await onCapture(file, capturedAt);
      setShotCount((count) => count + 1);
    } catch {
      setError("Foto gagal diambil. Coba lagi.");
    } finally {
      setCapturing(false);
    }
  }

  function close() {
    openRef.current = false;
    stopCamera();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      description={description}
      size="md"
      dismissible={!capturing}
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={close}
            disabled={capturing}
            className="sm:flex-1"
          >
            Tutup
          </Button>
          {status === "error" ? (
            <Button
              type="button"
              onClick={() => void startCamera()}
              className="sm:flex-1"
            >
              <RefreshCw aria-hidden="true" />
              Coba lagi
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => void capture()}
              disabled={status !== "ready" || capturing || disabled}
              className="sm:flex-1"
            >
              {capturing ? <Spinner /> : <Camera aria-hidden="true" />}
              {capturing ? "Mengambil…" : "Ambil foto"}
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
          <video
            ref={videoRef}
            className="size-full object-contain"
            muted
            playsInline
            autoPlay
            aria-label="Pratinjau kamera"
          />
          {status !== "ready" && (
            <div className="absolute inset-0 grid place-items-center bg-background/80 p-6 text-center">
              {status === "starting" ? (
                <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                  <Spinner />
                  Menyiapkan kamera…
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                  <Camera className="size-8" aria-hidden="true" />
                  <span>Kamera belum aktif.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        )}

        {disabled && disabledReason && (
          <p className="text-xs text-muted-foreground" role="status">
            {disabledReason}
          </p>
        )}

        {shotCount > 0 && !disabled && (
          <p className="text-xs text-muted-foreground" role="status">
            {shotCount} foto diambil. Kamera tetap aktif; ambil foto berikutnya
            atau tutup dialog.
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          Foto kamera memakai waktu tombol Ambil ditekan. Jika kamera tidak
          tersedia, tutup dialog lalu gunakan tombol Galeri.
        </p>
      </div>
    </Modal>
  );
}
