import { deviceTimeZone, zonedDayKey, zonedInputToIso } from "@/lib/timezone";
import { buildBacCurve, estimateBacAt, findPeakBac, isUsableProfile, toMillis } from "./widmark";
import type { AlcoholEvent, BacPeak, BacPoint, BacProfile, DailyBacPeak, ParticipantBacStats } from "./types";

const DAY_MS = 86_400_000;

/** Fenêtre de courbe : les points exacts aux bornes permettent de tracer sans interpoler. */
export function buildBacTimeline({ profile, events, from, to }: { profile: BacProfile | null; events: AlcoholEvent[]; from: string | number | Date; to: string | number | Date }): BacPoint[] {
  if (!isUsableProfile(profile)) return [];
  const fromMs = toMillis(from);
  const toMs = toMillis(to);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs < fromMs) return [];
  return buildBacCurve(profile, events, { until: toMs, marks: [fromMs, toMs] }).filter((point) => {
    const at = Date.parse(point.at);
    return at >= fromMs && at <= toMs;
  });
}

/** Bornes de journée locales entre deux instants, pour ne pas rater un pic à cheval sur minuit. */
function dayBoundaries(fromMs: number, toMs: number, timezone: string = deviceTimeZone()): number[] {
  const marks: number[] = [];
  for (let cursor = fromMs; cursor <= toMs + DAY_MS && marks.length < 400; cursor += DAY_MS) {
    const key = zonedDayKey(new Date(cursor).toISOString(), timezone);
    const midnight = Date.parse(zonedInputToIso(`${key}T00:00`, timezone));
    if (Number.isFinite(midnight) && midnight >= fromMs && midnight <= toMs) marks.push(midnight);
  }
  return marks;
}

/**
 * Statistiques d’un participant : taux courant, pic du séjour et pic de chaque journée.
 * Tout est recalculé depuis les consommations, jamais lu depuis un champ stocké.
 */
export function calculateParticipantBacStats({ profile, events, now, timezone = deviceTimeZone() }: { profile: BacProfile | null; events: AlcoholEvent[]; now: string | number | Date; timezone?: string }): ParticipantBacStats {
  const current = estimateBacAt({ profile, events, at: now });
  if (!isUsableProfile(profile) || !events.length) return { current, tripPeak: null, dailyPeaks: [] };

  const nowMs = toMillis(now);
  const lastEventMs = Math.max(...events.map((event) => toMillis(event.consumedAt)).filter(Number.isFinite));
  // On prolonge jusqu’à la fin de l’absorption du dernier verre : sinon le pic serait tronqué.
  const untilMs = Math.max(nowMs, lastEventMs + profile.absorptionMinutes * 60_000);
  const firstEventMs = Math.min(...events.map((event) => toMillis(event.consumedAt)).filter(Number.isFinite));
  const curve = buildBacCurve(profile, events, { until: untilMs, marks: dayBoundaries(firstEventMs, untilMs, timezone) });

  const peakByDay = new Map<string, BacPeak>();
  for (const point of curve) {
    if (point.gPerL <= 0) continue;
    const day = zonedDayKey(point.at, timezone);
    const known = peakByDay.get(day);
    if (!known || point.gPerL > known.gPerL) peakByDay.set(day, { at: point.at, gPerL: point.gPerL });
  }
  const dailyPeaks: DailyBacPeak[] = [...peakByDay.entries()]
    .map(([date, peak]) => ({ date, ...peak }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { current, tripPeak: findPeakBac(curve), dailyPeaks };
}
