"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Aksi utama halaman pada mobile. Diposisikan di atas bottom navigation agar
 * tetap terjangkau tanpa mendorong konten halaman.
 */
export function MobileFab({
  href,
  onClick,
  disabled,
  title,
  children,
  className,
}: {
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="above-mobile-nav pointer-events-none fixed inset-x-0 z-30 flex justify-end px-4 print:hidden md:hidden">
      {href ? (
        <Button
          size="lg"
          className={cn("pointer-events-auto rounded-full", className)}
          nativeButton={false}
          render={<Link href={href} />}
          title={title}
        >
          {children}
        </Button>
      ) : (
        <Button
          type="button"
          size="lg"
          className={cn("pointer-events-auto rounded-full", className)}
          onClick={onClick}
          disabled={disabled}
          title={title}
        >
          {children}
        </Button>
      )}
    </div>
  );
}

/** Placeholder FAB untuk route loading agar posisi aksi tidak bergeser. */
export function MobileFabSkeleton({ className }: { className?: string }) {
  return (
    <div className="above-mobile-nav pointer-events-none fixed inset-x-0 z-30 flex justify-end px-4 print:hidden md:hidden">
      <Skeleton className={cn("h-9 w-36 rounded-full", className)} />
    </div>
  );
}
