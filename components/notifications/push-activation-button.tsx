"use client";

import { BellRing } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { usePushSettings } from "./use-push-settings";

export function PushActivationButton() {
  const { loading, busy, canActivate, activate } = usePushSettings();

  if (loading) {
    return <Skeleton className="h-8 w-40" />;
  }

  if (!canActivate) return null;

  async function onActivate() {
    const result = await activate();
    if (!result.ok) toast.error(result.message);
  }

  return (
    <Button
      type="button"
      size="sm"
      disabled={busy}
      onClick={() => {
        void onActivate();
      }}
    >
      {busy ? <Spinner /> : <BellRing aria-hidden="true" />}
      Aktifkan notifikasi
    </Button>
  );
}
