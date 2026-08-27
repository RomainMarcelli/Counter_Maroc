"use client";

import { useEffect, useState } from "react";
import { ArrowRight, LoaderCircle, MapPin, Users } from "lucide-react";
import { createTrip, setActiveTripId } from "@/data/repository";
import { syncEngine } from "@/data/sync-engine";
import { useTrip } from "@/components/providers/trip-provider";
import { useAuth } from "@/components/providers/auth-provider";
import { useToast } from "@/components/providers/toast-provider";
import { authErrorMessage } from "@/data/auth";
import { BrandLogo } from "@/components/brand/brand-logo";

type Mode = "home" | "create" | "join";

/**
 * Écran d’entrée d’un compte sans séjour ouvert. S’il est déjà membre d’un séjour,
 * on l’ouvre directement au lieu de lui redemander quoi faire.
 */
export function Onboarding() {
  const { refreshActiveTrip } = useTrip();
  const { account } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>("home");
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [code, setCode] = useState("");
  const [form, setForm] = useState({ name: "", startDate: "2026-09-07", endDate: "2026-09-16" });
  const firstName = account?.displayName ?? "";

  useEffect(() => {
    // Séjour déjà rejoint depuis un autre téléphone : on le rouvre sans rien demander.
    // Les invitations par lien sont traitées en amont par JoinInvite.
    let cancelled = false;
    void syncEngine.listMyTrips()
      .then(async (trips) => {
        if (cancelled || !trips.length) return;
        await syncEngine.pullTrip(trips[0].tripId);
        await setActiveTripId(trips[0].tripId);
        await refreshActiveTrip();
      })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setRestoring(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await createTrip({ ...form, creatorName: firstName || "Moi" });
      await refreshActiveTrip();
      // Le séjour, le membership owner et le participant partent ensemble côté serveur.
      void syncEngine.flush({ immediate: true });
    } catch (error) {
      toast({ message: "Création impossible", detail: authErrorMessage(error), tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const join = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const joined = await syncEngine.joinTrip(code);
      await refreshActiveTrip();
      toast({ message: `Bienvenue dans ${joined.name}`, detail: "Choisis ton participant pour commencer." });
    } catch (error) {
      const message = error instanceof Error && error.message.includes("trip not found")
        ? "Aucun séjour ne correspond à ce code."
        : authErrorMessage(error);
      toast({ message: "Séjour introuvable", detail: message, tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-between px-6 pb-[calc(24px+env(safe-area-inset-bottom))] pt-[calc(42px+env(safe-area-inset-top))]">
      <div>
        <BrandLogo size={80} className="mb-10 rounded-[26px] shadow-card" priority />
        <p className="text-xs font-black uppercase tracking-[0.25em] text-terra">Le séjour commence ici</p>
        <h1 className="mt-3 font-display text-5xl font-bold leading-[0.95]">{firstName ? <>Bienvenue<br />{firstName}</> : <>Marrakech<br />Crew</>}</h1>
        <p className="mt-5 max-w-xs text-base leading-relaxed text-morocco/65">Crée le séjour du groupe, ou rejoins celui d’un ami avec son code. Ensuite, tout fonctionne même en mode avion.</p>
      </div>
      {restoring ? (
        <p className="flex min-h-16 items-center justify-center gap-2 text-sm font-extrabold text-morocco/55"><LoaderCircle size={18} className="animate-spin" />Recherche de tes séjours…</p>
      ) : mode === "home" ? (
        <div className="space-y-3">
          <button onClick={() => setMode("create")} className="tap-bump flex min-h-16 w-full items-center gap-3 rounded-2xl bg-morocco px-5 text-left font-extrabold text-ivory shadow-card"><MapPin /><span className="flex-1">Créer un séjour</span><ArrowRight /></button>
          <button onClick={() => setMode("join")} className="tap-bump flex min-h-16 w-full items-center gap-3 rounded-2xl border-2 border-morocco/15 bg-white/65 px-5 text-left font-extrabold"><Users /><span className="flex-1">Rejoindre un séjour</span><ArrowRight /></button>
        </div>
      ) : mode === "create" ? (
        <form onSubmit={create} className="space-y-3 rounded-3xl bg-white/70 p-5 shadow-card">
          <Field label="Nom du séjour" value={form.name} placeholder="Marrakech 2026" onChange={(name) => setForm({ ...form, name })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date début" type="date" value={form.startDate} onChange={(startDate) => setForm({ ...form, startDate })} />
            <Field label="Date fin" type="date" value={form.endDate} onChange={(endDate) => setForm({ ...form, endDate })} />
          </div>
          <p className="text-xs font-bold text-morocco/50">Tu seras ajouté comme <strong>{firstName || "participant"}</strong>, et tu pourras inviter le reste du crew avec le code de partage.</p>
          <button disabled={busy} className="tap-bump min-h-14 w-full rounded-2xl bg-terra font-extrabold text-ivory disabled:opacity-50">{busy ? "Création…" : "Créer et commencer"}</button>
          <button type="button" onClick={() => setMode("home")} className="min-h-11 w-full text-sm font-bold">Retour</button>
        </form>
      ) : (
        <form onSubmit={join} className="space-y-4 rounded-3xl bg-white/70 p-5 shadow-card">
          <label className="block text-xs font-extrabold uppercase tracking-wider">Code de partage<input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="MAROC-26-X7K4" className="mt-2 min-h-14 w-full rounded-2xl border border-sand bg-ivory px-4 text-base font-black uppercase outline-none" required /></label>
          <button disabled={busy} className="tap-bump min-h-14 w-full rounded-2xl bg-terra font-extrabold text-ivory disabled:opacity-50">{busy ? "Connexion…" : "Rejoindre le Crew"}</button>
          <button type="button" onClick={() => setMode("home")} className="min-h-11 w-full text-sm font-bold">Retour</button>
        </form>
      )}
    </main>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return <label className="block text-xs font-extrabold uppercase tracking-wider">{label}<input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-sand bg-ivory px-3 text-sm font-bold outline-none" required /></label>;
}
