"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  accountFromSession,
  currentSession,
  onAuthChange,
  signOut as supabaseSignOut,
  type AuthAccount,
  type AuthStatus,
} from "@/data/auth";
import { isSupabaseConfigured } from "@/data/supabase";
import { syncEngine } from "@/data/sync-engine";
import { claimLocalData, setAuthUserId } from "@/data/repository";

/**
 * Mode démonstration : le séjour d’exemple vit uniquement sur ce téléphone, sans
 * compte ni serveur. C’est aussi ce que les tests end-to-end utilisent.
 */
const DEMO_MODE = process.env.NEXT_PUBLIC_ENABLE_DEMO_SEED === "true";

interface AuthContextValue {
  status: AuthStatus;
  account: AuthAccount | null;
  /** false quand l’application tourne sans Supabase : aucun compte n’est exigé. */
  accountRequired: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const accountRequired = isSupabaseConfigured() && !DEMO_MODE;
  const [status, setStatus] = useState<AuthStatus>(accountRequired ? "loading" : "authenticated");
  const [account, setAccount] = useState<AuthAccount | null>(null);
  const appliedUserId = useRef<string | null>(null);
  const applying = useRef<Promise<void> | null>(null);

  /**
   * Aligne le stockage local et le moteur de sync sur le compte courant.
   *
   * `onAuthChange` émet INITIAL_SESSION pendant que `currentSession()` est encore en
   * vol : les deux chemins demandent le même compte. On partage donc la même promesse
   * plutôt que de laisser le second passer devant — sans quoi l’application pourrait
   * s’ouvrir avant que `authUserId` soit écrit, et un séjour créé dans cet intervalle
   * porterait un auteur que la RLS refuserait ensuite.
   */
  const applySession = useCallback((next: AuthAccount | null): Promise<void> => {
    const userId = next?.id ?? null;
    if (appliedUserId.current === userId && applying.current) return applying.current;
    appliedUserId.current = userId;
    applying.current = (async () => {
      // Un autre compte sur ce navigateur ne doit jamais voir le séjour du précédent.
      if (userId) {
        await claimLocalData(userId);
        await setAuthUserId(userId);
      }
      syncEngine.setUser(userId);
    })();
    return applying.current;
  }, []);

  useEffect(() => {
    syncEngine.setEnabled(accountRequired);
    if (!accountRequired) return;
    let cancelled = false;
    syncEngine.start();

    // Session lue depuis le stockage du navigateur : disponible hors ligne, donc une
    // PWA relancée en mode avion reste connectée.
    void currentSession().then(async (session) => {
      if (cancelled) return;
      const next = accountFromSession(session);
      await applySession(next);
      if (cancelled) return;
      setAccount(next);
      setStatus(next ? "authenticated" : "unauthenticated");
    });

    const unsubscribe = onAuthChange((session) => {
      const next = accountFromSession(session);
      void applySession(next).then(() => {
        if (cancelled) return;
        setAccount(next);
        setStatus(next ? "authenticated" : "unauthenticated");
      });
    });

    return () => {
      cancelled = true;
      unsubscribe();
      syncEngine.stop();
    };
  }, [accountRequired, applySession]);

  const signOut = useCallback(async () => {
    // Realtime d’abord : plus aucun message d’un séjour qu’on quitte.
    syncEngine.setUser(null);
    await setAuthUserId(null);
    await supabaseSignOut();
    appliedUserId.current = null;
    applying.current = null;
    setAccount(null);
    setStatus("unauthenticated");
  }, []);

  const value = useMemo<AuthContextValue>(() => ({ status, account, accountRequired, signOut }), [status, account, accountRequired, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth doit être utilisé dans AuthProvider");
  return value;
}
