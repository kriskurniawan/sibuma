import { cache, Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { DataLoadError } from "@/components/data-load-error";
import { ChecklistConditionSettings } from "@/components/settings/checklist-condition-settings";
import { DocumentSettings } from "@/components/settings/document-settings";
import { PhotoLimitSettings } from "@/components/settings/photo-limit-settings";
import { PolicyForm } from "@/components/settings/policy-form";
import { SettingsDataSkeleton, SettingsPageShell } from "@/components/settings/settings-page-shell";
import { WorkLocationSettings } from "@/components/settings/work-location-settings";
import { can } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { listChecklistConditions } from "@/lib/checklist-conditions";
import { getPolicy } from "@/lib/queries";
import { getPhotoLimits } from "@/lib/photo-limits";
import type { SettingsTab } from "@/lib/settings-tabs";
import { getWorkDocumentSettings } from "@/lib/work-document-settings";
import { listWorkLocations } from "@/lib/work-locations";

export const metadata = { title: "Pengaturan" };

const loadPolicy = cache(getPolicy);

async function PolicyRegion() {
  let policy;
  try { policy = await loadPolicy(); }
  catch { return <DataLoadError message="Kebijakan lembur belum dapat dimuat." />; }
  return <PolicyForm policy={policy} />;
}

async function LocationsRegion() {
  let data;
  try { data = await Promise.all([listWorkLocations({ includeInactive: true }), loadPolicy()]); }
  catch { return <DataLoadError message="Pengaturan lokasi belum dapat dimuat." />; }
  const [locations, policy] = data;
  return <WorkLocationSettings locations={locations} defaultCenter={policy.defaultLocation} defaultRadiusMeters={policy.defaultRadiusMeters} />;
}

async function ConditionsRegion() {
  let conditions;
  try { conditions = await listChecklistConditions({ includeInactive: true }); }
  catch { return <DataLoadError message="Status checklist belum dapat dimuat." />; }
  return <ChecklistConditionSettings conditions={conditions} />;
}

async function DocumentsRegion() {
  let settings;
  try { settings = await getWorkDocumentSettings(); }
  catch { return <DataLoadError message="Pengaturan dokumen belum dapat dimuat." />; }
  return <DocumentSettings settings={settings} />;
}

async function MediaRegion() {
  let limits;
  try { limits = await getPhotoLimits(); }
  catch { return <DataLoadError message="Batas dokumentasi belum dapat dimuat." />; }
  return <PhotoLimitSettings limits={limits} />;
}

function region(tab: SettingsTab, children: ReactNode) {
  return <Suspense fallback={<SettingsDataSkeleton tab={tab} />}>{children}</Suspense>;
}

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user.role, "policy.manage")) redirect("/");
  return <SettingsPageShell panels={{
    kebijakan: region("kebijakan", <PolicyRegion />),
    lokasi: region("lokasi", <LocationsRegion />),
    checklist: region("checklist", <ConditionsRegion />),
    dokumen: region("dokumen", <DocumentsRegion />),
    media: region("media", <MediaRegion />),
  }} />;
}
