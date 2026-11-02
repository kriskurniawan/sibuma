import { redirect } from "next/navigation";
import { MenuPageShell } from "@/components/menu/menu-page-shell";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "Menu" };

export default async function MenuPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "pekerja") redirect("/");

  return <MenuPageShell user={user} />;
}
