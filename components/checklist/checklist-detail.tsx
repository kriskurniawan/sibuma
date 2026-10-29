"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Eye,
  FolderTree,
  ListChecks,
  MapPin,
  RotateCcw,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { Alert, AlertDescription } from "@/components/reui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Avatar,
  Badge,
  EmptyState,
  InfoBanner,
  PageHeader,
  ProgressBar,
} from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/modal";
import { AnswerCard, type AnswerDraftState } from "@/components/checklist/answer-card";
import {
  ChecklistFollowUpBadge,
  ChecklistOverdueBadge,
  ChecklistPriorityBadge,
  ChecklistStatusBadge,
} from "@/components/checklist/checklist-badges";
import { ChecklistFollowUpDialog } from "@/components/checklist/follow-up-dialog";
import { ChecklistFollowUpUpdateDialog } from "@/components/checklist/follow-up-update-dialog";
import { ChecklistPhotoGallery } from "@/components/checklist/photo-gallery";
import { checklistIntervalLabel } from "@/lib/checklist-schedule";
import {
  conditionRequiresNote,
  isIssueCondition,
  type ChecklistAnswer,
  type ChecklistConditionOption,
  type ChecklistFollowUpRow,
  type ChecklistInspectionDetail,
} from "@/lib/checklist-types";
import { formatDateHuman, formatDateTime } from "@/lib/time";

function occurrenceIso(date: string) {
  return `${date}T00:00:00+07:00`;
}

function dueIso(date: string) {
  return `${date}T23:59:59+07:00`;
}

const ASSIGNEE_CHIP_LIMIT = 8;

interface MissingRequirement {
  answerId: string;
  prompt: string;
  reason: string;
}

export function ChecklistDetail({
  detail,
  currentUserId,
  conditions,
}: {
  detail: ChecklistInspectionDetail;
  currentUserId: string;
  conditions: ChecklistConditionOption[];
}) {
  const router = useRouter();
  const { inspection } = detail;
  const [completeOpen, setCompleteOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [completing, setCompleting] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [followUpAnswer, setFollowUpAnswer] = useState<ChecklistAnswer | null>(
    null,
  );
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [updateRow, setUpdateRow] = useState<ChecklistFollowUpRow | null>(null);

  const [draftStates, setDraftStates] = useState<
    Record<string, AnswerDraftState>
  >({});
  const [uploadingKeys, setUploadingKeys] = useState<Record<string, true>>({});

  const answered = detail.answers.filter((entry) => {
    const draft = draftStates[entry.answer.id];
    const condition = draft ? draft.condition : entry.answer.condition;
    return condition !== null;
  }).length;
  const total = detail.answers.length;
  const overdue = detail.overdue;
  const closed = ["selesai", "dilewati"].includes(inspection.status);
  const canUpdateFollowUps =
    !detail.readOnly &&
    (detail.canManage ||
      detail.assignees.some((person) => person.id === currentUserId));
  const canUpdateFollowUp = (row: ChecklistFollowUpRow) =>
    canUpdateFollowUps ||
    (!detail.readOnly && row.followUp.picId === currentUserId);
  const canEditFollowUp = (row: ChecklistFollowUpRow) =>
    canUpdateFollowUp(row) &&
    !["selesai", "dibatalkan"].includes(row.followUp.status);

  const handleDraftChange = useCallback(
    (answerId: string, state: AnswerDraftState) => {
      setDraftStates((current) => {
        if (!state.dirty) {
          if (!(answerId in current)) return current;
          const next = { ...current };
          delete next[answerId];
          return next;
        }
        const previous = current[answerId];
        if (
          previous &&
          previous.condition === state.condition &&
          previous.note === state.note
        ) {
          return current;
        }
        return { ...current, [answerId]: state };
      });
    },
    [],
  );

  const handleUploadingChange = useCallback(
    (key: string, uploading: boolean) => {
      setUploadingKeys((current) => {
        if (uploading) {
          return current[key] ? current : { ...current, [key]: true };
        }
        if (!current[key]) return current;
        const next = { ...current };
        delete next[key];
        return next;
      });
    },
    [],
  );

  // Mirror the server completion rules against local (unsaved) values so a
  // finalization never locks a checklist that ignores the last edits.
  const missingRequirements: MissingRequirement[] = [];
  for (const entry of detail.answers) {
    const persisted = entry.answer;
    const draft = draftStates[persisted.id];
    const condition = draft ? draft.condition : persisted.condition;
    const note = (draft ? draft.note : persisted.note).trim();
    let reason: string | null = null;
    if (persisted.required && condition === null) {
      reason = "wajib diisi";
    } else if (conditionRequiresNote(condition, conditions) && note.length < 3) {
      reason = "catatan status wajib diisi";
    } else if (
      isIssueCondition(condition, conditions) &&
      persisted.requireNoteOnIssue &&
      note.length < 3
    ) {
      reason = "catatan temuan wajib diisi";
    } else if (
      (persisted.photoPolicy === "wajib" ||
        (persisted.photoPolicy === "wajib_saat_masalah" &&
          isIssueCondition(condition, conditions))) &&
      entry.photos.length === 0
    ) {
      reason = "foto wajib dilampirkan";
    }
    if (reason) {
      missingRequirements.push({
        answerId: persisted.id,
        prompt: persisted.prompt,
        reason,
      });
    }
  }
  const unsavedCount = Object.keys(draftStates).length;
  const uploadingCount = Object.keys(uploadingKeys).length;
  const completionReady =
    missingRequirements.length === 0 &&
    unsavedCount === 0 &&
    uploadingCount === 0;
  const completionBlocker =
    unsavedCount > 0
      ? `Simpan dulu ${unsavedCount} item yang belum tersimpan.`
      : uploadingCount > 0
        ? "Tunggu unggahan foto selesai."
        : missingRequirements.length > 0
          ? `${missingRequirements.length} item belum lengkap.`
          : null;

  const jumpToRequirement = useCallback((answerId: string) => {
    const node = document.getElementById(`checklist-item-${answerId}`);
    if (!node) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    node.scrollIntoView({
      block: "center",
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, []);

  const picOptions = [
    ...(detail.ownerName && !detail.ownerReadOnly
      ? [{ id: inspection.ownerId, name: detail.ownerName }]
      : []),
    ...detail.team,
  ];

  function openCreateFollowUp(answer: ChecklistAnswer) {
    if (!canUpdateFollowUps) return;
    const existing = detail.followUps.find(
      (row) =>
        row.followUp.answerId === answer.id &&
        row.followUp.status !== "dibatalkan",
    );
    if (existing) {
      setUpdateRow(existing);
      return;
    }
    setFollowUpAnswer(answer);
    setFollowUpOpen(true);
  }

  async function complete() {
    if (!completionReady) {
      toast.error(
        completionBlocker ?? "Lengkapi checklist sebelum menyelesaikan.",
      );
      return;
    }
    setCompleting(true);
    try {
      const response = await fetch(
        `/api/checklist/inspections/${inspection.id}/complete`,
        { method: "POST" },
      );
      const data = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };
      if (!response.ok) {
        toast.error(data.message ?? "Gagal menyelesaikan checklist.");
        return;
      }
      toast.success("Checklist selesai.");
      setCompleteOpen(false);
      router.refresh();
    } catch {
      toast.error("Gagal menyelesaikan checklist. Coba lagi.");
    } finally {
      setCompleting(false);
    }
  }

  async function reopen() {
    if (reopenReason.trim().length < 10) {
      toast.error("Alasan membuka kembali minimal 10 karakter.");
      return;
    }
    setReopening(true);
    try {
      const response = await fetch(
        `/api/checklist/inspections/${inspection.id}/reopen`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reopenReason.trim() }),
        },
      );
      const data = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };
      if (!response.ok) {
        toast.error(data.message ?? "Gagal membuka kembali checklist.");
        return;
      }
      toast.success("Checklist dibuka kembali.");
      setReopenOpen(false);
      setReopenReason("");
      router.refresh();
    } catch {
      toast.error("Gagal membuka kembali checklist. Coba lagi.");
    } finally {
      setReopening(false);
    }
  }

  const unansweredRequired = detail.answers.filter((entry) => {
    if (!entry.answer.required) return false;
    const draft = draftStates[entry.answer.id];
    const condition = draft ? draft.condition : entry.answer.condition;
    return condition === null;
  }).length;

  const answerNumber = new Map<string, number>();
  const answerBlocks: Array<{
    groupPath: string;
    entries: ChecklistInspectionDetail["answers"];
  }> = [];
  detail.answers.forEach((entry, index) => {
    answerNumber.set(entry.answer.id, index + 1);
    const groupPath = entry.answer.groupPath?.trim() ?? "";
    const last = answerBlocks.at(-1);
    if (last && last.groupPath === groupPath) {
      last.entries.push(entry);
    } else {
      answerBlocks.push({ groupPath, entries: [entry] });
    }
  });

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <div>
        <Button
          size="sm"
          variant="ghost"
          nativeButton={false}
          render={<Link href="/checklist" />}
        >
          <ArrowLeft aria-hidden="true" />
          Checklist
        </Button>
      </div>

      <PageHeader
        eyebrow={`${inspection.category} · ${inspection.periodLabel}`}
        title={inspection.templateName}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden="true" />
              {inspection.locationName}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="size-3.5" aria-hidden="true" />
              {formatDateHuman(
                occurrenceIso(inspection.occurrenceDate),
                "d MMMM yyyy",
              )}
            </span>
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Clock3 className="size-3.5" aria-hidden="true" />
              Tenggat {formatDateTime(inspection.dueAt, "d MMM, HH:mm")}
            </span>
          </span>
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ChecklistStatusBadge status={inspection.status} />
            {overdue && <ChecklistOverdueBadge />}
            {detail.canReopen && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setReopenOpen(true)}
              >
                <RotateCcw aria-hidden="true" />
                Buka kembali
              </Button>
            )}
            {detail.canComplete && (
              <Button
                size="sm"
                onClick={() => setCompleteOpen(true)}
                disabled={!completionReady || completing}
                title={
                  completionBlocker ??
                  "Semua syarat penyelesaian sudah terpenuhi."
                }
              >
                <CheckCircle2 aria-hidden="true" />
                Selesaikan
              </Button>
            )}
          </div>
        }
      />

      {detail.readOnly && (
        <InfoBanner tone="info" icon={Eye}>
          Akun ini hanya dapat melihat data. Pengisian, penyelesaian, dan
          tindak lanjut checklist dilakukan oleh tim.
        </InfoBanner>
      )}

      {inspection.status === "selesai" && (
        <InfoBanner tone="success" icon={CheckCircle2}>
          Diselesaikan oleh {detail.completedByName ?? "anggota tim"}
          {inspection.completedAt
            ? ` pada ${formatDateTime(inspection.completedAt)}`
            : ""}
          . Temuan yang belum ditindaklanjuti tetap tercatat di tindak lanjut.
        </InfoBanner>
      )}

      {inspection.reopenedAt && (
        <InfoBanner tone="warning" icon={RotateCcw}>
          Dibuka kembali oleh {detail.reopenedByName ?? "atasan"}
          {` pada ${formatDateTime(inspection.reopenedAt)}`}. Alasan:{" "}
          {inspection.reopenReason ?? "—"}
        </InfoBanner>
      )}

      <Frame>
        <FrameHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <FrameTitle>Ringkasan</FrameTitle>
            <FrameDescription className="text-xs">
              {answered} dari {total} item sudah diisi
              {detail.schedule
                ? ` · jadwal ${checklistIntervalLabel(detail.schedule.intervalUnit, detail.schedule.intervalCount)}`
                : ""}
            </FrameDescription>
          </div>
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            {total === 0 ? 0 : Math.round((answered / total) * 100)}%
          </span>
        </FrameHeader>
        <FramePanel className="flex flex-col gap-4">
          <ProgressBar
            value={answered}
            max={total}
            tone={answered === total && total > 0 ? "success" : "primary"}
          />

          <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">Lokasi</dt>
              <dd className="text-sm font-medium text-foreground">
                {inspection.locationName}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">Tanggal jadwal</dt>
              <dd className="text-sm font-medium text-foreground">
                {formatDateHuman(
                  occurrenceIso(inspection.occurrenceDate),
                  "d MMM yyyy",
                )}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">Tenggat</dt>
              <dd className="text-sm font-medium text-foreground tabular-nums">
                {formatDateTime(inspection.dueAt, "d MMM yyyy, HH:mm")}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">Dibuat oleh</dt>
              <dd className="text-sm font-medium text-foreground">
                {detail.ownerName ?? "—"}
              </dd>
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <dt className="text-xs text-muted-foreground">
                Tim yang ditugaskan
              </dt>
              <dd className="flex flex-wrap items-center gap-2">
                {detail.assignees.length === 0 ? (
                  <span className="text-sm text-muted-foreground">
                    Belum ada anggota
                  </span>
                ) : (
                  <>
                    {detail.assignees
                      .slice(0, ASSIGNEE_CHIP_LIMIT)
                      .map((person) => (
                        <span
                          key={person.id}
                          className="inline-flex items-center gap-1.5 rounded-full border border-border/70 py-0.5 pl-0.5 pr-2 text-xs text-foreground"
                        >
                          <Avatar
                            name={person.name}
                            seed={person.id}
                            size="xs"
                          />
                          {person.name}
                        </span>
                      ))}
                    {detail.assignees.length > ASSIGNEE_CHIP_LIMIT && (
                      <Badge variant="secondary">
                        +{detail.assignees.length - ASSIGNEE_CHIP_LIMIT} anggota
                        lain
                      </Badge>
                    )}
                  </>
                )}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <dt className="text-xs text-muted-foreground">Jadwal</dt>
              <dd className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <UsersRound className="size-3.5 text-muted-foreground" aria-hidden="true" />
                {detail.schedule
                  ? `${checklistIntervalLabel(detail.schedule.intervalUnit, detail.schedule.intervalCount)} · tenggat ${detail.schedule.dueDays} hari`
                  : "Tanpa jadwal berkala"}
              </dd>
            </div>
          </dl>

          {closed && detail.canReopen && (
            <p className="text-xs text-muted-foreground">
              Checklist selesai tidak dapat diubah. Gunakan “Buka kembali” bila
              ada koreksi; alasan akan tercatat di audit.
            </p>
          )}
        </FramePanel>
      </Frame>

      <Frame>
        <FrameHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <FrameTitle>Item checklist</FrameTitle>
            <FrameDescription className="text-xs">
              {closed
                ? "Hasil pemeriksaan tersimpan sebagai riwayat."
                : "Semua anggota tim yang ditugaskan boleh mengisi item. Setiap item disimpan sendiri agar tidak saling menimpa."}
            </FrameDescription>
          </div>
          <Badge variant="outline" className="tabular-nums">
            {answered}/{total}
          </Badge>
        </FrameHeader>

        <FramePanel className="p-0">
          {detail.answers.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="Belum ada item"
              description="Template versi ini tidak memiliki item checklist."
            />
          ) : (
            <div className="divide-y divide-border/70">
              {answerBlocks.map((block) => (
                <section key={block.entries[0].answer.id}>
                  {block.groupPath && (
                    <div className="flex flex-wrap items-center gap-2 bg-muted/40 px-4 py-2.5 sm:px-5">
                      <FolderTree
                        className="size-3.5 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <p className="text-xs font-semibold text-foreground">
                        {block.groupPath}
                      </p>
                      <Badge variant="outline">
                        {block.entries.length} item
                      </Badge>
                    </div>
                  )}
                  <ul className="divide-y divide-border/70">
                    {block.entries.map((entry) => {
                      const active = detail.followUps.find(
                        (row) =>
                          row.followUp.answerId === entry.answer.id &&
                          row.followUp.status !== "dibatalkan",
                      );
                      return (
                        <AnswerCard
                          key={entry.answer.id}
                          index={(answerNumber.get(entry.answer.id) ?? 1) - 1}
                          inspectionId={inspection.id}
                          answer={entry.answer}
                          photos={entry.photos}
                          canFill={detail.canFill}
                          canManageFollowUps={canUpdateFollowUps}
                          followUp={active ?? null}
                          conditions={conditions}
                          nested={Boolean(block.groupPath)}
                          onCreateFollowUp={openCreateFollowUp}
                          onDraftChange={handleDraftChange}
                          onUploadingChange={(_, uploading) =>
                            handleUploadingChange(
                              `answer:${entry.answer.id}`,
                              uploading,
                            )
                          }
                        />
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </FramePanel>
      </Frame>

      {detail.canComplete && (
        <Frame>
          <FrameHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <FrameTitle>Penyelesaian</FrameTitle>
              <FrameDescription className="text-xs">
                Periksa kelengkapan sebelum checklist dikunci.
              </FrameDescription>
            </div>
            <Badge variant="outline" className="tabular-nums">
              {answered}/{total} item
            </Badge>
          </FrameHeader>
          <FramePanel className="flex flex-col gap-3">
            {uploadingCount > 0 && (
              <Alert variant="info">
                <AlertDescription>
                  Tunggu foto selesai diunggah sebelum menyelesaikan checklist.
                </AlertDescription>
              </Alert>
            )}
            {unsavedCount > 0 && (
              <Alert variant="warning">
                <AlertDescription>
                  <span className="font-medium">
                    {unsavedCount} item belum disimpan.
                  </span>{" "}
                  Simpan perubahan dulu agar hasil yang dikunci sesuai isian
                  terakhir.
                </AlertDescription>
              </Alert>
            )}
            {missingRequirements.length > 0 ? (
              <Alert variant="warning">
                <AlertDescription>
                  <span className="font-medium">
                    {missingRequirements.length} item belum lengkap.
                  </span>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {missingRequirements.map((item) => (
                      <li key={item.answerId}>
                        <button
                          type="button"
                          onClick={() => jumpToRequirement(item.answerId)}
                          className="text-left text-xs font-medium text-foreground underline decoration-border underline-offset-2 transition-colors hover:decoration-foreground"
                        >
                          Item {answerNumber.get(item.answerId) ?? "—"}:{" "}
                          {item.prompt} — {item.reason}
                        </button>
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            ) : (
              unsavedCount === 0 &&
              uploadingCount === 0 && (
                <p className="text-sm text-muted-foreground">
                  Semua item wajib, catatan, dan foto yang diwajibkan sudah
                  lengkap.
                </p>
              )
            )}
          </FramePanel>
          <FrameFooter className="flex-row flex-wrap items-center justify-between gap-3">
            <p className="max-w-md text-xs text-muted-foreground">
              Setelah selesai, item tidak dapat diubah sampai atasan membuka
              kembali.
            </p>
            <Button
              type="button"
              size="sm"
              onClick={() => setCompleteOpen(true)}
              disabled={!completionReady || completing}
              className="w-full sm:w-auto"
            >
              <CheckCircle2 aria-hidden="true" />
              Selesaikan checklist
            </Button>
          </FrameFooter>
        </Frame>
      )}

      <Frame>
        <FrameHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <FrameTitle>Tindak lanjut</FrameTitle>
            <FrameDescription className="text-xs">
              Tindak lanjut dibuat manual dari item bermasalah. Statusnya
              terpisah dari status checklist.
            </FrameDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setFollowUpAnswer(null);
              setFollowUpOpen(true);
            }}
            disabled={!detail.canFill}
          >
            <ListChecks aria-hidden="true" />
            Tindak lanjut baru
          </Button>
        </FrameHeader>

        <FramePanel className="p-0">
          {detail.followUps.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="Belum ada tindak lanjut"
              description={
                detail.canFill
                  ? "Bila ada temuan, buat tindak lanjut dari item yang bermasalah atau dari tombol di atas."
                  : "Temuan yang perlu diperbaiki akan muncul di sini."
              }
            />
          ) : (
            <ul className="divide-y divide-border/70">
              {detail.followUps.map((row) => {
                const photos = detail.photos.filter(
                  (photo) => photo.followUpId === row.followUp.id,
                );
                return (
                  <li
                    key={row.followUp.id}
                    className="flex flex-col gap-2.5 px-4 py-4 sm:px-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <p className="text-sm font-medium text-foreground">
                          {row.followUp.title}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {row.prompt
                            ? `Dari item: ${row.prompt}`
                            : "Tindak lanjut umum"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <ChecklistPriorityBadge
                          priority={row.followUp.priority}
                        />
                        <ChecklistFollowUpBadge status={row.followUp.status} />
                      </div>
                    </div>

                    {row.followUp.description && (
                      <p className="max-w-3xl whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                        {row.followUp.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        {row.pic ? `PIC ${row.pic.name}` : "Tanpa PIC"}
                      </span>
                      <span className="tabular-nums">
                        {row.followUp.dueDate
                          ? `Tenggat ${formatDateTime(dueIso(row.followUp.dueDate), "d MMM yyyy")}`
                          : "Tanpa tenggat"}
                      </span>
                      {row.overdue && <ChecklistOverdueBadge />}
                      {row.followUp.status === "selesai" &&
                        row.followUp.completedAt && (
                          <span className="tabular-nums">
                            Selesai{" "}
                            {formatDateTime(
                              row.followUp.completedAt,
                              "d MMM yyyy, HH:mm",
                            )}
                          </span>
                        )}
                    </div>

                    {row.followUp.status === "dibatalkan" &&
                      row.followUp.cancelReason && (
                        <p className="text-xs text-muted-foreground">
                          Dibatalkan: {row.followUp.cancelReason}
                        </p>
                      )}

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2.5">
                      <ChecklistPhotoGallery
                        photos={photos}
                        inspectionId={inspection.id}
                        followUpId={row.followUp.id}
                        canUpload={canEditFollowUp(row) && photos.length < 6}
                        canDelete={canEditFollowUp(row)}
                        stage="perbaikan"
                        onChanged={() => router.refresh()}
                        onUploadingChange={(uploading) =>
                          handleUploadingChange(
                            `followup:${row.followUp.id}`,
                            uploading,
                          )
                        }
                      />
                      {!detail.readOnly && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setUpdateRow(row)}
                          disabled={
                            !canUpdateFollowUp(row) ||
                            row.followUp.status === "dibatalkan"
                          }
                        >
                          Perbarui
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </FramePanel>
      </Frame>

      <Modal
        open={completeOpen}
        onClose={() => setCompleteOpen(false)}
        dismissible={!completing}
        title="Selesaikan checklist?"
        description="Setelah selesai, item tidak dapat diubah sampai atasan membuka kembali."
        size="sm"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCompleteOpen(false)}
              disabled={completing}
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={complete}
              disabled={completing || !completionReady}
            >
              {completing ? (
                <Spinner />
              ) : (
                <CheckCircle2 aria-hidden="true" />
              )}
              {completing ? "Menyelesaikan…" : "Selesaikan"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 text-sm text-muted-foreground">
          {!completionReady && (
            <Alert variant="warning">
              <AlertDescription>
                {completionBlocker ??
                  "Lengkapi checklist sebelum menyelesaikan."}
              </AlertDescription>
            </Alert>
          )}
          <p>
            {answered} dari {total} item sudah diisi.
            {unansweredRequired > 0
              ? ` ${unansweredRequired} item wajib belum diisi dan perlu dilengkapi lebih dulu.`
              : " Semua item wajib sudah terisi."}
          </p>
          <p>
            Pastikan catatan temuan dan foto yang diwajibkan sudah lengkap.
            Temuan yang belum diperbaiki tidak menghalangi penyelesaian dan
            tetap tercatat sebagai tindak lanjut.
          </p>
        </div>
      </Modal>

      <AlertDialog
        open={reopenOpen}
        onOpenChange={(open) => {
          if (!open && !reopening) setReopenOpen(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Buka kembali checklist?</AlertDialogTitle>
            <AlertDialogDescription>
              Checklist kembali berstatus berlangsung dan dapat diisi ulang.
              Alasan wajib diisi dan tercatat di log audit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="reopen-reason">Alasan membuka kembali</Label>
            <Textarea
              id="reopen-reason"
              value={reopenReason}
              onChange={(event) => setReopenReason(event.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Contoh: Foto item nomor 3 perlu diperbarui setelah perbaikan."
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reopening}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={reopen}
              disabled={reopening || reopenReason.trim().length < 10}
            >
              {reopening ? "Membuka…" : "Buka kembali"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ChecklistFollowUpDialog
        open={followUpOpen}
        onClose={() => setFollowUpOpen(false)}
        inspectionId={inspection.id}
        answer={followUpAnswer}
        people={picOptions}
        onCreated={() => router.refresh()}
      />

      <ChecklistFollowUpUpdateDialog
        open={updateRow !== null}
        onClose={() => setUpdateRow(null)}
        row={updateRow}
        onUpdated={() => router.refresh()}
      />
    </div>
  );
}
