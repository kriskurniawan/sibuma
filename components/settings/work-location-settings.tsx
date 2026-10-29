"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MapPin, MapPinned, Pencil, Plus } from "lucide-react";
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
import {
  LocationPicker,
  type LocationValue,
} from "@/components/maps/location-picker";
import { Modal } from "@/components/modal";
import { Badge, EmptyState, FieldError } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import type { WorkLocation } from "@/lib/types";

interface LocationForm {
  name: string;
  active: boolean;
  value: LocationValue;
}

const MIN_RADIUS_METERS = 25;
const MAX_RADIUS_METERS = 1_000;

function defaultRadius(value: number) {
  return Math.max(
    MIN_RADIUS_METERS,
    Math.min(MAX_RADIUS_METERS, Math.round(value || 120)),
  );
}

function formValue(location: WorkLocation): LocationForm {
  return {
    name: location.name,
    active: location.active,
    value: {
      latitude: location.latitude,
      longitude: location.longitude,
      address: location.address,
      radiusMeters: location.radiusMeters,
    },
  };
}

export function WorkLocationSettings({
  locations,
  defaultCenter,
  defaultRadiusMeters,
}: {
  locations: WorkLocation[];
  defaultCenter: { latitude: number; longitude: number };
  defaultRadiusMeters: number;
}) {
  const router = useRouter();
  const [items, setItems] = useState(locations);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WorkLocation | null>(null);
  const [form, setForm] = useState<LocationForm>({
    name: "",
    active: true,
    value: {
      latitude: defaultCenter.latitude,
      longitude: defaultCenter.longitude,
      address: "",
      radiusMeters: defaultRadius(defaultRadiusMeters),
    },
  });
  const [nameError, setNameError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    setItems(locations);
  }, [locations]);

  function openCreate() {
    setEditing(null);
    setForm({
      name: "",
      active: true,
      value: {
        latitude: defaultCenter.latitude,
        longitude: defaultCenter.longitude,
        address: "",
        radiusMeters: defaultRadius(defaultRadiusMeters),
      },
    });
    setNameError(undefined);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(location: WorkLocation) {
    setEditing(location);
    setForm(formValue(location));
    setNameError(undefined);
    setError(null);
    setDialogOpen(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNameError(undefined);

    const name = form.name.trim();
    if (name.length < 2) {
      setNameError("Nama titik lokasi minimal 2 karakter.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(
        editing ? `/api/work-locations/${editing.id}` : "/api/work-locations",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            address: form.value.address.trim().slice(0, 240),
            latitude: form.value.latitude,
            longitude: form.value.longitude,
            radiusMeters: form.value.radiusMeters,
            active: form.active,
          }),
        },
      );
      const data = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };
      if (!response.ok || !data.ok) {
        setError(data.message ?? "Gagal menyimpan titik absensi.");
        return;
      }
      toast.success(
        editing ? "Titik absensi diperbarui." : "Titik absensi ditambahkan.",
      );
      setDialogOpen(false);
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server. Periksa koneksimu.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(location: WorkLocation) {
    setPendingId(location.id);
    try {
      const response = await fetch(`/api/work-locations/${location.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !location.active }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };
      if (!response.ok || !data.ok) {
        toast.error(data.message ?? "Gagal mengubah status titik absensi.");
        return;
      }
      setItems((current) =>
        current.map((item) =>
          item.id === location.id
            ? { ...item, active: !location.active }
            : item,
        ),
      );
      toast.success(
        location.active ? "Titik absensi dinonaktifkan." : "Titik absensi diaktifkan.",
      );
      router.refresh();
    } catch {
      toast.error("Gagal mengubah status. Periksa koneksi lalu coba lagi.");
    } finally {
      setPendingId(null);
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
                <MapPinned />
              </IconTile>
              <div className="flex min-w-0 flex-col gap-0.5">
                <FrameTitle>Titik lokasi absensi</FrameTitle>
              </div>
            </div>
            <Button type="button" size="sm" onClick={openCreate}>
              <Plus aria-hidden="true" />
              Tambah titik
            </Button>
          </div>
          <FrameDescription className="hidden md:block">
            Setiap titik punya radius absen sendiri. Atasan hanya dapat memilih
            titik aktif dari daftar ini saat membuat SPKL. Titik nonaktif tetap
            tersimpan pada riwayat.
          </FrameDescription>
        </FrameHeader>

        <FramePanel className="p-0">
          {items.length === 0 ? (
            <EmptyState
              icon={MapPinned}
              title="Belum ada titik absensi"
              description="Tambahkan minimal satu titik agar SPKL dapat dibuat dan absensi diverifikasi."
              action={
                <Button type="button" size="sm" onClick={openCreate}>
                  <Plus aria-hidden="true" />
                  Tambah titik
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-border/70">
              {items.map((location) => (
                <li
                  key={location.id}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <IconTile
                      variant="outline"
                      size="sm"
                      className="mt-0.5 text-muted-foreground"
                      aria-hidden="true"
                    >
                      <MapPin />
                    </IconTile>
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-sm font-medium text-foreground">
                          {location.name}
                        </p>
                        <Badge
                          variant={
                            location.active ? "success-light" : "warning-light"
                          }
                        >
                          {location.active ? "Aktif" : "Nonaktif"}
                        </Badge>
                      </div>
                      {location.address && (
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {location.address}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {location.latitude.toFixed(5)},{" "}
                        {location.longitude.toFixed(5)} · Radius{" "}
                        {location.radiusMeters} m
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 pl-11 sm:pl-0">
                    <Label
                      htmlFor={`work-location-active-${location.id}`}
                      className="hidden text-xs font-normal text-muted-foreground sm:block"
                    >
                      Aktif
                    </Label>
                    <Switch
                      id={`work-location-active-${location.id}`}
                      aria-label={`Titik ${location.name} aktif`}
                      checked={location.active}
                      disabled={pendingId !== null}
                      onCheckedChange={() => toggleActive(location)}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => openEdit(location)}
                      aria-label={`Ubah titik ${location.name}`}
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
        title={editing ? "Ubah titik absensi" : "Titik absensi baru"}
        description="Tentukan koordinat dan radius absen titik ini. Atasan memilih titik tersebut saat membuat SPKL."
        size="lg"
        footer={
          <>
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
              form="work-location-form"
              disabled={saving}
            >
              {saving ? <Spinner /> : <MapPinned aria-hidden="true" />}
              {saving ? "Menyimpan…" : "Simpan"}
            </Button>
          </>
        }
      >
        <form
          id="work-location-form"
          onSubmit={submit}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="work-location-name">Nama titik</Label>
            <Input
              id="work-location-name"
              value={form.name}
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  name: event.target.value,
                }));
                setNameError(undefined);
              }}
              maxLength={80}
              placeholder="Contoh: Kantor Pusat — Lobi"
              aria-invalid={Boolean(nameError)}
              autoFocus
            />
            <FieldError>{nameError}</FieldError>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              Koordinat & alamat
            </p>
            <LocationPicker
              value={form.value}
              onChange={(value) =>
                setForm((current) => ({ ...current, value }))
              }
              showRadius
            />
          </div>

          {editing && (
            <div className="flex items-start justify-between gap-3 border-t border-border/70 pt-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <Label htmlFor="work-location-active">Titik aktif</Label>
                <p className="text-xs text-muted-foreground">
                  Hanya titik aktif yang bisa dipilih untuk SPKL baru. SPKL lama
                  tetap memakai titiknya.
                </p>
              </div>
              <Switch
                id="work-location-active"
                checked={form.active}
                onCheckedChange={(checked) =>
                  setForm((current) => ({ ...current, active: checked }))
                }
              />
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </form>
      </Modal>
    </>
  );
}
