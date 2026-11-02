"use client";

import { useSessionUser } from "@/components/session-user-provider";
import { TeamPageShell } from "@/components/team/team-page-shell";
import { TeamSupervisorsLoading } from "@/components/team/team-supervisors-loading";

export default function TimLoading() {
  const user = useSessionUser();
  return user.role === "super_admin" ? <TeamSupervisorsLoading /> : <TeamPageShell />;
}
