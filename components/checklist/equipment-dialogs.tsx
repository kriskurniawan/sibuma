"use client";

import { useEffect, useState } from "react";
import { PlusCircle, ShieldCheck, Wrench } from "lucide-react";
import { toast } from "sonner";
import { DatePicker } from "@/components/date-picker";
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
  CHECKLIST_EQUIPMENT_ACTIVITY_LABEL,
  type ChecklistEquipmentActivity,
  type ChecklistEquipmentListItem,
  type ChecklistEquipmentMaintenance,
} from "@/lib/checklist-types";
import type { ChecklistLocationOption } from "@/lib/checklist-location-path";
import { todayLocal } from "@/lib/time";

const ACTIVITY_ITEMS = (
  Object.keys(
    CHECKLIST_EQUIPMENT_ACTIVITY_LABEL,
  ) as ChecklistEquipmentActivity[]
).map((value) => ({
  value,
  label: CHECKLIST_EQUIPMENT_ACTIVITY_LABEL[value],
}));

const COMMON_COMPONENTS = ["Aki", "Oli", "Coolant", "BBM"];

export function EquipmentFormDialog({
  open,
  onClose,
  equipment,
  locations,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  equipment: ChecklistEquipmentListItem | null;
  locations: ChecklistLocationOption[];
  onSaved: () => void;
}) {
  const [locationId, setLocationId] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [publicEnabled, setPublicEnabled] = useState(false);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLocationId(equipment?.locationId ?? locations[0]?.id ?? "");
    setCode(equipment?.code ?? "");
    setName(equipment?.name ?? "");
    setCategory(equipment?.category ?? "");
    setPublicEnabled(equipment?.publicEnabled ?? false);
    setActive(equipment?.active ?? true);
  }, [open, equipment, locations]);

  const locationItems = locations.map((location) => ({
    value: location.id,
    label: location.path ?? location.name,
  }));
  if (
    equipment &&
    !locationItems.some((item) => item.value === equipment.locationId)
  ) {
    locationItems.unshift({
      value: equipment.locationId,
      label: `${equipment.locationPath} (nonaktif)`,
    });
  }

  async function submit() {
    if (!locationId) {
      toast.error("Pilih lokasi peralatan.");
      return;
    }
    if (code.trim().length < 2) {
      toast.error("Kode peralatan minimal 2 karakter.");
      return;
    }
    if (name.trim().length < 2) {
      toast.error("Nama peralatan minimal 2 karakter.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(
        equipment
          ? `/api/checklist/equipment/${equipment.id}`
          : "/api/checklist/equipment",
        {
          method: equipment ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            locationId,
            code: code.trim(),
            name: name.trim(),
            category: category.trim(),
            publicEnabled,
            ...(equipment ? { active } : {}),
          }),
        },
      );
      const data = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };
      if (!response.ok) {
        toast.error(data.message ?? "Gagal menyimpan peralatan.");
        return;
      }
      toast.success(
        equipment ? "Peralatan diperbarui." : "Peralatan ditambahkan.",
      );
      onClose();
      onSaved();
    } catch {
      toast.error("Gagal menyimpan peralatan. Periksa koneksi lalu coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!saving}
      title={equipment ? "Ubah peralatan" : "Peralatan baru"}
      description="Kode menjadi identitas tetap unit pada riwayat perawatan."
      size="sm"
      footer={
        <div className="flex w-full gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={saving}
            className="flex-1"
          >
            Batal
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={submit}
            disabled={saving || !locationId}
            className="flex-1"
          >
            {saving ? <Spinner /> : <Wrench aria-hidden="true" />}
            {saving ? "Menyimpan…" : "Simpan"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="equipment-location">Lokasi</Label>
          <Select
            value={locationId}
            onValueChange={(value) => setLocationId(value as string)}
            items={locationItems}
          >
            <SelectTrigger id="equipment-location" className="w-full">
              <SelectValue placeholder="Pilih lokasi" />
            </SelectTrigger>
            <SelectContent>
              {locationItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {locationItems.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Belum ada lokasi aktif. Tambahkan lokasi terlebih dahulu.
            </p>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="equipment-code">Kode unit</Label>
            <Input
              id="equipment-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              maxLength={40}
              placeholder="Contoh: GNS-01"
              autoCapitalize="characters"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="equipment-category">Kategori (opsional)</Label>
            <Input
              id="equipment-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              maxLength={60}
              placeholder="Contoh: Genset"
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="equipment-name">Nama peralatan</Label>
          <Input
            id="equipment-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={100}
            placeholder="Contoh: Genset 1"
          />
        </div>
        <div className="flex flex-col gap-3 border-y border-border/70 py-3">
          <Label className="flex items-center gap-2 text-sm font-normal text-foreground">
            <Checkbox
              checked={publicEnabled}
              onCheckedChange={(checked) => setPublicEnabled(checked === true)}
            />
            Tampilkan peralatan dan riwayat publiknya
          </Label>
          <p className="text-xs text-muted-foreground">
            Hanya tampil bila area juga dipublikasikan. Identitas petugas tidak
            pernah dikirim ke halaman pengunjung.
          </p>
          {equipment && (
            <Label className="flex items-center gap-2 text-sm font-normal text-foreground">
              <Checkbox
                checked={active}
                onCheckedChange={(checked) => setActive(checked === true)}
              />
              Peralatan aktif
            </Label>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function MaintenanceFormDialog({
  open,
  onClose,
  equipmentId,
  equipmentName,
  maintenance,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  equipmentId: string;
  equipmentName: string;
  maintenance: ChecklistEquipmentMaintenance | null;
  onSaved: () => void;
}) {
  const [activity, setActivity] =
    useState<ChecklistEquipmentActivity>("penggantian");
  const [component, setComponent] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [hourMeter, setHourMeter] = useState("");
  const [performedDate, setPerformedDate] = useState("");
  const [description, setDescription] = useState("");
  const [publicVisible, setPublicVisible] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setActivity(maintenance?.activity ?? "penggantian");
    setComponent(maintenance?.component ?? "");
    setQuantity(
      maintenance?.quantity === null || maintenance?.quantity === undefined
        ? ""
        : String(maintenance.quantity),
    );
    setUnit(maintenance?.unit ?? "");
    setHourMeter(
      maintenance?.hourMeter === null || maintenance?.hourMeter === undefined
        ? ""
        : String(maintenance.hourMeter),
    );
    setPerformedDate(maintenance?.performedDate ?? todayLocal());
    setDescription(maintenance?.description ?? "");
    setPublicVisible(maintenance?.publicVisible ?? true);
  }, [open, maintenance]);

  async function submit() {
    if (component.trim().length === 0) {
      toast.error("Komponen atau bahan wajib diisi.");
      return;
    }
    const quantityValue =
      quantity.trim() === ""
        ? null
        : Number(quantity.trim().replace(",", "."));
    if (
      quantityValue !== null &&
      (!Number.isFinite(quantityValue) || quantityValue <= 0)
    ) {
      toast.error("Jumlah harus lebih dari 0.");
      return;
    }
    const hourMeterValue =
      hourMeter.trim() === "" ? null : Number(hourMeter.trim());
    if (
      hourMeterValue !== null &&
      (!Number.isInteger(hourMeterValue) || hourMeterValue < 0)
    ) {
      toast.error("Hour meter harus bilangan bulat dan tidak negatif.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(performedDate)) {
      toast.error("Pilih tanggal pelaksanaan.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(
        maintenance
          ? `/api/checklist/equipment/${equipmentId}/maintenance/${maintenance.id}`
          : `/api/checklist/equipment/${equipmentId}/maintenance`,
        {
          method: maintenance ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            activity,
            component: component.trim(),
            quantity: quantityValue,
            unit: unit.trim(),
            hourMeter: hourMeterValue,
            performedDate,
            description: description.trim(),
            publicVisible,
          }),
        },
      );
      const data = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };
      if (!response.ok) {
        toast.error(data.message ?? "Gagal menyimpan riwayat perawatan.");
        return;
      }
      toast.success(
        maintenance
          ? "Riwayat perawatan diperbarui."
          : "Riwayat perawatan dicatat.",
      );
      onClose();
      onSaved();
    } catch {
      toast.error(
        "Gagal menyimpan riwayat perawatan. Periksa koneksi lalu coba lagi.",
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
      title={maintenance ? "Ubah riwayat perawatan" : "Catat perawatan"}
      description={equipmentName}
      size="md"
      footer={
        <div className="flex w-full gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={saving}
            className="flex-1"
          >
            Batal
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={submit}
            disabled={saving}
            className="flex-1"
          >
            {saving ? <Spinner /> : <PlusCircle aria-hidden="true" />}
            {saving ? "Menyimpan…" : "Simpan"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="maintenance-activity">Aktivitas</Label>
            <Select
              value={activity}
              onValueChange={(value) =>
                setActivity(value as ChecklistEquipmentActivity)
              }
              items={ACTIVITY_ITEMS}
            >
              <SelectTrigger id="maintenance-activity" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTIVITY_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="maintenance-date">Tanggal pelaksanaan</Label>
            <DatePicker
              id="maintenance-date"
              value={performedDate}
              onChange={setPerformedDate}
              placeholder="Pilih tanggal"
              ariaLabel="Tanggal pelaksanaan"
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="maintenance-component">Komponen atau bahan</Label>
          <Input
            id="maintenance-component"
            value={component}
            onChange={(event) => setComponent(event.target.value)}
            maxLength={80}
            placeholder="Contoh: Aki, oli mesin, coolant"
          />
          <div className="flex flex-wrap gap-1.5">
            {COMMON_COMPONENTS.map((item) => (
              <Button
                key={item}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setComponent(item)}
              >
                {item}
              </Button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="maintenance-quantity">Jumlah</Label>
            <Input
              id="maintenance-quantity"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              placeholder="0"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="maintenance-unit">Satuan</Label>
            <Input
              id="maintenance-unit"
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              maxLength={20}
              placeholder="Liter"
            />
          </div>
          <div className="col-span-2 flex flex-col gap-2 sm:col-span-1">
            <Label htmlFor="maintenance-hour-meter">Hour meter</Label>
            <Input
              id="maintenance-hour-meter"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={hourMeter}
              onChange={(event) => setHourMeter(event.target.value)}
              placeholder="Opsional"
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="maintenance-description">Uraian (opsional)</Label>
          <Textarea
            id="maintenance-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            maxLength={1_000}
            placeholder="Contoh: Ganti oli mesin dan filter, cek kebocoran."
          />
        </div>
        <div className="flex flex-col gap-3 border-t border-border/70 pt-3">
          <Label className="flex items-center gap-2 text-sm font-normal text-foreground">
            <Checkbox
              checked={publicVisible}
              onCheckedChange={(checked) =>
                setPublicVisible(checked === true)
              }
            />
            Tampilkan catatan ini ke pengunjung
          </Label>
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            Identitas petugas tetap tersimpan untuk pengelola dan tidak tampil
            ke pengunjung.
          </p>
        </div>
      </div>
    </Modal>
  );
}
