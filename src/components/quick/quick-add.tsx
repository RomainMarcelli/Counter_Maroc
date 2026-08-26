"use client";

import { useMemo, useState } from "react";
import { Plus, RotateCcw, Sparkles } from "lucide-react";
import { useTrip } from "@/components/providers/trip-provider";
import { useToast } from "@/components/providers/toast-provider";
import { ParticipantPicker } from "./participant-picker";
import { DrinkFormSheet } from "./drink-form-sheet";
import { sortSmartFavorites } from "@/domain/favorites";
import { addDrinkRound, addWaterRound, undoBatch } from "@/data/repository";

export function QuickAdd() {
  const { trip, activeParticipants, activeDrinks, drinkEntries, selectedParticipantIds } = useTrip();
  const toast = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const sortedDrinks = useMemo(() => sortSmartFavorites(activeDrinks, drinkEntries, selectedParticipantIds), [activeDrinks, drinkEntries, selectedParticipantIds]);
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

  const add = async (drinkId: string, participantIds = selectedParticipantIds) => {
    if (!trip || participantIds.length === 0) return;
    const drink = drinkById.get(drinkId);
    if (!drink) return;
    const batch = await addDrinkRound(trip.id, participantIds, drinkId);
    const target = participantIds.length === 1 ? nameById.get(participantIds[0]) : `${participantIds.length} personnes`;
    toast({
      message: participantIds.length === 1 ? `${drink.name} ajouté à ${target}` : `Tournée ajoutée · ${participantIds.length} ${drink.name}${participantIds.length > 1 ? "s" : ""}`,
      detail: navigator.onLine ? "Synchronisation en cours" : "Enregistré sur ce téléphone · en attente",
      actionLabel: "Annuler",
      onAction: () => undoBatch(batch),
    });
  };
  const addWater = async () => {
    if (!trip || !selectedParticipantIds.length) return;
    const batch = await addWaterRound(trip.id, selectedParticipantIds);
    toast({ message: selectedParticipantIds.length === 1 ? `Eau ajoutée à ${nameById.get(selectedParticipantIds[0])}` : `${selectedParticipantIds.length} eaux ajoutées`, actionLabel: "Annuler", onAction: () => undoBatch(batch) });
  };

  return (
    <div className="space-y-7">
      <ParticipantPicker />
      {(latestForSelection || lastRound.length > 1) ? (
        <section className="grid gap-2 sm:grid-cols-2" aria-label="Actions rapides précédentes">
          {latestForSelection ? <button onClick={() => void add(latestForSelection.drinkId)} className="tap-bump flex min-h-14 items-center gap-3 rounded-2xl bg-sand/50 px-4 text-left text-sm font-extrabold"><RotateCcw size={18} className="text-terra" /><span><span className="block text-[10px] uppercase tracking-wider text-morocco/55">Reprendre</span>{drinkById.get(latestForSelection.drinkId)?.icon} {drinkById.get(latestForSelection.drinkId)?.name}</span></button> : null}
          {lastRound.length > 1 ? <button onClick={() => void add(lastRound[0].drinkId, lastRound.map((entry) => entry.participantId))} className="tap-bump flex min-h-14 items-center gap-3 rounded-2xl bg-sand/50 px-4 text-left text-sm font-extrabold"><RotateCcw size={18} className="text-terra" /><span><span className="block text-[10px] uppercase tracking-wider text-morocco/55">Dernière tournée</span>Refaire {lastRound.length} {drinkById.get(lastRound[0].drinkId)?.name}s</span></button> : null}
        </section>
      ) : null}
      <section aria-labelledby="drink-title">
        <div className="mb-3 flex items-end justify-between"><div><p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.2em] text-terra"><Sparkles size={12} /> Favoris intelligents</p><h2 id="drink-title" className="font-display text-2xl font-bold">Qu’est-ce qu’on prend ?</h2></div></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {sortedDrinks.map((drink, index) => (
            <button key={drink.id} onClick={() => void add(drink.id)} className={`zellige-card tap-bump card-enter flex min-h-[94px] flex-col items-start justify-between rounded-[22px] p-4 text-left shadow-card transition ${index < 4 ? "bg-morocco text-ivory" : "border border-sand/60 bg-white/75 text-morocco"}`} style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }} aria-label={`Ajouter un ${drink.name} aux participants sélectionnés`}>
              <span className="text-2xl" aria-hidden="true">{drink.icon}</span><span className="relative z-10 text-sm font-black leading-tight">{drink.name}</span>
            </button>
          ))}
          <button onClick={() => setFormOpen(true)} className="tap-bump flex min-h-[94px] flex-col items-start justify-between rounded-[22px] border-2 border-dashed border-terra/45 bg-terra/5 p-4 text-left text-terra"><Plus size={24} /><span className="text-sm font-black">Ajouter une boisson</span></button>
        </div>
      </section>
      <button onClick={() => void addWater()} className="tap-bump flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl border-2 border-morocco bg-ivory text-base font-black text-morocco shadow-card"><span className="text-2xl">💧</span> +1 eau <span className="text-xs font-bold text-morocco/50">hors classement alcool</span></button>
      <DrinkFormSheet open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}
