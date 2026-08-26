"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useTrip } from "@/components/providers/trip-provider";
import { useToast } from "@/components/providers/toast-provider";
import type { DrinkEntry, WaterEntry } from "@/domain/types";
import { deleteDrinkEntry, deleteWaterEntry, updateDrinkEntry, updateWaterEntry } from "@/data/repository";
import { isoToZonedInput, zonedInputToIso } from "@/lib/timezone";

export type JournalSelection = { kind: "drink"; entry: DrinkEntry } | { kind: "water"; entry: WaterEntry };

export function EntryEditor({ selection, onClose }: { selection: JournalSelection | null; onClose: () => void }) {
  const { trip, activeParticipants, activeDrinks } = useTrip();
  const toast = useToast();
  const [participantId, setParticipantId] = useState("");
  const [drinkId, setDrinkId] = useState("");
  const [consumedAt, setConsumedAt] = useState("");
  useEffect(() => {
    if (!selection || !trip) return;
    setParticipantId(selection.entry.participantId);
    setDrinkId(selection.kind === "drink" ? selection.entry.drinkId : "");
    setConsumedAt(isoToZonedInput(selection.entry.consumedAt, trip.timezone));
  }, [selection, trip]);
  if (!selection || !trip) return null;
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const time = zonedInputToIso(consumedAt, trip.timezone);
    if (selection.kind === "drink") await updateDrinkEntry(selection.entry, { participantId, drinkId, consumedAt: time });
    else await updateWaterEntry(selection.entry, { participantId, consumedAt: time });
    toast({ message: "Consommation modifiée", detail: navigator.onLine ? "Synchronisation en cours" : "Modification gardée hors ligne" });
    onClose();
  };
  const remove = async () => {
    if (!window.confirm("Supprimer cette consommation ?")) return;
    if (selection.kind === "drink") await deleteDrinkEntry(selection.entry); else await deleteWaterEntry(selection.entry);
    toast({ message: "Consommation supprimée", detail: "La suppression sera synchronisée" });
    onClose();
  };
  return (
    <BottomSheet open onClose={onClose} title="Modifier la consommation">
      <form onSubmit={save} className="space-y-4">
        <label className="block text-sm font-extrabold">Participant<select value={participantId} onChange={(event) => setParticipantId(event.target.value)} className="mt-2 min-h-14 w-full rounded-2xl border border-sand bg-white px-4">{activeParticipants.map((participant) => <option key={participant.id} value={participant.id}>{participant.name}</option>)}</select></label>
        {selection.kind === "drink" ? <label className="block text-sm font-extrabold">Boisson<select value={drinkId} onChange={(event) => setDrinkId(event.target.value)} className="mt-2 min-h-14 w-full rounded-2xl border border-sand bg-white px-4">{activeDrinks.map((drink) => <option key={drink.id} value={drink.id}>{drink.icon} {drink.name}</option>)}</select></label> : null}
        <label className="block text-sm font-extrabold">Date et heure · Marrakech<input type="datetime-local" value={consumedAt} onChange={(event) => setConsumedAt(event.target.value)} className="mt-2 min-h-14 w-full rounded-2xl border border-sand bg-white px-4" required /></label>
        <button className="min-h-14 w-full rounded-2xl bg-morocco font-black text-ivory">Enregistrer</button>
        <button type="button" onClick={() => void remove()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-terra font-black text-terra"><Trash2 size={18} />Supprimer</button>
      </form>
    </BottomSheet>
  );
}
