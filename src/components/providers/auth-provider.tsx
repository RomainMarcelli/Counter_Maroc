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

  /** Aligne le stockage local et le moteur de sync sur le compte courant. */
  const applySession = useCallback(async (next: AuthAccount | null) => {
    if (appliedUserId.current === (next?.id ?? null)) return;
    appliedUserId.current = next?.id ?? null;
    if (next) {
      // Un autre compte sur ce navigateur ne doit jamais voir le séjour du précédent.
      await claimLocalData(next.id);
      await setAuthUserId(next.id);
    }
    syncEngine.setUser(next?.id ?? null);
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
