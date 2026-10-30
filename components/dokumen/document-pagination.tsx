"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ListPagination } from "@/components/list-pagination";

export function DocumentPagination({
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

  function update(nextPage: number, nextSize: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextPage > 0) params.set("page", String(nextPage + 1));
    else params.delete("page");
    if (nextSize !== 10) params.set("size", String(nextSize));
    else params.delete("size");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <ListPagination
      page={page}
      pageSize={pageSize}
      total={total}
      onPageChange={(nextPage) => update(nextPage, pageSize)}
      onPageSizeChange={(nextSize) => update(0, nextSize)}
      itemLabel="dokumen"
    />
  );
}
