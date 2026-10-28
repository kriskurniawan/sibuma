/** Normalisasi nomor Indonesia ke format 628xxxxxxxxx. */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  if (digits.startsWith("8")) digits = `62${digits}`;
  if (!/^628\d{7,12}$/.test(digits)) return null;
  return digits;
}

export function formatPhone(phone: string) {
  if (!phone.startsWith("62")) return phone;
  const local = `0${phone.slice(2)}`;
  return `${local.slice(0, 4)}-${local.slice(4, 8)}-${local.slice(8)}`;
}

export function phoneForDisplay(phone: string) {
  return formatPhone(phone);
}
