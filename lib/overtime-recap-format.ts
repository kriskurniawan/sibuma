const numberFormat = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 0,
});

const hoursFormat = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 2,
});

/** Nominal rupiah tanpa desimal; nilai negatif tidak pernah ditampilkan. */
export function formatRecapRupiah(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Rp0";
  }
  return `Rp${numberFormat.format(Math.max(0, Math.round(value)))}`;
}

/** Jam dari menit, maksimal dua desimal, memakai pemisah desimal Indonesia. */
export function formatRecapHours(minutes: number) {
  const hours = Math.max(0, minutes) / 60;
  return hoursFormat.format(hours);
}

/** Jam dari nilai jam penuh (dipakai panel ringkasan). */
export function formatRecapHourValue(hours: number) {
  return hoursFormat.format(Math.max(0, hours));
}

export function formatRecapCount(value: number) {
  return numberFormat.format(Math.max(0, value));
}
