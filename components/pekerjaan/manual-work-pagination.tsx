"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ListPagination } from "@/components/list-pagination";
import { cn } from "@/lib/utils";

export function ManualWorkPagination({
  page,
  pageSize,
  total,
}: {
  page: number;
  pageSize: number;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function update(nextPage: number, nextSize: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextPage > 0) params.set("page", String(nextPage + 1));
    else params.delete("page");
    if (nextSize !== 10) params.set("size", String(nextSize));
    else params.delete("size");
    const query = params.toString();
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  return (
    <div
      aria-busy={isPending}
      className={cn(
        "transition-opacity duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
        isPending && "opacity-60",
      )}
    >
      <ListPagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={(nextPage) => update(nextPage, pageSize)}
        onPageSizeChange={(nextSize) => update(0, nextSize)}
        itemLabel="pekerjaan"
      />
      <span className="sr-only" role="status" aria-live="polite">
        {isPending ? "Memuat halaman pekerjaan…" : ""}
      </span>
    </div>
  );
}
