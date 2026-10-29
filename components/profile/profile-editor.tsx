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
import type { SessionUser } from "@/lib/types";

export function ProfileEditor({ user }: { user: SessionUser }) {
  const router = useRouter();
  const isAdmin = user.role === "super_admin";
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(user.name);
  const [nameError, setNameError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open) nameInputRef.current?.focus();
    else if (wasOpen.current) editButtonRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  function openEditor() {
    setName(user.name);
    setNameError(null);
    setServerError(null);
    setOpen(true);
  }

  function closeEditor() {
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
            <p className="text-xs text-muted-foreground">
              {isAdmin
                ? "Nomor WhatsApp adalah identitas login. NIK dan kontak tidak diubah di sini."
                : user.role === "pekerja"
                  ? "WhatsApp adalah identitas login. NIK dan kontak dikelola atasan lewat menu Tim."
                  : "WhatsApp adalah identitas login. NIK dan kontak tidak dapat diubah di sini."}
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={closeEditor}
                disabled={saving}
              >
                Batal
              </Button>
            </div>
          </form>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
