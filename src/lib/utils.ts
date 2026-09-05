import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function nid(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

export function inviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

export function initials(name: string | null | undefined) {
  const parts = (name ?? "?").trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join("") || "?";
}

export function avatarTone(id: string) {
  const tones = [
    "bg-cover-moss text-primary-fg",
    "bg-cover-ink text-primary-fg",
    "bg-cover-dusk text-primary-fg",
    "bg-cover-clay text-primary-fg",
    "bg-cover-steel text-primary-fg",
    "bg-pine text-primary-fg",
  ] as const;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return tones[h % tones.length];
}
