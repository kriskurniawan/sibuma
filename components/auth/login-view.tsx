"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { ArrowLeft, Check, ChevronDown, Copy } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/logo";
import { Alert, AlertDescription } from "@/components/reui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Spinner } from "@/components/ui/spinner";
import type { EmployeeRole } from "@/lib/types";

interface DemoAccount {
  id: string;
  name: string;
  role: EmployeeRole;
  nik: string;
}

interface LoginViewProps {
  demoAccounts: DemoAccount[];
  demoMode: boolean;
  next?: string;
}

export function LoginView({
  demoAccounts,
  demoMode,
  next = "/",
}: LoginViewProps) {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [identifier, setIdentifier] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [deliveryMessage, setDeliveryMessage] = useState("");
  const [deliveryChannel, setDeliveryChannel] = useState("WhatsApp");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [maskedDestination, setMaskedDestination] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [resendDeadline, setResendDeadline] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const busy = loading || Boolean(demoLoading);

  // Derive the countdown from an absolute deadline so background throttling and
  // app resume cannot leave a stale "Kirim ulang 45 dtk" label.
  useEffect(() => {
    if (!resendDeadline) return;
    const tick = () =>
      // Wall clock is intentional: the label must follow real elapsed time.
      setResendIn(Math.max(0, Math.ceil((resendDeadline - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [resendDeadline]);

  useEffect(() => {
    if (step !== "otp") return;
    const timer = window.setTimeout(() => {
      document.getElementById("otp")?.focus();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [step]);

  async function requestOtp(isResend = false) {
    setError(null);
    // Keep the current challenge and entered code until a resend succeeds; a
    // failed resend must not destroy the only working OTP.
    if (!isResend) {
      setCode("");
      setChallengeId("");
      setDevCode(null);
    }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        message?: string;
        devCode?: string;
        resendAfter?: number;
        maskedDestination?: string;
        challengeId: string;
        channel: "whatsapp" | "email";
      };
      if (!response.ok || !data.ok) {
        setError(data.message ?? "Gagal mengirim OTP.");
        return;
      }
      setStep("otp");
      setCode("");
      setMaskedDestination(data.maskedDestination ?? "");
      setChallengeId(data.challengeId);
      setDeliveryChannel(data.channel === "email" ? "Email" : "WhatsApp");
      setDeliveryMessage(data.message ?? "OTP dikirim ke kontak terdaftar.");
      setDevCode(data.devCode ?? null);
      const resendAfter = data.resendAfter ?? 60;
      setResendIn(resendAfter);
      // Anchor the countdown to a wall-clock deadline, not to render timing.
      setResendDeadline(Date.now() + resendAfter * 1000);
      setCopied(false);
      if (isResend) toast.success("Kode OTP baru sudah dikirim.");
    } catch {
      setError("Tidak dapat menghubungi server. Periksa koneksi internetmu.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePhoneSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!identifier.trim()) {
      setError("Masukkan email atau WhatsApp terlebih dahulu.");
      return;
    }
    await requestOtp(false);
  }

  async function verifyOtp(event?: React.FormEvent) {
    event?.preventDefault();
    if (code.length !== 6) {
      setError("Masukkan kode OTP 6 digit.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, challengeId, code }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        message?: string;
      };
      if (!response.ok || !data.ok) {
        setError(data.message ?? "Kode OTP tidak valid.");
        return;
      }
      toast.success("Berhasil masuk. Selamat bekerja!");
      router.push(next);
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server. Periksa koneksi internetmu.");
    } finally {
      setLoading(false);
    }
  }

  async function loginDemo(employeeId: string) {
    setError(null);
    setDemoLoading(employeeId);
    try {
      const response = await fetch("/api/auth/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        message?: string;
      };
      if (!response.ok || !data.ok) {
        setError(data.message ?? "Tidak dapat masuk dengan akun demo.");
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server.");
    } finally {
      setDemoLoading(null);
    }
  }

  function fillCode(value: string) {
    const clean = value.replace(/\D/g, "").slice(0, 6);
    setCode(clean);
    setError(null);
    window.setTimeout(() => document.getElementById("otp")?.focus(), 0);
  }

  async function copyDemoCode() {
    if (!devCode) return;
    try {
      await navigator.clipboard.writeText(devCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Gagal menyalin kode.");
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-8">
      <section
        aria-labelledby="login-title"
        className="flex w-full min-w-0 max-w-sm flex-col gap-6"
      >
        <div className="flex justify-center">
          <Logo />
        </div>

        <Card>
          <CardHeader>
            <CardTitle id="login-title" role="heading" aria-level={1}>
              {step === "phone" ? "Masuk" : "Verifikasi OTP"}
            </CardTitle>
            <CardDescription id="login-description">
              {step === "phone" ? (
                "Gunakan email atau WhatsApp yang terdaftar oleh admin."
              ) : (
                <>
                  Masukkan kode 6 digit dari {deliveryChannel} ke{" "}
                  <span className="font-medium text-foreground">
                    {maskedDestination}
                  </span>
                  .
                </>
              )}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {step === "phone" ? (
              <form onSubmit={handlePhoneSubmit} className="grid gap-4">
                <FieldGroup>
                  <Field data-invalid={Boolean(error)}>
                    <FieldLabel htmlFor="identifier">Email atau WhatsApp</FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        id="identifier"
                        name="identifier"
                        type="text"
                        autoComplete="username"
                        autoCapitalize="none"
                        spellCheck={false}
                        placeholder="nama@perusahaan.com atau 08xx"
                        value={identifier}
                        disabled={busy}
                        onChange={(event) => {
                          setIdentifier(event.target.value);
                          setError(null);
                        }}
                        aria-invalid={Boolean(error)}
                        aria-describedby={
                          error ? "login-error" : "login-description"
                        }
                      />
                    </InputGroup>
                    <FieldDescription>
                      Jika WhatsApp gagal, OTP otomatis dikirim ke email yang terdaftar pada akunmu.
                    </FieldDescription>
                  </Field>
                </FieldGroup>

                {error && (
                  <Alert variant="destructive" id="login-error">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  size="lg"
                  disabled={busy}
                  className="w-full"
                  aria-live="polite"
                >
                  {loading ? (
                    <>
                      <Spinner />
                      Mengirim OTP…
                    </>
                  ) : (
                    "Kirim OTP"
                  )}
                </Button>

                <p className="text-center text-xs text-muted-foreground">
                  Belum terdaftar? Hubungi admin Anda.
                </p>
              </form>
            ) : (
              <form onSubmit={verifyOtp} className="grid gap-4">
                <Alert variant="info" role="status">
                  <AlertDescription>{deliveryMessage}</AlertDescription>
                </Alert>
                {devCode && (
                  <Alert variant="warning" role="status">
                    <AlertDescription>
                      <p>
                        Kode demo:{" "}
                        <span className="font-mono font-semibold tracking-widest text-foreground">
                          {devCode}
                        </span>
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={copyDemoCode}
                          disabled={busy}
                        >
                          {copied ? (
                            <Check aria-hidden="true" />
                          ) : (
                            <Copy aria-hidden="true" />
                          )}
                          {copied ? "Tersalin" : "Salin"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fillCode(devCode)}
                          disabled={busy}
                        >
                          Isi otomatis
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                <FieldGroup>
                  <Field data-invalid={Boolean(error)}>
                    <FieldLabel htmlFor="otp">Kode OTP</FieldLabel>
                    <InputOTP
                      id="otp"
                      name="otp"
                      maxLength={6}
                      value={code}
                      onChange={(value) => {
                        setCode(value);
                        setError(null);
                      }}
                      disabled={busy}
                      inputMode="numeric"
                      pattern={REGEXP_ONLY_DIGITS}
                      autoComplete="one-time-code"
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? "login-error" : "otp-hint"}
                      containerClassName="w-full justify-center gap-2"
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} aria-invalid={Boolean(error)} />
                        <InputOTPSlot index={1} aria-invalid={Boolean(error)} />
                        <InputOTPSlot index={2} aria-invalid={Boolean(error)} />
                      </InputOTPGroup>
                      <InputOTPSeparator />
                      <InputOTPGroup>
                        <InputOTPSlot index={3} aria-invalid={Boolean(error)} />
                        <InputOTPSlot index={4} aria-invalid={Boolean(error)} />
                        <InputOTPSlot index={5} aria-invalid={Boolean(error)} />
                      </InputOTPGroup>
                    </InputOTP>
                    <FieldDescription id="otp-hint" className="text-xs">
                      Berlaku 5 menit. Jangan bagikan kode ini.
                    </FieldDescription>
                  </Field>
                </FieldGroup>

                {error && (
                  <Alert variant="destructive" id="login-error">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  size="lg"
                  disabled={busy || !challengeId || code.length !== 6}
                  className="w-full"
                  aria-live="polite"
                >
                  {loading ? (
                    <>
                      <Spinner />
                      Memverifikasi…
                    </>
                  ) : (
                    "Verifikasi & masuk"
                  )}
                </Button>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      setStep("phone");
                      setError(null);
                      setDevCode(null);
                      setCode("");
                      window.setTimeout(
                        () => document.getElementById("identifier")?.focus(),
                        0,
                      );
                    }}
                  >
                    <ArrowLeft aria-hidden="true" />
                    Ganti kontak
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={resendIn > 0 || busy}
                    onClick={() => requestOtp(true)}
                  >
                    {resendIn > 0
                      ? `Kirim ulang ${resendIn} dtk`
                      : "Kirim ulang"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>

          {demoMode && demoAccounts.length > 0 && step === "phone" && (
            <CardFooter>
              <Collapsible className="flex w-full flex-col gap-3">
                <CollapsibleTrigger
                  disabled={busy}
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="group w-full justify-between"
                    />
                  }
                >
                  Coba akun demo
                  <ChevronDown
                    aria-hidden="true"
                    className="group-aria-expanded:rotate-180"
                  />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="flex flex-col gap-3">
                    <p className="text-xs text-muted-foreground">
                      Masuk tanpa OTP, khusus mode demo.
                    </p>
                    <div className="flex flex-col gap-2">
                      {demoAccounts.map((account) => (
                        <Button
                          key={account.id}
                          type="button"
                          variant="outline"
                          disabled={busy}
                          onClick={() => loginDemo(account.id)}
                          className="w-full min-w-0 justify-start gap-2"
                          aria-live="polite"
                        >
                          <span className="min-w-0 flex-1 truncate text-left">
                            {account.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {account.role === "atasan" ? "Atasan" : "Pekerja"}
                          </span>
                          {demoLoading === account.id && (
                            <>
                              <Spinner />
                              <span className="sr-only">Sedang masuk…</span>
                            </>
                          )}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardFooter>
          )}
        </Card>

        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          Dengan masuk, Anda menyetujui kebijakan privasi perusahaan untuk data
          nomor HP, lokasi, dan foto absensi.
        </p>
      </section>
    </main>
  );
}
