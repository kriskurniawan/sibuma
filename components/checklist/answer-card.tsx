"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, ImageIcon, ListChecks, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui";
import { Alert, AlertDescription } from "@/components/reui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChecklistPhotoGallery } from "@/components/checklist/photo-gallery";
import { ChecklistConditionBadge, ChecklistFollowUpBadge } from "@/components/checklist/checklist-badges";
import {
  CHECKLIST_MAX_PHOTOS,
  CHECKLIST_PHOTO_POLICY_LABEL,
  conditionRequiresNote,
  findChecklistCondition,
  isIssueCondition,
  type ChecklistAnswer,
  type ChecklistCondition,
  type ChecklistConditionOption,
  type ChecklistConditionTone,
  type ChecklistFollowUpRow,
  type ChecklistPhoto,
} from "@/lib/checklist-types";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";

const SELECTED_CLASS: Record<ChecklistConditionTone, string> = {
  success: "border-success/50 bg-success/10 text-success-foreground",
  warning: "border-warning/50 bg-warning/10 text-warning-foreground",
  danger: "border-destructive/50 bg-destructive/10 text-destructive-foreground",
  neutral: "border-border bg-muted text-muted-foreground",
};

const DRAFT_PREFIX = "sibuma:draft:";

interface DraftRecord {
  condition: ChecklistCondition | null;
  note: string;
  baseVersion: number;
  savedAt: number;
}

function readDraft(key: string): DraftRecord | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DraftRecord>;
    if (
      typeof parsed.note !== "string" ||
      typeof parsed.baseVersion !== "number" ||
      (parsed.condition !== null && typeof parsed.condition !== "string")
    ) {
      return null;
    }
    return {
      condition: (parsed.condition as ChecklistCondition | null) ?? null,
      note: parsed.note,
      baseVersion: parsed.baseVersion,
      // Legacy drafts may lack a timestamp; stamp them when first read.
      savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

function writeDraft(key: string, draft: DraftRecord) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // Storage can be unavailable in private mode or when the quota is full.
  }
}

function clearDraft(key: string) {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore; the server copy remains authoritative.
  }
}

function needsNote(
  answer: ChecklistAnswer,
  condition: ChecklistCondition | null,
  conditions: ChecklistConditionOption[],
) {
  if (conditionRequiresNote(condition, conditions)) {
    return `Tuliskan catatan untuk status "${findChecklistCondition(conditions, condition)?.label ?? condition}" (minimal 3 karakter).`;
  }
  if (isIssueCondition(condition, conditions) && answer.requireNoteOnIssue) {
    return "Catatan wajib diisi saat kondisi bermasalah (minimal 3 karakter).";
  }
  return null;
}

export interface AnswerDraftState {
  condition: ChecklistCondition | null;
  note: string;
  dirty: boolean;
}

export function AnswerCard({
  index,
  inspectionId,
  answer,
  photos,
  canFill,
  canManageFollowUps,
  followUp,
  conditions,
  nested,
  onCreateFollowUp,
  onDraftChange,
  onUploadingChange,
}: {
  index: number;
  inspectionId: string;
  answer: ChecklistAnswer;
  photos: ChecklistPhoto[];
  canFill: boolean;
  canManageFollowUps: boolean;
  followUp: ChecklistFollowUpRow | null;
  conditions: ChecklistConditionOption[];
  nested?: boolean;
  onCreateFollowUp: (answer: ChecklistAnswer) => void;
  /** Reports local edits so the parent can mirror completion validation. */
  onDraftChange?: (answerId: string, state: AnswerDraftState) => void;
  onUploadingChange?: (answerId: string, uploading: boolean) => void;
}) {
  const router = useRouter();
  const [condition, setCondition] = useState<ChecklistCondition | null>(
    answer.condition,
  );
  const [note, setNote] = useState(answer.note);
  const [saving, setSaving] = useState(false);
  const [baseVersion, setBaseVersion] = useState(answer.version);
  const [serverChanged, setServerChanged] = useState(false);
  const draftKey = `${DRAFT_PREFIX}${inspectionId}:${answer.id}`;

  const serverRef = useRef({
    condition: answer.condition,
    note: answer.note,
    version: answer.version,
  });
  const localRef = useRef({ condition, note });
  localRef.current = { condition, note };
  const draftRef = useRef<DraftRecord | null>(null);
  const draftChecked = useRef(false);
  const skipDraftWrite = useRef(false);

  // Read a per-tab draft after a reload or when the OS reclaimed the page.
  useEffect(() => {
    draftRef.current = readDraft(draftKey);
    draftChecked.current = true;
  }, [draftKey]);

  // Adopt new server values only when the user has no unsaved edits. A pending
  // per-tab draft always wins until it is saved or explicitly discarded.
  useEffect(() => {
    if (!draftChecked.current) return;

    const pendingDraft = draftRef.current;
    if (pendingDraft) {
      draftRef.current = null;
      skipDraftWrite.current = true;
      setCondition(pendingDraft.condition);
      setNote(pendingDraft.note);
      setBaseVersion(pendingDraft.baseVersion);
      setServerChanged(pendingDraft.baseVersion !== answer.version);
      return;
    }

    const previous = serverRef.current;
    const local = localRef.current;
    const untouched =
      local.condition === previous.condition && local.note === previous.note;

    if (untouched) {
      setCondition(answer.condition);
      setNote(answer.note);
      setBaseVersion(answer.version);
      setServerChanged(false);
    } else if (answer.version !== previous.version) {
      setServerChanged(true);
    }

    serverRef.current = {
      condition: answer.condition,
      note: answer.note,
      version: answer.version,
    };
  }, [answer.condition, answer.note, answer.version]);

  const dirty =
    condition !== answer.condition || note !== answer.note || serverChanged;

  useEffect(() => {
    onDraftChange?.(answer.id, { condition, note, dirty });
  }, [answer.id, condition, note, dirty, onDraftChange]);

  // Persist only genuine unsaved work in this browser tab. Skip the first pass
  // after applying a stored draft so it is not erased before it renders.
  useEffect(() => {
    if (!draftChecked.current) return;
    if (skipDraftWrite.current) {
      skipDraftWrite.current = false;
      return;
    }
    if (!dirty) {
      clearDraft(draftKey);
      return;
    }
    writeDraft(draftKey, {
      condition,
      note,
      baseVersion,
      // Draft timestamp is stored metadata, never rendered on the server.
      savedAt: Date.now(),
    });
  }, [condition, note, baseVersion, dirty, draftKey]);

  const noteHint = needsNote(answer, condition, conditions);
  const invalid =
    dirty &&
    condition !== null &&
    ((conditionRequiresNote(condition, conditions) ||
      (isIssueCondition(condition, conditions) && answer.requireNoteOnIssue)) &&
      note.trim().length < 3);
  const photoWarning =
    answer.photoPolicy === "wajib" && photos.length === 0
      ? "Foto wajib dilampirkan sebelum checklist diselesaikan."
      : answer.photoPolicy === "wajib_saat_masalah" &&
          isIssueCondition(condition, conditions) &&
          photos.length === 0
        ? "Kondisi bermasalah mewajibkan minimal satu foto."
        : null;

  async function save(overwrite = false) {
    if (invalid) {
      toast.error(noteHint ?? "Lengkapi catatan sebelum menyimpan.");
      return;
    }
    setSaving(true);
    const expectedVersion = overwrite ? answer.version : baseVersion;
    try {
      const response = await fetch(`/api/checklist/answers/${answer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          condition,
          note,
          expectedVersion,
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        message?: string;
        answer?: { version: number };
      };
      if (response.status === 409) {
        toast.error(
          data.message ??
            "Item ini baru saja diubah anggota lain. Draf Anda tetap tersimpan.",
        );
        router.refresh();
        return;
      }
      if (!response.ok) {
        toast.error(data.message ?? "Gagal menyimpan item.");
        return;
      }
      const nextVersion = data.answer?.version ?? expectedVersion + 1;
      serverRef.current = { condition, note, version: nextVersion };
      setBaseVersion(nextVersion);
      setServerChanged(false);
      clearDraft(draftKey);
      toast.success("Item checklist disimpan.");
      router.refresh();
    } catch {
      toast.error("Gagal menyimpan item. Periksa koneksi lalu coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  function useServerVersion() {
    setCondition(answer.condition);
    setNote(answer.note);
    setBaseVersion(answer.version);
    setServerChanged(false);
    clearDraft(draftKey);
  }

  const activeFollowUp = followUp && followUp.followUp.status !== "dibatalkan";

  return (
    <li
      id={`checklist-item-${answer.id}`}
      className={cn(
        "flex scroll-mt-24 flex-col gap-3 py-4 pr-4 sm:pr-5",
        nested ? "border-l-2 border-border/70 pl-8 sm:pl-12" : "pl-4 sm:pl-5",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground tabular-nums">
              {String(index + 1).padStart(2, "0")}
            </span>
            {answer.required ? (
              <Badge variant="outline" className="text-xs">
                Wajib
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                Opsional
              </Badge>
            )}
            {answer.photoPolicy !== "opsional" && (
              <Badge variant="outline" className="text-xs">
                <ImageIcon aria-hidden="true" />
                {CHECKLIST_PHOTO_POLICY_LABEL[answer.photoPolicy]}
              </Badge>
            )}
            {condition && (
              <ChecklistConditionBadge
                condition={condition}
                conditions={conditions}
              />
            )}
            {dirty && (
              <Badge variant="warning-outline" className="text-xs">
                Belum disimpan
              </Badge>
            )}
          </div>
          <p className="text-sm font-medium leading-relaxed text-foreground">
            {answer.prompt}
          </p>
          {answer.guidance && (
            <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
              {answer.guidance}
            </p>
          )}
        </div>
        {answer.updatedAt && (
          <span className="hidden shrink-0 text-xs text-muted-foreground tabular-nums sm:block">
            {formatDateTime(answer.updatedAt, "d MMM, HH:mm")}
          </span>
        )}
      </div>

      {serverChanged && (
        <Alert variant="warning">
          <AlertDescription>
            <span className="font-medium">
              Item ini diubah anggota lain saat Anda mengisi.
            </span>{" "}
            Draf Anda belum dikirim. Versi server terbaru:{" "}
            <span className="font-medium">
              {answer.condition
                ? (findChecklistCondition(conditions, answer.condition)?.label ??
                  answer.condition)
                : "belum diisi"}
            </span>
            {answer.note.trim() ? ` · “${answer.note.trim().slice(0, 120)}”` : ""}.
            <span className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={useServerVersion}
                disabled={saving}
              >
                Gunakan versi server
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => save(true)}
                disabled={saving || invalid}
              >
                Simpan draf saya
              </Button>
            </span>
          </AlertDescription>
        </Alert>
      )}

      <div
        role="group"
        aria-label={`Kondisi ${answer.prompt}`}
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {conditions
          .filter((option) => option.active || option.id === condition)
          .map((option) => {
            const selected = condition === option.id;
            return (
              <button
                key={option.id}
                type="button"
                disabled={!canFill || saving}
                aria-pressed={selected}
                onClick={() => setCondition(option.id)}
                className={cn(
                  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60",
                  selected
                    ? SELECTED_CLASS[option.tone]
                    : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {selected && <Check className="size-3.5" aria-hidden="true" />}
                {option.label}
              </button>
            );
          })}
      </div>

      <div className="flex flex-col gap-1.5">
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          readOnly={!canFill || saving}
          rows={2}
          maxLength={2000}
          placeholder={
            canFill
              ? "Catatan pemeriksaan, temuan, atau alasan tidak berlaku…"
              : "Catatan akan tampil di sini."
          }
          aria-label={`Catatan ${answer.prompt}`}
        />
        {dirty && noteHint && (
          <p className="flex items-start gap-1.5 text-xs text-warning-foreground">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {noteHint}
          </p>
        )}
        {photoWarning && (
          <p className="flex items-start gap-1.5 text-xs text-warning-foreground">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {photoWarning}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ChecklistPhotoGallery
            photos={photos}
            inspectionId={inspectionId}
            answerId={answer.id}
            canUpload={canFill && photos.length < CHECKLIST_MAX_PHOTOS}
            canDelete={canFill}
            onUploadingChange={(uploading) =>
              onUploadingChange?.(answer.id, uploading)
            }
            onChanged={() => router.refresh()}
          />
          <div className="flex flex-wrap items-center gap-2">
            {activeFollowUp && (
              <>
                <ChecklistFollowUpBadge status={followUp.followUp.status} />
                {canManageFollowUps && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onCreateFollowUp(answer)}
                    disabled={saving}
                  >
                    <ListChecks aria-hidden="true" />
                    Kelola
                  </Button>
                )}
              </>
            )}
            {canFill && !activeFollowUp && isIssueCondition(condition, conditions) && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onCreateFollowUp(answer)}
                disabled={saving}
              >
                <ListChecks aria-hidden="true" />
                Buat tindak lanjut
              </Button>
            )}
            {canFill && !serverChanged && dirty && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={useServerVersion}
                disabled={saving}
              >
                Batalkan draf
              </Button>
            )}
            {canFill && !serverChanged && (
              <Button
                type="button"
                size="sm"
                onClick={() => save(false)}
                disabled={saving || !dirty || invalid}
              >
                {saving ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <Check aria-hidden="true" />
                )}
                {saving ? "Menyimpan…" : "Simpan"}
              </Button>
            )}
          </div>
        </div>
        {answer.updatedBy && (
          <p className="text-xs text-muted-foreground sm:hidden">
            Diperbarui {answer.updatedAt ? formatDateTime(answer.updatedAt, "d MMM, HH:mm") : "—"}
          </p>
        )}
      </div>
    </li>
  );
}
