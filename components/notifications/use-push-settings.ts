"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  activatePush,
  detachPushSubscription,
  localPushState,
  syncPushSubscription,
  type PushActivationResult,
  type PushCapability,
} from "@/lib/push-client";

interface PushConfigState {
  configured: boolean;
  publicKey: string | null;
  /** Jumlah perangkat yang sudah terdaftar untuk akun ini. */
  subscriptions: number;
}

interface LocalPushState {
  capability: PushCapability;
  subscribed: boolean;
}

export function usePushSettings() {
  const [config, setConfig] = useState<PushConfigState | null>(null);
  const [local, setLocal] = useState<LocalPushState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      try {
        const [response, state] = await Promise.all([
          fetch("/api/notifikasi/push", { cache: "no-store" }),
          localPushState(),
        ]);
        if (!response.ok) throw new Error("Gagal memuat status perangkat.");
        const data = (await response.json()) as {
          configured?: boolean;
          publicKey?: string | null;
          subscriptions?: number;
        };
        if (cancelled) return;
        setConfig({
          configured: Boolean(data.configured),
          publicKey: data.publicKey ?? null,
          subscriptions:
            typeof data.subscriptions === "number" ? data.subscriptions : 0,
        });
        setLocal(state);
        if (state.capability === "granted" && state.subscribed) {
          void syncPushSubscription();
        }
      } catch {
        if (!cancelled) {
          setError("Status notifikasi perangkat gagal dimuat.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") {
        setAttempt((value) => value + 1);
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const retry = useCallback(() => {
    setLoading(true);
    setAttempt((value) => value + 1);
  }, []);

  const activate = useCallback(async (): Promise<PushActivationResult> => {
    if (!config?.publicKey) {
      const message = "Notifikasi perangkat belum diaktifkan admin.";
      setError(message);
      return { ok: false, reason: "unconfigured", message };
    }

    setBusy(true);
    setError(null);
    const result = await activatePush(config.publicKey).catch(
      (): PushActivationResult => ({
        ok: false,
        reason: "failed",
        message: "Notifikasi perangkat gagal diaktifkan. Coba lagi.",
      }),
    );
    setBusy(false);

    if (!result.ok) {
      setError(result.message);
      if (result.reason === "denied" || result.reason === "unsupported") {
        const capability = result.reason;
        setLocal((current) =>
          current ? { ...current, capability, subscribed: false } : current,
        );
      }
      return result;
    }

    setLocal((current) =>
      current ? { capability: "granted", subscribed: true } : current,
    );
    toast.success("Notifikasi perangkat aktif.");
    setAttempt((value) => value + 1);
    return result;
  }, [config?.publicKey]);

  const disable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await detachPushSubscription();
    } finally {
      setLocal((current) =>
        current ? { ...current, subscribed: false } : current,
      );
      setBusy(false);
    }
    toast.success("Notifikasi perangkat dimatikan.");
    setAttempt((value) => value + 1);
  }, []);

  const toggle = useCallback(
    async (checked: boolean) => {
      if (checked) {
        await activate();
      } else {
        await disable();
      }
    },
    [activate, disable],
  );

  const active =
    config?.configured === true &&
    local?.capability === "granted" &&
    Boolean(local?.subscribed);

  const unavailable =
    local?.capability === "unsupported" ||
    local?.capability === "denied" ||
    config?.configured === false;

  const unavailableLabel =
    local?.capability === "unsupported"
      ? "Tidak didukung"
      : local?.capability === "denied"
        ? "Izin ditolak"
        : config?.configured === false
          ? "Belum diatur"
          : null;

  const canActivate =
    !loading &&
    config?.configured === true &&
    local != null &&
    local.capability !== "unsupported" &&
    local.capability !== "denied" &&
    !local.subscribed;

  return {
    config,
    local,
    loading,
    busy,
    error,
    active,
    unavailable,
    unavailableLabel,
    canActivate,
    subscriptions: config?.subscriptions ?? 0,
    activate,
    disable,
    toggle,
    retry,
  };
}
