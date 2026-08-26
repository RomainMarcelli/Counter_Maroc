import { DISTRIBUTION_UNCERTAINTY, MAX_ELIMINATION_RATE, MIN_ELIMINATION_RATE } from "./constants";
import type { AlcoholEvent, BacEstimate, BacPeak, BacPoint, BacProfile } from "./types";

const HOUR_MS = 3_600_000;

interface TimedEvent {
  at: number;
  grams: number;
}

export function toMillis(value: string | number | Date): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return Date.parse(value);
}

export function isUsableProfile(profile: BacProfile | null | undefined): profile is BacProfile {
  if (!profile) return false;
  return Number.isFinite(profile.weightKg) && profile.weightKg > 0
    && Number.isFinite(profile.distributionRatio) && profile.distributionRatio > 0;
}

function usableEvents(events: AlcoholEvent[]): TimedEvent[] {
  return events
    .map((event) => ({ at: toMillis(event.consumedAt), grams: event.pureAlcoholGrams }))
    .filter((event) => Number.isFinite(event.at) && Number.isFinite(event.grams) && event.grams > 0)
    .sort((a, b) => a.at - b.at);
}

/**
 * Courbe d’alcoolémie estimée, calculée événement par événement.
 *
 * Le modèle est linéaire par morceaux : chaque verre monte linéairement pendant
 * son absorption, l’élimination retire un débit constant, et le résultat est borné
 * à zéro. Les points de rupture (début et fin d’absorption de chaque verre) suffisent
 * donc à décrire exactement la courbe.
 */
export function buildBacCurve(profile: BacProfile, events: AlcoholEvent[], options: { until: string | number | Date; marks?: Array<string | number | Date> }): BacPoint[] {
  const timed = usableEvents(events);
  const untilMs = toMillis(options.until);
  if (!timed.length || !isUsableProfile(profile) || !Number.isFinite(untilMs)) return [];

  const absorptionMs = Math.max(0, profile.absorptionMinutes) * 60_000;
  const distributionVolume = profile.weightKg * profile.distributionRatio;
  const elimination = Math.max(0, profile.eliminationRate);
  const extraMarks = (options.marks ?? []).map(toMillis).filter((mark) => Number.isFinite(mark) && mark <= untilMs);
  const start = Math.min(timed[0].at, ...extraMarks, untilMs);

  const marks = new Set<number>([start, untilMs]);
  for (const event of timed) {
    if (event.at >= start && event.at <= untilMs) marks.add(event.at);
    const absorbed = event.at + absorptionMs;
    if (absorbed >= start && absorbed <= untilMs) marks.add(absorbed);
  }
  for (const mark of extraMarks) if (mark >= start) marks.add(mark);
  const times = [...marks].filter((time) => time >= start && time <= untilMs).sort((a, b) => a - b);

  const points: BacPoint[] = [];
  let bac = 0;
  for (let index = 0; index < times.length; index += 1) {
    const time = times[index];
    if (index > 0) {
      const previous = times[index - 1];
      let gain = 0;
      for (const event of timed) {
        if (absorptionMs === 0) {
          if (event.at > previous && event.at <= time) gain += event.grams / distributionVolume;
        } else if (event.at <= previous && time <= event.at + absorptionMs) {
          gain += (event.grams / distributionVolume) * ((time - previous) / absorptionMs);
        }
      }
      const net = gain - elimination * ((time - previous) / HOUR_MS);
      const next = bac + net;
      if (next < 0) {
        // La courbe touche zéro à l’intérieur du segment : on marque l’instant exact.
        if (bac > 0) points.push({ at: new Date(previous + (time - previous) * (bac / -net)).toISOString(), gPerL: 0 });
        bac = 0;
      } else {
        bac = next;
      }
    }
    if (absorptionMs === 0) for (const event of timed) if (event.at === time && index === 0) bac += event.grams / distributionVolume;
    points.push({ at: new Date(time).toISOString(), gPerL: Math.max(0, bac) });
  }
  return points;
}

function lastValue(points: BacPoint[]): number {
  return points.length ? Math.max(0, points[points.length - 1].gPerL) : 0;
}

/**
 * Estimation à un instant donné, encadrée par une plage d’incertitude : l’élimination
 * et la répartition varient d’une personne à l’autre et d’un soir à l’autre.
 */
export function estimateBacAt({ profile, events, at }: { profile: BacProfile | null; events: AlcoholEvent[]; at: string | number | Date }): BacEstimate {
  if (!isUsableProfile(profile)) return { estimatedGPerL: 0, lowEstimateGPerL: 0, highEstimateGPerL: 0 };
  const central = lastValue(buildBacCurve(profile, events, { until: at }));
  const low = lastValue(buildBacCurve({ ...profile, distributionRatio: profile.distributionRatio * (1 + DISTRIBUTION_UNCERTAINTY), eliminationRate: MAX_ELIMINATION_RATE }, events, { until: at }));
  const high = lastValue(buildBacCurve({ ...profile, distributionRatio: profile.distributionRatio * (1 - DISTRIBUTION_UNCERTAINTY), eliminationRate: MIN_ELIMINATION_RATE }, events, { until: at }));
  return {
    estimatedGPerL: central,
    lowEstimateGPerL: Math.min(low, central),
    highEstimateGPerL: Math.max(high, central),
  };
}

export function findPeakBac(points: BacPoint[]): BacPeak | null {
  return points.reduce<BacPeak | null>((peak, point) => (point.gPerL > 0 && (!peak || point.gPerL > peak.gPerL) ? { at: point.at, gPerL: point.gPerL } : peak), null);
}
