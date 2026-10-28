import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Informasi checklist",
    template: "%s · SIBUMA",
  },
  description:
    "Informasi publik hasil checklist area gedung. Hanya item yang dipublikasikan yang ditampilkan.",
  robots: { index: false, follow: false, nocache: true },
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-svh bg-background">{children}</div>;
}
