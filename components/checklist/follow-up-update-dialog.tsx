"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  CHECKLIST_FOLLOW_UP_LABEL,
  type ChecklistFollowUpRow,
  type ChecklistFollowUpStatus,
} from "@/lib/checklist-types";
import { formatDateTime } from "@/lib/time";

const STATUSES: ChecklistFollowUpStatus[] = [
  "terbuka",
  "diproses",
  "tertunda",
  "selesai",
  "dibatalkan",
];

export function ChecklistFollowUpUpdateDialog({
  open,
  onClose,
  row,
  onUpdated,
}: {
  open: boolean;
  onClose: () => void;
  row: ChecklistFollowUpRow | null;
  onUpdated: () => void;
}) {
  const [status, setStatus] = useState<ChecklistFollowUpStatus>("terbuka");
  const [progressNote, setProgressNote] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [resultNote, setResultNote] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !row) return;
    setStatus(row.followUp.status);
    setProgressNote("");
    setDueDate(row.followUp.dueDate ?? "");
    setResultNote(row.followUp.resultNote);
    setCancelReason(row.followUp.cancelReason ?? "");
  }, [open, row]);

  async function submit() {
    if (!row) return;
    if (status === "selesai" && resultNote.trim().length < 3) {
      toast.error("Tuliskan hasil tindak lanjut minimal 3 karakter.");
      return;
    }
    if (status === "dibatalkan" && cancelReason.trim().length < 4) {
      toast.error("Tuliskan alasan pembatalan minimal 4 karakter.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(
        `/api/checklist/follow-ups/${row.followUp.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            progressNote: progressNote.trim(),
            dueDate: dueDate || null,
            resultNote: resultNote.trim(),
            cancelReason: cancelReason.trim() || null,
          }),
        },
      );
      const data = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };
      if (!response.ok) {
        toast.error(data.message ?? "Gagal memperbarui tindak lanjut.");
        return;
      }
      toast.success("Tindak lanjut diperbarui.");
      onClose();
      onUpdated();
    } catch {
      toast.error(
        "Gagal memperbarui tindak lanjut. Periksa koneksi lalu coba lagi.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!saving}
      title={row?.followUp.title ?? "Perbarui tindak lanjut"}
      description="Perubahan status dan catatan progres tersimpan di riwayat tindak lanjut."
      size="md"
      mobileSheet
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={saving}
          >
            Batal
          </Button>
          <Button type="button" size="sm" onClick={submit} disabled={saving}>
            {saving ? <Spinner /> : <Save aria-hidden="true" />}
            {saving ? "Menyimpan…" : "Simpan perubahan"}
          </Button>
        </>
      }
    >
      {row && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 rounded-lg border border-border/70 bg-muted/40 px-3 py-2">
            <p className="text-xs text-muted-foreground">
              {row.inspection.templateName} · {row.inspection.locationName}
            </p>
            <p className="text-xs text-muted-foreground">
              {row.pic ? `PIC ${row.pic.name}` : "Belum ada PIC"}
              {row.followUp.safetyName
                ? ` · Petugas safety ${row.followUp.safetyName}`
                : ""}
              {row.followUp.dueDate
                ? ` · Deadline ${formatDateTime(`${row.followUp.dueDate}T23:59:59+07:00`, "d MMM yyyy")}`
                : ""}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="update-status">Status</Label>
              <Select
                value={status}
                onValueChange={(value) =>
                  setStatus(value as ChecklistFollowUpStatus)
                }
                items={STATUSES.map((value) => ({
                  value,
                  label: CHECKLIST_FOLLOW_UP_LABEL[value],
                }))}
              >
                <SelectTrigger id="update-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {CHECKLIST_FOLLOW_UP_LABEL[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="update-due">Deadline</Label>
              <Input
                id="update-due"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="update-progress">Catatan progres</Label>
            <Textarea
              id="update-progress"
              value={progressNote}
              onChange={(event) => setProgressNote(event.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="Tambahkan catatan progres (opsional). Catatan lama tetap tersimpan."
            />
          </div>

          {status === "selesai" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="update-result">Hasil tindak lanjut</Label>
              <Textarea
                id="update-result"
                value={resultNote}
                onChange={(event) => setResultNote(event.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Jelaskan perbaikan yang sudah dilakukan…"
              />
            </div>
          )}

          {status === "dibatalkan" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="update-cancel">Alasan pembatalan</Label>
              <Textarea
                id="update-cancel"
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Mengapa tindak lanjut ini dibatalkan?"
              />
            </div>
          )}

          {row.events.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
              <p className="text-xs font-medium text-foreground">Riwayat</p>
              <ul className="flex flex-col gap-1.5">
                {row.events
                  .slice(-4)
                  .reverse()
                  .map((event) => (
                    <li
                      key={event.id}
                      className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-muted-foreground"
                    >
                      <span className="font-medium text-foreground">
                        {event.actorName}
                      </span>
                      <span>{CHECKLIST_FOLLOW_UP_LABEL[event.status]}</span>
                      <span className="tabular-nums">
                        {formatDateTime(event.createdAt, "d MMM yyyy, HH:mm")}
                      </span>
                      {event.note && (
                        <span className="w-full truncate">{event.note}</span>
                      )}
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
