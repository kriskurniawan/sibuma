"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  ClipboardList,
  MapPin,
  Pencil,
  Plus,
  QrCode,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
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
  emptyTemplateItem,
  validateTemplateDraft,
  type TemplateItemDraft,
} from "@/components/checklist/template-item-editor";
import type {
  ChecklistLocation,
  ChecklistSetup,
} from "@/lib/checklist-types";

export function ChecklistTemplateView({ setup }: { setup: ChecklistSetup }) {
  const router = useRouter();
  const [locationOpen, setLocationOpen] = useState(false);
  const [editingLocation, setEditingLocation] =
    useState<ChecklistLocation | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);

  const locationNames = new Map(
    setup.locations.map((location) => [location.id, location.name]),
  );

  function openLocation(location: ChecklistLocation | null) {
    setEditingLocation(location);
    setLocationOpen(true);
  }

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
        eyebrow="Pengaturan checklist"
        title="Template & lokasi"
        description="Versi template bersifat tetap: hasil pemeriksaan lama tetap memakai item dari versi saat checklist dibuat. Terbitkan versi baru untuk mengubah item."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href="/checklist/qr" />}
            >
              <QrCode aria-hidden="true" />
              QR area
            </Button>
            <Button size="sm" variant="outline" onClick={() => openLocation(null)}>
              <MapPin aria-hidden="true" />
              Lokasi baru
            </Button>
            <Button size="sm" onClick={() => setTemplateOpen(true)}>
              <Plus aria-hidden="true" />
              Template baru
            </Button>
          </div>
        }
      />

      <Frame>
        <FrameHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <FrameTitle>Lokasi</FrameTitle>
            <FrameDescription className="text-xs">
              Area atau titik pemeriksaan. Lokasi nonaktif tidak dapat dipakai
              untuk jadwal baru.
            </FrameDescription>
          </div>
          <Badge variant="outline" className="tabular-nums">
            {setup.locations.length}
          </Badge>
        </FrameHeader>

        <FramePanel className="p-0">
          {setup.locations.length === 0 ? (
            <EmptyState
              icon={MapPin}
              title="Belum ada lokasi"
              description="Tambahkan lokasi seperti gudang, kantor, atau area produksi sebelum membuat jadwal."
              action={
                <Button size="sm" onClick={() => openLocation(null)}>
                  <Plus aria-hidden="true" />
                  Tambah lokasi
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-border/70">
              {setup.locations.map((location) => (
                <li
                  key={location.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5"
                >
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <MapPin className="size-4" aria-hidden="true" />
                    </span>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-sm font-medium text-foreground">
                          {location.name}
                        </p>
                        {!location.active && (
                          <Badge variant="outline" className="text-xs">
                            Nonaktif
                          </Badge>
                        )}
                        {location.publicEnabled && (
                          <Badge variant="success-light" className="text-xs">
                            Publik
                          </Badge>
                        )}
                        {location.parentId && (
                          <Badge variant="outline" className="max-w-40 text-xs">
                            <Building2 aria-hidden="true" />
                            <span className="truncate">
                              {locationNames.get(location.parentId) ??
                                "Induk"}
                            </span>
                          </Badge>
                        )}
                      </div>
                      {location.description && (
                        <p className="max-w-xl truncate text-xs text-muted-foreground">
                          {location.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openLocation(location)}
                  >
                    <Pencil aria-hidden="true" />
                    Ubah
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </FramePanel>
      </Frame>

      <Frame>
        <FrameHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <FrameTitle>Template</FrameTitle>
            <FrameDescription className="text-xs">
              Item pemeriksaan, kebijakan foto, dan kewajiban catatan per template.
            </FrameDescription>
          </div>
          <Badge variant="outline" className="tabular-nums">
            {setup.templates.length}
          </Badge>
        </FrameHeader>

        <FramePanel className="p-0">
          {setup.templates.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Belum ada template"
              description="Template menentukan item pemeriksaan. Buat template pertama lalu terbitkan versinya."
              action={
                <Button size="sm" onClick={() => setTemplateOpen(true)}>
                  <Plus aria-hidden="true" />
                  Buat template
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-border/70">
              {setup.templates.map((template) => {
                const latest = template.versions[0];
                return (
                  <li
                    key={template.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5"
                  >
                    <div className="flex min-w-0 items-start gap-2.5">
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <Settings2 className="size-4" aria-hidden="true" />
                      </span>
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Link
                            href={`/checklist/template/${template.id}`}
                            className="truncate text-sm font-medium text-foreground transition-colors hover:text-primary"
                          >
                            {template.name}
                          </Link>
                          <Badge variant="outline" className="text-xs">
                            {template.category}
                          </Badge>
                          <Badge variant="info-light" className="text-xs">
                            Versi {template.currentVersion}
                          </Badge>
                          {!template.active && (
                            <Badge variant="outline" className="text-xs">
                              Nonaktif
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {latest?.itemCount ?? 0} item ·{" "}
                          {template.usedBySchedules} jadwal
                          {template.description
                            ? ` · ${template.description}`
                            : ""}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      nativeButton={false}
                      render={
                        <Link href={`/checklist/template/${template.id}`} />
                      }
                    >
                      Kelola
                      <ChevronRight aria-hidden="true" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </FramePanel>
      </Frame>

      <LocationDialog
        open={locationOpen}
        onClose={() => setLocationOpen(false)}
        location={editingLocation}
        locations={setup.locations}
        onSaved={() => router.refresh()}
      />

      <TemplateCreateDialog
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        onCreated={(id) => router.push(`/checklist/template/${id}`)}
      />
    </div>
  );
}

function LocationDialog({
  open,
  onClose,
  location,
  locations,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  location: ChecklistLocation | null;
  locations: ChecklistLocation[];
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [publicDescription, setPublicDescription] = useState("");
  const [publicEnabled, setPublicEnabled] = useState(false);
  const [parentId, setParentId] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(location?.name ?? "");
    setDescription(location?.description ?? "");
    setPublicDescription(location?.publicDescription ?? "");
    setPublicEnabled(location?.publicEnabled ?? false);
    setParentId(location?.parentId ?? "");
    setActive(location?.active ?? true);
  }, [open, location]);

  const parentItems = [
    { value: "", label: "Tanpa induk" },
    ...locations
      .filter((item) => item.id !== location?.id)
      .map((item) => ({ value: item.id, label: item.name })),
  ];

  async function submit() {
    if (name.trim().length < 2) {
      toast.error("Nama lokasi minimal 2 karakter.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(
        location
          ? `/api/checklist/locations/${location.id}`
          : "/api/checklist/locations",
        {
          method: location ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim(),
            publicDescription: publicDescription.trim(),
            publicEnabled,
            parentId: parentId || null,
            active,
          }),
        },
      );
      const data = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };
      if (!response.ok) {
        toast.error(data.message ?? "Gagal menyimpan lokasi.");
        return;
      }
      toast.success(location ? "Lokasi diperbarui." : "Lokasi ditambahkan.");
      onClose();
      onSaved();
    } catch {
      toast.error("Gagal menyimpan lokasi. Periksa koneksi lalu coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!saving}
      title={location ? "Ubah lokasi" : "Lokasi baru"}
      description="Lokasi dipakai untuk menandai tempat pemeriksaan pada jadwal."
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
            {saving ? <Spinner /> : <MapPin aria-hidden="true" />}
            {saving ? "Menyimpan…" : "Simpan"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="location-name">Nama lokasi</Label>
          <Input
            id="location-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            placeholder="Contoh: Gudang utama"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="location-description">Keterangan (opsional)</Label>
          <Textarea
            id="location-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            maxLength={300}
            placeholder="Alamat singkat atau patokan lokasi…"
          />
        </div>
        <div className="flex flex-col gap-3 rounded-lg border border-border/70 px-3 py-3">
          <Label className="flex items-center gap-2 text-sm font-normal text-foreground">
            <Checkbox
              checked={publicEnabled}
              onCheckedChange={(checked) => setPublicEnabled(checked === true)}
            />
            Tampilkan area ini ke pengunjung
          </Label>
          <p className="text-xs text-muted-foreground">
            Pengunjung hanya melihat item yang ditandai publik. Catatan, foto,
            dan identitas petugas tetap internal.
          </p>
          {publicEnabled && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="location-public-description">
                Keterangan untuk pengunjung (opsional)
              </Label>
              <Textarea
                id="location-public-description"
                value={publicDescription}
                onChange={(event) =>
                  setPublicDescription(event.target.value)
                }
                rows={2}
                maxLength={300}
                placeholder="Contoh: Lantai 1, dekat lobi utama…"
              />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="location-parent">Lokasi induk (opsional)</Label>
          <Select
            value={parentId}
            onValueChange={(value) => setParentId(value as string)}
            items={parentItems}
          >
            <SelectTrigger id="location-parent" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {parentItems.map((item) => (
                <SelectItem key={item.value || "none"} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {location && (
          <Label className="flex items-center gap-2 text-sm font-normal text-foreground">
            <Checkbox
              checked={active}
              onCheckedChange={(checked) => setActive(checked === true)}
            />
            Lokasi aktif
          </Label>
        )}
      </div>
    </Modal>
  );
}

function TemplateCreateDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<TemplateItemDraft[]>([
    emptyTemplateItem(),
  ]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setCategory("");
    setDescription("");
    setItems([emptyTemplateItem()]);
  }, [open]);

  async function submit() {
    if (name.trim().length < 3) {
      toast.error("Nama template minimal 3 karakter.");
      return;
    }
    if (category.trim().length < 2) {
      toast.error("Kategori minimal 2 karakter.");
      return;
    }
    const itemError = validateTemplateDraft(items);
    if (itemError) {
      toast.error(itemError);
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/checklist/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          category: category.trim(),
          description: description.trim(),
          items: items.map((item) => ({
            ...item,
            prompt: item.prompt.trim(),
            guidance: item.guidance.trim(),
          })),
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        message?: string;
        template?: { id: string };
      };
      if (!response.ok) {
        toast.error(data.message ?? "Gagal membuat template.");
        return;
      }
      toast.success("Template checklist dibuat.");
      onClose();
      if (data.template?.id) onCreated(data.template.id);
    } catch {
      toast.error("Gagal membuat template. Periksa koneksi lalu coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!saving}
      title="Template baru"
      description="Versi 1 langsung diterbitkan dengan item di bawah. Versi yang sudah terbit tidak dapat diubah."
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
            {saving ? "Menyimpan…" : "Buat template"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="template-name">Nama template</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              placeholder="Contoh: Pemeriksaan keamanan gedung"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="template-category">Kategori</Label>
            <Input
              id="template-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              maxLength={60}
              placeholder="Contoh: Keamanan"
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="template-description">Deskripsi (opsional)</Label>
          <Textarea
            id="template-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Tujuan dan cakupan pemeriksaan…"
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
