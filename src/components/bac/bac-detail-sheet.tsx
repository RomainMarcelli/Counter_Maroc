"use client";

import { useMemo } from "react";
import { Info } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useTrip } from "@/components/providers/trip-provider";
import { useNow } from "@/lib/use-now";
import { BacCurve } from "./bac-curve";
import { BAC_DISCLAIMER, buildAlcoholEvents, buildBacProfile, buildBacTimeline, calculateParticipantBacStats, formatBac, formatBacRange, formatTripTime } from "@/domain/bac";
import { formatDateKey } from "@/lib/timezone";
import type { Participant } from "@/domain/types";

const WINDOW_BEFORE_MS = 8 * 3_600_000;
const WINDOW_AFTER_MS = 2 * 3_600_000;

/** Fiche détaillée d’un participant : taux courant, pic, courbe et pics quotidiens. */
export function BacDetailSheet({ participant, onClose }: { participant: Participant | null; onClose: () => void }) {
  const { trip, drinks, drinkEntries } = useTrip();
  const now = useNow();
  const detail = useMemo(() => {
    if (!participant || !trip) return null;
    const profile = buildBacProfile(participant);
    if (!profile) return null;
    const events = buildAlcoholEvents(drinkEntries, drinks, participant.id);
    const stats = calculateParticipantBacStats({ profile, events, now, timezone: trip.timezone });
    const timeline = buildBacTimeline({ profile, events, from: now - WINDOW_BEFORE_MS, to: now + WINDOW_AFTER_MS });
    const markers = events
      .filter((event) => Date.parse(event.consumedAt) >= now - WINDOW_BEFORE_MS)
      .map((event) => ({ at: event.consumedAt, label: `Verre à ${formatTripTime(event.consumedAt, trip.timezone)}` }));
    return { stats, timeline, markers };
  }, [participant, trip, drinks, drinkEntries, now]);

  if (!participant || !trip) return null;
  return (
    <BottomSheet open onClose={onClose} title={`Alcoolémie estimée · ${participant.name}`}>
      {detail ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <article className="rounded-3xl bg-morocco p-4 text-ivory">
              <p className="text-[10px] font-black uppercase tracking-wider text-sand">Actuellement</p>
              <strong className="mt-2 block font-display text-3xl">≈ {formatBac(detail.stats.current.estimatedGPerL)}</strong>
              <span className="text-xs font-bold text-sand">g/L estimés</span>
            </article>
            <article className="rounded-3xl border border-sand/60 bg-white p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-terra">Pic estimé</p>
              <strong className="mt-2 block font-display text-3xl">{detail.stats.tripPeak ? `≈ ${formatBac(detail.stats.tripPeak.gPerL)}` : "—"}</strong>
              <span className="text-xs font-bold text-morocco/50">{detail.stats.tripPeak ? formatTripTime(detail.stats.tripPeak.at, trip.timezone) : "aucun verre"}</span>
            </article>
          </div>

          <div className="rounded-2xl border border-sand/60 bg-white/70 p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-morocco/50">Plage théorique</p>
            <p className="mt-1 text-sm font-extrabold">{formatBacRange(detail.stats.current)}</p>
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-terra">Évolution estimée</p>
            <div className="mt-2 rounded-3xl border border-sand/50 bg-white/70 p-3">
              <BacCurve points={detail.timeline} markers={detail.markers} now={now} timezone={trip.timezone} label={`Courbe d’alcoolémie estimée de ${participant.name}`} />
            </div>
          </div>

          {detail.stats.dailyPeaks.length ? (
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-terra">Pic par journée</p>
              <div className="mt-2 space-y-1.5">
                {[...detail.stats.dailyPeaks].reverse().slice(0, 12).map((peak) => (
                  <div key={peak.date} className="flex min-h-11 items-center gap-3 rounded-xl bg-white/70 px-3 text-sm">
                    <span className="flex-1 font-extrabold">{formatDateKey(peak.date)}</span>
                    <strong>≈ {formatBac(peak.gPerL)} g/L</strong>
                    <span className="w-11 text-right text-xs font-bold text-morocco/45">{formatTripTime(peak.at, trip.timezone)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <p className="flex gap-2 rounded-2xl border border-sand bg-sand/25 p-3 text-xs font-bold leading-relaxed text-morocco/70"><Info size={16} className="mt-0.5 shrink-0 text-terra" />{BAC_DISCLAIMER}</p>
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-sand p-5 text-sm font-bold text-morocco/60">{participant.name} n’a pas activé l’estimation d’alcoolémie. Elle se configure dans les Réglages, section Participants.</p>
      )}
    </BottomSheet>
  );
}
