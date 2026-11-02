import { cache, Suspense } from "react";
import { redirect } from "next/navigation";
import { MapPin } from "lucide-react";
import { DataLoadError } from "@/components/data-load-error";
import { ProfileServices } from "@/components/profile/profile-services";
import { ProfileLocationSkeleton, ProfilePageShell, ProfilePolicySkeleton } from "@/components/profile/profile-page-shell";
import { Badge } from "@/components/reui/badge";
import { DataRow } from "@/components/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth";
import { getPolicy, getTeam } from "@/lib/queries";
import { currentTimeZoneLabel, durationLabel, formatDateTime } from "@/lib/time";
import { listWorkLocations } from "@/lib/work-locations";

export const metadata = { title: "Profil" };

const loadPolicy = cache(getPolicy);

async function TeamDescription({ userId }: { userId: string }) {
  let team;
  try { team = await getTeam(userId); }
  catch { return "Jumlah pekerja belum tersedia"; }
  return <>{team.length} pekerja</>;
}

async function PolicyRegion() {
  let policy;
  try { policy = await loadPolicy(); }
  catch { return <DataLoadError message="Kebijakan lembur belum dapat dimuat." />; }
  return <div className="flex min-w-0 flex-col">
    <DataRow label="Batas harian" value={durationLabel(policy.dailyLimitMinutes)} />
    <DataRow label="Batas mingguan" value={durationLabel(policy.weeklyLimitMinutes)} />
    <DataRow label="Akurasi GPS maksimal" value={`${policy.maxGpsAccuracyMeters} m`} />
    <DataRow label="Toleransi dokumentasi" value={`${policy.docGraceMinutes} menit`} />
    <DataRow label="Radius default titik" value={`${policy.defaultRadiusMeters} m`} />
    <DataRow label="Dokumentasi" value={<Badge variant={policy.requireDocumentation ? "info-light" : "outline"}>{policy.requireDocumentation ? "Wajib" : "Opsional"}</Badge>} />
  </div>;
}

async function LocationsRegion({ isAdmin }: { isAdmin: boolean }) {
  let data;
  try { data = await Promise.all([listWorkLocations(), isAdmin ? loadPolicy() : Promise.resolve(null)]); }
  catch { return <DataLoadError message="Lokasi kerja belum dapat dimuat." />; }
  const [locations, policy] = data;
  const primaryLocation = locations[0];
  return <div className="flex min-w-0 flex-col">
    <DataRow label="Titik absensi" value={<span className="inline-flex items-start gap-2"><MapPin className="size-4 shrink-0" aria-hidden="true" /><span>{primaryLocation ? `${primaryLocation.name}${locations.length > 1 ? ` +${locations.length - 1} titik lain` : ""}` : "Belum diatur"}</span></span>} />
    <DataRow label="Zona waktu" value={policy ? `${policy.timezone} (${currentTimeZoneLabel()})` : currentTimeZoneLabel()} />
  </div>;
}

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const isAdmin = user.role === "super_admin";
  return <ProfilePageShell
    user={user}
    teamDescription={user.role === "atasan" ? <Suspense fallback={<Skeleton className="h-3 w-20" />}><TeamDescription userId={user.id} /></Suspense> : undefined}
    policy={<Suspense fallback={<ProfilePolicySkeleton />}><PolicyRegion /></Suspense>}
    locations={<Suspense fallback={<ProfileLocationSkeleton />}><LocationsRegion isAdmin={isAdmin} /></Suspense>}
    services={isAdmin ? <ProfileServices /> : undefined}
    serverTime={formatDateTime(new Date().toISOString(), "d MMM yyyy, HH:mm")}
  />;
}
