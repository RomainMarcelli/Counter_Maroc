"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock3, Droplets, Plus, RotateCcw, Star } from "lucide-react";
import clsx from "clsx";
import { useTrip } from "@/components/providers/trip-provider";
import { useToast } from "@/components/providers/toast-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { ParticipantPicker } from "./participant-picker";
import { DrinkFormSheet } from "./drink-form-sheet";
import { SelectionSummary } from "./selection-summary";
import { DrinkIcon, DrinkIconGlyph } from "@/components/drinks/drink-icon";
import { resolveDrinkIconKey } from "@/domain/drink-icons";
import { buildDrinkSuggestions, DRINK_FILTERS, filterSuggestions, isDrinkFilter, type DrinkFilter } from "@/domain/favorites";
import { addDrinkRound, addWaterRound, undoBatch } from "@/data/repository";
import type { UndoBatch } from "@/domain/types";

const FILTER_STORAGE_KEY = "marrakech-quick-filter";

/** Rattrapage d’une soirée saisie en retard, sans jamais ajouter d’étape à l’ajout normal. */
const TIME_OFFSETS = [
  { minutes: 0, label: "Maintenant" },
  { minutes: 60, label: "Il y a 1 h" },
  { minutes: 120, label: "Il y a 2 h" },
  { minutes: 180, label: "Il y a 3 h" },
] as const;

function readStoredFilter(): DrinkFilter | null {
  try {
    const stored = window.localStorage.getItem(FILTER_STORAGE_KEY);
    return stored && isDrinkFilter(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function QuickAdd() {
  const { trip, activeParticipants, activeDrinks, drinkEntries, selectedParticipantIds, queue } = useTrip();
  const toast = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [filter, setFilter] = useState<DrinkFilter>("all");
  const [offsetIndex, setOffsetIndex] = useState(0);
  const pendingSync = useRef<{ operationIds: string[]; message: string; icon: React.ReactNode; queued: boolean } | null>(null);

  useEffect(() => {
    const stored = readStoredFilter();
    if (stored) setFilter(stored);
  }, []);

  const selectFilter = useCallback((next: DrinkFilter) => {
    setFilter(next);
    try { window.localStorage.setItem(FILTER_STORAGE_KEY, next); } catch { /* stockage indisponible */ }
  }, []);

  const suggestions = useMemo(() => buildDrinkSuggestions(activeDrinks, drinkEntries, selectedParticipantIds), [activeDrinks, drinkEntries, selectedParticipantIds]);
  const visibleSuggestions = useMemo(() => filterSuggestions(suggestions, filter), [suggestions, filter]);
  const latestForSelection = useMemo(() => {
    if (selectedParticipantIds.length !== 1) return null;
    return [...drinkEntries].filter((entry) => !entry.deletedAt && entry.participantId === selectedParticipantIds[0]).sort((a, b) => b.consumedAt.localeCompare(a.consumedAt))[0] ?? null;
  }, [drinkEntries, selectedParticipantIds]);
  const lastRound = useMemo(() => {
    const latest = [...drinkEntries].filter((entry) => !entry.deletedAt && entry.roundId).sort((a, b) => b.consumedAt.localeCompare(a.consumedAt))[0];
    return latest ? drinkEntries.filter((entry) => !entry.deletedAt && entry.roundId === latest.roundId) : [];
  }, [drinkEntries]);
  const nameById = new Map(activeParticipants.map((participant) => [participant.id, participant.name]));
  const drinkById = new Map(activeDrinks.map((drink) => [drink.id, drink]));

  // La ligne de synchronisation complète le snackbar en cours, elle ne le remplace jamais.
  useEffect(() => {
    const pending = pendingSync.current;
    if (!pending) return;
    if (queue.some((operation) => pending.operationIds.includes(operation.id))) {
      pending.queued = true;
      return;
    }
    if (!pending.queued) return;
    pendingSync.current = null;
    toast({ message: pending.message, icon: pending.icon, detail: "Synchronisé avec le groupe ✓", syncUpdate: true });
  }, [queue, toast]);

  const offset = TIME_OFFSETS[offsetIndex];
  const consumedAt = () => (offset.minutes ? new Date(Date.now() - offset.minutes * 60_000).toISOString() : undefined);

  const announce = (batch: UndoBatch, message: string, icon: React.ReactNode) => {
    const online = typeof navigator === "undefined" || navigator.onLine;
    const when = offset.minutes ? `Enregistré ${offset.label.toLowerCase()}` : online ? "Enregistré" : "Enregistré sur ce téléphone";
    pendingSync.current = {
      operationIds: [...batch.drinkEntryIds.map((id) => `drinkEntry:${id}`), ...batch.waterEntryIds.map((id) => `waterEntry:${id}`)],
      message,
      icon,
      queued: false,
    };
    toast({
      message,
      icon,
      detail: `${when} · synchronisation en attente`,
      actionLabel: "Annuler",
      onAction: () => { pendingSync.current = null; return undoBatch(batch); },
    });
  };

  const add = async (drinkId: string, participantIds = selectedParticipantIds) => {
    if (!trip || participantIds.length === 0) return;
    const drink = drinkById.get(drinkId);
    if (!drink) return;
    const batch = await addDrinkRound(trip.id, participantIds, drinkId, consumedAt());
    const message = participantIds.length === 1
      ? `${drink.name} ajouté à ${nameById.get(participantIds[0]) ?? "ce participant"}`
      : `Tournée ajoutée · ${participantIds.length} × ${drink.name}`;
    announce(batch, message, <DrinkIconGlyph iconKey={resolveDrinkIconKey(drink)} size={21} />);
  };

  const addWater = async () => {
    if (!trip || !selectedParticipantIds.length) return;
    const batch = await addWaterRound(trip.id, selectedParticipantIds, consumedAt());
    announce(batch, selectedParticipantIds.length === 1 ? `Eau ajoutée à ${nameById.get(selectedParticipantIds[0])}` : `${selectedParticipantIds.length} eaux ajoutées`, <Droplets size={21} />);
  };

  return (
    <div className="space-y-7">
      <ParticipantPicker />
      <SelectionSummary />
      {(latestForSelection || lastRound.length > 1) ? (
        <section className="grid gap-2 sm:grid-cols-2" aria-label="Actions rapides précédentes">
          {latestForSelection ? <button onClick={() => void add(latestForSelection.drinkId)} className="tap-bump flex min-h-14 items-center gap-3 rounded-2xl bg-sand/50 px-4 text-left text-sm font-extrabold"><RotateCcw size={18} className="text-terra" /><span className="min-w-0 flex-1"><span className="block text-[10px] uppercase tracking-wider text-morocco/55">Reprendre</span><span className="flex items-center gap-1.5 truncate">{(() => { const previous = drinkById.get(latestForSelection.drinkId); return previous ? <><DrinkIcon drink={previous} size={17} />{previous.name}</> : null; })()}</span></span></button> : null}
          {lastRound.length > 1 ? <button onClick={() => void add(lastRound[0].drinkId, lastRound.map((entry) => entry.participantId))} className="tap-bump flex min-h-14 items-center gap-3 rounded-2xl bg-sand/50 px-4 text-left text-sm font-extrabold"><RotateCcw size={18} className="text-terra" /><span><span className="block text-[10px] uppercase tracking-wider text-morocco/55">Dernière tournée</span>Refaire {lastRound.length} × {drinkById.get(lastRound[0].drinkId)?.name}</span></button> : null}
        </section>
      ) : null}
      <section aria-labelledby="drink-title">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-terra">Étape 2</p><h2 id="drink-title" className="font-display text-2xl font-bold">Qu’est-ce qu’on prend ?</h2></div>
          <button type="button" onClick={() => setOffsetIndex((index) => (index + 1) % TIME_OFFSETS.length)} className={clsx("tap-bump flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-black transition", offset.minutes ? "border-terra bg-terra text-ivory" : "border-sand bg-white text-morocco/70")} aria-label={`Heure du verre : ${offset.label}. Toucher pour saisir un verre plus ancien`}>
            <Clock3 size={14} />{offset.label}
          </button>
        </div>
        <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Filtrer les boissons">
          {DRINK_FILTERS.map((option) => {
            const active = filter === option.id;
            return (
              <button key={option.id} type="button" onClick={() => selectFilter(option.id)} aria-pressed={active} className={clsx("tap-bump min-h-11 shrink-0 rounded-full border px-4 text-xs font-black transition", active ? "border-morocco bg-morocco text-ivory shadow-card" : "border-sand/70 bg-sand/25 text-morocco")}>
                {option.label}
              </button>
            );
          })}
        </div>
        {visibleSuggestions.length === 0 ? (
          filter === "favorites"
            ? <EmptyState icon={<Star size={29} />} title="Pas encore de favoris" detail="Tes boissons favorites apparaîtront ici après quelques verres." />
            : <EmptyState icon={<DrinkIconGlyph iconKey="cocktail" size={29} />} title="Rien dans cette catégorie" detail="Ajoute une boisson : elle rejoindra ce filtre immédiatement." />
        ) : null}
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {visibleSuggestions.map(({ drink, count, isFavorite }) => (
            <button key={drink.id} onClick={() => void add(drink.id)} data-favorite={isFavorite ? "true" : "false"} title={isFavorite ? `Favori · ${count} verre${count > 1 ? "s" : ""}` : undefined} className={clsx("zellige-card tap-bump card-enter relative flex min-h-[94px] flex-col items-start justify-between rounded-[22px] border bg-white/75 p-4 text-left text-morocco shadow-card transition", isFavorite ? "border-terra/45" : "border-sand/60")} style={{ animationDelay: `${Math.min(drink.sortOrder, 8) * 30}ms` }} aria-label={`Ajouter un ${drink.name} aux participants sélectionnés`}>
              <DrinkIcon drink={drink} size={26} className="relative z-10" />
              <span className="relative z-10 text-sm font-black leading-tight">{drink.name}</span>
              {isFavorite ? <span key={count} className="count-bump absolute right-2.5 top-2.5 z-10 flex items-center gap-0.5 rounded-full bg-terra/10 px-1.5 py-0.5 text-[10px] font-black text-terra" aria-hidden="true"><Star size={9} className="fill-terra" />{count}</span> : null}
            </button>
          ))}
          <button onClick={() => setFormOpen(true)} className="tap-bump flex min-h-[94px] flex-col items-start justify-between rounded-[22px] border-2 border-dashed border-terra/45 bg-terra/5 p-4 text-left text-terra"><Plus size={24} /><span className="text-sm font-black">Ajouter une boisson</span></button>
        </div>
      </section>
      <button onClick={() => void addWater()} className="tap-bump flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl border-2 border-morocco bg-ivory text-base font-black text-morocco shadow-card"><Droplets size={22} /> +1 eau <span className="text-xs font-bold text-morocco/50">hors classement alcool</span></button>
      <DrinkFormSheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        defaultCategory={filter === "all" || filter === "favorites" ? undefined : filter}
        onCreated={(drink) => { if (filter === "favorites") selectFilter(drink.category); }}
      />
    </div>
  );
}
