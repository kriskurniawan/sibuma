"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type FilterValue = string | null | undefined;

/**
 * Navigasi filter berbasis URL dengan perilaku yang sama di semua daftar:
 * mempertahankan parameter lain, menghapus nilai default, dan kembali ke
 * halaman pertama tanpa mengubah posisi scroll.
 */
export function useFilterNavigation(
  defaults: Record<string, string> = {},
) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const paramsRef = useRef(new URLSearchParams(searchParams.toString()));

  useEffect(() => {
    // Jangan timpa parameter yang baru saja diubah saat navigasi masih berjalan.
    if (!isPending) {
      paramsRef.current = new URLSearchParams(searchParams.toString());
    }
  }, [isPending, searchParams]);

  function navigate(updates: Record<string, FilterValue>) {
    const params = new URLSearchParams(paramsRef.current.toString());
    for (const [key, value] of Object.entries(updates)) {
      const normalized = typeof value === "string" ? value.trim() : "";
      if (!normalized || normalized === defaults[key]) params.delete(key);
      else params.set(key, normalized);
    }
    params.delete("page");
    params.delete("print");
    paramsRef.current = params;
    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    });
  }

  return { isPending, navigate };
}

/**
 * Nilai lokal agar select/checkbox langsung terlihat berubah, lalu disinkronkan
 * kembali dengan nilai server setelah navigasi selesai.
 */
export function useOptimisticFilterValue<T>(value: T, pending: boolean) {
  const [local, setLocal] = useState(value);

  useEffect(() => {
    if (!pending) setLocal(value);
  }, [pending, value]);

  return [local, setLocal] as const;
}

/**
 * Input pencarian dengan jeda 400 ms. Enter dan tombol hapus langsung
 * menerapkan nilai tanpa menunggu jeda.
 */
export function useDebouncedFilterValue(
  value: string | undefined,
  commit: (next: string) => void,
  delay = 400,
) {
  const [text, setText] = useState(value ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commitRef = useRef(commit);
  const focused = useRef(false);

  useEffect(() => {
    commitRef.current = commit;
  });

  useEffect(() => {
    if (!focused.current) {
      // URL berubah dari luar (mis. Reset) — batalkan jeda yang tertinggal.
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      setText(value ?? "");
    }
  }, [value]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function cancelPending() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }

  function change(next: string) {
    setText(next);
    cancelPending();
    timer.current = setTimeout(() => {
      timer.current = null;
      commitRef.current(next);
    }, delay);
  }

  function commitNow(next = text) {
    cancelPending();
    setText(next);
    commitRef.current(next);
  }

  function reset() {
    cancelPending();
    setText("");
  }

  return {
    text,
    change,
    commitNow,
    cancelPending,
    reset,
    onFocus: () => {
      focused.current = true;
    },
    onBlur: () => {
      focused.current = false;
      // Terapkan segera saat fokus berpindah, jangan biarkan hasil lama menimpa
      // aksi berikutnya (mis. Reset atau memilih filter lain).
      if (timer.current) {
        cancelPending();
        commitRef.current(text);
      }
    },
  };
}
