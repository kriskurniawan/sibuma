export const SETTINGS_TABS = [
  { value: "kebijakan", label: "Kebijakan" },
  { value: "lokasi", label: "Lokasi" },
  { value: "checklist", label: "Checklist" },
  { value: "dokumen", label: "Dokumen" },
  { value: "media", label: "Foto & video" },
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number]["value"];

export const DEFAULT_SETTINGS_TAB: SettingsTab = "kebijakan";
