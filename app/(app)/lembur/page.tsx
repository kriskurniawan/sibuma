import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LemburPageShell, LemburRows, LemburView } from "@/components/lembur/lembur-view";
import { spklListCountSlots } from "@/components/lembur/spkl-list-counts";
import { getCurrentUser } from "@/lib/auth";
import { getSpklListItems } from "@/lib/spkl-list-queries";
import type { SessionUser, SpklListItem } from "@/lib/types";

export const metadata = {
  title: "Lembur",
};

async function LemburList({ user }: { user: SessionUser }) {
  let items: SpklListItem[];
  try {
    items = await getSpklListItems(user);
  } catch {
    return <LemburRows error />;
  }
  return <LemburRows items={items} />;
}

export default async function LemburPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "atasan") redirect("/");

  return (
    <LemburPageShell>
      <LemburView counts={spklListCountSlots(user)}>
        <Suspense fallback={<LemburRows />}>
          <LemburList user={user} />
        </Suspense>
      </LemburView>
    </LemburPageShell>
  );
}
