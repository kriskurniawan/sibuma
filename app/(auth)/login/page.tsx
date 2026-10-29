import { redirect } from "next/navigation";
import { LoginView } from "@/components/auth/login-view";
import { getCurrentUser } from "@/lib/auth";

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

  return <LoginView next={next} />;
}
