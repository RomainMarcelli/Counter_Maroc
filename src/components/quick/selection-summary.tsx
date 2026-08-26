"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Droplets, Users } from "lucide-react";
import { useTrip } from "@/components/providers/trip-provider";
import { BacDetailSheet } from "@/components/bac/bac-detail-sheet";
import { useNow } from "@/lib/use-now";
import { zonedDayKey } from "@/lib/timezone";
import { ABSORPTION_MINUTES, buildAlcoholEvents, buildBacProfile, canSeeBac, estimateBacAt, formatBac } from "@/domain/bac";
import type { Participant } from "@/domain/types";

/** Nombre de verres d’affilée sans eau avant de suggérer un verre d’eau. */
const WATER_HINT_THRESHOLD = 3;

/**
 * Bandeau compact sous le sélecteur : compteur du jour, hydratation et — seulement si la
 * personne l’a activée — son estimation d’alcoolémie. Jamais de moyenne de groupe :
 * un taux est individuel.
 */
export function SelectionSummary() {
  const { trip, activeParticipants, drinks, drinkEntries, waterEntries, selectedParticipantIds, actorId } = useTrip();
  const now = useNow();
  const [detail, setDetail] = useState<Participant | null>(null);
  const single = selectedParticipantIds.length === 1 ? activeParticipants.find((participant) => participant.id === selectedParticipantIds[0]) ?? null : null;

  const summary = useMemo(() => {
    if (!trip || !single) return null;
    const today = zonedDayKey(new Date(now).toISOString(), trip.timezone);
    const mine = drinkEntries.filter((entry) => !entry.deletedAt && entry.participantId === single.id);
    const drinksToday = mine.filter((entry) => zonedDayKey(entry.consumedAt, trip.timezone) === today);
    const watersToday = waterEntries.filter((entry) => !entry.deletedAt && entry.participantId === single.id && zonedDayKey(entry.consumedAt, trip.timezone) === today);
    const lastWater = watersToday.map((entry) => entry.consumedAt).sort().at(-1) ?? "";
    const sinceWater = drinksToday.filter((entry) => entry.consumedAt > lastWater).length;
    const profile = buildBacProfile(single);
    const visible = canSeeBac(single, actorId);
    const bac = profile && visible ? estimateBacAt({ profile, events: buildAlcoholEvents(drinkEntries, drinks, single.id), at: now }).estimatedGPerL : null;
    // Un verre à peine servi n’est pas encore passé dans le sang : on le dit plutôt que d’afficher un 0 muet.
    // La tolérance négative couvre le pas d’horloge : `now` peut avoir jusqu’à une minute de retard sur l’ajout.
    const absorbing = mine.filter((entry) => {
      const elapsed = now - Date.parse(entry.consumedAt);
      return elapsed > -60_000 && elapsed < ABSORPTION_MINUTES * 60_000;
    }).length;
    return { drinksToday: drinksToday.length, watersToday: watersToday.length, sinceWater, bac, absorbing, hasProfile: Boolean(profile) };
  }, [trip, single, drinkEntries, waterEntries, drinks, actorId, now]);

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
