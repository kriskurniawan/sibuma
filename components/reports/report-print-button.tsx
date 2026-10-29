"use client";

import { useEffect, type ComponentProps } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { FileDown, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReportPrintButton({
  variant = "default",
  href,
}: {
  variant?: ComponentProps<typeof Button>["variant"];
  /** Bila diisi, tombol mengunduh PDF server, bukan mencetak halaman. */
  href?: string;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const printing = params.get("print") === "1";
  useEffect(() => {
    if (!printing) return;
    const timer = setTimeout(() => window.print(), 300);
    return () => clearTimeout(timer);
  }, [printing]);
  function printAll() {
    if (printing) return window.print();
    const search = new URLSearchParams(params.toString());
    search.set("print", "1");
    search.delete("page");
    window.open(`${pathname}?${search}`, "_blank", "noopener,noreferrer");
  }
  if (href) {
    return (
      <Button
        size="sm"
        variant={variant}
        nativeButton={false}
        render={<a href={href} />}
      >
        <FileDown aria-hidden="true" />
        Unduh PDF
      </Button>
    );
  }
  return (
    <Button type="button" size="sm" variant={variant} onClick={printAll}>
      <Printer aria-hidden="true" />
      Cetak / PDF
    </Button>
  );
}
