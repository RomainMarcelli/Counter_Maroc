"use client";

import { useMemo } from "react";
import { Activity, Info } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { DrinkIcon } from "@/components/drinks/drink-icon";
import { useTrip } from "@/components/providers/trip-provider";
import { useBac } from "@/components/providers/bac-provider";
import { BacCurve } from "./bac-curve";
import { BAC_DISCLAIMER, buildBacConsumptionDetails, buildBacTimeline, formatAlcoholGrams, formatBac, formatBacRange, formatTripTime } from "@/domain/bac";
import { formatDateKey, zonedDayKey } from "@/lib/timezone";
import type { Participant } from "@/domain/types";

const WINDOW_BEFORE_MS = 8 * 3_600_000;
const WINDOW_AFTER_MS = 2 * 3_600_000;

/** Fiche détaillée d’un participant : taux courant, pic, courbe et pics quotidiens. */
export function BacDetailSheet({ participant, onClose }: { participant: Participant | null; onClose: () => void }) {
  const { trip, drinks, drinkEntries } = useTrip();
  // Le taux « Actuellement », le pic et la courbe partent tous du même calcul et du
  // même instant que la carte qui a ouvert cette fiche.
  const { now, rowFor } = useBac();
  const row = rowFor(participant?.id);

  const detail = useMemo(() => {
    if (!participant || !trip || !row?.profile || !row.stats) return null;
    const { profile, events, stats } = { profile: row.profile, events: row.events, stats: row.stats };
    const timeline = buildBacTimeline({ profile, events, from: now - WINDOW_BEFORE_MS, to: now + WINDOW_AFTER_MS });
    const consumptions = buildBacConsumptionDetails({
      entries: drinkEntries,
      drinks,
      participantId: participant.id,
      now,
      absorptionMinutes: profile.absorptionMinutes,
    });
    const totalPureAlcohol = consumptions.reduce((total, item) => total + item.pureAlcoholGrams, 0);
    const totalAbsorbed = consumptions.reduce((total, item) => total + item.absorbedGrams, 0);
    const markers = events
      .filter((event) => Date.parse(event.consumedAt) >= now - WINDOW_BEFORE_MS)
      .map((event) => ({ at: event.consumedAt, label: `Verre à ${formatTripTime(event.consumedAt)}` }));
    // Dernier verre réellement enregistré : le nom figé au moment du verre prime,
    // pour qu’une recette modifiée depuis ne réécrive pas l’historique affiché.
    const latest = drinkEntries
      .filter((entry) => !entry.deletedAt && entry.participantId === participant.id)
      .sort((a, b) => b.consumedAt.localeCompare(a.consumedAt))[0] ?? null;
    const lastDrink = latest
      ? {
          name: latest.drinkNameSnapshot ?? drinks.find((drink) => drink.id === latest.drinkId)?.name ?? "Verre",
          time: formatTripTime(latest.consumedAt),
        }
      : null;
    return { stats, timeline, markers, lastDrink, consumptions, totalPureAlcohol, totalAbsorbed };
  }, [participant, trip, row, drinks, drinkEntries, now]);

  if (!participant || !trip) return null;
  return (
    <BottomSheet open onClose={onClose} title={`Alcoolémie estimée · ${participant.name}`}>
      {detail ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <article className="rounded-3xl bg-morocco p-4 text-ivory">
              <p className="text-[10px] font-black uppercase tracking-wider text-sand">Maintenant · {formatTripTime(new Date(now).toISOString())}</p>
              <strong className="mt-2 block font-display text-3xl">≈ {formatBac(detail.stats.current.estimatedGPerL)}</strong>
              <span className="text-xs font-bold text-sand">g/L estimés</span>
              <span className="mt-1 block text-[10px] font-black uppercase tracking-wider text-sand/70">{row?.absorbing ? "Absorption en cours" : detail.stats.current.estimatedGPerL > 0 ? "Phase d’élimination estimée" : "Rien à éliminer"}</span>
            </article>
            <article className="rounded-3xl border border-sand/60 bg-white p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-terra">Pic estimé</p>
              <strong className="mt-2 block font-display text-3xl">{detail.stats.tripPeak ? `≈ ${formatBac(detail.stats.tripPeak.gPerL)}` : "—"}</strong>
              <span className="text-xs font-bold text-morocco/50">{detail.stats.tripPeak ? formatTripTime(detail.stats.tripPeak.at) : "aucun verre"}</span>
            </article>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-sand/60 bg-white/70 p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-morocco/50">Plage théorique</p>
              <p className="mt-1 text-sm font-extrabold">{formatBacRange(detail.stats.current)}</p>
            </div>
            <div className="rounded-2xl border border-sand/60 bg-white/70 p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-morocco/50">Dernier verre</p>
              {detail.lastDrink ? (
                <p className="mt-1 truncate text-sm font-extrabold">{detail.lastDrink.name}<span className="ml-1.5 font-bold text-morocco/50">{detail.lastDrink.time}</span></p>
              ) : (
                <p className="mt-1 text-sm font-extrabold text-morocco/45">Aucun</p>
              )}
            </div>
          </div>

          {detail.consumptions.length ? (
            <section aria-labelledby="bac-drinks-title">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-terra">Détail du calcul</p>
                  <h3 id="bac-drinks-title" className="font-display text-xl font-bold">Boissons prises</h3>
                </div>
                <span className="rounded-full bg-sand/35 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-morocco/65">
                  {detail.consumptions.length} verre{detail.consumptions.length > 1 ? "s" : ""}
                </span>
              </div>

              <div className="mt-3 overflow-hidden rounded-3xl border border-sand/60 bg-white/75">
                <div className="grid grid-cols-2 gap-px bg-sand/45">
                  <div className="bg-ivory/95 p-3.5">
                    <p className="text-[9px] font-black uppercase tracking-wider text-morocco/45">Total alcool pur</p>
                    <strong className="mt-1 block text-lg">≈ {formatAlcoholGrams(detail.totalPureAlcohol)}</strong>
                  </div>
                  <div className="bg-ivory/95 p-3.5">
                    <p className="text-[9px] font-black uppercase tracking-wider text-morocco/45">Déjà absorbé</p>
                    <strong className="mt-1 block text-lg">≈ {formatAlcoholGrams(detail.totalAbsorbed)}</strong>
                  </div>
                </div>

                {row?.absorbing ? (
                  <div className="flex gap-2 border-t border-sand/50 bg-terra/10 px-3.5 py-3 text-xs font-bold leading-relaxed text-morocco/75">
                    <Activity size={17} className="mt-0.5 shrink-0 text-terra" />
                    <span><strong className="block text-morocco">Absorption en cours</strong>Le pic estimé n’est peut-être pas encore atteint.</span>
                  </div>
                ) : null}

                <div className="divide-y divide-sand/45">
                  {detail.consumptions.map((item) => {
                    const drink = drinks.find((candidate) => candidate.id === item.drinkId) ?? { icon: "generic", name: item.name, category: "cocktail" as const };
                    const impact = item.impact === "low" ? "faible" : item.impact === "moderate" ? "modéré" : "fort";
                    const absorption = Math.round(item.absorptionFraction * 100);
                    return (
                      <article key={item.entryId} className="flex gap-3 p-3.5">
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-sand/30 text-morocco"><DrinkIcon drink={drink} size={21} /></span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h4 className="truncate text-sm font-extrabold">{item.name}</h4>
                              <p className="text-[10px] font-bold text-morocco/45">{formatDateKey(zonedDayKey(item.consumedAt))} · {formatTripTime(item.consumedAt)}</p>
                            </div>
                            <strong className="shrink-0 text-sm">≈ {formatAlcoholGrams(item.pureAlcoholGrams)}</strong>
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-3 text-[10px] font-bold">
                            <span className="text-morocco/55">Impact estimé : {impact}</span>
                            <span className={item.absorbing ? "text-terra" : "text-morocco/45"}>{item.absorbing ? `Absorption ${absorption} %` : "Absorbé"}</span>
                          </div>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sand/35" aria-label={`${absorption} % absorbé`}>
                            <div className="h-full rounded-full bg-terra transition-[width] duration-500" style={{ width: `${absorption}%` }} />
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            </section>
          ) : (
            <section className="rounded-3xl border border-dashed border-sand p-5 text-center">
              <h3 className="font-display text-lg font-bold">Boissons prises</h3>
              <p className="mt-1 text-xs font-bold text-morocco/50">Aucune consommation alcoolisée enregistrée pour {participant.name}.</p>
            </section>
          )}

          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-terra">Évolution estimée</p>
            <div className="mt-2 rounded-3xl border border-sand/50 bg-white/70 p-3">
              <BacCurve points={detail.timeline} markers={detail.markers} now={now} label={`Courbe d’alcoolémie estimée de ${participant.name}`} />
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
                    <span className="w-11 text-right text-xs font-bold text-morocco/45">{formatTripTime(peak.at)}</span>
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
