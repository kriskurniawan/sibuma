"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/modal";
import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { Alert, AlertDescription } from "@/components/reui/alert";
import { DataRow, FieldError } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import type { SessionUser } from "@/lib/types";

function phoneLabel(phone: string) {
  if (!phone) return "-";
  if (phone.startsWith("62")) {
    const local = `0${phone.slice(2)}`;
    return `${local.slice(0, 4)}-${local.slice(4, 8)}-${local.slice(8)}`;
  }
  return phone;
}

export function ProfileEditor({ user }: { user: SessionUser }) {
  const router = useRouter();
  const isAdmin = user.role === "super_admin";
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(user.name);
  const [nameError, setNameError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function openModal() {
    setName(user.name);
    setNameError(null);
    setServerError(null);
    setOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setOpen(false);
    setNameError(null);
    setServerError(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const nextName = name.trim();
    if (nextName.length < 3) {
      setNameError("Nama minimal 3 karakter.");
      return;
    }

    setSaving(true);
    setNameError(null);
    setServerError(null);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextName }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        message?: string;
      };
      if (!response.ok || !data.ok) {
        setServerError(data.message ?? "Gagal menyimpan profil.");
        return;
      }
      toast.success(data.message ?? "Profil diperbarui.");
      setOpen(false);
      router.refresh();
    } catch {
      setServerError("Tidak dapat menghubungi server. Periksa koneksimu.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={openModal}
        className="w-full sm:w-auto"
      >
        <Pencil aria-hidden="true" />
        Ubah profil
      </Button>

      <Modal
        open={open}
        onClose={closeModal}
        title="Ubah profil"
        description={
          isAdmin
            ? "Perbarui nama dan foto profilmu."
            : user.role === "pekerja"
              ? "Perbarui nama dan foto profilmu. NIK, nomor WhatsApp, dan email dikelola atasan."
              : "Perbarui nama dan foto profilmu. NIK, nomor WhatsApp, dan email tidak dapat diubah dari sini."
        }
        size="md"
        dismissible={!saving}
        footer={
          <div className="flex w-full gap-2.5">
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
              form="profile-form"
              disabled={saving}
              className="flex-1"
            >
              {saving ? (
                <>
                  <Spinner />
                  Menyimpan.
                </>
              ) : (
                "Simpan"
              )}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          <AvatarUploader
            employeeId={user.id}
            name={name || user.name}
            avatarKey={user.avatarKey}
            endpoint="/api/profile/avatar"
            onChanged={() => router.refresh()}
            disabled={saving}
          />

          <Separator />

          <form
            id="profile-form"
            onSubmit={submit}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="profile-name">
                Nama lengkap <span className="text-destructive">*</span>
              </Label>
              <Input
                id="profile-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-invalid={Boolean(nameError)}
                autoComplete="name"
              />
              <FieldError>{nameError}</FieldError>
            </div>

            <div className="flex flex-col">
              <DataRow label="NIK" value={user.nik} />
              <DataRow label="WhatsApp" value={phoneLabel(user.phone)} />
              <DataRow label="Email" value={user.email ?? "Belum diisi"} />
            </div>
          </form>

          <p className="text-xs leading-relaxed text-muted-foreground">
            Nomor WhatsApp adalah identitas login.
            {user.role === "pekerja" &&
              " Perubahannya hanya dapat dilakukan atasan lewat menu Tim."}
            {user.role === "atasan" &&
              " Perubahannya tidak dapat dilakukan dari halaman ini."}
          </p>
        </div>
      </Modal>
    </>
  );
}
