"use client";

import { useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { PwaInstallInstructions } from "@/components/pwa-install-instructions";
import { Badge } from "@/components/reui/badge";
import {
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { usePushSettings } from "./use-push-settings";

export function PushSettings() {
  const {
    config,
    local,
    loading,
    busy,
    error,
    active,
    unavailable,
    unavailableLabel,
    statusDescription,
    installRequired,
    toggle,
    retry,
  } = usePushSettings();

  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const ready = Boolean(local && config);

  return (
    <Frame id="notifikasi" spacing="default">
      <FrameHeader>
        <FrameTitle>Notifikasi</FrameTitle>
      </FrameHeader>

      <FramePanel className="flex flex-col gap-3">
        {loading ? (
          <div className="flex flex-col gap-3" aria-busy="true" aria-live="polite">
            <span className="sr-only">Memeriksa pengaturan notifikasi perangkat…</span>
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="text-sm font-medium">Notifikasi perangkat</span>
                <Skeleton className="h-5 w-24" />
              </div>
              <Skeleton className="h-[18.4px] w-8 shrink-0 rounded-full" />
            </div>
            <div className="grid" aria-hidden="true">
              <p className="invisible col-start-1 row-start-1 text-sm">
                {statusDescription}
              </p>
              <Skeleton className="col-start-1 row-start-1 h-full w-full" />
            </div>
            {(!local || installRequired) && <Skeleton className="h-7 w-32" />}
          </div>
        ) : (
          <>
            {ready && (
              <div className="flex flex-col gap-3">
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Label
                      htmlFor="notifikasi-perangkat"
                      className="text-sm font-medium"
                    >
                      Notifikasi perangkat
                    </Label>
                    {unavailableLabel && (
                      <Badge variant="warning-light">{unavailableLabel}</Badge>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {busy && <Spinner />}
                    <Switch
                      id="notifikasi-perangkat"
                      aria-describedby="notifikasi-perangkat-hint"
                      checked={active}
                      disabled={busy || unavailable}
                      onCheckedChange={(checked) => {
                        void toggle(checked);
                      }}
                    />
                  </div>
                </div>
                <p id="notifikasi-perangkat-hint" className="text-sm text-muted-foreground">
                  {statusDescription}
                </p>
                {installRequired && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="self-start"
                    onClick={() => setInstructionsOpen(true)}
                  >
                    <Download aria-hidden="true" />
                    Cara memasang
                  </Button>
                )}
              </div>
            )}

            {error && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
                {!ready && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={retry}
                  >
                    <RefreshCw aria-hidden="true" />
                    Coba lagi
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </FramePanel>
      <PwaInstallInstructions
        open={instructionsOpen}
        onClose={() => setInstructionsOpen(false)}
      />
    </Frame>
  );
}
