"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReportPrintButton() {
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
  return (
    <Button type="button" size="sm" onClick={printAll}>
      <Printer aria-hidden="true" />
      Cetak / PDF
    </Button>
  );
}
