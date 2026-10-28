import Link from "next/link";
import { redirect } from "next/navigation";
import { ScrollText } from "lucide-react";
import { PolicyForm } from "@/components/settings/policy-form";
import { PageHeader } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { getPolicy } from "@/lib/queries";

export const metadata = {
  title: "Pengaturan",
};

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "atasan") redirect("/");

  const policy = await getPolicy();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Kelola"
        title="Pengaturan."
        description="Atur kebijakan lembur yang berlaku untuk seluruh tim, mulai dari batas durasi, pembulatan, radius absensi, hingga kewajiban dokumentasi."
        action={
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/audit" />}
          >
            <ScrollText aria-hidden="true" />
            Lihat log audit
          </Button>
        }
      />

      <div className="w-full max-w-4xl">
        <PolicyForm policy={policy} />
      </div>
    </div>
  );
}
