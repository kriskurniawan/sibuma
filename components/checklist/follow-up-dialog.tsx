"use client";

import { useEffect, useState } from "react";
import { ListChecks } from "lucide-react";
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
  CHECKLIST_PRIORITY_LABEL,
  type ChecklistAnswer,
  type ChecklistPerson,
  type ChecklistPriority,
} from "@/lib/checklist-types";

const PRIORITIES: ChecklistPriority[] = [
  "rendah",
  "sedang",
  "tinggi",
  "mendesak",
];

export function ChecklistFollowUpDialog({
  open,
  onClose,
  inspectionId,
  answer,
  people,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  inspectionId: string;
  answer: ChecklistAnswer | null;
  people: ChecklistPerson[];
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [picId, setPicId] = useState("");
  const [priority, setPriority] = useState<ChecklistPriority>("sedang");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(answer?.prompt ?? "");
    setDescription(
      answer?.note?.trim()
        ? `Temuan: ${answer.note.trim()}`
        : "",
    );
    setPicId("");
    setPriority("sedang");
    setDueDate("");
  }, [open, answer]);

  async function submit() {
    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 4) {
      toast.error("Judul tindak lanjut minimal 4 karakter.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/checklist/follow-ups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inspectionId,
          answerId: answer?.id ?? null,
          title: trimmedTitle,
          description: description.trim(),
          picId: picId || null,
          priority,
          dueDate: dueDate || null,
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };
      if (!response.ok) {
        toast.error(data.message ?? "Gagal membuat tindak lanjut.");
        return;
      }
      toast.success("Tindak lanjut dibuat.");
      onClose();
      onCreated();
    } catch {
      toast.error("Gagal membuat tindak lanjut. Periksa koneksi lalu coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  const picItems = [
    { value: "", label: "Tanpa PIC" },
    ...people.map((person) => ({ value: person.id, label: person.name })),
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!saving}
      title="Buat tindak lanjut"
      description={
        answer
          ? "Tindak lanjut dibuat manual dari item bermasalah. Status checklist tidak berubah."
          : "Catat pekerjaan perbaikan untuk temuan pada checklist ini."
      }
      size="md"
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
          <Button
            type="button"
            size="sm"
            onClick={submit}
            disabled={saving}
          >
            {saving ? (
              <Spinner />
            ) : (
              <ListChecks aria-hidden="true" />
            )}
            {saving ? "Menyimpan…" : "Buat tindak lanjut"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {answer && (
          <div className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2">
            <p className="text-xs text-muted-foreground">Item bermasalah</p>
            <p className="mt-0.5 text-sm font-medium text-foreground">
              {answer.prompt}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="follow-up-title">Judul</Label>
          <Input
            id="follow-up-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={140}
            placeholder="Contoh: Ganti lampu koridor lantai 2"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="follow-up-description">Deskripsi</Label>
          <Textarea
            id="follow-up-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Rincian temuan, lokasi, dan perbaikan yang dibutuhkan…"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="follow-up-pic">PIC</Label>
            <Select
              value={picId}
              onValueChange={(value) => setPicId(value as string)}
              items={picItems}
            >
              <SelectTrigger id="follow-up-pic" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {picItems.map((item) => (
                  <SelectItem key={item.value || "none"} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="follow-up-priority">Prioritas</Label>
            <Select
              value={priority}
              onValueChange={(value) =>
                setPriority(value as ChecklistPriority)
              }
              items={PRIORITIES.map((value) => ({
                value,
                label: CHECKLIST_PRIORITY_LABEL[value],
              }))}
            >
              <SelectTrigger id="follow-up-priority" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {CHECKLIST_PRIORITY_LABEL[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="follow-up-due">Deadline (opsional)</Label>
          <Input
            id="follow-up-due"
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}
