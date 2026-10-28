import "server-only";

import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { serverSecret } from "./server-secret";

function otpPepper() {
  return serverSecret();
}

export function generateOtp() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function otpSalt() {
  return (
    globalThis.crypto?.randomUUID?.().replaceAll("-", "") ??
    String(Date.now()) + String(Math.random()).slice(2)
  );
}

export function hashOtp(code: string, salt: string) {
  return createHash("sha256")
    .update(`${otpPepper()}:${salt}:${code}`)
    .digest("hex");
}

export function safeCompareHash(a: string, b: string) {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}
