import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { TimeZoneBootstrap } from "@/components/time-zone-bootstrap";
import { getActiveTimeZone } from "@/lib/active-time-zone";
import { getCurrentUser } from "@/lib/auth";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const timeZone = getActiveTimeZone();

  return (
    <>
      <TimeZoneBootstrap timeZone={timeZone} />
      <AppShell user={user}>{children}</AppShell>
    </>
  );
}
