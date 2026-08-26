"use client";

import { useEffect, useState } from "react";
import { ArrowRight, MapPin, Users } from "lucide-react";
import { createTrip } from "@/data/repository";
import { syncEngine } from "@/data/sync-engine";
import { useTrip } from "@/components/providers/trip-provider";
import { useToast } from "@/components/providers/toast-provider";
import { BrandLogo } from "@/components/brand/brand-logo";

export function Onboarding() {
  const { refreshActiveTrip } = useTrip();
  const toast = useToast();
  const [mode, setMode] = useState<"home" | "create" | "join">("home");
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [form, setForm] = useState({ name: "", creatorName: "", startDate: "2026-09-07", endDate: "2026-09-16" });

  useEffect(() => {
    const joinCode = new URLSearchParams(window.location.search).get("join");
    if (joinCode) { setCode(joinCode.toUpperCase()); setMode("join"); }
  }, []);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await createTrip(form);
      await refreshActiveTrip();
      void syncEngine.flush();
    } catch (error) { toast({ message: "Création impossible", detail: error instanceof Error ? error.message : undefined }); }
    finally { setBusy(false); }
  };
  const join = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try { await syncEngine.joinTrip(code); await refreshActiveTrip(); }
    catch (error) { toast({ message: "Séjour introuvable", detail: error instanceof Error ? error.message : undefined }); }
    finally { setBusy(false); }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-between px-6 pb-[calc(24px+env(safe-area-inset-bottom))] pt-[calc(42px+env(safe-area-inset-top))]">
      <div>
        <BrandLogo size={80} className="mb-10 rounded-[26px] shadow-card" priority />
        <p className="text-xs font-black uppercase tracking-[0.25em] text-terra">Le séjour commence ici</p>
        <h1 className="mt-3 font-display text-5xl font-bold leading-[0.95]">Marrakech<br />Crew</h1>
        <p className="mt-5 max-w-xs text-base leading-relaxed text-morocco/65">Vos tournées, même en mode avion. Une connexion suffit plus tard pour retrouver tout le groupe.</p>
      </div>
      {mode === "home" ? (
        <div className="space-y-3">
          <button onClick={() => setMode("create")} className="flex min-h-16 w-full items-center gap-3 rounded-2xl bg-morocco px-5 text-left font-extrabold text-ivory shadow-card"><MapPin /><span className="flex-1">Créer le séjour</span><ArrowRight /></button>
          <button onClick={() => setMode("join")} className="flex min-h-16 w-full items-center gap-3 rounded-2xl border-2 border-morocco/15 bg-white/65 px-5 text-left font-extrabold"><Users /><span className="flex-1">Rejoindre avec un code</span><ArrowRight /></button>
        </div>
      ) : mode === "create" ? (
        <form onSubmit={create} className="space-y-3 rounded-3xl bg-white/70 p-5 shadow-card">
          <Field label="Nom du séjour" value={form.name} onChange={(name) => setForm({ ...form, name })} />
          <Field label="Votre prénom" value={form.creatorName} onChange={(creatorName) => setForm({ ...form, creatorName })} required />
          <div className="grid grid-cols-2 gap-3"><Field label="Début" type="date" value={form.startDate} onChange={(startDate) => setForm({ ...form, startDate })} /><Field label="Fin" type="date" value={form.endDate} onChange={(endDate) => setForm({ ...form, endDate })} /></div>
          <button disabled={busy} className="min-h-14 w-full rounded-2xl bg-terra font-extrabold text-ivory disabled:opacity-50">{busy ? "Création…" : "Créer et commencer"}</button>
          <button type="button" onClick={() => setMode("home")} className="min-h-11 w-full text-sm font-bold">Retour</button>
        </form>
      ) : (
        <form onSubmit={join} className="space-y-4 rounded-3xl bg-white/70 p-5 shadow-card">
          <label className="block text-xs font-extrabold uppercase tracking-wider">Code de partage<input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="MAROC-26-X7K4" className="mt-2 min-h-14 w-full rounded-2xl border border-sand bg-ivory px-4 text-base font-black uppercase outline-none" required /></label>
          <button disabled={busy} className="min-h-14 w-full rounded-2xl bg-terra font-extrabold text-ivory disabled:opacity-50">{busy ? "Connexion…" : "Rejoindre le Crew"}</button>
          <button type="button" onClick={() => setMode("home")} className="min-h-11 w-full text-sm font-bold">Retour</button>
        </form>
      )}
    </main>
  );
}

function Field({ label, value, onChange, type = "text", required = true }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return <label className="block text-xs font-extrabold uppercase tracking-wider">{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-sand bg-ivory px-3 text-sm font-bold outline-none" required={required} /></label>;
}
