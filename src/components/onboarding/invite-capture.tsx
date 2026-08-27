"use client";

import { useEffect, useState } from "react";
import { INVITE_EVENT, parseInviteCode, peekPendingInvite, storePendingInvite } from "@/lib/invite";

/**
 * Capte le code d’invitation dès l’arrivée, avant même l’écran de connexion :
 * un ami qui reçoit le lien n’a en général pas encore de compte, et il ne doit
 * pas avoir à ressaisir le code après son inscription.
 *
 * Le composant n’affiche rien et vit hors des portes d’authentification.
 */
export function InviteCapture() {
  useEffect(() => {
    const code = parseInviteCode(window.location.href);
    if (!code) return;
    storePendingInvite(code);
    // On nettoie l’URL : un rechargement ne doit pas re-proposer une invitation déjà traitée.
    const url = new URL(window.location.href);
    url.searchParams.delete("code");
    url.searchParams.delete("join");
    window.history.replaceState(null, "", `${url.pathname === "/join" ? "/" : url.pathname}${url.search}`);
  }, []);
  return null;
}

/** Invitation en attente, réactive : elle disparaît dès qu’elle est acceptée ou refusée. */
export function usePendingInvite(): string | null {
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => {
    const sync = () => setCode(peekPendingInvite());
    sync();
    window.addEventListener(INVITE_EVENT, sync);
    return () => window.removeEventListener(INVITE_EVENT, sync);
  }, []);
  return code;
}
