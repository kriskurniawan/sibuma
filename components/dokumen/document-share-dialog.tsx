"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Modal } from "@/components/modal";
import { Alert, AlertDescription } from "@/components/reui/alert";
import { Badge } from "@/components/reui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type {
  WorkDocumentShareOption,
  WorkDocumentShareOptions,
  WorkDocumentShareTarget,
  WorkDocumentSettings,
} from "@/lib/work-document-types";

export function DocumentShareDialog({
  open,
  onClose,
  endpoint,
  title,
  description,
  options,
  targets,
  settings,
  successMessage,
}: {
  open: boolean;
  onClose: () => void;
  endpoint: string;
  title: string;
  description: string;
  options: WorkDocumentShareOptions;
  targets: WorkDocumentShareTarget[];
  settings: Pick<
    WorkDocumentSettings,
    "shareToDivision" | "shareToSupervisor"
  >;
  successMessage: string;
}) {
  const router = useRouter();
  const [divisionIds, setDivisionIds] = useState<string[]>([]);
  const [supervisorIds, setSupervisorIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDivisionIds(
      targets
        .filter((target) => target.audience === "division")
        .map((target) => target.targetId),
    );
    setSupervisorIds(
      targets
        .filter((target) => target.audience === "supervisor")
        .map((target) => target.targetId),
    );
    setQuery("");
  }, [open, targets]);

  const legacyPresent = useMemo(
    () => targets.some((target) => target.legacy),
    [targets],
  );
  const legacyKeys = useMemo(
    () =>
      new Set(
        targets
          .filter((target) => target.legacy)
          .map((target) => `${target.audience}:${target.targetId}`),
      ),
    [targets],
  );

  const needle = query.trim().toLocaleLowerCase("id-ID");
  const matches = (option: WorkDocumentShareOption) =>
    needle.length === 0 ||
    option.name.toLocaleLowerCase("id-ID").includes(needle) ||
    (option.description ?? "").toLocaleLowerCase("id-ID").includes(needle);
  const divisions = options.divisions.filter(matches);
  const supervisors = options.supervisors.filter(matches);

  function toggle(
    audience: "division" | "supervisor",
    targetId: string,
    checked: boolean,
  ) {
    const update = (current: string[]) =>
      checked
        ? [...new Set([...current, targetId])]
        : current.filter((id) => id !== targetId);
    if (audience === "division") {
      setDivisionIds(update);
    } else {
      setSupervisorIds(update);
    }
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ divisionIds, supervisorIds }),
      });
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      if (!response.ok) {
        throw new Error(payload?.message ?? "Pengaturan berbagi gagal disimpan.");
      }
      toast.success(successMessage);
      onClose();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Pengaturan berbagi gagal disimpan.",
      );
    } finally {
      setBusy(false);
    }
  }

  const divisionLocked = !settings.shareToDivision;
  const supervisorLocked = !settings.shareToSupervisor;
  const missing = [
    divisionLocked ? "divisi" : null,
    supervisorLocked ? "atasan" : null,
  ].filter(Boolean);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="lg"
      dismissible={!busy}
      mobileSheet
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={onClose}
          >
            Batal
          </Button>
          <Button type="button" size="sm" disabled={busy} onClick={() => void save()}>
            {busy && <Spinner />}
            {busy ? "Menyimpan…" : "Simpan akses"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {missing.length > 0 && (
          <Alert variant="warning">
            <AlertDescription>
              Super admin menonaktifkan penambahan penerima{" "}
              {missing.join(" dan ")}. Pilihan yang sudah ada tetap dapat
              dipertahankan atau dihapus.
            </AlertDescription>
          </Alert>
        )}
        {legacyPresent && (
          <Alert variant="info">
            <AlertDescription>
              Sebagian akses berasal dari pengaturan berbagi lama. Menyimpan
              pilihan akan mengubahnya menjadi penerima eksplisit.
            </AlertDescription>
          </Alert>
        )}

        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cari divisi atau atasan…"
          aria-label="Cari divisi atau atasan"
        />

        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h3
              id="share-division-label"
              className="text-sm font-medium text-foreground"
            >
              Divisi
            </h3>
            <span className="text-xs text-muted-foreground tabular-nums">
              {divisionIds.length} dipilih
            </span>
          </div>
          <div role="group" aria-labelledby="share-division-label">
            {divisions.length === 0 ? (
              <p className="px-1 py-4 text-sm text-muted-foreground">
                {options.divisions.length === 0
                  ? "Belum ada divisi aktif."
                  : "Tidak ada divisi yang cocok."}
              </p>
            ) : (
              divisions.map((option) => {
                const selected = divisionIds.includes(option.id);
                const locked = divisionLocked && !selected;
                const legacy = legacyKeys.has(`division:${option.id}`);
                return (
                  <label
                    key={option.id}
                    htmlFor={`share-division-${option.id}`}
                    className={cn(
                      "flex items-start gap-3 px-1 py-2 transition-colors",
                      locked
                        ? "cursor-not-allowed opacity-60"
                        : "cursor-pointer hover:bg-muted/50",
                    )}
                  >
                    <Checkbox
                      id={`share-division-${option.id}`}
                      checked={selected}
                      disabled={locked || busy}
                      onCheckedChange={(value) =>
                        toggle("division", option.id, value === true)
                      }
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                        {option.name}
                        {legacy && (
                          <Badge variant="warning-light">Lama</Badge>
                        )}
                      </span>
                      {option.description && (
                        <span className="text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </section>

        <section className="flex flex-col gap-2 border-t border-border/70 pt-4">
          <div className="flex items-center justify-between gap-2">
            <h3
              id="share-supervisor-label"
              className="text-sm font-medium text-foreground"
            >
              Atasan
            </h3>
            <span className="text-xs text-muted-foreground tabular-nums">
              {supervisorIds.length} dipilih
            </span>
          </div>
          <div role="group" aria-labelledby="share-supervisor-label">
            {supervisors.length === 0 ? (
              <p className="px-1 py-4 text-sm text-muted-foreground">
                {options.supervisors.length === 0
                  ? "Belum ada atasan aktif."
                  : "Tidak ada atasan yang cocok."}
              </p>
            ) : (
              supervisors.map((option) => {
                const selected = supervisorIds.includes(option.id);
                const locked = supervisorLocked && !selected;
                const legacy = legacyKeys.has(`supervisor:${option.id}`);
                return (
                  <label
                    key={option.id}
                    htmlFor={`share-supervisor-${option.id}`}
                    className={cn(
                      "flex items-start gap-3 px-1 py-2 transition-colors",
                      locked
                        ? "cursor-not-allowed opacity-60"
                        : "cursor-pointer hover:bg-muted/50",
                    )}
                  >
                    <Checkbox
                      id={`share-supervisor-${option.id}`}
                      checked={selected}
                      disabled={locked || busy}
                      onCheckedChange={(value) =>
                        toggle("supervisor", option.id, value === true)
                      }
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                        {option.name}
                        {legacy && (
                          <Badge variant="warning-light">Lama</Badge>
                        )}
                      </span>
                      {option.description && (
                        <span className="text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </section>

        <p className="text-xs text-muted-foreground">
          Penerima hanya dapat membuka dan mengunduh. Akses dapat dicabut kapan
          saja dengan menghapus centang lalu menyimpan.
        </p>
      </div>
    </Modal>
  );
}
