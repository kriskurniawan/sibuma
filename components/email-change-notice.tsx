import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/reui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EmailChangeNotice({
  email,
  readOnly,
  className,
}: {
  email: string;
  readOnly: boolean;
  className?: string;
}) {
  return (
    <Alert
      variant="warning"
      className={cn("no-print items-start", className)}
    >
      <TriangleAlert aria-hidden="true" />
      <AlertTitle>Wajib ubah email</AlertTitle>
      <AlertDescription>
        <p>
          Email akun{" "}
          <span className="font-medium break-all text-foreground">{email}</span>{" "}
          masih memakai domain kantor{" "}
          <span className="font-medium text-foreground">bmbi.my.id</span>.{" "}
          {readOnly
            ? "Akun ini hanya dapat melihat, jadi minta super admin mengganti email ke alamat pribadi yang aktif."
            : "Ganti ke email pribadi yang aktif agar kode OTP dan pemberitahuan tetap diterima."}
        </p>
      </AlertDescription>
      {!readOnly && (
        <AlertAction>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/profil#email" />}
          >
            Ubah email
          </Button>
        </AlertAction>
      )}
    </Alert>
  );
}
