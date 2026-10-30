import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LogoMark } from "@/components/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-12 text-foreground">
      <div className="flex w-full max-w-sm flex-col items-center gap-3 text-center">
        <LogoMark className="size-10" />
        <p className="text-sm font-medium text-muted-foreground">404</p>
        <h1 className="text-xl font-semibold tracking-tight">
          Halaman tidak ditemukan
        </h1>
        <p className="text-sm text-muted-foreground">
          Tautan ini tidak tersedia atau sudah dipindahkan.
        </p>
        <Button nativeButton={false} render={<Link href="/" />}>
          <ArrowLeft aria-hidden="true" />
          Kembali ke beranda
        </Button>
      </div>
    </main>
  );
}
