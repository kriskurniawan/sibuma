"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock3,
  Eye,
  Hammer,
  ListChecks,
  MapPin,
  Pencil,
  Play,
  RotateCcw,
  UsersRound,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/modal";
import {
  ManualWorkOverdueBadge,
  ManualWorkSelfReportedBadge,
  ManualWorkStatusBadge,
} from "@/components/pekerjaan/manual-work-badges";
import { ManualWorkPhotoGallery } from "@/components/pekerjaan/manual-work-photo-gallery";
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import {
  Avatar,
  DataRow,
  InfoBanner,
  PageHeader,
} from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  MANUAL_WORK_EVENT_LABEL,
  type ManualWorkDetail,
} from "@/lib/manual-work-types";
import { formatDateHuman, formatDateTime } from "@/lib/time";

function dateIso(value: string) {
  return `${value}T00:00:00+07:00`;
}

export function ManualWorkDetailView({
  detail,
  photoLimit,
  videoLimit,
  videoMaxBytes,
  videoEnabled,
}: {
  detail: ManualWorkDetail;
  photoLimit: number;
  videoLimit: number;
  videoMaxBytes: number;
  videoEnabled: boolean;
}) {
  const router = useRouter();
  const work = detail.work;
  const [completeOpen, setCompleteOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [resultNote, setResultNote] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const photoCount = detail.photos.filter(
    (photo) => photo.kind !== "video",
  ).length;
  const videoCount = detail.photos.filter(
    (photo) => photo.kind === "video",
  ).length;

  const completionReady =
    !work.requiresDocumentation || photoCount >= 1 || !detail.canComplete;

  async function runAction(
    action: "mulai" | "selesai" | "batal" | "buka_kembali",
    payload: Record<string, unknown> = {},
  ) {
    setBusy(action);
    try {
      const response = await fetch(`/api/pekerjaan/${work.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok) {
        toast.error(data.message ?? "Gagal memperbarui status pekerjaan.");
        return false;
      }
      toast.success(data.message ?? "Status pekerjaan diperbarui.");
      setCompleteOpen(false);
      setCancelOpen(false);
      setReopenOpen(false);
      setResultNote("");
      setReason("");
      router.refresh();
      return true;
    } catch {
      toast.error("Gagal memperbarui status. Periksa koneksi lalu coba lagi.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function start() {
    await runAction("mulai");
  }

  return (
    <div className="flex flex-col gap-5 pb-8">
      <PageHeader
        eyebrow="Pekerjaan harian"
        title={work.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <ManualWorkStatusBadge status={work.status} />
            {detail.overdue && <ManualWorkOverdueBadge />}
            {detail.selfReported && <ManualWorkSelfReportedBadge />}
            {work.locationName && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden="true" />
                {work.locationName}
              </span>
            )}
          </span>
        }
        action={
          detail.canEdit ? (
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href={`/pekerjaan/${work.id}/ubah`} />}
            >
              <Pencil aria-hidden="true" />
              Ubah
            </Button>
          ) : undefined
        }
      />

      {detail.readOnly && (
        <InfoBanner tone="info" icon={Eye}>
          Hanya lihat. Perubahan dilakukan oleh pemilik pekerjaan, pelapor, atau
          pekerja yang ditugaskan.
        </InfoBanner>
      )}

      {work.status === "selesai" && (
        <InfoBanner tone="success" icon={CheckCircle2}>
          Selesai
          {detail.completedByName ? ` oleh ${detail.completedByName}` : ""}
          {work.completedAt
            ? ` pada ${formatDateTime(work.completedAt, "d MMM yyyy, HH:mm")}`
            : ""}
          . Dokumentasi terkunci.
        </InfoBanner>
      )}

      {work.status === "dibatalkan" && (
        <InfoBanner tone="warning" icon={XCircle}>
          Pekerjaan dibatalkan.
          {work.cancelReason ? ` Alasan: ${work.cancelReason}` : ""}
        </InfoBanner>
      )}

      {detail.sourceFollowUp && (
        <InfoBanner tone="info" icon={ListChecks}>
          Menindaklanjuti temuan checklist:{" "}
          <Link
            href={`/checklist/${detail.sourceFollowUp.inspectionId}`}
            className="font-medium text-primary transition-colors hover:underline"
          >
            {detail.sourceFollowUp.title}
          </Link>
        </InfoBanner>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Frame>
            <FrameHeader>
              <FrameTitle>Rincian pekerjaan</FrameTitle>
              <FrameDescription>
                Rincian pekerjaan dan dokumentasi.
              </FrameDescription>
            </FrameHeader>
            <FramePanel className="flex flex-col gap-4">
              <p className="text-sm leading-relaxed whitespace-pre-line text-foreground">
                {work.description}
              </p>
              <div className="flex flex-col">
                <DataRow
                  label="Lokasi"
                  value={work.locationName || "Tidak disebutkan"}
                />
                {work.safetyName && (
                  <DataRow
                    label="Petugas safety"
                    value={work.safetyName}
                  />
                )}
                <DataRow
                  label="Mulai"
                  value={formatDateHuman(
                    dateIso(work.startDate),
                    "d MMMM yyyy",
                  )}
                />
                <DataRow
                  label="Target selesai"
                  value={
                    work.targetDate
                      ? formatDateHuman(dateIso(work.targetDate), "d MMMM yyyy")
                      : "Tanpa target"
                  }
                />
                <DataRow
                  label="Dokumentasi"
                  value={
                    work.requiresDocumentation
                      ? `Wajib, minimal 1 dari ${photoLimit} foto`
                      : "Opsional"
                  }
                />
                {work.resultNote && (
                  <DataRow
                    label="Catatan hasil"
                    value={
                      <span className="whitespace-pre-line">
                        {work.resultNote}
                      </span>
                    }
                  />
                )}
              </div>
            </FramePanel>
          </Frame>

          <Frame>
            <FrameHeader className="flex-row items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <FrameTitle>Dokumentasi</FrameTitle>
                <FrameDescription>
                  Bukti foto dan video privat. Hanya pemilik pekerjaan, pelapor,
                  dan pekerja yang ditugaskan dapat mengakses.
                </FrameDescription>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground tabular-nums">
                <Camera className="size-3.5" aria-hidden="true" />
                {photoCount}/{photoLimit} foto
                {videoEnabled && videoLimit > 0
                  ? ` · ${videoCount}/${videoLimit} video`
                  : ""}
              </span>
            </FrameHeader>
            <FramePanel className="flex flex-col gap-3">
              {!work.requiresDocumentation && detail.photos.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Dokumentasi tidak diwajibkan, tetapi tetap dapat ditambahkan.
                </p>
              )}
              <ManualWorkPhotoGallery
                photos={detail.photos}
                workId={work.id}
                workTitle={work.title}
                canUpload={detail.canUpload}
                canDelete={detail.canUpload}
                maxPhotos={photoLimit}
                maxVideos={videoLimit}
                videoMaxBytes={videoMaxBytes}
                videoEnabled={videoEnabled}
                onChanged={() => router.refresh()}
                onUploadingChange={setUploading}
              />
              {!detail.canUpload && work.status === "selesai" && (
                <p className="text-xs text-muted-foreground">
                  Pekerjaan sudah selesai. Minta pemilik pekerjaan membuka
                  kembali untuk mengubah dokumentasi.
                </p>
              )}
            </FramePanel>
          </Frame>

          <Frame>
            <FrameHeader>
              <FrameTitle>Riwayat</FrameTitle>
              <FrameDescription>
                Jejak perubahan status dan catatan pekerjaan.
              </FrameDescription>
            </FrameHeader>
            <FramePanel>
              {detail.events.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Belum ada riwayat.
                </p>
              ) : (
                <ol className="flex flex-col">
                  {detail.events.map((event, index) => (
                    <li
                      key={event.id}
                      className="relative flex gap-3 pb-4 last:pb-0"
                    >
                      <span className="flex flex-col items-center">
                        <span
                          className="mt-1 size-2 shrink-0 rounded-full bg-primary ring-4 ring-card"
                          aria-hidden="true"
                        />
                        {index < detail.events.length - 1 && (
                          <span
                            className="mt-1 w-px flex-1 bg-border"
                            aria-hidden="true"
                          />
                        )}
                      </span>
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <p className="text-sm font-medium text-foreground">
                          {MANUAL_WORK_EVENT_LABEL[event.action] ?? event.action}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {event.actorName} ·{" "}
                          {formatDateTime(
                            event.createdAt,
                            "d MMM yyyy, HH:mm",
                          )}
                        </p>
                        {event.note && (
                          <p className="text-xs leading-relaxed whitespace-pre-line text-muted-foreground">
                            {event.note}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </FramePanel>
          </Frame>
        </div>

        <aside className="flex min-w-0 flex-col gap-5 xl:sticky xl:top-20 xl:self-start">
          <Frame spacing="sm">
            <FrameHeader>
              <FrameTitle>Status & tindakan</FrameTitle>
              <FrameDescription>
                {work.status === "terbuka"
                  ? "Pekerjaan belum dimulai."
                  : work.status === "dikerjakan"
                    ? "Pekerjaan sedang dikerjakan."
                    : work.status === "selesai"
                      ? "Pekerjaan sudah selesai."
                      : "Pekerjaan dibatalkan."}
              </FrameDescription>
            </FrameHeader>
            <FramePanel className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <ManualWorkStatusBadge status={work.status} />
                {detail.overdue && <ManualWorkOverdueBadge />}
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock3 className="size-3.5" aria-hidden="true" />
                  {formatDateHuman(dateIso(work.startDate), "d MMM")}
                  {work.targetDate
                    ? ` – ${formatDateHuman(dateIso(work.targetDate), "d MMM")}`
                    : ""}
                </span>
              </div>

              {detail.canStart && (
                <Button
                  type="button"
                  className="w-full"
                  onClick={start}
                  disabled={busy !== null}
                >
                  {busy === "mulai" ? (
                    <Spinner />
                  ) : (
                    <Play aria-hidden="true" />
                  )}
                  Mulai pekerjaan
                </Button>
              )}

              {detail.canComplete && (
                <>
                  <Button
                    type="button"
                    className="w-full"
                    onClick={() => setCompleteOpen(true)}
                    disabled={busy !== null || uploading}
                  >
                    <CheckCircle2 aria-hidden="true" />
                    Selesaikan
                  </Button>
                  {work.requiresDocumentation && photoCount === 0 && (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Unggah minimal satu foto dokumentasi sebelum menyelesaikan.
                    </p>
                  )}
                </>
              )}

              {detail.canCancel && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setCancelOpen(true)}
                  disabled={busy !== null}
                >
                  <XCircle aria-hidden="true" />
                  Batalkan pekerjaan
                </Button>
              )}

              {detail.canReopen && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setReopenOpen(true)}
                  disabled={busy !== null}
                >
                  <RotateCcw aria-hidden="true" />
                  Buka kembali
                </Button>
              )}

              {!detail.canStart &&
                !detail.canComplete &&
                !detail.canCancel &&
                !detail.canReopen &&
                !detail.canEdit && (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {detail.readOnly
                      ? "Akun hanya-lihat tidak dapat mengubah pekerjaan."
                      : "Tidak ada tindakan yang tersedia untuk status ini."}
                  </p>
                )}

              {detail.canEdit && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  nativeButton={false}
                  render={<Link href={`/pekerjaan/${work.id}/ubah`} />}
                >
                  <Pencil aria-hidden="true" />
                  Ubah rincian
                </Button>
              )}
            </FramePanel>
          </Frame>

          <Frame spacing="sm">
            <FrameHeader className="flex-row items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <FrameTitle>Pekerja</FrameTitle>
                <FrameDescription>
                  {detail.assignees.length} pekerja ditugaskan
                </FrameDescription>
              </div>
              <UsersRound
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            </FrameHeader>
            <FramePanel className="flex flex-col gap-2">
              {detail.assignees.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Belum ada pekerja.
                </p>
              ) : (
                detail.assignees.map((person) => (
                  <div key={person.id} className="flex min-w-0 items-center gap-2">
                    <Avatar name={person.name} seed={person.id} size="sm" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium text-foreground">
                        {person.name}
                      </span>
                      <span className="truncate text-xs text-muted-foreground tabular-nums">
                        {person.nik}
                      </span>
                    </span>
                  </div>
                ))
              )}
            </FramePanel>
          </Frame>

          <Frame spacing="sm">
            <FrameHeader>
              <FrameTitle>Informasi</FrameTitle>
            </FrameHeader>
            <FramePanel className="flex flex-col">
              <DataRow
                label={detail.selfReported ? "Dilaporkan oleh" : "Dibuat oleh"}
                value={detail.createdByName}
              />
              {detail.selfReported && (
                <DataRow label="Penanggung jawab" value={detail.ownerName} />
              )}
              <DataRow
                label="Dibuat"
                value={formatDateTime(work.createdAt, "d MMM yyyy, HH:mm")}
              />
              {work.startedAt && (
                <DataRow
                  label="Dimulai"
                  value={formatDateTime(work.startedAt, "d MMM yyyy, HH:mm")}
                />
              )}
              {work.completedAt && (
                <DataRow
                  label="Selesai"
                  value={formatDateTime(work.completedAt, "d MMM yyyy, HH:mm")}
                />
              )}
              {work.reopenedAt && (
                <DataRow
                  label="Dibuka kembali"
                  value={formatDateTime(work.reopenedAt, "d MMM yyyy, HH:mm")}
                />
              )}
            </FramePanel>
          </Frame>

          {work.reopenReason && (
            <Frame spacing="sm">
              <FrameHeader>
                <FrameTitle>Alasan dibuka kembali</FrameTitle>
              </FrameHeader>
              <FramePanel>
                <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                  {work.reopenReason}
                </p>
              </FramePanel>
            </Frame>
          )}
        </aside>
      </div>

      <Modal
        open={completeOpen}
        onClose={() => setCompleteOpen(false)}
        dismissible={busy === null}
        title="Selesaikan pekerjaan?"
        description="Setelah selesai, rincian dan dokumentasi tidak dapat diubah sampai pemilik pekerjaan membuka kembali."
        size="md"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCompleteOpen(false)}
              disabled={busy !== null}
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => runAction("selesai", { resultNote })}
              disabled={busy !== null || !completionReady}
            >
              {busy === "selesai" ? (
                <Spinner />
              ) : (
                <CheckCircle2 aria-hidden="true" />
              )}
              Selesaikan
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {!completionReady && (
            <InfoBanner tone="warning" icon={Camera}>
              Unggah minimal satu foto dokumentasi terlebih dahulu.
            </InfoBanner>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="manual-work-result">Catatan hasil (opsional)</Label>
            <Textarea
              id="manual-work-result"
              value={resultNote}
              onChange={(event) => setResultNote(event.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Hasil pekerjaan, kendala, atau catatan lain…"
            />
            <span className="ml-auto text-xs text-muted-foreground">
              {resultNote.length}/2.000
            </span>
          </div>
        </div>
      </Modal>

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        dismissible={busy === null}
        title="Batalkan pekerjaan?"
        description="Pekerjaan yang dibatalkan tidak dapat dilanjutkan. Tuliskan alasan yang jelas."
        size="md"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCancelOpen(false)}
              disabled={busy !== null}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => runAction("batal", { reason })}
              disabled={busy !== null || reason.trim().length < 10}
            >
              {busy === "batal" ? <Spinner /> : <XCircle aria-hidden="true" />}
              Batalkan pekerjaan
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="manual-work-cancel-reason">
            Alasan pembatalan <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="manual-work-cancel-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            maxLength={500}
            placeholder="Contoh: Pekerjaan digabung ke SPKL lain…"
          />
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Minimal 10 karakter.
            </p>
            <span className="ml-auto shrink-0 text-xs text-muted-foreground">
              {reason.length}/500
            </span>
          </div>
        </div>
      </Modal>

      <Modal
        open={reopenOpen}
        onClose={() => setReopenOpen(false)}
        dismissible={busy === null}
        title="Buka kembali pekerjaan?"
        description="Pekerjaan akan kembali dikerjakan dan dokumentasi dapat diubah."
        size="md"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setReopenOpen(false)}
              disabled={busy !== null}
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => runAction("buka_kembali", { reason })}
              disabled={busy !== null || reason.trim().length < 10}
            >
              {busy === "buka_kembali" ? (
                <Spinner />
              ) : (
                <RotateCcw aria-hidden="true" />
              )}
              Buka kembali
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="manual-work-reopen-reason">
            Alasan membuka kembali <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="manual-work-reopen-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            maxLength={500}
            placeholder="Contoh: Foto belum menunjukkan hasil akhir…"
          />
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Minimal 10 karakter.
            </p>
            <span className="ml-auto shrink-0 text-xs text-muted-foreground">
              {reason.length}/500
            </span>
          </div>
        </div>
      </Modal>
    </div>
  );
}
