"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useTrip } from "@/components/providers/trip-provider";
import { useToast } from "@/components/providers/toast-provider";
import { useActionDialog } from "@/components/providers/action-dialog-provider";
import type { DrinkEntry, WaterEntry } from "@/domain/types";
import { deleteDrinkEntry, deleteWaterEntry, refreshEntrySnapshots, updateDrinkEntry, updateWaterEntry } from "@/data/repository";
import { formatAlcoholGrams } from "@/domain/bac";
import { isoToZonedInput, zonedInputToIso } from "@/lib/timezone";

export type JournalSelection = { kind: "drink"; entry: DrinkEntry } | { kind: "water"; entry: WaterEntry };

export function EntryEditor({ selection, onClose }: { selection: JournalSelection | null; onClose: () => void }) {
  const { trip, activeParticipants, activeDrinks } = useTrip();
  const toast = useToast();
  const { confirm: confirmAction } = useActionDialog();
  const [participantId, setParticipantId] = useState("");
  const [drinkId, setDrinkId] = useState("");
  const [consumedAt, setConsumedAt] = useState("");
  const [paidBy, setPaidBy] = useState("");
  useEffect(() => {
    if (!selection || !trip) return;
    setParticipantId(selection.entry.participantId);
    setDrinkId(selection.kind === "drink" ? selection.entry.drinkId : "");
    setConsumedAt(isoToZonedInput(selection.entry.consumedAt, trip.timezone));
    setPaidBy(selection.kind === "drink" ? selection.entry.paidBy ?? "" : "");
  }, [selection, trip]);
  if (!selection || !trip) return null;
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const time = zonedInputToIso(consumedAt, trip.timezone);
    if (selection.kind === "drink") await updateDrinkEntry(selection.entry, { participantId, drinkId, consumedAt: time, paidBy: paidBy || null });
    else await updateWaterEntry(selection.entry, { participantId, consumedAt: time });
    toast({ message: "Consommation modifiée", detail: navigator.onLine ? "Synchronisation en cours" : "Modification gardée hors ligne" });
    onClose();
  };
  /** Recalcul explicite : une ancienne consommation reprend la recette actuelle de la boisson. */
  const recompute = async () => {
    await refreshEntrySnapshots([selection.entry.id]);
    toast({ message: "Alcool recalculé", detail: "L’entrée reprend la composition actuelle de la boisson." });
    onClose();
  };
  const remove = async () => {
    const confirmed = await confirmAction({
      eyebrow: "Journal du séjour",
      title: "Supprimer cette consommation ?",
      description: "Elle disparaîtra du Journal, des compteurs et des statistiques sur tous les téléphones après synchronisation.",
      confirmLabel: selection.kind === "drink" ? "Supprimer le verre" : "Supprimer l’eau",
      cancelLabel: "Garder l’entrée",
      tone: "danger",
      icon: "trash",
    });
    if (!confirmed) return;
    if (selection.kind === "drink") await deleteDrinkEntry(selection.entry); else await deleteWaterEntry(selection.entry);
    toast({ message: "Consommation supprimée", detail: navigator.onLine ? "Suppression en cours de synchronisation." : "Suppression conservée hors ligne." });
    onClose();
  };
  return (
    <BottomSheet open onClose={onClose} title="Modifier la consommation">
      <form onSubmit={save} className="space-y-4">
        <label className="block text-sm font-extrabold">Participant<select value={participantId} onChange={(event) => setParticipantId(event.target.value)} className="mt-2 min-h-14 w-full rounded-2xl border border-sand bg-white px-4">{activeParticipants.map((participant) => <option key={participant.id} value={participant.id}>{participant.name}</option>)}</select></label>
        {selection.kind === "drink" ? <label className="block text-sm font-extrabold">Boisson<select value={drinkId} onChange={(event) => setDrinkId(event.target.value)} className="mt-2 min-h-14 w-full rounded-2xl border border-sand bg-white px-4">{activeDrinks.map((drink) => <option key={drink.id} value={drink.id}>{drink.icon} {drink.name}</option>)}</select></label> : null}
        <label className="block text-sm font-extrabold">Date et heure · Marrakech<input type="datetime-local" value={consumedAt} onChange={(event) => setConsumedAt(event.target.value)} className="mt-2 min-h-14 w-full rounded-2xl border border-sand bg-white px-4" required /></label>
        {selection.kind === "drink" ? (
          <>
            <label className="block text-sm font-extrabold">Payé par<select value={paidBy} onChange={(event) => setPaidBy(event.target.value)} className="mt-2 min-h-14 w-full rounded-2xl border border-sand bg-white px-4"><option value="">Non précisé</option>{activeParticipants.map((participant) => <option key={participant.id} value={participant.id}>{participant.name}</option>)}</select></label>
            <div className="flex items-center gap-2 rounded-2xl border border-sand bg-white/70 px-3 py-2">
              <span className="min-w-0 flex-1 text-xs font-bold text-morocco/65">{selection.entry.alcoholGrams === null ? "Alcool non estimé pour ce verre" : `≈ ${formatAlcoholGrams(selection.entry.alcoholGrams)} d’alcool pur estimés`}</span>
              <button type="button" onClick={() => void recompute()} className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-2 text-xs font-black text-terra"><RefreshCw size={14} />Recalculer</button>
            </div>
          </>
        ) : null}
        <button className="min-h-14 w-full rounded-2xl bg-morocco font-black text-ivory">Enregistrer</button>
        <button type="button" onClick={() => void remove()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-terra font-black text-terra"><Trash2 size={18} />Supprimer</button>
      </form>
    </BottomSheet>
  );
}
