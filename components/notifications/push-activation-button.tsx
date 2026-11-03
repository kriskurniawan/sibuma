"use client";

import { BellRing } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { usePushSettings } from "./use-push-settings";

export function PushActivationButton() {
  const { loading, busy, canActivate, activate } = usePushSettings();

  // Status perangkat belum diketahui. Jangan render tombol placeholder atau
  // skeleton: keduanya terbaca sebagai aksi hantu, terutama saat sudah aktif.
  if (loading) return null;

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
