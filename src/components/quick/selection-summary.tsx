"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Droplets, Users } from "lucide-react";
import { useTrip } from "@/components/providers/trip-provider";
import { useBac } from "@/components/providers/bac-provider";
import { BacDetailSheet } from "@/components/bac/bac-detail-sheet";
import { getTripDayKey } from "@/lib/trip-day";
import { formatBac } from "@/domain/bac";
import type { Participant } from "@/domain/types";

/** Nombre de verres d’affilée sans eau avant de suggérer un verre d’eau. */
const WATER_HINT_THRESHOLD = 3;

/**
 * Bandeau compact sous le sélecteur : compteur du jour, hydratation et — seulement si la
 * personne l’a activée — son estimation d’alcoolémie. Jamais de moyenne de groupe :
 * un taux est individuel.
 */
export function SelectionSummary() {
  const { trip, activeParticipants, drinkEntries, waterEntries, selectedParticipantIds } = useTrip();
  // Même estimation, même instant que la page Alcoolémie et que la modale de détail :
  // c’est le provider qui calcule, cet écran ne fait que lire.
  const { now, rowFor } = useBac();
  const [detail, setDetail] = useState<Participant | null>(null);
  const single = selectedParticipantIds.length === 1 ? activeParticipants.find((participant) => participant.id === selectedParticipantIds[0]) ?? null : null;

  const summary = useMemo(() => {
    if (!trip || !single) return null;
    const today = getTripDayKey(now);
    const mine = drinkEntries.filter((entry) => !entry.deletedAt && entry.participantId === single.id);
    const drinksToday = mine.filter((entry) => getTripDayKey(entry.consumedAt) === today);
    const watersToday = waterEntries.filter((entry) => !entry.deletedAt && entry.participantId === single.id && getTripDayKey(entry.consumedAt) === today);
    const lastWater = watersToday.map((entry) => entry.consumedAt).sort().at(-1) ?? "";
    const sinceWater = drinksToday.filter((entry) => entry.consumedAt > lastWater).length;
    // Un verre à peine servi n’est pas encore passé dans le sang : on le dit plutôt
    // que d’afficher un 0 muet.
    const row = rowFor(single.id);
    return {
      drinksToday: drinksToday.length,
      watersToday: watersToday.length,
      sinceWater,
      bac: row?.stats?.current.estimatedGPerL ?? null,
      absorbing: row?.absorbing ?? 0,
      hasProfile: Boolean(row?.profile),
    };
  }, [trip, single, drinkEntries, waterEntries, rowFor, now]);

  if (!trip) return null;
  if (!single || !summary) {
    return (
      <p className="flex min-h-12 items-center gap-2 rounded-2xl border border-sand/60 bg-white/60 px-4 text-sm font-extrabold text-morocco/70">
        <Users size={16} className="text-terra" />
        {selectedParticipantIds.length} personnes sélectionnées · les taux restent individuels
      </p>
    );
  }

  const content = (
    <>
      <span className="min-w-0 flex-1 text-left">
        <strong className="block truncate text-sm font-black">{single.name} · {summary.drinksToday} verre{summary.drinksToday > 1 ? "s" : ""} aujourd’hui</strong>
        <span className="mt-0.5 flex items-center gap-1.5 text-xs font-bold text-morocco/55"><Droplets size={12} />{summary.watersToday} eau{summary.watersToday > 1 ? "x" : ""}{summary.sinceWater >= WATER_HINT_THRESHOLD ? ` · ${summary.sinceWater} verres sans eau` : ""}</span>
      </span>
      {summary.bac === null ? null : (
        <span className="shrink-0 text-right">
          <strong className="block font-display text-xl leading-none">≈ {formatBac(summary.bac)}</strong>
          <span className="text-[10px] font-black uppercase tracking-wider text-morocco/50">g/L estimés</span>
          {summary.absorbing ? <span className="mt-0.5 block text-[10px] font-black uppercase tracking-wider text-terra">absorption en cours</span> : null}
        </span>
      )}
      {summary.hasProfile ? <ChevronRight size={16} className="shrink-0 text-morocco/35" /> : null}
    </>
  );

  return (
    <>
      {summary.hasProfile ? (
        <button onClick={() => setDetail(single)} className="tap-bump flex min-h-14 w-full items-center gap-3 rounded-2xl border border-sand/60 bg-white/70 px-4 text-morocco shadow-sm" aria-label={`Voir le détail de l’alcoolémie estimée de ${single.name}`}>{content}</button>
      ) : (
        <div className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-sand/60 bg-white/60 px-4">{content}</div>
      )}
      <BacDetailSheet participant={detail} onClose={() => setDetail(null)} />
    </>
  );
}
