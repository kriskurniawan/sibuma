"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  ListChecks,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/reui/alert";
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { IconTile } from "@/components/reui/icon-tile";
import { Badge, EmptyState } from "@/components/ui";
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
import { Switch } from "@/components/ui/switch";
import { Modal } from "@/components/modal";
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
import { ChecklistConditionBadge } from "@/components/checklist/checklist-badges";
import {
  CHECKLIST_CONDITION_TONE_LABEL,
  type ChecklistConditionOption,
  type ChecklistConditionTone,
} from "@/lib/checklist-types";

const TONE_ITEMS = (
  Object.keys(CHECKLIST_CONDITION_TONE_LABEL) as ChecklistConditionTone[]
).map((value) => ({
  value,
  label: CHECKLIST_CONDITION_TONE_LABEL[value],
}));

const EMPTY_FORM = {
  label: "",
  tone: "neutral" as ChecklistConditionTone,
  isIssue: false,
  requiresNote: false,
  active: true,
};

type ConditionForm = typeof EMPTY_FORM;

export function ChecklistConditionSettings({
  conditions,
}: {
  conditions: ChecklistConditionOption[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(conditions);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ChecklistConditionOption | null>(null);
  const [form, setForm] = useState<ConditionForm>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] =
    useState<ChecklistConditionOption | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setItems(conditions);
  }, [conditions]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(condition: ChecklistConditionOption) {
    setEditing(condition);
    setForm({
      label: condition.label,
      tone: condition.tone,
      isIssue: condition.isIssue,
      requiresNote: condition.requiresNote,
      active: condition.active,
    });
    setError(null);
    setDialogOpen(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const label = form.label.trim();
    if (label.length < 2) {
      setError("Nama status minimal 2 karakter.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(
        editing
          ? `/api/checklist/conditions/${editing.id}`
          : "/api/checklist/conditions",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, label }),
        },
      );
      const data = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };
      if (!response.ok || !data.ok) {
        setError(data.message ?? "Gagal menyimpan status checklist.");
        return;
      }
      toast.success(
        editing ? "Status checklist diperbarui." : "Status checklist ditambahkan.",
      );
      setDialogOpen(false);
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server. Periksa koneksimu.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(condition: ChecklistConditionOption) {
    setPendingId(condition.id);
    try {
      const response = await fetch(`/api/checklist/conditions/${condition.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !condition.active }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };
      if (!response.ok || !data.ok) {
        toast.error(data.message ?? "Gagal mengubah status checklist.");
        return;
      }
      setItems((current) =>
        current.map((item) =>
          item.id === condition.id
            ? { ...item, active: !condition.active }
            : item,
        ),
      );
      toast.success(
        condition.active ? "Status dinonaktifkan." : "Status diaktifkan.",
      );
      router.refresh();
    } catch {
      toast.error("Gagal mengubah status. Periksa koneksi lalu coba lagi.");
    } finally {
      setPendingId(null);
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const previous = items;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    setPendingId(items[index].id);
    try {
      const response = await fetch("/api/checklist/conditions/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: next.map((item) => item.id) }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };
      if (!response.ok || !data.ok) {
        setItems(previous);
        toast.error(data.message ?? "Gagal menyimpan urutan status.");
        return;
      }
      toast.success("Urutan status disimpan.");
      router.refresh();
    } catch {
      setItems(previous);
      toast.error("Gagal menyimpan urutan. Periksa koneksi lalu coba lagi.");
    } finally {
      setPendingId(null);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await fetch(
        `/api/checklist/conditions/${deleteTarget.id}`,
        { method: "DELETE" },
      );
      const data = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };
      if (!response.ok || !data.ok) {
        toast.error(data.message ?? "Gagal menghapus status checklist.");
        return;
      }
      setDeleteTarget(null);
      setDialogOpen(false);
      toast.success("Status checklist dihapus.");
      router.refresh();
    } catch {
      toast.error("Gagal menghapus status. Periksa koneksi lalu coba lagi.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Frame spacing="default">
        <FrameHeader className="gap-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <IconTile
                variant="soft"
                size="sm"
                className="text-primary"
                aria-hidden="true"
              >
                <ListChecks />
              </IconTile>
              <div className="flex min-w-0 flex-col gap-0.5">
                <FrameTitle>Status checklist</FrameTitle>
              </div>
            </div>
            <Button type="button" size="sm" onClick={openCreate}>
              <Plus aria-hidden="true" />
              Tambah status
            </Button>
          </div>
          <FrameDescription className="hidden md:block">
            Status nonaktif hanya tersimpan di riwayat, bukan pengisian baru.
          </FrameDescription>
        </FrameHeader>

        <FramePanel className="p-0">
          {items.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="Belum ada status checklist"
              description="Tambahkan minimal satu status, misalnya Baik atau Perlu perhatian."
              action={
                <Button type="button" size="sm" onClick={openCreate}>
                  <Plus aria-hidden="true" />
                  Tambah status
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-border/70">
              {items.map((condition, index) => (
                <li
                  key={condition.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <div className="flex shrink-0 flex-col">
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Naikkan status ${condition.label}`}
                        disabled={index === 0 || pendingId !== null}
                        onClick={() => move(index, -1)}
                      >
                        <ChevronUp aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Turunkan status ${condition.label}`}
                        disabled={
                          index === items.length - 1 || pendingId !== null
                        }
                        onClick={() => move(index, 1)}
                      >
                        <ChevronDown aria-hidden="true" />
                      </Button>
                    </div>
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <ChecklistConditionBadge
                          condition={condition.id}
                          conditions={items}
                        />
                        {condition.isIssue && (
                          <Badge variant="warning-light">Temuan</Badge>
                        )}
                        {condition.requiresNote && (
                          <Badge variant="outline">Wajib catatan</Badge>
                        )}
                        {!condition.active && (
                          <Badge variant="warning-light">Nonaktif</Badge>
                        )}
                      </div>
                      <p className="hidden text-xs text-muted-foreground md:block">
                        {condition.isIssue
                          ? "Dihitung sebagai temuan dan dapat memicu tindak lanjut."
                          : condition.requiresNote
                            ? "Wajib catatan saat dipilih."
                            : "Tidak dihitung sebagai temuan."}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Label
                      htmlFor={`condition-active-${condition.id}`}
                      className="hidden text-xs font-normal text-muted-foreground sm:block"
                    >
                      Aktif
                    </Label>
                    <Switch
                      id={`condition-active-${condition.id}`}
                      aria-label={`Status ${condition.label} aktif`}
                      checked={condition.active}
                      disabled={pendingId !== null}
                      onCheckedChange={() => toggleActive(condition)}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => openEdit(condition)}
                      aria-label={`Ubah status ${condition.label}`}
                    >
                      <Pencil aria-hidden="true" />
                      <span className="hidden sm:inline">Ubah</span>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </FramePanel>
      </Frame>

      <Modal
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        dismissible={!saving}
        title={editing ? "Ubah status checklist" : "Status checklist baru"}
        description="Status ini dipakai saat petugas mengisi item pemeriksaan."
        size="sm"
        footer={
          <>
            {editing && (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="mr-auto"
                disabled={saving}
                onClick={() => setDeleteTarget(editing)}
              >
                <Trash2 aria-hidden="true" />
                Hapus
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => setDialogOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              form="condition-form"
              disabled={saving}
            >
              {saving ? <Spinner /> : <ListChecks aria-hidden="true" />}
              {saving ? "Menyimpan…" : "Simpan"}
            </Button>
          </>
        }
      >
        <form
          id="condition-form"
          onSubmit={submit}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="condition-label">Nama status</Label>
            <Input
              id="condition-label"
              value={form.label}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  label: event.target.value,
                }))
              }
              maxLength={40}
              placeholder="Contoh: Menunggu vendor"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="condition-tone">Warna</Label>
            <Select
              value={form.tone}
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  tone: value as ChecklistConditionTone,
                }))
              }
              items={TONE_ITEMS}
            >
              <SelectTrigger id="condition-tone" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TONE_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-3 border-t border-border/70 pt-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <Label htmlFor="condition-issue">Hitung sebagai temuan</Label>
                <p className="text-xs text-muted-foreground">
                  Memunculkan tombol tindak lanjut dan dihitung di laporan.
                </p>
              </div>
              <Switch
                id="condition-issue"
                checked={form.isIssue}
                onCheckedChange={(checked) =>
                  setForm((current) => ({ ...current, isIssue: checked }))
                }
              />
            </div>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <Label htmlFor="condition-note">Wajib catatan</Label>
                <p className="text-xs text-muted-foreground">
                  Petugas tidak bisa menyimpan item tanpa catatan.
                </p>
              </div>
              <Switch
                id="condition-note"
                checked={form.requiresNote}
                onCheckedChange={(checked) =>
                  setForm((current) => ({ ...current, requiresNote: checked }))
                }
              />
            </div>
            {editing && (
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <Label htmlFor="condition-active">Status aktif</Label>
                  <p className="text-xs text-muted-foreground">
                    Hanya status aktif yang muncul saat pengisian baru.
                  </p>
                </div>
                <Switch
                  id="condition-active"
                  checked={form.active}
                  onCheckedChange={(checked) =>
                    setForm((current) => ({ ...current, active: checked }))
                  }
                />
              </div>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </form>
      </Modal>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus status checklist?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `Status "${deleteTarget.label}" akan dihapus. Status yang sudah dipakai pada jawaban tidak dapat dihapus; nonaktifkan saja.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void remove();
              }}
              disabled={deleting}
            >
              {deleting ? "Menghapus…" : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
