export { cn } from "cn";

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

const AVATAR_COLORS = [
  "bg-[#E8F0DF] text-[#31572C] dark:bg-[#2E4026] dark:text-[#C5DBAE]",
  "bg-[#FBE9DF] text-[#9A4220] dark:bg-[#4A2A1C] dark:text-[#F5C4A8]",
  "bg-[#E4E9F6] text-[#344D85] dark:bg-[#28344F] dark:text-[#BFCCEF]",
  "bg-[#F4E6F1] text-[#7F356C] dark:bg-[#462639] dark:text-[#E8BFDD]",
  "bg-[#F8EFCB] text-[#7A5A12] dark:bg-[#433715] dark:text-[#EBD79B]",
  "bg-[#DBEEED] text-[#1E5B5A] dark:bg-[#1F3C3B] dark:text-[#B1DFDD]",
];

export function avatarColor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function truncate(text: string, length = 120) {
  if (text.length <= length) return text;
  return `${text.slice(0, length).trimEnd()}…`;
}

export function fileSizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

export function documentSrc(storageKey: string) {
  const key = storageKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `/api/uploads/${key}`;
}

export function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
