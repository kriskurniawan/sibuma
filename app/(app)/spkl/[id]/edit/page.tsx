import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
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
  getSpklDetail,
  getTeam,
} from "@/lib/queries";
import { toLocalDateInput, toLocalTimeInput } from "@/lib/time";
import { listWorkLocations } from "@/lib/work-locations";

export const metadata = {
  title: "Ubah SPKL",
};

export default async function EditSpklPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "atasan") redirect("/");
  if (isReadOnly(user)) redirect(`/spkl/${(await params).id}`);

  return (
    <SpklFormShell mode="edit">
      <Suspense fallback={<SpklFormDataSkeleton mode="edit" />}>
        <EditSpklData user={user} params={params} />
      </Suspense>
    </SpklFormShell>
  );
}

async function EditSpklData({ user, params }: {
  user: SessionUser;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let data;
  try {
    data = await Promise.all([
      getSpklDetail(id, user),
      getTeam(user.id),
      getPolicy(),
      getAssignmentSchedules(user.id),
      getDivisions(user.id),
      listWorkLocations({ includeInactive: true }),
    ]);
  } catch {
    return <Frame><FramePanel><DataLoadError message="Data SPKL gagal dimuat." /></FramePanel></Frame>;
  }
  const [detail, team, policy, schedules, divisions, locations] = data;

  if (!detail) notFound();
  if (!detail.canManage) redirect(`/spkl/${id}`);
  if (detail.status === "selesai" || detail.status === "dibatalkan") {
    redirect(`/spkl/${id}`);
  }

  const activeWorkerIds = setFrom(
    team
      .filter((employee) => employee.active)
      .map((employee) => employee.id),
  );
  const assignedActiveWorkers = detail.workers
    .filter((employee) => activeWorkerIds.has(employee.id))
    .map((employee) => employee.id);

  return (
    <SpklForm
      hideHeading
      mode="edit"
      team={team.filter((employee) => employee.active)}
      divisions={divisions}
      locations={locations}
      policy={policy}
      schedules={schedules}
      defaultDate={toLocalDateInput(detail.spkl.startAt)}
      initial={{
        id: detail.spkl.id,
        title: detail.spkl.title,
        description: detail.spkl.description,
        date: toLocalDateInput(detail.spkl.startAt),
        startTime: toLocalTimeInput(detail.spkl.startAt),
        endTime: toLocalTimeInput(detail.spkl.endAt),
        workLocationId: detail.spkl.workLocationId,
        radiusMeters: detail.spkl.radiusMeters,
        divisionId: detail.spkl.divisionId ?? "",
        requiresDocumentation: detail.spkl.requiresDocumentation,
        workerIds:
          assignedActiveWorkers.length > 0
            ? assignedActiveWorkers
            : detail.workers.map((employee) => employee.id),
      }}
    />
  );
}

function setFrom(values: string[]) {
  return new Set(values);
}
