"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { Alert, AlertDescription } from "@/components/reui/alert";
import { FieldError } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { isCompanyEmail } from "@/lib/email";
import { normalizePhone } from "@/lib/phone";
import type { SessionUser } from "@/lib/types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ProfileEditor({ user }: { user: SessionUser }) {
  const router = useRouter();
  const isAdmin = user.role === "super_admin";
  const requiresEmailChange = isCompanyEmail(user.email);
  const [open, setOpen] = useState(requiresEmailChange);
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(editablePhone(user.phone));
  const [email, setEmail] = useState(user.email ?? "");
  const [nameError, setNameError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const wasOpen = useRef(open);

  useEffect(() => {
    if (requiresEmailChange) setOpen(true);
  }, [requiresEmailChange]);

  useEffect(() => {
    if (open && !wasOpen.current) {
      if (requiresEmailChange) emailInputRef.current?.focus();
      else nameInputRef.current?.focus();
    } else if (!open && wasOpen.current) {
      editButtonRef.current?.focus();
    }
    wasOpen.current = open;
  }, [open, requiresEmailChange]);

  function openEditor() {
    setName(user.name);
    setPhone(editablePhone(user.phone));
    setEmail(user.email ?? "");
    setNameError(null);
    setPhoneError(null);
    setEmailError(null);
    setServerError(null);
    setOpen(true);
  }

  function closeEditor() {
    if (saving) return;
    setOpen(false);
    setNameError(null);
    setPhoneError(null);
    setEmailError(null);
    setServerError(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const nextName = name.trim();
    if (nextName.length < 3) {
      setNameError("Nama minimal 3 karakter.");
      return;
    }
    const nextPhone = phone.trim();
    if (isAdmin) {
      if (!nextPhone) {
        setPhoneError("Nomor HP wajib diisi.");
        return;
      }
      if (!normalizePhone(nextPhone)) {
        setPhoneError(
          "Format nomor HP tidak valid. Gunakan format 08xx atau 628xx.",
        );
        return;
      }
    }

    const nextEmail = email.trim().toLowerCase();
    if (!nextEmail && user.email) {
      setEmailError("Email wajib diisi.");
      return;
    }
    if (nextEmail && !EMAIL_PATTERN.test(nextEmail)) {
      setEmailError("Format email tidak valid.");
      return;
    }
    if (nextEmail && isCompanyEmail(nextEmail)) {
      setEmailError(
        "Email wajib memakai domain selain bmbi.my.id. Gunakan email pribadi.",
      );
      return;
    }

    setSaving(true);
    setNameError(null);
    setPhoneError(null);
    setEmailError(null);
    setServerError(null);
    try {
      const payload: { name: string; email?: string; phone?: string } = {
        name: nextName,
      };
      if (nextEmail) payload.email = nextEmail;
      if (isAdmin) payload.phone = nextPhone;

      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
    <Collapsible open={open}>
      {!open && (
        <Button
          ref={editButtonRef}
          type="button"
          variant="outline"
          size="sm"
          onClick={openEditor}
          aria-expanded={open}
          aria-controls="profile-editor"
          className="w-full sm:w-auto"
        >
          <Pencil aria-hidden="true" />
          Ubah profil
        </Button>
      )}
      <CollapsibleContent id="profile-editor">
        <div className="flex min-w-0 flex-col gap-4">
          <Separator />
          <h3 className="text-sm font-semibold tracking-tight">Ubah profil</h3>
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
          <form
            onSubmit={submit}
            className="flex flex-col gap-4"
            aria-busy={saving}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="profile-name">
                  Nama lengkap <span className="text-destructive">*</span>
                </Label>
                <Input
                  ref={nameInputRef}
                  id="profile-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  aria-invalid={Boolean(nameError)}
                  aria-describedby={nameError ? "profile-name-error" : undefined}
                  autoComplete="name"
                />
                <FieldError id="profile-name-error">{nameError}</FieldError>
              </div>

              <div
                id="email"
                className="flex scroll-mt-24 flex-col gap-2"
              >
                <Label htmlFor="profile-email">
                  Email{" "}
                  {user.email ? (
                    <span className="text-destructive">*</span>
                  ) : (
                    <span className="font-normal text-muted-foreground">
                      (opsional)
                    </span>
                  )}
                </Label>
                <Input
                  ref={emailInputRef}
                  id="profile-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  aria-invalid={Boolean(emailError)}
                  aria-describedby={
                    emailError
                      ? "profile-email-error profile-email-help"
                      : "profile-email-help"
                  }
                  placeholder="nama@email.com"
                  inputMode="email"
                  autoComplete="email"
                  className="scroll-mb-36"
                />
                <FieldError id="profile-email-error">{emailError}</FieldError>
                <p
                  id="profile-email-help"
                  className="text-xs text-muted-foreground"
                >
                  {requiresEmailChange
                    ? "Email ini masih memakai domain bmbi.my.id dan wajib diganti ke email pribadi yang aktif."
                    : "Dipakai untuk login OTP dan pemberitahuan. Domain bmbi.my.id tidak diizinkan."}
                </p>
              </div>

              {isAdmin && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="profile-phone">
                    Nomor WhatsApp <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="profile-phone"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    aria-invalid={Boolean(phoneError)}
                    aria-describedby={
                      phoneError
                        ? "profile-phone-error profile-phone-help"
                        : "profile-phone-help"
                    }
                    placeholder="08xxxxxxxxxx"
                    inputMode="tel"
                    autoComplete="tel"
                  />
                  <FieldError id="profile-phone-error">{phoneError}</FieldError>
                </div>
              )}
            </div>
            <p id="profile-phone-help" className="text-xs text-muted-foreground">
              {isAdmin
                ? "Email dan nomor WhatsApp dipakai untuk login OTP. Perubahan berlaku untuk login berikutnya. NIK tidak dapat diubah di sini."
                : user.role === "pekerja"
                  ? "Email dapat kamu ubah di sini. NIK dan nomor WhatsApp dikelola atasan lewat menu Tim."
                  : "Email dapat kamu ubah di sini. NIK dan nomor WhatsApp tidak dapat diubah di sini."}
            </p>
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? (
                  <>
                    <Spinner />
                    Menyimpan…
                  </>
                ) : (
                  "Simpan"
                )}
              </Button>
              {!requiresEmailChange && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={closeEditor}
                  disabled={saving}
                >
                  Batal
                </Button>
              )}
            </div>
          </form>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function editablePhone(phone: string) {
  return phone.startsWith("62") ? `0${phone.slice(2)}` : phone;
}
