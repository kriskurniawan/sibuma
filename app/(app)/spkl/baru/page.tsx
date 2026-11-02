import { Suspense } from "react";
import { redirect } from "next/navigation";
import { SpklFormShell } from "@/components/spkl/spkl-route-shell";
import { SpklFormDataSkeleton } from "@/components/spkl/spkl-route-skeletons";
import { DataLoadError } from "@/components/data-load-error";
import { Frame, FramePanel } from "@/components/reui/frame";
import type { SessionUser } from "@/lib/types";
import { SpklForm } from "@/components/spkl/spkl-form";
import { isReadOnly } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import {
  getAssignmentSchedules,
  getDivisions,
  getPolicy,
  getTeam,
} from "@/lib/queries";
import { listWorkLocations } from "@/lib/work-locations";
import { todayLocal } from "@/lib/time";

export const metadata = {
  title: "Buat SPKL",
};

export default async function CreateSpklPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "atasan") redirect("/");
  if (isReadOnly(user)) redirect("/lembur");

  return (
    <SpklFormShell mode="create">
      <Suspense fallback={<SpklFormDataSkeleton />}>
        <CreateSpklData user={user} />
      </Suspense>
    </SpklFormShell>
  );
}

async function CreateSpklData({ user }: { user: SessionUser }) {
  let data;
  try {
    data = await Promise.all([
    getTeam(user.id),
    getPolicy(),
    getAssignmentSchedules(user.id),
    getDivisions(user.id),
    listWorkLocations(),
    ]);
  } catch {
    return <Frame><FramePanel><DataLoadError message="Pilihan SPKL gagal dimuat." /></FramePanel></Frame>;
  }
  const [team, policy, schedules, divisions, locations] = data;

  return (
    <SpklForm
      hideHeading
      mode="create"
      team={team.filter((employee) => employee.active)}
      divisions={divisions}
      locations={locations}
      policy={policy}
      schedules={schedules}
      defaultDate={todayLocal()}
    />
  );
}
