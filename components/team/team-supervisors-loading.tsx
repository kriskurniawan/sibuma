"use client";

import { createContext, useContext, useMemo, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus, Search, ShieldCheck, UserPlus, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { DataLoadError } from "@/components/data-load-error";
import { MobileFab } from "@/components/mobile-fab";
import { MobileSummary } from "@/components/mobile-summary";
import { Modal } from "@/components/modal";
import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { Alert, AlertDescription } from "@/components/reui/alert";
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from "@/components/reui/frame";
import { SupervisorsGrid } from "@/components/supervisors/supervisors-grid";
import { EmptyState, FieldError, PageHeader, StatCard } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { TeamCountSkeleton, TeamListSkeleton } from "@/components/team/team-page-shell";
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
const EMPTY_FORM: SupervisorForm = { name: "", nik: "", phone: "", email: "", accessMode: "full" };
interface SupervisorState {
  search: string;
  openAdd: () => void;
  openEdit: (row: SupervisorRow) => void;
}
const SupervisorContext = createContext<SupervisorState | null>(null);

function supervisorTotals(rows: SupervisorRow[]) {
  return { supervisors: rows.length, teams: rows.filter((row) => row.teamCount > 0).length, divisions: rows.reduce((sum, row) => sum + row.divisionCount, 0) };
}

export function TeamSupervisorsSummary({ rows, failed = false }: { rows?: SupervisorRow[]; failed?: boolean }) {
  const totals = rows ? supervisorTotals(rows) : undefined;
  const value = (number?: number) => number === undefined ? failed ? "—" : <Skeleton className="inline-block h-7 w-12 align-middle" /> : number;
  return <>
    <MobileSummary columns={3} className="md:hidden" items={[
      { label: "Atasan", value: value(totals?.supervisors), tone: "primary" },
      { label: "Tim berjalan", value: value(totals?.teams), tone: "primary" },
      { label: "Divisi", value: value(totals?.divisions), tone: "info" },
    ]} />
    <div className="hidden gap-3 md:grid md:grid-cols-3">
      <StatCard label="Akun atasan" value={value(totals?.supervisors)} icon={ShieldCheck} helper="Seluruh atasan terdaftar" tone="primary" />
      <StatCard label="Tim berjalan" value={value(totals?.teams)} icon={UsersRound} helper="Atasan dengan anggota" tone="primary" />
      <StatCard label="Divisi" value={value(totals?.divisions)} icon={Building2} helper="Divisi yang dikelola atasan" tone="info" />
    </div>
  </>;
}

export function TeamSupervisorsCount({ rows }: { rows: SupervisorRow[] }) {
  const state = useContext(SupervisorContext);
  const filtered = filterSupervisors(rows, state?.search ?? "");
  return <>{filtered.length} dari {rows.length}</>;
}

function filterSupervisors(rows: SupervisorRow[], search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return rows;
  return rows.filter((row) => [row.employee.name, row.employee.nik, row.employee.phone, row.employee.email ?? ""].some((value) => value.toLowerCase().includes(query)));
}

export function TeamSupervisorsRows({ rows }: { rows: SupervisorRow[] }) {
  const state = useContext(SupervisorContext);
  const filtered = useMemo(() => filterSupervisors(rows, state?.search ?? ""), [rows, state?.search]);
  if (!state) return null;
  if (rows.length === 0) return <EmptyState icon={UsersRound} title="Belum ada akun atasan" description="Buat akun atasan pertama agar operasional tim dapat berjalan." action={<Button type="button" size="sm" onClick={state.openAdd}><Plus aria-hidden="true" />Tambah atasan</Button>} />;
  if (filtered.length === 0) return <EmptyState icon={Search} title="Tidak ada atasan yang cocok" description="Ubah kata kunci untuk menemukan akun lain." action={<Button type="button" size="sm" variant="outline" onClick={() => document.getElementById("team-supervisor-search")?.focus()}>Ubah pencarian</Button>} />;
  return <SupervisorsGrid rows={filtered} onEdit={state.openEdit} />;
}

/** Shared super-admin shell: add/edit dialogs do not wait for the list query. */
export function TeamSupervisorsLoading({ error = false, summary, count, children }: {
  error?: boolean;
  summary?: ReactNode;
  count?: ReactNode;
  children?: ReactNode;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<SupervisorRow | null>(null);
  const [form, setForm] = useState<SupervisorForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function openAdd() { setEditing(null); setForm(EMPTY_FORM); setErrors({}); setServerError(null); setAddOpen(true); }
  function openEdit(row: SupervisorRow) {
    setEditing(row);
    setForm({ name: row.employee.name, nik: row.employee.nik, phone: row.employee.phone, email: row.employee.email ?? "", accessMode: row.employee.accessMode });
    setErrors({}); setServerError(null); setAddOpen(true);
  }
  function closeModal() { if (saving) return; setAddOpen(false); setEditing(null); setErrors({}); setServerError(null); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: Record<string, string | undefined> = {};
    if (form.name.trim().length < 3) nextErrors.name = "Nama minimal 3 karakter.";
    if (form.nik.trim().length < 3) nextErrors.nik = "NIK minimal 3 karakter.";
    if (form.phone.trim().length < 8) nextErrors.phone = "Nomor HP minimal 8 digit.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) nextErrors.email = "Masukkan email yang valid untuk OTP cadangan.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSaving(true); setServerError(null);
    try {
      const response = await fetch(editing ? `/api/supervisors/${editing.employee.id}` : "/api/supervisors", {
        method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name.trim(), nik: form.nik.trim(), phone: form.phone.trim(), email: form.email.trim().toLowerCase(), accessMode: form.accessMode }),
      });
      const data = await response.json() as { ok: boolean; message?: string };
      if (!response.ok || !data.ok) { setServerError(data.message ?? "Gagal menyimpan akun atasan."); return; }
      toast.success(data.message ?? (editing ? "Akun atasan tersimpan." : "Akun atasan dibuat."));
      setAddOpen(false); setEditing(null); setErrors({}); setServerError(null);
      startTransition(() => router.refresh());
    } catch { setServerError("Tidak dapat menghubungi server. Periksa koneksimu."); }
    finally { setSaving(false); }
  }

  return <SupervisorContext.Provider value={{ search, openAdd, openEdit }}>
    <div className="flex min-w-0 flex-col gap-6 lg:gap-8">
      <PageHeader mobileCompact eyebrow="Administrasi organisasi" title="Akun atasan." description="Kelola akun dan hak akses atasan." descriptionClassName="hidden md:block" action={
        <div className="max-md:hidden"><Button type="button" size="sm" onClick={openAdd}><UserPlus aria-hidden="true" />Tambah atasan</Button></div>
      } />
      {summary ?? <TeamSupervisorsSummary />}
      <Frame spacing="default" className="min-w-0">
        <FrameHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-0.5"><FrameTitle className="max-md:sr-only">Daftar atasan</FrameTitle><FrameDescription className="text-xs">{count ?? <TeamCountSkeleton />} akun ditampilkan.</FrameDescription></div>
          <InputGroup className="w-full sm:w-72"><InputGroupAddon><Search aria-hidden="true" /></InputGroupAddon><InputGroupInput id="team-supervisor-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama, NIK, atau kontak…" aria-label="Cari atasan" /></InputGroup>
        </FrameHeader>
        <FramePanel className="p-0">{error ? <DataLoadError message="Daftar atasan belum dapat dimuat." /> : children ?? <TeamListSkeleton kind="atasan" />}</FramePanel>
      </Frame>
      <MobileFab onClick={openAdd}><UserPlus aria-hidden="true" />Tambah atasan</MobileFab>
      <Modal open={addOpen} onClose={closeModal} title={editing ? "Ubah akun atasan" : "Tambah akun atasan"} description={editing ? `${editing.employee.name} · ${editing.employee.nik}` : "WhatsApp dan email terdaftar digunakan untuk login."} size="md" dismissible={!saving} footer={
        <div className="flex w-full gap-2"><Button type="button" variant="outline" onClick={closeModal} disabled={saving} className="flex-1">Batal</Button><Button type="submit" form="team-supervisor-form" disabled={saving} className="flex-1">{saving ? <><Spinner />Menyimpan…</> : editing ? "Simpan" : <><UserPlus aria-hidden="true" />Buat akun</>}</Button></div>
      }>
        <form id="team-supervisor-form" onSubmit={submit} className="flex flex-col gap-4">
          {serverError && <Alert variant="destructive"><AlertDescription>{serverError}</AlertDescription></Alert>}
          {editing && <><AvatarUploader key={editing.employee.id} employeeId={editing.employee.id} name={editing.employee.name} avatarKey={editing.employee.avatarKey} endpoint={`/api/supervisors/${editing.employee.id}/avatar`} onChanged={() => startTransition(() => router.refresh())} disabled={saving} /><Separator /></>}
          {([
            { key: "name", label: "Nama lengkap", placeholder: "Contoh: Budi Santoso", autoComplete: "name" },
            { key: "nik", label: "NIK / ID karyawan", placeholder: "Contoh: BMBI-2024-001" },
            { key: "phone", label: "Nomor WhatsApp", placeholder: "08xxxxxxxxxx", autoComplete: "tel" },
            { key: "email", label: "Email", placeholder: "nama@perusahaan.com", autoComplete: "email" },
          ] as const).map((field) => <div key={field.key} className="flex flex-col gap-2">
            <Label htmlFor={`team-supervisor-${field.key}`}>{field.label} <span className="text-destructive">*</span></Label>
            <Input id={`team-supervisor-${field.key}`} type={field.key === "email" ? "email" : "text"} inputMode={field.key === "phone" ? "tel" : undefined} autoComplete={"autoComplete" in field ? field.autoComplete : undefined} value={form[field.key]} onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))} aria-invalid={Boolean(errors[field.key])} placeholder={field.placeholder} />
            <FieldError>{errors[field.key]}</FieldError>
          </div>)}
          <div className="flex flex-col gap-2"><Label htmlFor="team-supervisor-access-mode">Hak akses</Label>
            <Select items={ACCESS_MODE_LABEL} value={form.accessMode} onValueChange={(value) => { if (value !== null) setForm((current) => ({ ...current, accessMode: value as AccessMode })); }}>
              <SelectTrigger id="team-supervisor-access-mode" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="full">{ACCESS_MODE_LABEL.full}</SelectItem><SelectItem value="read_only">{ACCESS_MODE_LABEL.read_only}</SelectItem></SelectContent>
            </Select>
            <p className="text-xs leading-relaxed text-muted-foreground">{form.accessMode === "read_only" ? "Pengamat lintas tim: dapat melihat seluruh data operasional perusahaan; perubahan dinonaktifkan kecuali membuat QR area." : "Mengelola SPKL, tim, absensi, dan checklist tim sendiri."}</p>
          </div>
        </form>
      </Modal>
    </div>
  </SupervisorContext.Provider>;
}
