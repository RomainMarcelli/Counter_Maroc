"use client";

import { useEffect, useState } from "react";
import { Check, CloudOff, RefreshCw, TriangleAlert } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { useTrip } from "@/components/providers/trip-provider";
import { useAuth } from "@/components/providers/auth-provider";
import { isSupabaseConfigured } from "@/data/supabase";
import { syncEngine } from "@/data/sync-engine";
import { db } from "@/data/database";

/**
 * Trois informations distinctes, jamais confondues sous un même « Non connecté » :
 * le compte, le réseau, et l’état de la file de synchronisation.
 */
export function SyncIndicator() {
  const { queue } = useTrip();
  const { account, accountRequired } = useAuth();
  const [online, setOnline] = useState(true);
  const errorKind = useLiveQuery(() => db.settings.get("syncErrorKind").then((setting) => setting?.value ?? ""), [], "");
  const errorMessage = useLiveQuery(() => db.settings.get("syncError").then((setting) => setting?.value ?? null), [], null);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);

  const pending = queue.length;
  const syncing = queue.some((item) => item.status === "syncing");
  const configured = isSupabaseConfigured();

  let label = "Synchronisé";
  let Icon = Check;
  let healthy = true;
  if (!configured || !accountRequired) {
    label = "Mode local";
    Icon = CloudOff;
    healthy = false;
  } else if (!online) {
    label = pending ? `Hors ligne · ${pending} action${pending > 1 ? "s" : ""} locale${pending > 1 ? "s" : ""}` : "Hors ligne";
    Icon = CloudOff;
    healthy = false;
  } else if (errorKind === "auth") {
    label = "Session expirée";
    Icon = TriangleAlert;
    healthy = false;
  } else if (errorKind) {
    label = "Erreur de synchronisation";
    Icon = TriangleAlert;
    healthy = false;
  } else if (pending || syncing) {
    label = `${pending} action${pending > 1 ? "s" : ""} en attente`;
    Icon = RefreshCw;
    healthy = false;
  }

  const account_ = account ? `Connecté en tant que ${account.displayName}` : accountRequired ? "Aucun compte connecté" : "Séjour local à ce téléphone";
  const network = configured && accountRequired ? (online ? "En ligne" : "Hors ligne") : null;
  const description = [account_, network, label, errorMessage].filter(Boolean).join(". ");

  return (
    <button
      className={`flex min-h-11 items-center gap-1.5 rounded-full px-2 text-[11px] font-bold ${healthy ? "text-ivory" : "text-sand"}`}
      onClick={() => void syncEngine.flush({ immediate: true })}
      aria-label={`${description}. Toucher pour synchroniser`}
      title={description}
    >
      <span className={`size-2.5 shrink-0 rounded-full ring-2 ring-ivory/20 ${healthy ? "bg-emerald-400" : "bg-sand"} ${syncing ? "animate-pulse" : ""}`} aria-hidden="true" />
      <Icon size={14} className={syncing ? "animate-spin" : ""} />
      <span>{label}</span>
    </button>
  );
}
