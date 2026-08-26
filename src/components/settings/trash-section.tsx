"use client";

import { useCallback, useEffect, useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { useTrip } from "@/components/providers/trip-provider";
import { useToast } from "@/components/providers/toast-provider";
import { listDeletedEntries, restoreEntries, type DeletedEntry } from "@/data/repository";
import { formatTripDateTime } from "@/lib/timezone";

/** Corbeille : les suppressions sont douces, tout reste restaurable après les 6 secondes du snackbar. */
export function TrashSection({ open }: { open: boolean }) {
  const { trip, participants, drinks, drinkEntries, waterEntries } = useTrip();
  const toast = useToast();
  const [entries, setEntries] = useState<DeletedEntry[]>([]);
  const participantById = new Map(participants.map((item) => [item.id, item]));
  const drinkById = new Map(drinks.map((item) => [item.id, item]));

  const refresh = useCallback(async () => {
    if (!trip) return;
    setEntries(await listDeletedEntries(trip.id));
  }, [trip]);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh, drinkEntries, waterEntries]);

  if (!trip || !entries.length) return null;

  const restore = async (entry: DeletedEntry) => {
    await restoreEntries({
      drinkEntryIds: entry.kind === "drink" ? [entry.id] : [],
      waterEntryIds: entry.kind === "water" ? [entry.id] : [],
    });
    toast({ message: "Consommation restaurée", detail: "Elle revient dans le Journal et dans les statistiques." });
    await refresh();
  };

  return (
    <section>
      <h3 className="flex items-center gap-2 font-display text-xl font-bold"><Trash2 size={18} className="text-terra" />Corbeille</h3>
      <p className="mt-1 text-xs text-morocco/55">Les {entries.length} dernières suppressions de ce téléphone. Une entrée restaurée revient partout après synchronisation.</p>
      <div className="mt-3 space-y-2">
        {entries.map((entry) => (
          <div key={`${entry.kind}-${entry.id}`} className="flex min-h-14 items-center gap-2 rounded-xl bg-white px-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sand/35 text-base">{entry.kind === "water" ? "💧" : (entry.drinkId ? drinkById.get(entry.drinkId)?.icon : null) ?? "🍹"}</span>
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-sm">{participantById.get(entry.participantId)?.name ?? "Participant supprimé"} · {entry.kind === "water" ? "Eau" : (entry.drinkId ? drinkById.get(entry.drinkId)?.name : null) ?? entry.drinkName ?? "Boisson supprimée"}</strong>
              <span className="block truncate text-xs font-bold text-morocco/50">{formatTripDateTime(entry.consumedAt, trip.timezone)}</span>
            </span>
            <button onClick={() => void restore(entry)} className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-2 text-xs font-black text-terra" aria-label="Restaurer cette consommation"><RotateCcw size={15} />Restaurer</button>
          </div>
        ))}
      </div>
    </section>
  );
}
