"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { clearPrivateBrowserCache } from "@/components/pwa-register";

export function ProfileActions() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        setLoggingOut(false);
        toast.error("Server belum mengakhiri sesi. Periksa koneksi lalu coba lagi.");
        return;
      }
      // Drop anything that could expose the previous account on a shared phone.
      await clearPrivateBrowserCache();
      toast.success("Sampai jumpa!");
      router.push("/login");
      router.refresh();
    } catch {
      setLoggingOut(false);
      toast.error("Gagal keluar. Coba lagi.");
    }
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <Button
        type="button"
        variant="destructive"
        className="w-full"
        onClick={logout}
        disabled={loggingOut}
      >
        {loggingOut ? (
          <>
            <Spinner />
            Keluar…
          </>
        ) : (
          <>
            <LogOut />
            Keluar dari akun
          </>
        )}
      </Button>
    </div>
  );
}
