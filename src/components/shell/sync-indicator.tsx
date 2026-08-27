"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CloudOff, RefreshCw, TriangleAlert } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { useTrip } from "@/components/providers/trip-provider";
import { useAuth } from "@/components/providers/auth-provider";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { isSupabaseConfigured } from "@/data/supabase";
import { syncEngine } from "@/data/sync-engine";
import { retryPhotoUploads } from "@/data/profile-photos";
import { db } from "@/data/database";
import { resolveSyncStatus } from "@/domain/sync-status";

export function SyncIndicator() {
  const { queue } = useTrip();
  const { status: authStatus, account, accountRequired } = useAuth();
  const [online, setOnline] = useState(true);
  const [open, setOpen] = useState(false);
  const errorKind = useLiveQuery(() => db.settings.get("syncErrorKind").then((setting) => setting?.value ?? ""), [], "");
  const errorMessage = useLiveQuery(() => db.settings.get("syncError").then((setting) => setting?.value ?? null), [], null);
  const lastSuccess = useLiveQuery(() => db.settings.get("syncLastSuccessAt").then((setting) => setting?.value ?? null), [], null);
  const photoQueue = useLiveQuery(() => db.photoUploads.toArray(), [], []);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    const resume = () => { if (document.visibilityState === "visible") update(); };
    update(); window.addEventListener("online", update); window.addEventListener("offline", update); window.addEventListener("pageshow", update); document.addEventListener("visibilitychange", resume);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); window.removeEventListener("pageshow", update); document.removeEventListener("visibilitychange", resume); };
  }, []);

  const configured = isSupabaseConfigured();
  const pending = queue.length + photoQueue.length;
  const syncing = queue.some((item) => item.status === "syncing") || photoQueue.some((item) => item.status === "uploading");
  const photoFailed = photoQueue.some((item) => item.status === "failed");
  const state = resolveSyncStatus({
    backendConfigured: configured,
    localMode: configured && !accountRequired,
    authStatus,
    online,
    pending,
    syncing,
    errorKind: (photoFailed ? "network" : errorKind || "") as "auth" | "membership" | "network" | "",
  });
  const toneClass = state.tone === "green" ? "bg-emerald-400" : state.tone === "orange" ? "bg-amber-400" : "bg-red-500";
  const accountLine = account ? `Connecté en tant que ${account.displayName}` : "Aucun compte connecté";
  const lastLine = lastSuccess ? new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(lastSuccess)) : "Pas encore disponible";
  const retry = () => { void Promise.all([syncEngine.flush({ immediate: true }), retryPhotoUploads()]); };

  return (
    <>
      <button className="flex size-11 shrink-0 items-center justify-center rounded-full" onClick={() => setOpen(true)} aria-label={`Synchronisation : ${state.label}`} title={state.label}>
        <span className={`size-3 rounded-full ring-2 ring-ivory/30 ${toneClass} ${state.tone === "orange" ? "animate-pulse" : ""}`} aria-hidden="true" />
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Synchronisation">
        <div className={`flex items-center gap-4 rounded-[24px] p-4 ${state.tone === "green" ? "bg-emerald-50" : state.tone === "orange" ? "bg-amber-50" : "bg-red-50"}`}>
          <span className={`flex size-12 shrink-0 items-center justify-center rounded-2xl text-white ${state.tone === "green" ? "bg-emerald-600" : state.tone === "orange" ? "bg-amber-500" : "bg-red-600"}`}>{state.tone === "green" ? <CheckCircle2 size={22} /> : state.kind === "offline" ? <CloudOff size={22} /> : <TriangleAlert size={22} />}</span>
          <div><p className="font-display text-xl font-bold">{state.label}</p><p className="text-xs font-bold text-morocco/50">{pending ? `${pending} action${pending > 1 ? "s" : ""} en attente` : "Aucune action en attente"}</p></div>
        </div>
        <dl className="mt-5 space-y-3 rounded-2xl border border-sand/60 bg-white p-4 text-sm"><Line term="Compte" value={accountLine} /><Line term="Réseau" value={online ? "En ligne" : "Hors ligne"} /><Line term="Supabase" value={configured ? (errorMessage ?? "Accessible") : "Non configuré"} /><Line term="Dernière synchro" value={lastLine} /></dl>
        {state.tone !== "green" ? <button onClick={retry} className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-terra font-black text-ivory"><RefreshCw size={18} />Réessayer</button> : null}
      </BottomSheet>
    </>
  );
}

function Line({ term, value }: { term: string; value: string }) { return <div className="flex items-start justify-between gap-4"><dt className="font-black text-morocco/50">{term}</dt><dd className="max-w-[65%] text-right font-bold">{value}</dd></div>; }
