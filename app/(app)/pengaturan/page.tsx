import Link from "next/link";
import { redirect } from "next/navigation";
import { ScrollText } from "lucide-react";
import { ChecklistConditionSettings } from "@/components/settings/checklist-condition-settings";
import { PolicyForm } from "@/components/settings/policy-form";
import { PageHeader } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { listChecklistConditions } from "@/lib/checklist-conditions";
import { getPolicy } from "@/lib/queries";

export const metadata = {
  title: "Pengaturan",
};

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user.role, "policy.manage")) redirect("/");

  const [policy, conditions] = await Promise.all([
    getPolicy(),
    listChecklistConditions({ includeInactive: true }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Kelola"
        title="Pengaturan."
        description="Kebijakan lembur dan pilihan status checklist."
        descriptionClassName="hidden md:block"
        action={
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<Link href="/audit" />}
          >
            <ScrollText aria-hidden="true" />
            Lihat log audit
          </Button>
        }
      />

      <div className="flex w-full max-w-4xl flex-col gap-6">
        <PolicyForm policy={policy} />
        <ChecklistConditionSettings conditions={conditions} />
      </div>
    </div>
  );
}
