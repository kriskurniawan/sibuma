"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ClipboardList,
  FolderTree,
  History,
  ImageIcon,
  Pencil,
  PlusCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { Badge, PageHeader } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Modal } from "@/components/modal";
import {
  TemplateItemEditor,
  toTemplateDraft,
  validateTemplateDraft,
  type TemplateItemDraft,
} from "@/components/checklist/template-item-editor";
import {
  CHECKLIST_PHOTO_POLICY_LABEL,
  type ChecklistTemplate,
  type ChecklistTemplateItem,
  type ChecklistTemplateVersion,
} from "@/lib/checklist-types";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";

type VersionWithItems = ChecklistTemplateVersion & {
  items: ChecklistTemplateItem[];
};

function leafCount(items: ChecklistTemplateItem[]) {
  return items.filter((item) => item.itemType === "item").length;
}

export function ChecklistTemplateDetailView({
  template,
  versions,
}: {
  template: ChecklistTemplate;
  versions: VersionWithItems[];
}) {
  const router = useRouter();
  const [selectedVersionId, setSelectedVersionId] = useState(
    versions[0]?.id ?? "",
  );
  const [editOpen, setEditOpen] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);

  const selected =
    versions.find((version) => version.id === selectedVersionId) ??
    versions[0] ??
    null;
  const latest = versions[0] ?? null;

  const versionItems = versions.map((version) => ({
    value: version.id,
    label: `Versi ${version.version} — ${leafCount(version.items)} item`,
  }));

  let leafNumber = 0;
  const selectedRows = (selected?.items ?? []).map((item) => ({
    item,
    number: item.itemType === "item" ? ++leafNumber : null,
  }));

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <div>
        <Button
          size="sm"
          variant="ghost"
          nativeButton={false}
          render={<Link href="/checklist/template" />}
        >
          <ArrowLeft aria-hidden="true" />
          Template & lokasi
        </Button>
      </div>

      <PageHeader
        eyebrow={template.category}
        title={template.name}
        description={template.description || undefined}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info-light" className="tabular-nums">
              Versi {template.currentVersion}
            </Badge>
            {!template.active && <Badge variant="outline">Nonaktif</Badge>}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditOpen(true)}
            >
              <Pencil aria-hidden="true" />
              Ubah
            </Button>
            <Button
              size="sm"
              onClick={() => setVersionOpen(true)}
              disabled={!latest}
            >
              <PlusCircle aria-hidden="true" />
              Terbitkan versi
            </Button>
          </div>
        }
      />

      <Frame>
        <FrameHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <FrameTitle>Item pada versi</FrameTitle>
            <FrameDescription className="text-xs">
              Setiap versi bersifat tetap. Checklist yang sudah dibuat tetap
              memakai item dari versi saat itu.
            </FrameDescription>
          </div>
          {versions.length > 0 && (
            <Select
              value={selected?.id ?? ""}
              onValueChange={(value) => setSelectedVersionId(value as string)}
              items={versionItems}
            >
              <SelectTrigger size="sm" className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {versionItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FrameHeader>

        <FramePanel className="p-0">
          {!selected ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">
              Template ini belum memiliki item pada versinya.
            </div>
          ) : (
            <ul className="divide-y divide-border/70">
              {selectedRows.map(({ item, number }) => {
                const isGroup = item.itemType === "grup";
                return (
                  <li
                    key={item.id}
                    className={cn(
                      "flex flex-col gap-1.5 px-4 py-3 sm:px-5",
                      item.parentItemId &&
                        "border-l-2 border-border/70 pl-8 sm:pl-12",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      {isGroup ? (
                        <FolderTree
                          className="size-3.5 text-muted-foreground"
                          aria-hidden="true"
                        />
                      ) : (
                        <span className="text-xs font-medium text-muted-foreground tabular-nums">
                          {String(number).padStart(2, "0")}
                        </span>
                      )}
                      {isGroup ? (
                        <Badge variant="secondary" className="text-xs">
                          Grup
                        </Badge>
                      ) : item.required ? (
                        <Badge variant="outline" className="text-xs">
                          Wajib
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-xs text-muted-foreground"
                        >
                          Opsional
                        </Badge>
                      )}
                      {!isGroup && item.photoPolicy !== "opsional" && (
                        <Badge variant="outline" className="text-xs">
                          <ImageIcon aria-hidden="true" />
                          {CHECKLIST_PHOTO_POLICY_LABEL[item.photoPolicy]}
                        </Badge>
                      )}
                      {!isGroup && item.requireNoteOnIssue && (
                        <Badge variant="outline" className="text-xs">
                          Catatan wajib saat bermasalah
                        </Badge>
                      )}
                      {!isGroup && item.publicVisible && (
                        <Badge variant="success-light" className="text-xs">
                          Tampil ke pengunjung
                        </Badge>
                      )}
                    </div>
                    <p
                      className={cn(
                        "text-sm text-foreground",
                        isGroup ? "font-semibold" : "font-medium",
                      )}
                    >
                      {item.prompt}
                    </p>
                    {item.guidance && (
                      <p className="text-xs text-muted-foreground">
                        {item.guidance}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </FramePanel>

        {selected && (
          <div className="border-t border-border/70 px-4 py-2.5 text-xs text-muted-foreground sm:px-5">
            Versi {selected.version} diterbitkan{" "}
            {formatDateTime(selected.createdAt, "d MMM yyyy, HH:mm")}
            {selected.notes ? ` · ${selected.notes}` : ""}
          </div>
        )}
      </Frame>

      <Frame>
        <FrameHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <FrameTitle>Riwayat versi</FrameTitle>
            <FrameDescription className="text-xs">
              Versi lama tidak berubah walaupun template diubah.
            </FrameDescription>
          </div>
          <Badge variant="outline" className="tabular-nums">
            {versions.length} versi
          </Badge>
        </FrameHeader>

        <FramePanel className="p-0">
          <ul className="divide-y divide-border/70">
            {versions.map((version) => (
              <li
                key={version.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5"
              >
                <div className="flex min-w-0 items-start gap-2.5">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <History className="size-4" aria-hidden="true" />
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-medium text-foreground">
                        Versi {version.version}
                      </p>
                      {version.id === latest?.id && (
                        <Badge variant="success-light" className="text-xs">
                          Terbaru
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {leafCount(version.items)} item ·{" "}
                      {formatDateTime(version.createdAt, "d MMM yyyy, HH:mm")}
                      {version.notes ? ` · ${version.notes}` : ""}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedVersionId(version.id)}
                >
                  Lihat
                </Button>
              </li>
            ))}
          </ul>
        </FramePanel>
      </Frame>

      <TemplateEditDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        template={template}
        onSaved={() => router.refresh()}
      />

      <PublishVersionDialog
        open={versionOpen}
        onClose={() => setVersionOpen(false)}
        template={template}
        source={latest}
        onPublished={() => {
          setSelectedVersionId("");
          router.refresh();
        }}
      />
    </div>
  );
}

function TemplateEditDialog({
  open,
  onClose,
  template,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  template: ChecklistTemplate;
  onSaved: () => void;
}) {
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description);
  const [active, setActive] = useState(template.active);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(template.name);
    setDescription(template.description);
    setActive(template.active);
  }, [open, template]);

  async function submit() {
    if (name.trim().length < 3) {
      toast.error("Nama template minimal 3 karakter.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(
        `/api/checklist/templates/${template.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim(),
            active,
          }),
        },
      );
      const data = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };
      if (!response.ok) {
        toast.error(data.message ?? "Gagal mengubah template.");
        return;
      }
      toast.success("Template diperbarui.");
      onClose();
      onSaved();
    } catch {
      toast.error("Gagal mengubah template. Coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!saving}
      title="Ubah template"
      description="Perubahan nama dan status tidak mengubah item pada versi yang sudah terbit."
      size="sm"
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
            {saving ? <Spinner /> : <Pencil aria-hidden="true" />}
            {saving ? "Menyimpan…" : "Simpan"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-template-name">Nama template</Label>
          <Input
            id="edit-template-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={100}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-template-description">Deskripsi</Label>
          <Textarea
            id="edit-template-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            maxLength={500}
          />
        </div>
        <Label className="flex items-center gap-2 text-sm font-normal text-foreground">
          <Checkbox
            checked={active}
            onCheckedChange={(checked) => setActive(checked === true)}
          />
          Template aktif
        </Label>
      </div>
    </Modal>
  );
}

function PublishVersionDialog({
  open,
  onClose,
  template,
  source,
  onPublished,
}: {
  open: boolean;
  onClose: () => void;
  template: ChecklistTemplate;
  source: VersionWithItems | null;
  onPublished: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<TemplateItemDraft[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNotes("");
    setItems(source ? toTemplateDraft(source.items) : []);
  }, [open, source]);

  async function submit() {
    const itemError = validateTemplateDraft(items);
    if (itemError) {
      toast.error(itemError);
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(
        `/api/checklist/templates/${template.id}/versions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            notes: notes.trim(),
            items: items.map((item) => ({
              ...item,
              prompt: item.prompt.trim(),
              guidance: item.guidance.trim(),
            })),
          }),
        },
      );
      const data = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };
      if (!response.ok) {
        toast.error(data.message ?? "Gagal menerbitkan versi.");
        return;
      }
      toast.success(data.message ?? "Versi baru diterbitkan.");
      onClose();
      onPublished();
    } catch {
      toast.error("Gagal menerbitkan versi. Periksa koneksi lalu coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!saving}
      title={`Terbitkan versi ${template.currentVersion + 1}`}
      description="Versi baru hanya berlaku untuk checklist yang dibuat setelah diterbitkan. Checklist lama tetap memakai versi sebelumnya."
      size="xl"
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
            {saving ? <Spinner /> : <ClipboardList aria-hidden="true" />}
            {saving ? "Menerbitkan…" : "Terbitkan versi"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="version-notes">Catatan versi</Label>
          <Input
            id="version-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={500}
            placeholder="Contoh: Menambah item pemeriksaan APAR"
          />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-foreground">Item checklist</p>
          <TemplateItemEditor
            items={items}
            onChange={setItems}
            disabled={saving}
          />
        </div>
      </div>
    </Modal>
  );
}
