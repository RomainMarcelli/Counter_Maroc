"use client";

import { useMemo, useState } from "react";
import { Activity, ChevronRight, Info } from "lucide-react";
import { useTrip } from "@/components/providers/trip-provider";
import { useBac } from "@/components/providers/bac-provider";
import { BacDetailSheet } from "@/components/bac/bac-detail-sheet";
import { formatDateKey } from "@/lib/timezone";
import { BAC_DISCLAIMER, formatBac, formatTripTime } from "@/domain/bac";
import type { Participant } from "@/domain/types";

/**
 * Statistiques descriptives, pas un classement : on n’érige jamais un taux élevé
 * en récompense. Le classement ludique du séjour reste celui des verres.
 */
export function BacSection() {
  const { trip } = useTrip();
  // Lecture seule du calcul partagé : cette section ne peut plus diverger des autres.
  const { rows: bacRows } = useBac();
  const [detail, setDetail] = useState<Participant | null>(null);

  const rows = useMemo(() => {
    if (!trip) return [];
    return bacRows
      .flatMap(({ participant, stats }) => (stats ? [{ participant, stats }] : []))
      .map(({ participant, stats }) => ({
        participant,
        stats,
        averagePeak: stats.dailyPeaks.length ? stats.dailyPeaks.reduce((total, peak) => total + peak.gPerL, 0) / stats.dailyPeaks.length : 0,
      }))
      .filter((row) => row.stats.tripPeak || row.stats.current.estimatedGPerL > 0)
      .sort((a, b) => a.participant.name.localeCompare(b.participant.name));
  }, [trip, bacRows]);

  if (!trip || !rows.length) return null;

  return (
    <section>
      <header className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-terra/10 text-terra"><Activity /></span>
        <div><h2 className="font-display text-xl font-bold">Alcoolémie estimée</h2><p className="text-xs font-bold text-morocco/45">Valeurs théoriques, jamais une mesure</p></div>
      </header>
      <div className="mt-3 space-y-2">
        {rows.map(({ participant, stats, averagePeak }) => (
          <button key={participant.id} onClick={() => setDetail(participant)} className="tap-bump flex min-h-[72px] w-full items-center gap-3 rounded-2xl border border-sand/50 bg-white/75 p-4 text-left shadow-sm" aria-label={`Détail de l’alcoolémie estimée de ${participant.name}`}>
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-sm">{participant.name}</strong>
              <span className="mt-1 block text-xs font-bold text-morocco/50">
                {stats.tripPeak ? `Pic du séjour ≈ ${formatBac(stats.tripPeak.gPerL)} g/L · ${formatDateKey(stats.tripPeak.at.slice(0, 10))} ${formatTripTime(stats.tripPeak.at)}` : "Pas encore de pic estimé"}
              </span>
              {stats.dailyPeaks.length > 1 ? <span className="mt-0.5 block text-xs font-bold text-morocco/40">Moyenne des pics quotidiens ≈ {formatBac(averagePeak)} g/L</span> : null}
            </span>
            <span className="shrink-0 text-right">
              <strong className="block font-display text-lg leading-none">≈ {formatBac(stats.current.estimatedGPerL)}</strong>
              <span className="text-[10px] font-black uppercase tracking-wider text-morocco/45">maintenant</span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-morocco/35" />
          </button>
        ))}
      </div>
      <p className="mt-3 flex gap-2 rounded-2xl border border-sand bg-sand/25 p-3 text-xs font-bold leading-relaxed text-morocco/70"><Info size={16} className="mt-0.5 shrink-0 text-terra" />{BAC_DISCLAIMER}</p>
      <BacDetailSheet participant={detail} onClose={() => setDetail(null)} />
    </section>
  );
}
