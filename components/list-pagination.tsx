"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const DEFAULT_SIZES = [10, 25, 50, 100];

function getPageItems(page: number, pageCount: number) {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index);
  }

  const items: Array<number | "ellipsis"> = [0];
  const start = Math.max(1, page - 2);
  const end = Math.min(pageCount - 2, page + 2);

  if (start > 1) items.push("ellipsis");
  for (let index = start; index <= end; index += 1) items.push(index);
  if (end < pageCount - 2) items.push("ellipsis");
  items.push(pageCount - 1);

  return items;
}

export function ListPagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  sizes = DEFAULT_SIZES,
  itemLabel = "baris",
  className,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  sizes?: number[];
  itemLabel?: string;
  className?: string;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);
  const pageItems = getPageItems(page, pageCount);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="order-2 flex flex-wrap items-center gap-x-2.5 gap-y-2 sm:order-1">
        <span className="text-sm text-muted-foreground">Baris per halaman</span>
        <Select
          value={`${pageSize}`}
          onValueChange={(value) => onPageSizeChange(Number(value))}
        >
          <SelectTrigger
            aria-label="Baris per halaman"
            className="w-fit min-w-16"
            size="sm"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent
            align="start"
            alignItemWithTrigger={false}
            className="min-w-(--anchor-width)"
          >
            {sizes.map((size) => (
              <SelectItem key={size} value={`${size}`}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="order-1 flex flex-col items-center gap-2 sm:order-2 sm:flex-row sm:gap-3">
        <span className="order-2 text-xs text-muted-foreground tabular-nums sm:order-1 sm:text-sm">
          {from}–{to} dari {total} {itemLabel}
        </span>

        {pageCount > 1 && (
          <Pagination
            aria-label="Navigasi halaman"
            className="order-1 mx-0 w-auto justify-center sm:order-2 sm:justify-end"
          >
            <PaginationContent className="flex-wrap justify-center">
              <PaginationItem>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Halaman sebelumnya"
                  disabled={page === 0}
                  onClick={() => onPageChange(page - 1)}
                >
                  <ChevronLeft aria-hidden="true" />
                </Button>
              </PaginationItem>

              {pageItems.map((item, index) =>
                item === "ellipsis" ? (
                  <PaginationItem key={`ellipsis-${index}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={item}>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className={cn(
                        "min-w-7 px-1.5 text-sm tabular-nums",
                        item === page && "bg-accent text-accent-foreground",
                      )}
                      aria-label={`Ke halaman ${item + 1}`}
                      aria-current={item === page ? "page" : undefined}
                      onClick={() => onPageChange(item)}
                    >
                      {item + 1}
                    </Button>
                  </PaginationItem>
                ),
              )}

              <PaginationItem>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Halaman berikutnya"
                  disabled={page >= pageCount - 1}
                  onClick={() => onPageChange(page + 1)}
                >
                  <ChevronRight aria-hidden="true" />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>
    </div>
  );
}
