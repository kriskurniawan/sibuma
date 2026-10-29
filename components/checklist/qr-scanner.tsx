"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, ComponentProps, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ImageUp, QrCode, RefreshCw } from "lucide-react";
import { Modal } from "@/components/modal";
import { InfoBanner } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type ScannerStatus = "idle" | "starting" | "scanning" | "error";

interface DetectedBarcode {
  rawValue: string;
}

interface BarcodeDetectorInstance {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}

type BarcodeDetectorConstructor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorInstance;

const MAX_QR_LENGTH = 2048;

/**
 * QR area selalu menuju halaman publik /p/... . Batasi ke origin aplikasi dan
 * awalan tersebut agar QR dari luar tidak bisa dipakai sebagai open redirect.
 */
function toAppPath(raw: string) {
  const value = raw.trim();
  if (!value || value.length > MAX_QR_LENGTH) return null;

  let url: URL;
  try {
    url = new URL(value, window.location.origin);
  } catch {
    return null;
  }
  if (url.origin !== window.location.origin) return null;
  if (!url.pathname.startsWith("/p/")) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

function createDetector(): BarcodeDetectorInstance | null {
  const Detector = (
    window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }
  ).BarcodeDetector;
  if (!Detector) return null;
  try {
    return new Detector({ formats: ["qr_code"] });
  } catch {
    return null;
  }
}

function cameraErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return "Izin kamera ditolak. Izinkan kamera di pengaturan browser, lalu coba lagi.";
    }
    if (error.name === "NotFoundError" || error.name === "OverconstrainedError") {
      return "Kamera tidak ditemukan. Pilih foto QR sebagai gantinya.";
    }
    if (error.name === "NotReadableError") {
      return "Kamera sedang dipakai aplikasi lain. Tutup aplikasi tersebut lalu coba lagi.";
    }
  }
  return "Kamera tidak dapat dibuka. Coba lagi atau pilih foto QR.";
}

export function QrScanButton({
  variant = "outline",
  size = "sm",
  className,
  label = "Scan QR",
  trigger,
}: {
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
  className?: string;
  label?: string;
  /** Ganti tampilan pemicu, mis. tombol tengah di bottom nav. */
  trigger?: (openScanner: () => void) => ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ScannerStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null);
  const detectorCheckedRef = useRef(false);
  const jsQrRef = useRef<typeof import("jsqr").default | null>(null);
  const openRef = useRef(false);
  const busyRef = useRef(false);

  const getDetector = useCallback(() => {
    if (!detectorCheckedRef.current) {
      detectorCheckedRef.current = true;
      detectorRef.current = createDetector();
    }
    return detectorRef.current;
  }, []);

  const stopCamera = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    busyRef.current = false;
    const stream = streamRef.current;
    streamRef.current = null;
    stream?.getTracks().forEach((track) => track.stop());
    const video = videoRef.current;
    if (video) video.srcObject = null;
  }, []);

  const decodeCanvas = useCallback(
    async (source: CanvasImageSource, width: number, height: number) => {
      if (!width || !height) return null;
      const targetWidth = Math.min(720, width);
      const scale = targetWidth / width;
      const canvas = canvasRef.current ?? document.createElement("canvas");
      canvasRef.current = canvas;
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return null;
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      const jsQr =
        jsQrRef.current ?? (await import("jsqr")).default;
      jsQrRef.current = jsQr;
      return (
        jsQr(image.data, image.width, image.height, {
          inversionAttempts: "dontInvert",
        })?.data ?? null
      );
    },
    [],
  );

  const fail = useCallback(
    (message: string) => {
      stopCamera();
      setStatus("error");
      setError(message);
    },
    [stopCamera],
  );

  const handleValue = useCallback(
    (raw: string) => {
      const target = toAppPath(raw);
      if (!target) {
        fail(
          "QR ini bukan QR area SIBUMA. Gunakan QR yang terpasang di area gedung.",
        );
        return;
      }
      stopCamera();
      openRef.current = false;
      setOpen(false);
      setStatus("idle");
      setError(null);
      router.push(target);
    },
    [fail, router, stopCamera],
  );

  const scanFrame = useCallback(async () => {
    if (!openRef.current) return;
    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      timerRef.current = window.setTimeout(scanFrame, 220);
      return;
    }
    if (busyRef.current) {
      timerRef.current = window.setTimeout(scanFrame, 220);
      return;
    }

    busyRef.current = true;
    try {
      let value: string | null = null;
      const detector = getDetector();
      if (detector) {
        try {
          const results = await detector.detect(video);
          value = results.find((item) => item.rawValue)?.rawValue ?? null;
        } catch {
          detectorRef.current = null;
        }
      }
      if (!value) {
        value = await decodeCanvas(video, video.videoWidth, video.videoHeight);
      }
      if (value) {
        handleValue(value);
        return;
      }
    } finally {
      busyRef.current = false;
      if (openRef.current) {
        timerRef.current = window.setTimeout(scanFrame, 220);
      }
    }
  }, [decodeCanvas, getDetector, handleValue]);

  const startCamera = useCallback(async () => {
    stopCamera();
    setError(null);
    setStatus("starting");

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      fail(
        "Kamera memerlukan koneksi aman (HTTPS). Pilih foto QR sebagai gantinya.",
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      if (!openRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        fail("Kamera tidak dapat dibuka. Coba lagi.");
        return;
      }
      video.srcObject = stream;
      await video.play();
      if (!openRef.current) return;
      setStatus("scanning");
      void scanFrame();
    } catch (cameraError) {
      if (openRef.current) fail(cameraErrorMessage(cameraError));
    }
  }, [fail, scanFrame, stopCamera]);

  const handleFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;

      stopCamera();
      setError(null);
      setStatus("starting");

      try {
        const bitmap = await createImageBitmap(file);
        let value: string | null = null;
        const detector = getDetector();
        if (detector) {
          try {
            const results = await detector.detect(bitmap);
            value = results.find((item) => item.rawValue)?.rawValue ?? null;
          } catch {
            detectorRef.current = null;
          }
        }
        if (!value) {
          value = await decodeCanvas(bitmap, bitmap.width, bitmap.height);
        }
        bitmap.close();

        if (!value) {
          fail(
            "QR tidak terbaca. Pastikan seluruh QR terlihat, tidak blur, lalu coba lagi.",
          );
          return;
        }
        if (!openRef.current) return;
        handleValue(value);
      } catch {
        fail("Foto tidak dapat dibaca. Pilih foto QR lain.");
      }
    },
    [decodeCanvas, fail, getDetector, handleValue, stopCamera],
  );

  useEffect(() => {
    if (!open) {
      openRef.current = false;
      stopCamera();
      return;
    }
    openRef.current = true;
    void startCamera();
    return () => {
      openRef.current = false;
      stopCamera();
    };
  }, [open, startCamera, stopCamera]);

  const openScanner = () => {
    setError(null);
    setStatus("idle");
    setOpen(true);
  };

  const closeScanner = () => {
    openRef.current = false;
    stopCamera();
    setOpen(false);
    setStatus("idle");
    setError(null);
  };

  return (
    <>
      {trigger ? (
        trigger(openScanner)
      ) : (
        <Button
          type="button"
          variant={variant}
          size={size}
          className={className}
          onClick={openScanner}
        >
          <QrCode aria-hidden="true" />
          {label}
        </Button>
      )}

      <Modal
        open={open}
        onClose={closeScanner}
        title="Scan QR area"
        description="Arahkan kamera ke QR area. Halaman checklist akan terbuka langsung di aplikasi."
        size="sm"
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={closeScanner}
              className="sm:flex-1"
            >
              Tutup
            </Button>
            {status === "error" && (
              <Button
                type="button"
                onClick={() => void startCamera()}
                className="sm:flex-1"
              >
                <RefreshCw aria-hidden="true" />
                Coba lagi
              </Button>
            )}
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
            <video
              ref={videoRef}
              className="size-full object-cover"
              muted
              playsInline
              aria-label="Pratinjau kamera untuk scan QR"
            />
            {status !== "scanning" && (
              <div className="absolute inset-0 grid place-items-center bg-background/75 p-6 text-center">
                {status === "starting" ? (
                  <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                    <Spinner />
                    Menyiapkan kamera.
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                    <QrCode className="size-8" aria-hidden="true" />
                    Kamera belum aktif.
                  </div>
                )}
              </div>
            )}
            {status === "scanning" && (
              <div
                className="pointer-events-none absolute inset-8 rounded-lg border-2 border-primary/80"
                aria-hidden="true"
              />
            )}
          </div>

          <p className="sr-only" role="status" aria-live="polite">
            {status === "scanning"
              ? "Kamera aktif. Arahkan kamera ke QR area."
              : status === "starting"
                ? "Menyiapkan kamera."
                : status === "error"
                  ? "Kamera tidak aktif. Baca pesan kesalahan atau coba lagi."
                  : "Kamera belum aktif."}
          </p>

          {error && <InfoBanner tone="warning">{error}</InfoBanner>}

          <p className="text-xs leading-relaxed text-muted-foreground">
            Kamera hanya membaca QR area SIBUMA. Tidak perlu membuka tautan di
            browser.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleFile}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="w-full"
          >
            <ImageUp aria-hidden="true" />
            Pilih foto QR
          </Button>
        </div>
      </Modal>
    </>
  );
}
