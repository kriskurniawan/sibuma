"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Plus,
  Search,
  ShieldCheck,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/modal";
import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { Alert, AlertDescription } from "@/components/reui/alert";
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { SupervisorsGrid } from "@/components/supervisors/supervisors-grid";
import {
  EmptyState,
  FieldError,
  PageHeader,
  StatCard,
} from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { ACCESS_MODE_LABEL } from "@/lib/constants";
import type { SupervisorRow } from "@/lib/supervisor-queries";
import type { AccessMode } from "@/lib/types";

interface SupervisorForm {
  name: string;
  nik: string;
  phone: string;
  email: string;
  accessMode: AccessMode;
}

const EMPTY_FORM: SupervisorForm = {
  name: "",
  nik: "",
  phone: "",
  email: "",
  accessMode: "full",
};

export function SupervisorsView({ rows }: { rows: SupervisorRow[] }) {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<SupervisorRow | null>(null);
  const [form, setForm] = useState<SupervisorForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      [
        row.employee.name,
        row.employee.nik,
        row.employee.phone,
        row.employee.email ?? "",
      ].some((value) => value.toLowerCase().includes(query)),
    );
  }, [rows, search]);

  const totals = useMemo(
    () => ({
      supervisors: rows.length,
      teams: rows.filter((row) => row.teamCount > 0).length,
      divisions: rows.reduce((sum, row) => sum + row.divisionCount, 0),
    }),
    [rows],
  );

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setServerError(null);
    setAddOpen(true);
  }

  function openEdit(row: SupervisorRow) {
    setEditing(row);
    setForm({
      name: row.employee.name,
      nik: row.employee.nik,
      phone: row.employee.phone,
      email: row.employee.email ?? "",
      accessMode: row.employee.accessMode,
    });
    setErrors({});
    setServerError(null);
    setAddOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setAddOpen(false);
    setEditing(null);
    setErrors({});
    setServerError(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: Record<string, string | undefined> = {};
    if (form.name.trim().length < 3) nextErrors.name = "Nama minimal 3 karakter.";
    if (form.nik.trim().length < 3) nextErrors.nik = "NIK minimal 3 karakter.";
    if (form.phone.trim().length < 8) nextErrors.phone = "Nomor HP minimal 8 digit.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      nextErrors.email = "Masukkan email yang valid untuk OTP cadangan.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    setServerError(null);
    try {
      const response = await fetch(
        editing ? `/api/supervisors/${editing.employee.id}` : "/api/supervisors",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            nik: form.nik.trim(),
            phone: form.phone.trim(),
            email: form.email.trim().toLowerCase(),
            accessMode: form.accessMode,
          }),
        },
      );
      const data = (await response.json()) as {
        ok: boolean;
        message?: string;
      };
      if (!response.ok || !data.ok) {
        setServerError(data.message ?? "Gagal menyimpan akun atasan.");
        return;
      }
      toast.success(
        data.message ??
          (editing ? "Akun atasan tersimpan." : "Akun atasan dibuat."),
      );
      closeModal();
      startTransition(() => router.refresh());
    } catch {
      setServerError("Tidak dapat menghubungi server. Periksa koneksimu.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        eyebrow="Administrasi organisasi"
        title="Akun atasan."
        description="Buat dan perbarui akun atasan. Setiap atasan mengelola tim, divisi, SPKL, dan checklist miliknya sendiri."
        action={
          <Button type="button" onClick={openAdd}>
            <UserPlus aria-hidden="true" />
            Tambah atasan
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Akun atasan"
          value={totals.supervisors}
          icon={ShieldCheck}
          helper="Seluruh atasan terdaftar"
          tone="primary"
        />
        <StatCard
          label="Tim berjalan"
          value={totals.teams}
          icon={UsersRound}
          helper="Atasan dengan anggota"
          tone="success"
        />
        <StatCard
          label="Divisi"
          value={totals.divisions}
          icon={Building2}
          helper="Divisi yang dikelola atasan"
          tone="info"
        />
      </div>

      <Frame>
        <FrameHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-0.5">
            <FrameTitle>Daftar atasan</FrameTitle>
            <FrameDescription className="text-xs">
              {filtered.length} dari {totals.supervisors} akun ditampilkan.
            </FrameDescription>
          </div>
          <InputGroup className="w-full sm:w-72">
            <InputGroupAddon>
              <Search aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama, NIK, atau kontak…"
              aria-label="Cari atasan"
            />
          </InputGroup>
        </FrameHeader>

        <FramePanel className="p-0">
          {rows.length === 0 ? (
            <EmptyState
              icon={UsersRound}
              title="Belum ada akun atasan"
              description="Buat akun atasan pertama agar operasional tim dapat berjalan."
              action={
                <Button type="button" onClick={openAdd}>
                  <Plus aria-hidden="true" />
                  Tambah atasan
                </Button>
              }
            />
          ) : (
            <div
              className={isRefreshing ? "pointer-events-none opacity-70" : undefined}
              aria-busy={isRefreshing}
            >
              <SupervisorsGrid rows={filtered} onEdit={openEdit} />
            </div>
          )}
        </FramePanel>
      </Frame>

      <Modal
        open={addOpen}
        onClose={closeModal}
        title={editing ? "Ubah akun atasan" : "Tambah akun atasan"}
        description={
          editing
            ? `${editing.employee.name} · ${editing.employee.nik}`
            : "Atasan dapat langsung masuk dengan WhatsApp atau email terdaftar setelah akun dibuat."
        }
        size="md"
        dismissible={!saving}
        footer={
          <div className="flex w-full gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={closeModal}
              disabled={saving}
              className="flex-1"
            >
              Batal
            </Button>
            <Button
              type="submit"
              form="supervisor-form"
              disabled={saving}
              className="flex-1"
            >
              {saving ? (
                <>
                  <Spinner />
                  Menyimpan…
                </>
              ) : editing ? (
                "Simpan"
              ) : (
                <>
                  <UserPlus aria-hidden="true" />
                  Buat akun
                </>
              )}
            </Button>
          </div>
        }
      >
        <form
          id="supervisor-form"
          onSubmit={submit}
          className="flex flex-col gap-4"
        >
          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          {editing && (
            <>
              <AvatarUploader
                key={editing.employee.id}
                employeeId={editing.employee.id}
                name={editing.employee.name}
                avatarKey={editing.employee.avatarKey}
                endpoint={`/api/supervisors/${editing.employee.id}/avatar`}
                onChanged={() => startTransition(() => router.refresh())}
                disabled={saving}
              />
              <Separator />
            </>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="supervisor-name">
              Nama lengkap <span className="text-destructive">*</span>
            </Label>
            <Input
              id="supervisor-name"
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              aria-invalid={Boolean(errors.name)}
              placeholder="Contoh: Budi Santoso"
              autoComplete="name"
            />
            <FieldError>{errors.name}</FieldError>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="supervisor-nik">
              NIK / ID karyawan <span className="text-destructive">*</span>
            </Label>
            <Input
              id="supervisor-nik"
              value={form.nik}
              onChange={(event) =>
                setForm((current) => ({ ...current, nik: event.target.value }))
              }
              aria-invalid={Boolean(errors.nik)}
              placeholder="Contoh: BMBI-2024-001"
            />
            <FieldError>{errors.nik}</FieldError>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="supervisor-phone">
                Nomor WhatsApp <span className="text-destructive">*</span>
              </Label>
              <Input
                id="supervisor-phone"
                value={form.phone}
                onChange={(event) =>
                  setForm((current) => ({ ...current, phone: event.target.value }))
                }
                aria-invalid={Boolean(errors.phone)}
                placeholder="08xxxxxxxxxx"
                inputMode="tel"
                autoComplete="tel"
              />
              <FieldError>{errors.phone}</FieldError>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="supervisor-email">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="supervisor-email"
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({ ...current, email: event.target.value }))
                }
                aria-invalid={Boolean(errors.email)}
                placeholder="nama@perusahaan.com"
                autoComplete="email"
              />
              <FieldError>{errors.email}</FieldError>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="supervisor-access-mode">Hak akses</Label>
            <Select
              items={ACCESS_MODE_LABEL}
              value={form.accessMode}
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  accessMode: value as AccessMode,
                }))
              }
            >
              <SelectTrigger
                id="supervisor-access-mode"
                className="w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">
                  {ACCESS_MODE_LABEL.full}
                </SelectItem>
                <SelectItem value="read_only">
                  {ACCESS_MODE_LABEL.read_only}
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {form.accessMode === "read_only"
                ? "Atasan hanya dapat melihat data timnya sendiri. Tambah, ubah, hapus, absensi, checklist, dan unggah foto dinonaktifkan."
                : "Atasan dapat mengelola SPKL, tim, absensi, dan checklist timnya sendiri."}
            </p>
          </div>
        </form>
      </Modal>
    </div>
  );
}
