"use client";

import { useState } from "react";
import { UsersRound } from "lucide-react";
import { Alert, AlertDescription } from "@/components/reui/alert";
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { Button } from "@/components/ui/button";
import { DocumentShareDialog } from "@/components/dokumen/document-share-dialog";
import { DocumentShareSummary } from "@/components/dokumen/document-share-summary";
import type {
  WorkDocumentDetail,
  WorkDocumentShareOptions,
  WorkDocumentSettings,
} from "@/lib/work-document-types";

export function DocumentSharePanel({
  document,
  settings,
  options,
}: {
  document: WorkDocumentDetail;
  settings: Pick<
    WorkDocumentSettings,
    "shareToDivision" | "shareToSupervisor"
  >;
  options: WorkDocumentShareOptions;
}) {
  const [open, setOpen] = useState(false);
  const divisionCount = document.shareTargets.filter(
    (target) => target.audience === "division",
  ).length;
  const supervisorCount = document.shareTargets.filter(
    (target) => target.audience === "supervisor",
  ).length;

  return (
    <Frame stacked spacing="sm">
      <FrameHeader>
        <FrameTitle>Berbagi hanya-baca</FrameTitle>
        <FrameDescription className="text-xs">
          Penerima dapat membuka dan mengunduh, tetapi tidak dapat mengubah
          atau membagikan ulang.
        </FrameDescription>
      </FrameHeader>
      <FramePanel className="flex flex-col gap-4">
        {(!settings.shareToDivision || !settings.shareToSupervisor) && (
          <Alert variant="warning">
            <AlertDescription>
              Sebagian opsi berbagi dinonaktifkan oleh super admin. Penerima
              yang sudah ada tetap berlaku sampai kamu menghapusnya.
            </AlertDescription>
          </Alert>
        )}

        <DocumentShareSummary
          targets={document.shareTargets}
          empty="Privat — hanya kamu yang dapat membuka dokumen ini."
        />

        {document.folderName && (
          <p className="text-xs text-muted-foreground">
            Dokumen ini berada di folder{" "}
            <span className="font-medium text-foreground">
              {document.folderName}
            </span>
            . Berbagi folder juga membuka berkas ini dan diatur dari header
            folder.
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <span className="text-xs text-muted-foreground tabular-nums">
            {document.shareTargets.length === 0
              ? "Belum ada penerima"
              : `${divisionCount} divisi · ${supervisorCount} atasan`}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setOpen(true)}
          >
            <UsersRound aria-hidden="true" />
            Atur akses
          </Button>
        </div>
      </FramePanel>

      <DocumentShareDialog
        open={open}
        onClose={() => setOpen(false)}
        endpoint={`/api/dokumen/${document.id}/shares`}
        title="Atur akses dokumen"
        description="Pilih divisi dan atasan yang boleh membuka dokumen ini. Akses hanya-baca dan dapat dicabut kapan saja."
        options={options}
        targets={document.shareTargets}
        settings={settings}
        successMessage="Akses hanya-baca dokumen diperbarui."
      />
    </Frame>
  );
}
