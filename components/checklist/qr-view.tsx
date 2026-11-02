"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  MapPin,
  Pencil,
  Plus,
  QrCode,
  ScanLine,
} from "lucide-react";
import { toast } from "sonner";
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import {
  Badge,
  EmptyState,
  StatCard,
} from "@/components/ui";
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
import { Modal } from "@/components/modal";
import { useDialogIntent } from "@/hooks/use-dialog-intent";
import { MobileSummary } from "@/components/mobile-summary";
import {
  checklistQrPath,
  type ChecklistLocation,
  type ChecklistQrCode,
  type ChecklistQrMode,
  type ChecklistQrSetup,
} from "@/lib/checklist-types";

type QrRow = ChecklistQrCode & { locationName: string | null };

export function ChecklistQrView({ setup }: { setup: ChecklistQrSetup }) {
  const router = useRouter();
  const [origin, setOrigin] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<QrRow | null>(null);
  const [preview, setPreview] = useState<QrRow | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => setOrigin(window.location.origin), []);

  const activeCount = setup.codes.filter((code) => code.active).length;
  const directCount = setup.codes.filter(
    (code) => code.mode === "langsung",
  ).length;
  const publicLocations = setup.locations.filter(
    (location) => location.publicEnabled && location.active,
  );

  function openForm(code: QrRow | null) {
    setEditing(code);
    setFormOpen(true);
  }

  useDialogIntent("qr-new", () => openForm(null));
  useEffect(() => {
    function openFromHash() {
      if (window.location.hash !== "#qr-baru") return;
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
      setEditing(null);
      setFormOpen(true);
    }
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  function urlFor(code: QrRow) {
    return `${origin}${checklistQrPath(code)}`;
  }

  async function copyLink(code: QrRow) {
    try {
      await navigator.clipboard.writeText(urlFor(code));
      setCopiedId(code.id);
      window.setTimeout(() => setCopiedId(null), 1800);
      toast.success("Tautan QR disalin.");
    } catch {
      toast.error("Gagal menyalin tautan.");
    }
  }

  return (
    <>
      <MobileSummary
        columns={3}
        className="md:hidden"
        items={[
          { label: "QR aktif", value: activeCount, tone: "primary" },
          { label: "QR langsung", value: directCount, tone: "info" },
          { label: "Area publik", value: publicLocations.length, tone: "success" },
        ]}
      />

      <div className="hidden gap-3 md:grid md:grid-cols-3">
        <StatCard
          label="Total QR"
          value={setup.codes.length}
          icon={QrCode}
          helper={`${activeCount} aktif`}
          tone="primary"
        />
        <StatCard
          label="QR area langsung"
          value={directCount}
          icon={ScanLine}
          helper="Langsung membuka satu area"
          tone="info"
        />
        <StatCard
          label="Area publik"
          value={publicLocations.length}
          icon={MapPin}
          helper="Tampil di QR pilih area"
          tone="success"
        />
      </div>

      <Frame spacing="default" className="min-w-0">
        <div className="hidden md:block">
          <FrameHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <FrameTitle>Daftar QR</FrameTitle>
              <FrameDescription className="text-xs">
                Tautan tetap; nonaktifkan QR yang tidak dipakai.
              </FrameDescription>
            </div>
            <Badge variant="outline" className="tabular-nums">
              {setup.codes.length}
            </Badge>
          </FrameHeader>
        </div>

        <FramePanel className="p-0">
          {setup.codes.length === 0 ? (
            <EmptyState
              icon={QrCode}
              title="Belum ada QR"
              description="Buat QR umum untuk memilih area, atau QR khusus yang langsung membuka satu area."
              action={
                <div className="max-md:hidden">
                  <Button type="button" size="sm" onClick={() => openForm(null)}>
                    <Plus aria-hidden="true" />
                    Buat QR pertama
                  </Button>
                </div>
              }
            />
          ) : (
            <ul className="divide-y divide-border/70">
              {setup.codes.map((code) => (
                <li
                  key={code.id}
                  className="flex flex-col gap-3 px-4 py-4 sm:px-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <QrCode className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <div className="flex min-w-0 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-sm font-medium text-foreground">
                            {code.name}
                          </p>
                          <Badge variant="outline" className="text-xs">
                            {code.mode === "langsung"
                              ? "Area langsung"
                              : "Pilih area"}
                          </Badge>
                          {code.mode === "langsung" && code.locationName && (
                            <Badge variant="info-light" className="text-xs">
                              <MapPin aria-hidden="true" />
                              {code.locationName}
                            </Badge>
                          )}
                          {code.active ? (
                            <Badge variant="success-light" className="text-xs">
                              Aktif
                            </Badge>
                          ) : (
                            <Badge variant="warning-light">
                              Nonaktif
                            </Badge>
                          )}
                        </div>
                        <p className="hidden break-all text-xs text-muted-foreground md:block">
                          {urlFor(code) || checklistQrPath(code)}
                        </p>
                      </div>
                    </div>

                    <div className="flex min-w-0 max-w-full items-center gap-1 overflow-x-auto">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => copyLink(code)}
                      >
                        {copiedId === code.id ? (
                          <Check aria-hidden="true" />
                        ) : (
                          <Copy aria-hidden="true" />
                        )}
                        {copiedId === code.id ? "Tersalin" : "Salin"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setPreview(code)}
                      >
                        <QrCode aria-hidden="true" />
                        Pratinjau
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        nativeButton={false}
                        render={
                          <a
                            href={`/api/checklist/qr/${code.id}/image?download=1&v=${encodeURIComponent(code.updatedAt)}`}
                            download
                          />
                        }
                      >
                        <Download aria-hidden="true" />
                        Unduh
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        nativeButton={false}
                        render={
                          <a
                            href={urlFor(code) || checklistQrPath(code)}
                            target="_blank"
                            rel="noopener noreferrer"
                          />
                        }
                      >
                        <ExternalLink aria-hidden="true" />
                        Buka
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => openForm(code)}
                      >
                        <Pencil aria-hidden="true" />
                        Ubah
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </FramePanel>
      </Frame>

      <QrFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        qr={editing}
        locations={setup.locations}
        onSaved={() => {
          setFormOpen(false);
          router.refresh();
        }}
      />

      <Modal
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title={preview?.name ?? "Pratinjau QR"}
        description="Cetak atau tempel QR ini di area terkait. Tautan dapat dipakai ulang."
        size="sm"
      >
        {preview && (
          <div className="flex flex-col items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/checklist/qr/${preview.id}/image?v=${encodeURIComponent(preview.updatedAt)}`}
              alt={`QR ${preview.name}`}
              className="size-64 rounded-lg border border-border bg-white"
            />
            <p className="break-all text-center text-xs text-muted-foreground">
              {urlFor(preview) || checklistQrPath(preview)}
            </p>
          </div>
        )}
      </Modal>
    </>
  );
}

function QrFormDialog({
  open,
  onClose,
  qr,
  locations,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  qr: QrRow | null;
  locations: ChecklistLocation[];
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [mode, setMode] = useState<ChecklistQrMode>("pilih_area");
  const [locationId, setLocationId] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(qr?.name ?? "");
    setMode(qr?.mode ?? "pilih_area");
    setLocationId(qr?.locationId ?? "");
    setActive(qr?.active ?? true);
  }, [open, qr]);

  const modeItems = {
    pilih_area: "Pilih area (QR umum)",
    langsung: "Langsung ke satu area",
  };
  const locationItems = useMemo(
    () =>
      locations
        .filter((location) => location.active)
        .map((location) => ({
          value: location.id,
          label: `${location.path ?? location.name}${
            location.ownerName ? ` · ${location.ownerName}` : ""
          }${location.publicEnabled ? "" : " (belum publik)"}`,
        })),
    [locations],
  );
  const selectedLocation = locations.find(
    (location) => location.id === locationId,
  );

  async function submit() {
    if (name.trim().length < 3) {
      toast.error("Nama QR minimal 3 karakter.");
      return;
    }
    if (mode === "langsung" && !locationId) {
      toast.error("Pilih area tujuan untuk QR langsung.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(
        qr ? `/api/checklist/qr/${qr.id}` : "/api/checklist/qr",
        {
          method: qr ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            mode,
            locationId: mode === "langsung" ? locationId : null,
            active,
          }),
        },
      );
      const data = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };
      if (!response.ok) {
        toast.error(data.message ?? "Gagal menyimpan QR.");
        return;
      }
      toast.success(qr ? "QR diperbarui." : "QR dibuat.");
      onSaved();
    } catch {
      toast.error("Gagal menyimpan QR. Periksa koneksi lalu coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!saving}
      title={qr ? "Ubah QR" : "QR baru"}
      description="QR umum menampilkan pilihan area publik. QR langsung membuka satu area setelah dipindai."
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
            {saving ? <Spinner /> : <QrCode aria-hidden="true" />}
            {saving ? "Menyimpan…" : "Simpan"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="qr-name">Nama QR</Label>
          <Input
            id="qr-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            placeholder="Contoh: Lobi gedung utama"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="qr-mode">Jenis QR</Label>
          <Select
            value={mode}
            onValueChange={(value) => setMode(value as ChecklistQrMode)}
            items={modeItems}
          >
            <SelectTrigger id="qr-mode" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pilih_area">
                Pilih area (QR umum)
              </SelectItem>
              <SelectItem value="langsung">Langsung ke satu area</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {mode === "langsung" && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="qr-location">Area tujuan</Label>
            <Select
              value={locationId}
              onValueChange={(value) => setLocationId(value as string)}
              items={locationItems}
            >
              <SelectTrigger id="qr-location" className="w-full">
                <SelectValue placeholder="Pilih area…" />
              </SelectTrigger>
              <SelectContent>
                {locationItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedLocation && !selectedLocation.publicEnabled && (
              <p className="text-xs text-muted-foreground">
                Area ini belum diaktifkan untuk publik. Aktifkan di Template
                &amp; lokasi agar pengunjung dapat melihat hasilnya.
              </p>
            )}
          </div>
        )}

        {qr && (
          <Label className="flex items-center gap-2 text-sm font-normal text-foreground">
            <Checkbox
              checked={active}
              onCheckedChange={(checked) => setActive(checked === true)}
            />
            QR aktif
          </Label>
        )}
      </div>
    </Modal>
  );
}
