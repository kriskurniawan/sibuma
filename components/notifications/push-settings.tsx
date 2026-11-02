"use client";

import { RefreshCw } from "lucide-react";
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
    toggle,
    retry,
  } = usePushSettings();

  const ready = Boolean(local && config);

  return (
    <Frame id="notifikasi" spacing="default">
      <FrameHeader>
        <FrameTitle>Notifikasi</FrameTitle>
      </FrameHeader>

      <FramePanel className="flex flex-col gap-3">
        {loading ? (
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-[18.4px] w-8 rounded-full" />
          </div>
        ) : (
          <>
            {ready && (
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
                    checked={active}
                    disabled={busy || unavailable}
                    onCheckedChange={(checked) => {
                      void toggle(checked);
                    }}
                  />
                </div>
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
    </Frame>
  );
}
