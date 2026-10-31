import type { Metadata } from "next";
import { TimeZoneBootstrap } from "@/components/time-zone-bootstrap";
import { getPolicy } from "@/lib/queries";

export const metadata: Metadata = {
  title: {
    default: "Informasi checklist",
    template: "%s · SIBUMA",
  },
  description:
    "Informasi publik hasil checklist area gedung. Hanya item yang dipublikasikan yang ditampilkan.",
  robots: { index: false, follow: false, nocache: true },
};

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const policy = await getPolicy();

  return (
    <div className="min-h-svh bg-background">
      <TimeZoneBootstrap timeZone={policy.timezone} />
      {children}
    </div>
  );
}
