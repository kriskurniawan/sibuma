export const TIME_ZONE_OPTIONS = [
  {
    value: "Asia/Jakarta",
    label: "WIB",
    offset: "UTC+7",
    description: "Sumatera, Jawa, dan Kalimantan Barat",
  },
  {
    value: "Asia/Makassar",
    label: "WITA",
    offset: "UTC+8",
    description:
      "Bali, Nusa Tenggara, Sulawesi, dan Kalimantan Selatan/Timur/Utara",
  },
  {
    value: "Asia/Jayapura",
    label: "WIT",
    offset: "UTC+9",
    description: "Maluku dan Papua",
  },
] as const;

export type AppTimeZone = (typeof TIME_ZONE_OPTIONS)[number]["value"];

export const TIME_ZONE_VALUES = TIME_ZONE_OPTIONS.map(
  (option) => option.value,
) as [AppTimeZone, ...AppTimeZone[]];

export function isAppTimeZone(value: unknown): value is AppTimeZone {
  return (
    typeof value === "string" &&
    TIME_ZONE_OPTIONS.some((option) => option.value === value)
  );
}

export function timeZoneLabel(value: string) {
  return (
    TIME_ZONE_OPTIONS.find((option) => option.value === value)?.label ?? value
  );
}
