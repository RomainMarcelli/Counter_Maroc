/**
 * Invitation par lien. Le code doit survivre à l’écran de connexion : quelqu’un
 * qui reçoit l’invitation par message n’a en général pas encore de compte, et il
 * ne doit pas avoir à ressaisir le code après s’être inscrit.
 */
export const INVITE_STORAGE_KEY = "marrakech-pending-invite";
/** Signale un changement d’invitation en attente aux écrans déjà montés. */
export const INVITE_EVENT = "marrakech-invite";

function announce(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(INVITE_EVENT));
}

/** Un code de partage ressemble à MAROC-26-X7K4 : lettres, chiffres et tirets. */
const CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{3,23}$/;

export function normalizeInviteCode(value: string): string | null {
  const code = value.trim().toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}

/**
 * Lit le code d’une URL d’arrivée. Deux formes sont acceptées : `/join?code=…`,
 * le lien partagé, et `/?join=…`, l’ancien format des QR Codes déjà distribués.
 */
export function parseInviteCode(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url, "https://placeholder.invalid");
  } catch {
    return null;
  }
  const raw = parsed.searchParams.get("code") ?? parsed.searchParams.get("join");
  return raw ? normalizeInviteCode(raw) : null;
}

export function buildInviteUrl(origin: string, shareCode: string): string {
  return `${origin.replace(/\/+$/, "")}/join?code=${encodeURIComponent(shareCode)}`;
}

export function storePendingInvite(code: string): void {
  const normalized = normalizeInviteCode(code);
  if (!normalized) return;
  try {
    window.localStorage.setItem(INVITE_STORAGE_KEY, normalized);
  } catch {
    // Navigation privée ou stockage plein : le code sera simplement à ressaisir.
  }
  announce();
}

export function peekPendingInvite(): string | null {
  try {
    const stored = window.localStorage.getItem(INVITE_STORAGE_KEY);
    return stored ? normalizeInviteCode(stored) : null;
  } catch {
    return null;
  }
}

export function clearPendingInvite(): void {
  try {
    window.localStorage.removeItem(INVITE_STORAGE_KEY);
  } catch {
    // Rien à nettoyer si le stockage est indisponible.
  }
  announce();
}

/** Lit le code en attente et l’oublie : une invitation ne se rejoue pas. */
export function takePendingInvite(): string | null {
  const code = peekPendingInvite();
  if (code) clearPendingInvite();
  return code;
}
