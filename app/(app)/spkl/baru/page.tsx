import { redirect } from "next/navigation";
import { SpklForm } from "@/components/spkl/spkl-form";
import { getCurrentUser } from "@/lib/auth";
import {
  getAssignmentSchedules,
  getDivisions,
  getPolicy,
  getTeam,
} from "@/lib/queries";
import { todayLocal } from "@/lib/time";

export const metadata = {
  title: "Buat SPKL",
};

export default async function CreateSpklPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "atasan") redirect("/");

  const [team, policy, schedules, divisions] = await Promise.all([
    getTeam(user.id),
    getPolicy(),
    getAssignmentSchedules(user.id),
    getDivisions(user.id),
  ]);

  return (
    <SpklForm
      mode="create"
      team={team.filter((employee) => employee.active)}
      divisions={divisions}
      policy={policy}
      schedules={schedules}
      defaultDate={todayLocal()}
    />
  );
}
