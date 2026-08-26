"use client";

import { useEffect, useState } from "react";
import { Check, CloudOff, RefreshCw, TriangleAlert } from "lucide-react";
import { useTrip } from "@/components/providers/trip-provider";
import { isSupabaseConfigured } from "@/data/supabase";
import { syncEngine } from "@/data/sync-engine";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/data/database";

export function SyncIndicator() {
  const { queue } = useTrip();
  const [online, setOnline] = useState(true);
  const syncError = useLiveQuery(() => db.settings.get("syncError").then((setting) => setting?.value ?? null), [], null);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  const failed = queue.filter((item) => item.status === "failed").length;
  const syncing = queue.some((item) => item.status === "syncing");
  const configured = isSupabaseConfigured();
  let label = "Synchronisé";
  let Icon = Check;
  let color = "text-ivory";
  if (!configured) { label = "Mode local"; Icon = CloudOff; color = "text-sand"; }
  else if (syncError) { label = "Sync indisponible"; Icon = TriangleAlert; color = "text-sand"; }
  else if (!online) { label = `${queue.length} en attente`; Icon = CloudOff; color = "text-sand"; }
  else if (failed) { label = `${failed} à réessayer`; Icon = TriangleAlert; color = "text-sand"; }
  else if (queue.length || syncing) { label = `${queue.length} en attente`; Icon = RefreshCw; color = "text-sand"; }
  return (
    <button className={`flex min-h-11 items-center gap-1.5 rounded-full px-2 text-[11px] font-bold ${color}`} onClick={() => void syncEngine.flush()} aria-label={`${label}${syncError ? ` : ${syncError}` : ""}. Toucher pour synchroniser`} title={syncError ?? undefined}>
      <Icon size={14} className={syncing ? "animate-spin" : ""} />
      <span>{label}</span>
    </button>
  );
}
