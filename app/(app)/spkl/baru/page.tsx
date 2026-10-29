import { redirect } from "next/navigation";
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

  const [team, policy, schedules, divisions, locations] = await Promise.all([
    getTeam(user.id),
    getPolicy(),
    getAssignmentSchedules(user.id),
    getDivisions(user.id),
    listWorkLocations(),
  ]);

  return (
    <SpklForm
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
