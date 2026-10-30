"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  ImageIcon,
  RefreshCw,
  SwitchCamera,
  X,
} from "lucide-react";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type CameraStatus = "idle" | "starting" | "ready" | "error";
type FacingMode = "environment" | "user";

const CAMERA_CONTROL_CLASS =
  "text-white hover:bg-white/15 hover:text-white focus-visible:ring-white/60 dark:hover:bg-white/15 dark:hover:text-white";

// Ponsel yang diputar ke lanskap bisa melebar melewati 768px. Layar kamera
// tetap harus penuh di sana, sementara tablet dan desktop berpenunjuk presisi
// tetap memakai modal.
const FULLSCREEN_CAMERA_QUERY =
  "(max-width: 767px), (pointer: coarse) and (max-height: 540px)";

function useFullscreenCamera() {
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(FULLSCREEN_CAMERA_QUERY);
    const update = () => setFullscreen(query.matches);
    query.addEventListener("change", update);
    update();
    return () => query.removeEventListener("change", update);
  }, []);

  return fullscreen;
}

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
 * Di ponsel (termasuk lanskap) dialog memenuhi layar seperti aplikasi kamera;
 * di desktop dan tablet tetap berupa modal agar kontrol lain di halaman masih
 * terasa.
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
  const fullscreen = useFullscreenCamera();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const openRef = useRef(false);
  const facingRef = useRef<FacingMode>("environment");
  const lastShotUrlRef = useRef<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [shotCount, setShotCount] = useState(0);
  const [facing, setFacing] = useState<FacingMode>("environment");
  const [canSwitch, setCanSwitch] = useState(false);
  const [lastShotUrl, setLastShotUrl] = useState<string | null>(null);

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
          facingMode: { ideal: facingRef.current },
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

    // Tombol ganti kamera hanya berguna bila perangkat punya lebih dari satu
    // kamera. Enumerasi baru akurat setelah izin kamera diberikan.
    void navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        if (!openRef.current) return;
        setCanSwitch(
          devices.filter((device) => device.kind === "videoinput").length > 1,
        );
      })
      .catch(() => {
        setCanSwitch(false);
      });
  }, [stopCamera]);

  useEffect(() => {
    if (!open) {
      openRef.current = false;
      stopCamera();
      setStatus("idle");
      setError(null);
      setShotCount(0);
      setCanSwitch(false);
      facingRef.current = "environment";
      setFacing("environment");
      if (lastShotUrlRef.current) {
        URL.revokeObjectURL(lastShotUrlRef.current);
        lastShotUrlRef.current = null;
      }
      setLastShotUrl(null);
      return;
    }
    openRef.current = true;
    setShotCount(0);
    void startCamera();
    return () => {
      openRef.current = false;
      stopCamera();
    };
    // fullscreen menentukan elemen video mana yang terpasang. Saat breakpoint
    // berubah, mulai ulang kamera agar stream dipasang ke elemen yang benar.
  }, [open, fullscreen, startCamera, stopCamera]);

  useEffect(() => {
    return () => {
      if (lastShotUrlRef.current) {
        URL.revokeObjectURL(lastShotUrlRef.current);
        lastShotUrlRef.current = null;
      }
    };
  }, []);

  const rememberLastShot = useCallback((file: File) => {
    if (lastShotUrlRef.current) {
      URL.revokeObjectURL(lastShotUrlRef.current);
    }
    const url = URL.createObjectURL(file);
    lastShotUrlRef.current = url;
    setLastShotUrl(url);
  }, []);

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
      const file = new File(
        [blob],
        `kamera-${capturedAt.replace(/[:.]/g, "-")}.jpg`,
        {
          type: "image/jpeg",
        },
      );
      await onCapture(file, capturedAt);
      if (!openRef.current) return;
      rememberLastShot(file);
      setShotCount((count) => count + 1);
    } catch {
      setError("Foto gagal diambil. Coba lagi.");
    } finally {
      setCapturing(false);
    }
  }

  function flipCamera() {
    if (status !== "ready" || capturing) return;
    const next: FacingMode =
      facingRef.current === "environment" ? "user" : "environment";
    facingRef.current = next;
    setFacing(next);
    void startCamera();
  }

  function close() {
    openRef.current = false;
    stopCamera();
    onClose();
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen || capturing) return;
    close();
  }

  if (fullscreen) {
    const shutterDisabled = status !== "ready" || capturing || disabled;

    return (
      <Dialog
        open={open}
        onOpenChange={handleOpenChange}
        disablePointerDismissal
      >
        {/* Layar kamera menutup seluruh aplikasi, termasuk toast unggah. */}
        <DialogContent
          ref={dialogRef}
          showCloseButton={false}
          initialFocus={dialogRef}
          className="top-0 left-0 z-[1000000000] flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none bg-black p-0 text-white ring-0 outline-none sm:max-w-none"
        >
          <div className="flex shrink-0 items-center gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              onClick={close}
              disabled={capturing}
              aria-label="Tutup kamera"
              className={cn("-ml-1", CAMERA_CONTROL_CLASS)}
            >
              <X aria-hidden="true" />
            </Button>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <DialogTitle className="truncate text-sm text-white">
                {title}
              </DialogTitle>
              <DialogDescription className="truncate text-xs text-white/70">
                {description}
              </DialogDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={close}
              disabled={capturing}
              aria-label="Selesai dan tutup kamera"
              className={CAMERA_CONTROL_CLASS}
            >
              Selesai
            </Button>
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
            <video
              ref={videoRef}
              className="size-full object-contain"
              muted
              playsInline
              autoPlay
              aria-label="Pratinjau kamera"
            />
            {status !== "ready" && (
              <div className="absolute inset-0 grid place-items-center bg-black/70 p-6 text-center">
                {status === "starting" ? (
                  <div
                    className="flex flex-col items-center gap-2 text-sm text-white/70"
                    role="status"
                  >
                    <Spinner />
                    Menyiapkan kamera…
                  </div>
                ) : status === "error" ? (
                  <div className="flex max-w-xs flex-col items-center gap-3">
                    <CameraOff
                      className="size-8 text-white/70"
                      aria-hidden="true"
                    />
                    <p className="text-sm text-white/80" role="alert">
                      {error ?? "Kamera tidak dapat dibuka."}
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void startCamera()}
                    >
                      <RefreshCw aria-hidden="true" />
                      Coba lagi
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-sm text-white/70">
                    <Camera className="size-8" aria-hidden="true" />
                    <span>Kamera belum aktif.</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-col gap-3 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="grid grid-cols-3 items-center gap-3">
              <div className="flex justify-start">
                {lastShotUrl ? (
                  <div className="relative size-12 overflow-hidden rounded-lg ring-1 ring-white/30">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={lastShotUrl}
                      alt="Foto terakhir"
                      className="size-full object-cover"
                    />
                    {shotCount > 0 && (
                      <span className="absolute inset-x-0 bottom-0 bg-black/70 py-0.5 text-center text-xs font-medium text-white">
                        {shotCount}
                      </span>
                    )}
                  </div>
                ) : (
                  <span
                    className="grid size-12 place-items-center rounded-lg border border-white/20 text-white/50"
                    aria-hidden="true"
                  >
                    <ImageIcon className="size-4" />
                  </span>
                )}
              </div>

              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => void capture()}
                  disabled={shutterDisabled}
                  aria-label={capturing ? "Mengambil foto" : "Ambil foto"}
                  className={cn(
                    "grid size-16 place-items-center rounded-full border-4 border-white/90 bg-transparent transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:opacity-40 motion-reduce:transition-none",
                    capturing && "opacity-70",
                  )}
                >
                  <span className="size-12 rounded-full bg-white" />
                </button>
              </div>

              <div className="flex justify-end">
                {canSwitch ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-lg"
                    onClick={flipCamera}
                    disabled={status !== "ready" || capturing}
                    aria-label={
                      facing === "environment"
                        ? "Ganti ke kamera depan"
                        : "Ganti ke kamera belakang"
                    }
                    className={cn("-mr-1", CAMERA_CONTROL_CLASS)}
                  >
                    <SwitchCamera aria-hidden="true" />
                  </Button>
                ) : null}
              </div>
            </div>

            {error && status !== "error" ? (
              <p className="text-center text-xs text-white/80" role="alert">
                {error}
              </p>
            ) : disabled && disabledReason ? (
              <p className="text-center text-xs text-white/70" role="status">
                {disabledReason}
              </p>
            ) : status === "ready" ? (
              <p className="text-center text-xs text-white/60" role="status">
                {shotCount > 0
                  ? `${shotCount} foto diambil. Ambil foto lain atau tekan Selesai.`
                  : "Ambil beberapa foto sekaligus, lalu tekan Selesai."}
              </p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    );
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
