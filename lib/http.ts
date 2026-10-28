import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export function apiError(message: string, status = 400, extra?: unknown) {
  return NextResponse.json(
    { ok: false, message, ...(extra ? { details: extra } : {}) },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export function apiOk<T>(data: T, status = 200) {
  return NextResponse.json(
    { ok: true, ...(data as object) },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export function validationMessage(error: ZodError) {
  return error.issues[0]?.message ?? "Data yang dikirim tidak valid.";
}

export function safeErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Terjadi kesalahan. Silakan coba lagi.";
}
