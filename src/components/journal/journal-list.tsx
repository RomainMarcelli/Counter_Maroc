"use client";

import { useMemo, useState } from "react";
import { ChevronRight, SlidersHorizontal } from "lucide-react";
import { useTrip } from "@/components/providers/trip-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { EntryEditor, type JournalSelection } from "./entry-editor";
import { formatDateKey, formatTripDateTime, zonedDayKey } from "@/lib/timezone";

export function JournalList() {
  const { trip, participants, drinks, drinkEntries, waterEntries } = useTrip();
  const [selection, setSelection] = useState<JournalSelection | null>(null);
  const [day, setDay] = useState("all");
  const participantById = new Map(participants.map((item) => [item.id, item]));
  const drinkById = new Map(drinks.map((item) => [item.id, item]));
  const rows = useMemo(() => {
    if (!trip) return [];
    return [
      ...drinkEntries.filter((entry) => !entry.deletedAt).map((entry) => ({ kind: "drink" as const, entry, consumedAt: entry.consumedAt })),
      ...waterEntries.filter((entry) => !entry.deletedAt).map((entry) => ({ kind: "water" as const, entry, consumedAt: entry.consumedAt })),
    ].filter((row) => day === "all" || zonedDayKey(row.consumedAt, trip.timezone) === day).sort((a, b) => b.consumedAt.localeCompare(a.consumedAt));
  }, [trip, drinkEntries, waterEntries, day]);
  if (!trip) return null;
  const days = [...new Set([...drinkEntries, ...waterEntries].filter((entry) => !entry.deletedAt).map((entry) => zonedDayKey(entry.consumedAt, trip.timezone)))].sort().reverse();
  return (
    <div>
      <header className="mb-6"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-terra">Tout est modifiable</p><h1 className="font-display text-4xl font-bold">Journal</h1><p className="mt-2 text-sm text-morocco/60">Chaque heure est conservée dans le fuseau {trip.timezone}.</p></header>
      <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sand/35"><SlidersHorizontal size={17} /></span><button onClick={() => setDay("all")} className={`min-h-11 shrink-0 rounded-xl px-4 text-xs font-extrabold ${day === "all" ? "bg-morocco text-ivory" : "bg-white"}`}>Tout</button>{days.map((value) => <button key={value} onClick={() => setDay(value)} className={`min-h-11 shrink-0 rounded-xl px-4 text-xs font-extrabold ${day === value ? "bg-morocco text-ivory" : "bg-white"}`}>{formatDateKey(value)}</button>)}</div>
      {rows.length ? <div className="space-y-2">{rows.map((row) => {
        const participant = participantById.get(row.entry.participantId);
        const drink = row.kind === "drink" ? drinkById.get(row.entry.drinkId) : null;
        return <button key={`${row.kind}-${row.entry.id}`} onClick={() => setSelection({ kind: row.kind, entry: row.entry } as JournalSelection)} className="card-enter flex min-h-[72px] w-full items-center gap-3 rounded-2xl border border-sand/50 bg-white/75 p-3 text-left shadow-sm"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sand/35 text-xl">{row.kind === "water" ? "💧" : drink?.icon ?? "🍹"}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{participant?.name ?? "Participant supprimé"} · {row.kind === "water" ? "Eau" : drink?.name ?? "Boisson supprimée"}</strong><span className="mt-1 block text-xs font-bold text-morocco/50">{formatTripDateTime(row.consumedAt, trip.timezone)}</span></span><ChevronRight size={18} className="text-morocco/35" /></button>;
      })}</div> : <EmptyState icon="📖" title="Le journal est calme" detail="Ajoutez un premier verre depuis l’écran Rapide. Il apparaîtra ici instantanément, même hors ligne." />}
      <EntryEditor selection={selection} onClose={() => setSelection(null)} />
    </div>
  );
}
