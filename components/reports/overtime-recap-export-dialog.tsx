"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  FileBarChart2,
  FileDown,
  FileSpreadsheet,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { InfoBanner } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Modal } from "@/components/modal";
import { ReportDateFilters } from "@/components/reports/report-date-filters";
import { recapDocumentFileName } from "@/lib/overtime-recap-document";
import {
  formatRecapHours,
  formatRecapRupiah,
} from "@/lib/overtime-recap-format";
import type {
  OvertimeRecapPreview,
  OvertimeRecapPreviewResponse,
  OvertimeRecapTeam,
} from "@/lib/overtime-recap-types";

type DownloadFormat = "pdf" | "xlsx";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function OvertimeRecapExportDialog({
  defaultFrom,
  defaultTo,
  canSelectTeam,
}: {
  defaultFrom: string;
  defaultTo: string;
  canSelectTeam: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [rangeKey, setRangeKey] = useState(0);
  const [teams, setTeams] = useState<OvertimeRecapTeam[]>([]);
  const [ownerId, setOwnerId] = useState("");
  const [preview, setPreview] = useState<OvertimeRecapPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [buildingManagerName, setBuildingManagerName] = useState("");
  const [managerName, setManagerName] = useState("");
  const [downloading, setDownloading] = useState<DownloadFormat | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const signersTouched = useRef(false);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    let active = true;

    if (
      !DATE_PATTERN.test(from) ||
      !DATE_PATTERN.test(to) ||
      from > to
    ) {
      setLoading(false);
      setPreview(null);
      setError("Pilih rentang tanggal rekap terlebih dahulu.");
      return;
    }

    setLoading(true);
    setError(null);
    setPreview(null);

    const params = new URLSearchParams({ from, to });
    if (canSelectTeam && ownerId) params.set("ownerId", ownerId);

    fetch(`/api/reports/overtime-recap?${params.toString()}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as
          | (OvertimeRecapPreviewResponse & {
              ok?: boolean;
              message?: string;
            })
          | null;
        if (!response.ok || !data?.ok) {
          throw new Error(data?.message ?? "Rekap lembur gagal dimuat.");
        }
        return data;
      })
      .then((data) => {
        if (!active) return;
        if (data.teams) setTeams(data.teams);

        if (canSelectTeam && !ownerId) {
          const first =
            data.teams?.find((team) => team.active) ?? data.teams?.[0];
          if (first) {
            setOwnerId(first.id);
            return;
          }
          setLoading(false);
          return;
        }

        if (!data.preview) {
          setError("Data rekap tidak tersedia.");
          setLoading(false);
          return;
        }

        setPreview(data.preview);
        if (!signersTouched.current) {
          setBuildingManagerName(data.preview.signers.buildingManagerName);
          setManagerName(data.preview.signers.managerName);
        }
        setLoading(false);
      })
      .catch((fetchError: unknown) => {
        if (!active) return;
        if (
          fetchError instanceof DOMException &&
          fetchError.name === "AbortError"
        ) {
          return;
        }
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Tidak dapat menghubungi server. Periksa koneksimu.",
        );
        setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [open, from, to, ownerId, canSelectTeam, reloadKey]);

  function openDialog() {
    setFrom(defaultFrom);
    setTo(defaultTo);
    setRangeKey((value) => value + 1);
    setOwnerId("");
    setTeams([]);
    setPreview(null);
    setError(null);
    setActionError(null);
    setBuildingManagerName("");
    setManagerName("");
    setDownloading(null);
    signersTouched.current = false;
    setOpen(true);
  }

  function closeDialog() {
    if (downloading) return;
    setOpen(false);
  }

  function selectTeam(value: string) {
    if (value === ownerId) return;
    signersTouched.current = false;
    setBuildingManagerName("");
    setManagerName("");
    setActionError(null);
    setOwnerId(value);
  }

  async function exportRecap(format: DownloadFormat) {
    if (!preview || downloading) return;
    setDownloading(format);
    setActionError(null);
    try {
      const response = await fetch("/api/reports/overtime-recap/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          from,
          to,
          ...(canSelectTeam ? { ownerId: preview.owner.id } : {}),
          buildingManagerName,
          managerName,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        setActionError(data?.message ?? "Rekap lembur gagal diekspor.");
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = recapDocumentFileName(from, to, format);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      toast.success("Rekap lembur berhasil diunduh.");
    } catch {
      setActionError(
        "Tidak dapat mengunduh rekap. Periksa koneksi lalu coba lagi.",
      );
    } finally {
      setDownloading(null);
    }
  }

  const blocked = Boolean(preview?.blockers.length);
  const disabled = loading || !preview || blocked || Boolean(downloading);
  const teamItems = teams.map((team) => ({
    value: team.id,
    label: team.active ? team.name : `${team.name} (nonaktif)`,
  }));

  return (
    <>
      <Button type="button" size="sm" onClick={openDialog}>
        <FileBarChart2 aria-hidden="true" />
        Rekap lembur
      </Button>

      <Modal
        open={open}
        onClose={closeDialog}
        title="Ekspor rekapitulasi lembur"
        description="Pilih rentang tanggal dan tim, lengkapi nama penandatangan, lalu unduh PDF atau Excel."
        size="lg"
        dismissible={!downloading}
        mobileSheet
        stickyFooter
        footer={
          <div className="flex w-full flex-col gap-2">
            {actionError && (
              <p role="alert" className="text-xs text-destructive">
                {actionError}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
                disabled={Boolean(downloading)}
                className="flex-1"
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void exportRecap("xlsx")}
                disabled={disabled}
                className="flex-1"
              >
                {downloading === "xlsx" ? (
                  <Spinner />
                ) : (
                  <FileSpreadsheet aria-hidden="true" />
                )}
                Excel
              </Button>
              <Button
                type="button"
                onClick={() => void exportRecap("pdf")}
                disabled={disabled}
                className="flex-1"
              >
                {downloading === "pdf" ? (
                  <Spinner />
                ) : (
                  <FileDown aria-hidden="true" />
                )}
                PDF
              </Button>
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label>Periode rekap</Label>
              <ReportDateFilters
                key={rangeKey}
                from={from}
                to={to}
                ariaLabel="Rentang tanggal rekap"
                errorId="recap-date-range-error"
                onChange={(nextFrom, nextTo) => {
                  setActionError(null);
                  setFrom(nextFrom);
                  setTo(nextTo);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Default mengikuti filter laporan. Gaji pokok yang berlaku pada
                tanggal awal periode dipakai untuk menghitung lembur.
              </p>
            </div>

            {canSelectTeam && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="recap-team">Tim</Label>
                <Select
                  items={teamItems}
                  value={ownerId}
                  onValueChange={(value) => {
                    if (value !== null) selectTeam(value);
                  }}
                >
                  <SelectTrigger
                    id="recap-team"
                    className="w-full"
                    disabled={loading && teams.length === 0}
                  >
                    <SelectValue placeholder="Pilih tim" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Nama penandatangan disimpan per tim.
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="recap-building-manager">Building Manager</Label>
              <Input
                id="recap-building-manager"
                value={buildingManagerName}
                onChange={(event) => {
                  signersTouched.current = true;
                  setBuildingManagerName(event.target.value);
                }}
                disabled={!preview}
                maxLength={80}
                placeholder="Nama penandatangan"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="recap-manager">Manager</Label>
              <Input
                id="recap-manager"
                value={managerName}
                onChange={(event) => {
                  signersTouched.current = true;
                  setManagerName(event.target.value);
                }}
                disabled={!preview}
                maxLength={80}
                placeholder="Nama penandatangan"
              />
            </div>
          </div>
          {preview && (
            <p className="text-xs text-muted-foreground">
              {preview.canManageSigners
                ? "Nama penandatangan disimpan untuk ekspor berikutnya."
                : "Nama penandatangan hanya dipakai untuk ekspor ini dan tidak disimpan."}
            </p>
          )}

          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <p className="text-sm font-medium text-foreground">Kelengkapan rekap</p>

            {loading ? (
              <div
                className="flex flex-col gap-2"
                role="status"
                aria-label="Memuat rekap lembur"
              >
                <Skeleton className="h-4 w-40" />
                <div className="grid grid-cols-3 gap-2">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
                <Skeleton className="h-20 w-full" />
              </div>
            ) : error ? (
              <InfoBanner tone="danger" icon={AlertCircle}>
                <div className="flex flex-col items-start gap-2">
                  <span>{error}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setReloadKey((value) => value + 1)}
                  >
                    Coba lagi
                  </Button>
                </div>
              </InfoBanner>
            ) : !preview ? (
              <InfoBanner tone="warning" icon={TriangleAlert}>
                Belum ada tim yang memiliki pekerja. Tambahkan pekerja terlebih
                dahulu.
              </InfoBanner>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">
                    {preview.periodLabel}
                  </span>
                  <span className="text-xs font-medium text-foreground">
                    {preview.owner.name}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Pekerja</p>
                    <p className="mt-0.5 text-sm font-semibold text-foreground tabular-nums">
                      {preview.rows.length}
                    </p>
                  </div>
                  <div className="bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Total jam</p>
                    <p className="mt-0.5 text-sm font-semibold text-foreground tabular-nums">
                      {formatRecapHours(
                        preview.totals.hkMinutes + preview.totals.hlMinutes,
                      )}{" "}
                      jam
                    </p>
                  </div>
                  <div className="bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">
                      Total lembur
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-foreground tabular-nums">
                      {formatRecapRupiah(preview.totals.totalPay)}
                    </p>
                  </div>
                </div>

                {preview.blockers.length > 0 && (
                  <InfoBanner tone="warning" icon={TriangleAlert}>
                    <div className="flex flex-col gap-1">
                      {preview.blockers.map((blocker) => (
                        <p key={blocker.code}>{blocker.message}</p>
                      ))}
                    </div>
                  </InfoBanner>
                )}

                {preview.rows.length > 0 && (
                  <div className="flex flex-col">
                    {preview.rows.map((row) => (
                      <div
                        key={row.employeeId}
                        className="flex items-center justify-between gap-3 border-b border-border/70 py-2 last:border-b-0"
                      >
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <p className="truncate text-xs font-medium text-foreground">
                            {row.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {row.jobTitle ?? "Jabatan belum diisi"}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs font-semibold text-foreground tabular-nums">
                            {formatRecapRupiah(row.totalPay)}
                          </p>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {formatRecapHours(row.hkMinutes + row.hlMinutes)} jam
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
