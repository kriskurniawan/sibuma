import Link from "next/link";
import { redirect } from "next/navigation";
import { ScrollText } from "lucide-react";
import { ChecklistConditionSettings } from "@/components/settings/checklist-condition-settings";
import { PolicyForm } from "@/components/settings/policy-form";
import { WorkLocationSettings } from "@/components/settings/work-location-settings";
import { PageHeader } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { listChecklistConditions } from "@/lib/checklist-conditions";
import { getPolicy } from "@/lib/queries";
import { listWorkLocations } from "@/lib/work-locations";

export const metadata = {
  title: "Pengaturan",
};

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user.role, "policy.manage")) redirect("/");

  const [policy, conditions, locations] = await Promise.all([
    getPolicy(),
    listChecklistConditions({ includeInactive: true }),
    listWorkLocations({ includeInactive: true }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Kelola"
        title="Pengaturan."
        description="Kebijakan lembur, titik absensi, dan pilihan status checklist."
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
        <WorkLocationSettings
          locations={locations}
          defaultCenter={policy.defaultLocation}
          defaultRadiusMeters={policy.defaultRadiusMeters}
        />
        <ChecklistConditionSettings conditions={conditions} />
      </div>
    </div>
  );
}
