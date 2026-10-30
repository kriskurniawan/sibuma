"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { WorkDocumentFolder } from "@/lib/work-document-types";

/**
 * Folder satu tingkat. Deskripsi folder menjelaskan isi folder; setiap berkas
 * tetap menyimpan keterangannya sendiri.
 */
export function DocumentFolderDialog({
  open,
  onClose,
  folder,
}: {
  open: boolean;
  onClose: () => void;
  folder?: WorkDocumentFolder | null;
}) {
  const router = useRouter();
  const editing = Boolean(folder);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(folder?.name ?? "");
    setDescription(folder?.description ?? "");
  }, [open, folder]);

  function close() {
    if (busy) return;
    onClose();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch(
        editing ? `/api/dokumen/folders/${folder?.id}` : "/api/dokumen/folders",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description }),
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      if (!response.ok) {
        throw new Error(
          payload?.message ??
            (editing ? "Folder gagal diubah." : "Folder gagal dibuat."),
        );
      }
      toast.success(
        editing ? "Folder diperbarui." : `Folder "${name.trim()}" dibuat.`,
      );
      onClose();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : editing
            ? "Folder gagal diubah."
            : "Folder gagal dibuat.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={editing ? "Ubah folder" : "Folder baru"}
      description="Folder mengelompokkan berkas. Deskripsi folder menjelaskan isi folder; tiap berkas tetap punya keterangan sendiri."
      size="md"
      dismissible={!busy}
      footer={
        <>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={close}
            disabled={busy}
          >
            Batal
          </Button>
          <Button
            type="submit"
            size="sm"
            form="document-folder-form"
            disabled={busy || name.trim().length === 0}
          >
            {busy ? <Spinner /> : editing ? <Pencil /> : <FolderPlus />}
            {busy ? "Menyimpan…" : editing ? "Simpan" : "Buat folder"}
          </Button>
        </>
      }
    >
      <form
        id="document-folder-form"
        className="flex flex-col gap-4"
        onSubmit={submit}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="document-folder-name">Nama folder</Label>
          <Input
            id="document-folder-name"
            value={name}
            maxLength={120}
            required
            autoComplete="off"
            placeholder="Contoh: Panduan APD"
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="document-folder-description">Deskripsi</Label>
          <Textarea
            id="document-folder-description"
            value={description}
            maxLength={1_000}
            rows={4}
            placeholder="Opsional: isi folder, sumber, atau catatan pemakaian."
            onChange={(event) => setDescription(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Deskripsi ini tampil sebagai keterangan folder, bukan per berkas.
          </p>
        </div>
      </form>
    </Modal>
  );
}
