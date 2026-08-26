"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, ListChecks, PencilLine, SlidersHorizontal, Trash2, UserRound } from "lucide-react";
import clsx from "clsx";
import { useTrip } from "@/components/providers/trip-provider";
import { useToast } from "@/components/providers/toast-provider";
import { useActionDialog } from "@/components/providers/action-dialog-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { EntryEditor, type JournalSelection } from "./entry-editor";
import { BulkEditSheet } from "./bulk-edit-sheet";
import { deleteEntries, restoreEntries } from "@/data/repository";
import { formatDateKey, formatTripDateTime, zonedDayKey } from "@/lib/timezone";
import type { UndoBatch } from "@/domain/types";

type RowKind = "drink" | "water";

const rowId = (kind: RowKind, id: string) => `${kind}-${id}`;

export function JournalList() {
  const { trip, participants, drinks, drinkEntries, waterEntries } = useTrip();
  const toast = useToast();
  const { confirm: confirmAction } = useActionDialog();
  const [selection, setSelection] = useState<JournalSelection | null>(null);
  const [day, setDay] = useState("all");
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [person, setPerson] = useState("all");
  const [editing, setEditing] = useState<UndoBatch | null>(null);
  const participantById = new Map(participants.map((item) => [item.id, item]));
  const participantByUserId = new Map(participants.filter((item) => item.userId).map((item) => [item.userId as string, item]));
  const drinkById = new Map(drinks.map((item) => [item.id, item]));
  const rows = useMemo(() => {
    if (!trip) return [];
    return [
      ...drinkEntries.filter((entry) => !entry.deletedAt).map((entry) => ({ kind: "drink" as const, entry, consumedAt: entry.consumedAt })),
      ...waterEntries.filter((entry) => !entry.deletedAt).map((entry) => ({ kind: "water" as const, entry, consumedAt: entry.consumedAt })),
    ]
      .filter((row) => day === "all" || zonedDayKey(row.consumedAt, trip.timezone) === day)
      .filter((row) => person === "all" || row.entry.participantId === person)
      .sort((a, b) => b.consumedAt.localeCompare(a.consumedAt));
  }, [trip, drinkEntries, waterEntries, day, person]);

  const visibleIds = useMemo(() => rows.map((row) => rowId(row.kind, row.entry.id)), [rows]);
  const visibleKey = visibleIds.join("|");
  // On ne garde jamais dans la sélection une ligne que l’écran n’affiche plus (filtre par jour, suppression distante…).
  useEffect(() => {
    const visible = new Set(visibleKey ? visibleKey.split("|") : []);
    setPicked((current) => current.filter((id) => visible.has(id)));
  }, [visibleKey]);

  if (!trip) return null;
  const days = [...new Set([...drinkEntries, ...waterEntries].filter((entry) => !entry.deletedAt).map((entry) => zonedDayKey(entry.consumedAt, trip.timezone)))].sort().reverse();
  const pickedSet = new Set(picked);
  const allPicked = rows.length > 0 && picked.length === rows.length;

  const stopPicking = () => { setPicking(false); setPicked([]); };
  const toggleRow = (key: string) => setPicked((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);

  const pickedBatch = (): UndoBatch => ({
    drinkEntryIds: rows.filter((row) => row.kind === "drink" && pickedSet.has(rowId(row.kind, row.entry.id))).map((row) => row.entry.id),
    waterEntryIds: rows.filter((row) => row.kind === "water" && pickedSet.has(rowId(row.kind, row.entry.id))).map((row) => row.entry.id),
  });

  const removePicked = async () => {
    const batch = pickedBatch();
    const total = batch.drinkEntryIds.length + batch.waterEntryIds.length;
    if (!total) return;
    const confirmed = await confirmAction({
      eyebrow: "Journal du séjour",
      title: total === 1 ? "Supprimer cette consommation ?" : `Supprimer ces ${total} consommations ?`,
      description: "Elles disparaîtront du Journal, des compteurs et des statistiques sur tous les téléphones après synchronisation.",
      confirmLabel: total === 1 ? "Supprimer l’entrée" : `Supprimer les ${total}`,
      cancelLabel: "Tout garder",
      tone: "danger",
      icon: "trash",
    });
    if (!confirmed) return;
    await deleteEntries(batch);
    stopPicking();
    toast({
      message: total === 1 ? "1 consommation supprimée" : `${total} consommations supprimées`,
      icon: "🗑️",
      detail: navigator.onLine ? "Suppression · synchronisation en attente" : "Suppression conservée sur ce téléphone",
      actionLabel: "Annuler",
      onAction: () => restoreEntries(batch),
    });
  };

  return (
    <div>
      <header className="mb-6">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-terra">Tout est modifiable</p>
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-4xl font-bold">Journal</h1>
          {rows.length ? (
            <button onClick={() => (picking ? stopPicking() : setPicking(true))} aria-pressed={picking} className={clsx("tap-bump flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-black transition", picking ? "border-morocco bg-morocco text-ivory" : "border-sand bg-white text-morocco")}>
              <ListChecks size={16} />{picking ? "Terminer" : "Sélectionner"}
            </button>
          ) : null}
        </div>
        <p className="mt-2 text-sm text-morocco/60">{picking ? "Touchez les verres à corriger, puis supprimez-les d’un coup." : `Chaque heure est conservée dans le fuseau ${trip.timezone}.`}</p>
      </header>
      {picking ? (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-sand/70 bg-sand/25 px-3 py-2">
          <span className="text-xs font-black text-morocco">{picked.length} sélectionné{picked.length > 1 ? "s" : ""}</span>
          <button onClick={() => setPicked(allPicked ? [] : visibleIds)} className="tap-bump min-h-11 rounded-xl px-3 text-xs font-black text-terra">{allPicked ? "Tout désélectionner" : "Tout sélectionner"}</button>
        </div>
      ) : null}
      <div className="no-scrollbar -mx-4 mb-2 flex gap-2 overflow-x-auto px-4" role="group" aria-label="Filtrer par personne"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sand/35"><UserRound size={17} /></span><button onClick={() => setPerson("all")} aria-pressed={person === "all"} className={clsx("min-h-11 shrink-0 rounded-xl px-4 text-xs font-extrabold", person === "all" ? "bg-morocco text-ivory" : "bg-white")}>Tout le monde</button>{participants.filter((item) => !item.deletedAt).map((item) => <button key={item.id} onClick={() => setPerson(item.id)} aria-pressed={person === item.id} className={clsx("min-h-11 shrink-0 rounded-xl px-4 text-xs font-extrabold", person === item.id ? "bg-morocco text-ivory" : "bg-white")}>{item.name}</button>)}</div>
      <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4" role="group" aria-label="Filtrer par jour"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sand/35"><SlidersHorizontal size={17} /></span><button onClick={() => setDay("all")} className={`min-h-11 shrink-0 rounded-xl px-4 text-xs font-extrabold ${day === "all" ? "bg-morocco text-ivory" : "bg-white"}`}>Tout</button>{days.map((value) => <button key={value} onClick={() => setDay(value)} className={`min-h-11 shrink-0 rounded-xl px-4 text-xs font-extrabold ${day === value ? "bg-morocco text-ivory" : "bg-white"}`}>{formatDateKey(value)}</button>)}</div>
      {rows.length ? <div className="space-y-2">{rows.map((row) => {
        const participant = participantById.get(row.entry.participantId);
        const drink = row.kind === "drink" ? drinkById.get(row.entry.drinkId) : null;
        const key = rowId(row.kind, row.entry.id);
        const checked = pickedSet.has(key);
        const label = `${participant?.name ?? "Participant supprimé"} · ${row.kind === "water" ? "Eau" : drink?.name ?? row.entry.drinkNameSnapshot ?? "Boisson supprimée"}`;
        // `actionBy` est le compte qui a saisi la ligne : on l’affiche via le
        // participant qu’il incarne, et on reste muet si personne ne correspond.
        const addedBy = participantByUserId.get(row.entry.actionBy)?.name ?? null;
        return (
          <button
            key={key}
            onClick={() => (picking ? toggleRow(key) : setSelection({ kind: row.kind, entry: row.entry } as JournalSelection))}
            role={picking ? "checkbox" : undefined}
            aria-checked={picking ? checked : undefined}
            className={clsx("card-enter flex min-h-[72px] w-full items-center gap-3 rounded-2xl border p-3 text-left shadow-sm transition", checked ? "border-terra bg-terra/5" : "border-sand/50 bg-white/75")}
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sand/35 text-xl">{row.kind === "water" ? "💧" : drink?.icon ?? "🍹"}</span>
            <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{label}</strong><span className="mt-1 block truncate text-xs font-bold text-morocco/50">{formatTripDateTime(row.consumedAt, trip.timezone)}{addedBy ? ` · ajouté par ${addedBy}` : ""}</span></span>
            {picking
              ? <span className={clsx("flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition", checked ? "border-terra bg-terra text-ivory" : "border-sand bg-white")} aria-hidden="true">{checked ? <Check size={14} strokeWidth={3.5} /> : null}</span>
              : <ChevronRight size={18} className="text-morocco/35" />}
          </button>
        );
      })}</div> : <EmptyState icon="📖" title="Le journal est calme" detail="Ajoutez un premier verre depuis l’écran Rapide. Il apparaîtra ici instantanément, même hors ligne." />}
      {picking && picked.length ? (
        <>
          <div className="h-24" aria-hidden="true" />
          <div className="card-enter fixed inset-x-4 z-[80] mx-auto flex max-w-md items-center gap-3 rounded-[22px] border border-sand/20 bg-morocco px-3 py-3 text-ivory shadow-2xl" style={{ bottom: "calc(88px + env(safe-area-inset-bottom))" }}>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-sm font-black text-sand" aria-hidden="true">{picked.length}</span>
            <p className="min-w-0 flex-1 text-sm font-extrabold leading-snug">verre{picked.length > 1 ? "s" : ""} sélectionné{picked.length > 1 ? "s" : ""}</p>
            <button onClick={() => setEditing(pickedBatch())} className="tap-bump flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-white/10 px-3 text-xs font-black uppercase tracking-wider text-sand"><PencilLine size={15} />Corriger</button>
            <button onClick={() => void removePicked()} className="tap-bump flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-terra px-3 text-xs font-black uppercase tracking-wider text-ivory shadow-sm"><Trash2 size={15} />Supprimer</button>
          </div>
        </>
      ) : null}
      <EntryEditor selection={selection} onClose={() => setSelection(null)} />
      <BulkEditSheet batch={editing} onClose={() => setEditing(null)} onDone={stopPicking} />
    </div>
  );
}
