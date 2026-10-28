import { redirect } from "next/navigation";
import { LoginView } from "@/components/auth/login-view";
import { getCurrentUser, isDemoMode } from "@/lib/auth";
import { select } from "@/lib/db";

export const metadata = {
  title: "Masuk",
  description: "Masuk ke SIBUMA dengan OTP email atau WhatsApp.",
};

function safeNext(value: string | string[] | undefined) {
  const text = Array.isArray(value) ? value[0] : value;
  if (!text || !text.startsWith("/")) return "/";
  if (text.startsWith("//") || text.includes("\\")) return "/";
  return text;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);

  const user = await getCurrentUser();
  if (user) redirect(next);

  const employees = isDemoMode() ? await select("employees", "active AND id=ANY($1::text[])", [["emp_budi", "emp_andi", "emp_siti", "emp_rizky"]]) : [];
  const demoAccounts = isDemoMode()
    ? employees
        .filter(
          (employee) =>
            employee.active &&
            ["emp_budi", "emp_andi", "emp_siti", "emp_rizky"].includes(
              employee.id,
            ),
        )
        .sort((a, b) => (a.role === "atasan" ? -1 : b.role === "atasan" ? 1 : 0))
        .map((employee) => ({
          id: employee.id,
          name: employee.name,
          role: employee.role,
          nik: employee.nik,
        }))
    : [];

  return (
    <LoginView
      demoAccounts={demoAccounts}
      demoMode={isDemoMode()}
      next={next}
    />
  );
}
