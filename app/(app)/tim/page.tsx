import { redirect } from "next/navigation";
import { TeamView } from "@/components/team/team-view";
import { getCurrentUser } from "@/lib/auth";
import { getDivisions, getTeamOverview, getTeamTotals } from "@/lib/queries";
import { pageRequest } from "@/lib/pagination";

export const metadata = { title: "Tim" };

export default async function TeamPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "atasan") redirect("/");
  const params = await searchParams;
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const status = first(params.status);
  const filters = { search: first(params.search) ?? "", division: first(params.division) ?? "semua",
    status: status === "aktif" || status === "nonaktif" ? status : "semua" } as const;
  const printing = first(params.print) === "1";
  const team = await getTeamOverview(user.id, filters, printing ? undefined : pageRequest(first(params.page), first(params.size)));
  const [divisions, totals] = await Promise.all([getDivisions(user.id), getTeamTotals(user.id)]);
  return <TeamView team={team.rows} total={team.total} pagination={team.pagination ?? { pageIndex: 0, pageSize: Math.max(10, team.total) }}
    totals={totals} filters={filters} printRows={printing ? team.rows : undefined} divisions={divisions} />;
}
