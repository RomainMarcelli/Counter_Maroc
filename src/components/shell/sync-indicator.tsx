"use client";

import { useEffect, useState } from "react";
import { Check, CloudOff, LoaderCircle, RefreshCw, TriangleAlert } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { useTrip } from "@/components/providers/trip-provider";
import { useAuth } from "@/components/providers/auth-provider";
import { isSupabaseConfigured } from "@/data/supabase";
import { syncEngine } from "@/data/sync-engine";
import { db } from "@/data/database";
import { resolveSyncStatus } from "@/domain/sync-status";

/**
 * Trois informations distinctes, jamais confondues sous un même « Non connecté » :
 * le compte, le réseau, et l’état de la file de synchronisation.
 */
export function SyncIndicator() {
  const { queue } = useTrip();
  const { status: authStatus, account, accountRequired } = useAuth();
  const [online, setOnline] = useState(true);
  const errorKind = useLiveQuery(() => db.settings.get("syncErrorKind").then((setting) => setting?.value ?? ""), [], "");
  const errorMessage = useLiveQuery(() => db.settings.get("syncError").then((setting) => setting?.value ?? null), [], null);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    const updateOnResume = () => { if (document.visibilityState === "visible") update(); };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    window.addEventListener("pageshow", update);
    document.addEventListener("visibilitychange", updateOnResume);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener("pageshow", update);
      document.removeEventListener("visibilitychange", updateOnResume);
    };
  }, []);

  const pending = queue.length;
  const syncing = queue.some((item) => item.status === "syncing");
  const configured = isSupabaseConfigured();

  const state = resolveSyncStatus({
    backendConfigured: configured,
    localMode: configured && !accountRequired,
    authStatus,
    online,
    pending,
    syncing,
    errorKind: (errorKind || "") as "auth" | "membership" | "network" | "",
  });
  const Icon = state.kind === "synced" ? Check
    : state.kind === "offline" || state.kind === "local" ? CloudOff
      : state.kind === "error" || state.kind === "auth" ? TriangleAlert
        : state.kind === "connecting" ? LoaderCircle
          : RefreshCw;

  const account_ = account ? `Connecté en tant que ${account.displayName}` : accountRequired ? "Aucun compte connecté" : "Séjour local à ce téléphone";
  const network = configured && accountRequired ? (online ? "En ligne" : "Hors ligne") : null;
  const backend = configured ? null : "Supabase absent de ce build";
  const queueDetail = pending ? `${pending} action${pending > 1 ? "s" : ""} dans la file` : null;
  const description = [account_, network, backend, state.label, queueDetail, errorMessage].filter(Boolean).join(". ");

  // Le libellé reste visible même sur iPhone : la couleur seule ne doit jamais être
  // nécessaire pour distinguer le réseau, la session et la synchronisation.
  return (
    <button
      className={`flex min-h-11 items-center gap-1.5 rounded-full px-2 text-[11px] font-bold ${state.healthy ? "text-ivory" : state.kind === "error" || state.kind === "auth" ? "text-ivory" : "text-sand"}`}
      onClick={() => void syncEngine.flush({ immediate: true })}
      aria-label={`${description}. Toucher pour synchroniser`}
      title={description}
    >
      <span className={`size-2.5 shrink-0 rounded-full ring-2 ring-ivory/20 ${state.healthy ? "bg-emerald-400" : state.kind === "error" || state.kind === "auth" ? "bg-terra" : "bg-sand"} ${state.kind === "syncing" || state.kind === "connecting" ? "animate-pulse" : ""}`} aria-hidden="true" />
      <Icon size={14} className={state.kind === "syncing" || state.kind === "connecting" ? "animate-spin" : ""} />
      <span>{state.label}</span>
    </button>
  );
}
