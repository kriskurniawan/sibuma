import "server-only";
import { OTP_LOCK_MINUTES, OTP_MAX_ATTEMPTS, OTP_RESEND_SECONDS, OTP_TTL_SECONDS } from "./constants";
import { canEmployeeLogin, maskDestination, normalizeLoginIdentifier } from "./login-identity";
import { deliverOtp } from "./otp-delivery";
import { generateOtp, hashOtp, otpSalt, safeCompareHash } from "./security";
import { mutateDb, pushAudit } from "./store";
import type { OtpRecord } from "./types";

const accountError = "Akun belum terdaftar/aktif atau NIK dan atasan belum lengkap. Hubungi atasanmu.";
const demoMode = () => process.env.DEMO_MODE === "true";

export async function requestOtp(value: string) {
  const login = normalizeLoginIdentifier(value);
  if (!login) return { error: "Masukkan email atau nomor WhatsApp yang valid.", status: 400 };
  const outcome = await mutateDb({ kind: "otp", identifier: login.identifier }, (db) => {
    const now = new Date();
    const employee = db.employees.find(item => login.channel === "email" ? item.email === login.identifier : item.phone === login.identifier);
    if (!employee || !canEmployeeLogin(employee, db.employees)) return { error: accountError, status: 403 };
    const previous = db.otps[0];
    if (previous?.lockedUntil && new Date(previous.lockedUntil) > now) return { error: "Terlalu banyak percobaan. Tunggu sampai penguncian 15 menit selesai.", status: 429 };
    const elapsed = previous ? (now.getTime() - new Date(previous.createdAt).getTime()) / 1000 : Infinity;
    if (elapsed < OTP_RESEND_SECONDS) return { error: `Tunggu ${Math.ceil(OTP_RESEND_SECONDS - elapsed)} detik sebelum meminta kode baru.`, status: 429 };
    const code = generateOtp();
    const salt = otpSalt();
    // Attempts span resends/identifiers in a fixed 15-minute window.
    const carryAttempts = previous?.attemptsResetAt && new Date(previous.attemptsResetAt) > now;
    const record: OtpRecord = {
      id: crypto.randomUUID(), employeeId: employee.id,
      phone: employee.phone, email: employee.email ?? null, identifier: login.identifier,
      channel: login.channel, destination: null, codeSalt: salt, codeHash: hashOtp(code, salt),
      createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + OTP_TTL_SECONDS * 1000).toISOString(),
      attempts: carryAttempts ? previous.attempts : 0,
      attemptsResetAt: carryAttempts ? previous.attemptsResetAt : new Date(now.getTime() + OTP_LOCK_MINUTES * 60_000).toISOString(),
      status: "menunggu", usedAt: null, lockedUntil: null,
    };
    db.otps = [record];
    return { employee, code, record, status: 200 };
  });
  if ("error" in outcome) return outcome;
  const delivery = await deliverOtp(outcome.employee, login.channel, outcome.code, outcome.record.id, demoMode());
  const finalized = await mutateDb({ kind: "otp", employeeId: outcome.employee.id }, db => {
    const employee = db.employees.find(item => item.id === outcome.employee.id);
    const otp = db.otps.find(item => item.id === outcome.record.id);
    if (!otp || otp.status !== "menunggu") return false;
    if (!employee || !canEmployeeLogin(employee, db.employees) || employee.phone !== otp.phone || (employee.email ?? null) !== otp.email) {
      otp.status = "gagal";
      return false;
    }
    otp.status = delivery.status;
    otp.channel = delivery.channel;
    otp.destination = delivery.destination;
    return true;
  });
  if (!finalized || delivery.status === "gagal") return { error: "OTP tidak berhasil dikirim. Pastikan kontak terdaftar benar atau hubungi atasan. Coba kirim ulang setelah 60 detik.", status: 502 };
  return {
    status: 200, challengeId: outcome.record.id, channel: delivery.channel,
    maskedDestination: maskDestination(delivery.destination, delivery.channel), fallback: delivery.fallback,
    message: delivery.status === "demo" ? "Mode demo: kode tidak dikirim ke penyedia." : delivery.fallback ? "WhatsApp tidak tersedia. OTP dikirim ke email terdaftar." : `OTP dikirim ke ${delivery.channel === "email" ? "email" : "WhatsApp"} terdaftar.`,
    resendAfter: OTP_RESEND_SECONDS, expiresIn: OTP_TTL_SECONDS,
    devCode: demoMode() ? outcome.code : undefined,
  };
}

export async function verifyOtp(value: string, challengeId: string, code: string) {
  const login = normalizeLoginIdentifier(value);
  if (!login) return { error: "Email atau WhatsApp tidak valid.", status: 400 };
  return mutateDb({ kind: "otp", identifier: login.identifier }, db => {
    const now = new Date();
    const employee = db.employees.find(item => login.channel === "email" ? item.email === login.identifier : item.phone === login.identifier);
    if (!employee || !canEmployeeLogin(employee, db.employees)) return { error: accountError, status: 403 };
    const otp = db.otps[0];
    if (otp?.lockedUntil && new Date(otp.lockedUntil) > now) return { error: "Terlalu banyak percobaan. Coba lagi setelah penguncian 15 menit selesai.", status: 429 };
    if (!otp || otp.id !== challengeId || otp.identifier !== login.identifier || otp.employeeId !== employee.id) return { error: "Permintaan OTP tidak cocok. Minta kode baru.", status: 400 };
    if (employee.phone !== otp.phone || (employee.email ?? null) !== otp.email || !otp.destination || (otp.channel === "email" ? employee.email !== otp.destination : employee.phone !== otp.destination)) return { error: "Kontak akun berubah. Minta kode baru.", status: 400 };
    if (otp.usedAt || otp.status === "terpakai") return { error: "Kode OTP sudah dipakai. Minta kode baru.", status: 400 };
    if (otp.status !== "terkirim" && !(otp.status === "demo" && demoMode())) return { error: "OTP belum berhasil dikirim. Minta kode baru.", status: 400 };
    if (new Date(otp.expiresAt) <= now) return { error: "Kode OTP sudah kedaluwarsa. Minta kode baru.", status: 400 };
    if (!safeCompareHash(otp.codeHash, hashOtp(code, otp.codeSalt))) {
      otp.attempts += 1;
      if (otp.attempts >= OTP_MAX_ATTEMPTS) {
        otp.lockedUntil = new Date(now.getTime() + OTP_LOCK_MINUTES * 60_000).toISOString();
        return { error: `Kode salah ${OTP_MAX_ATTEMPTS} kali. Coba lagi dalam ${OTP_LOCK_MINUTES} menit.`, status: 429 };
      }
      return { error: `Kode OTP salah. Sisa ${OTP_MAX_ATTEMPTS - otp.attempts} percobaan.`, status: 401 };
    }
    otp.status = "terpakai";
    otp.usedAt = now.toISOString();
    pushAudit(db, { actorId: employee.id, actorName: employee.name, action: "login_otp", objectType: "autentikasi", objectId: employee.id, summary: `${employee.name} masuk menggunakan OTP ${otp.channel === "email" ? "email" : "WhatsApp"}.`, after: { channel: otp.channel } });
    return { employee, employees: db.employees, status: 200 };
  });
}
