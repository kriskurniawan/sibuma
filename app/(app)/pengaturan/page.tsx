import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ScrollText } from "lucide-react";
import { ChecklistConditionSettings } from "@/components/settings/checklist-condition-settings";
import { DocumentSettings } from "@/components/settings/document-settings";
import { PhotoLimitSettings } from "@/components/settings/photo-limit-settings";
import { PolicyForm } from "@/components/settings/policy-form";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { WorkLocationSettings } from "@/components/settings/work-location-settings";
import { PageHeader } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { can } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { listChecklistConditions } from "@/lib/checklist-conditions";
import { getPolicy } from "@/lib/queries";
import { getPhotoLimits } from "@/lib/photo-limits";
import { SETTINGS_TABS, type SettingsTab } from "@/lib/settings-tabs";
import { getWorkDocumentSettings } from "@/lib/work-document-settings";
import { listWorkLocations } from "@/lib/work-locations";

export const metadata = {
  title: "Pengaturan",
};

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user.role, "policy.manage")) redirect("/");

  const [policy, conditions, locations, documentSettings, photoLimits] =
    await Promise.all([
      getPolicy(),
      listChecklistConditions({ includeInactive: true }),
      listWorkLocations({ includeInactive: true }),
      getWorkDocumentSettings(),
      getPhotoLimits(),
    ]);

  const panels: Record<SettingsTab, ReactNode> = {
    kebijakan: <PolicyForm policy={policy} />,
    lokasi: (
      <WorkLocationSettings
        locations={locations}
        defaultCenter={policy.defaultLocation}
        defaultRadiusMeters={policy.defaultRadiusMeters}
      />
    ),
    checklist: <ChecklistConditionSettings conditions={conditions} />,
    dokumen: <DocumentSettings settings={documentSettings} />,
    media: <PhotoLimitSettings limits={photoLimits} />,
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Kelola"
        title="Pengaturan."
        description="Kebijakan, lokasi, checklist, dan batas dokumentasi."
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

      <div className="w-full max-w-4xl">
        <SettingsTabs>
          {SETTINGS_TABS.map((tab) => (
            <TabsContent key={tab.value} value={tab.value} keepMounted>
              {panels[tab.value]}
            </TabsContent>
          ))}
        </SettingsTabs>
      </div>
    </div>
  );
}
