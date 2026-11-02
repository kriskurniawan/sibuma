import "server-only";
import { Cloud, Database, Mail, MessageCircle, Smartphone } from "lucide-react";
import { Badge } from "@/components/reui/badge";
import { getCurrentUser } from "@/lib/auth";
import { isNeonBackend } from "@/lib/db-state";
import { isS3Configured } from "@/lib/storage-config";

/** Configuration is available without waiting for profile database regions. */
export async function ProfileServices() {
  const user = await getCurrentUser();
  if (user?.role !== "super_admin") return null;
  const chateryConfigured = Boolean(process.env.CHATERY_API_URL && process.env.CHATERY_API_KEY && process.env.CHATERY_SESSION_ID);
  const resendConfigured = Boolean(process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM_EMAIL?.trim());
  const neonDatabase = isNeonBackend();
  const neonStorage = isS3Configured();
  return <>
    <IntegrationRow icon={MessageCircle} title="Chatery WhatsApp" description={chateryConfigured ? "OTP dan notifikasi melalui API Chatery." : "OTP beralih ke email jika Resend tersedia. Notifikasi SPKL gagal hingga Chatery dikonfigurasi."} configured={chateryConfigured} />
    <IntegrationRow icon={Mail} title="Resend Email" description={resendConfigured ? "Login email dan OTP cadangan. Penerimaan perlu diuji." : "RESEND_API_KEY dan RESEND_FROM_EMAIL belum dikonfigurasi."} configured={resendConfigured} />
    <IntegrationRow icon={Database} title="Neon Postgres" description={neonDatabase ? "Data tersimpan dengan kontrol versi." : "DATABASE_URL belum dikonfigurasi. Penyimpanan lokal tidak tersedia."} configured={neonDatabase} />
    <IntegrationRow icon={Cloud} title="Object Storage S3" description={neonStorage ? "Bucket privat, diakses melalui proxy aplikasi." : "Object storage belum dikonfigurasi. Unggahan tidak dapat disimpan."} configured={neonStorage} />
    <div className="flex items-start gap-3">
      <Smartphone className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-1"><p className="text-sm font-medium">PWA & GPS</p><p className="text-xs text-muted-foreground">Pasang ke layar utama. GPS memerlukan HTTPS atau localhost.</p></div>
      <Badge variant="success-light">Siap</Badge>
    </div>
  </>;
}

function IntegrationRow({ icon: Icon, title, description, configured }: { icon: typeof Mail; title: string; description: string; configured: boolean }) {
  return <div className="flex items-start gap-3">
    <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">{title}</p><Badge variant={configured ? "success-light" : "warning-light"}>{configured ? "Dikonfigurasi" : "Belum dikonfigurasi"}</Badge></div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  </div>;
}
