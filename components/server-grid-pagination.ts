"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { OnChangeFn, PaginationState } from "@tanstack/react-table";

/** Keep server pagination in the URL so filters, refresh and Back agree. */
export function useServerGridPagination(pagination: PaginationState) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const onPaginationChange: OnChangeFn<PaginationState> = (updater) => {
    const next = typeof updater === "function" ? updater(pagination) : updater;
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(next.pageIndex + 1));
    params.set("size", String(next.pageSize));
    startTransition(() => router.replace(`${pathname}?${params}`, { scroll: false }));
  };
  return { onPaginationChange, isPending };
}
