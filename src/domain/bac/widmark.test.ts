import { describe, expect, it } from "vitest";
import { ABSORPTION_MINUTES, ELIMINATION_RATE_G_PER_L_PER_HOUR } from "./constants";
import { calculatePureAlcoholGrams } from "./alcohol";
import { buildBacCurve, estimateBacAt, findPeakBac } from "./widmark";
import { buildBacTimeline, calculateParticipantBacStats } from "./timeline";
import type { AlcoholEvent, BacProfile } from "./types";

const profile = (weightKg = 70, overrides: Partial<BacProfile> = {}): BacProfile => ({
  weightKg,
  distributionRatio: 0.68,
  eliminationRate: ELIMINATION_RATE_G_PER_L_PER_HOUR,
  absorptionMinutes: ABSORPTION_MINUTES,
  ...overrides,
});

const whisky = calculatePureAlcoholGrams(40, 40);
const at = (hour: number, minute = 0) => `2026-09-12T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`;
const events = (...items: Array<[number, number]>): AlcoholEvent[] => items.map(([hour, grams]) => ({ consumedAt: at(hour), pureAlcoholGrams: grams }));
const bacAt = (hour: number, list: AlcoholEvent[], person = profile()) => estimateBacAt({ profile: person, events: list, at: at(hour) }).estimatedGPerL;

describe("estimateBacAt", () => {
  it("renvoie zéro sans aucune consommation", () => {
    expect(bacAt(23, [])).toBe(0);
    expect(estimateBacAt({ profile: profile(), events: [], at: at(23) })).toEqual({ estimatedGPerL: 0, lowEstimateGPerL: 0, highEstimateGPerL: 0 });
  });

  it("approche la valeur de Widmark une fois le verre absorbé", () => {
    // Widmark : 12,624 g / (70 × 0,68) = 0,265 g/L, moins une heure d’élimination.
    const value = bacAt(21, events([20, whisky]));
    expect(value).toBeGreaterThan(0.1);
    expect(value).toBeCloseTo(12.624 / (70 * 0.68) - ELIMINATION_RATE_G_PER_L_PER_HOUR, 3);
  });

  it("n’attribue pas tout l’alcool à la milliseconde du verre", () => {
    const list = events([20, whisky]);
    const immediate = bacAt(20, list);
    const halfAbsorbed = estimateBacAt({ profile: profile(), events: list, at: at(20, 15) }).estimatedGPerL;
    const absorbed = estimateBacAt({ profile: profile(), events: list, at: at(20, 30) }).estimatedGPerL;
    expect(immediate).toBe(0);
    expect(halfAbsorbed).toBeGreaterThan(0);
    expect(halfAbsorbed).toBeLessThan(absorbed);
  });

  it("décroît avec le temps quand plus rien n’est bu", () => {
    const list = events([19, whisky], [20, whisky], [21, whisky], [22, whisky], [22, whisky], [23, whisky]);
    const value = (iso: string) => estimateBacAt({ profile: profile(), events: list, at: iso }).estimatedGPerL;
    expect(value(at(23, 30))).toBeGreaterThan(value("2026-09-13T02:00:00.000Z"));
    expect(value("2026-09-13T02:00:00.000Z")).toBeGreaterThan(value("2026-09-13T04:00:00.000Z"));
    expect(value("2026-09-13T04:00:00.000Z")).toBeGreaterThan(0);
  });

  it("ne descend jamais en dessous de zéro, même très longtemps après", () => {
    const list = events([20, whisky]);
    expect(estimateBacAt({ profile: profile(), events: list, at: "2026-09-20T12:00:00.000Z" }).estimatedGPerL).toBe(0);
    expect(estimateBacAt({ profile: profile(), events: list, at: "2026-09-20T12:00:00.000Z" }).lowEstimateGPerL).toBe(0);
  });

  it("compte chaque verre : en retirer un fait baisser l’estimation", () => {
    const two = events([20, whisky], [21, whisky]);
    const one = events([20, whisky]);
    expect(bacAt(22, two)).toBeGreaterThan(bacAt(22, one));
  });

  it("dépend de l’heure de la consommation, pas seulement du nombre de verres", () => {
    const late = events([23, whisky]);
    const early = events([20, whisky]);
    expect(bacAt(24, late)).toBeGreaterThan(bacAt(24, early));
  });

  it("estime moins haut à poids plus élevé, à alcool identique", () => {
    const list = events([20, whisky], [21, whisky]);
    expect(bacAt(22, list, profile(95))).toBeLessThan(bacAt(22, list, profile(60)));
  });

  it("encadre l’estimation par une plage cohérente", () => {
    const estimate = estimateBacAt({ profile: profile(), events: events([20, whisky], [21, whisky]), at: at(22) });
    expect(estimate.lowEstimateGPerL).toBeLessThan(estimate.estimatedGPerL);
    expect(estimate.highEstimateGPerL).toBeGreaterThan(estimate.estimatedGPerL);
  });

  it("ignore un profil incomplet ou incohérent", () => {
    expect(estimateBacAt({ profile: null, events: events([20, whisky]), at: at(22) }).estimatedGPerL).toBe(0);
    expect(estimateBacAt({ profile: profile(0), events: events([20, whisky]), at: at(22) }).estimatedGPerL).toBe(0);
  });

  it("ignore les consommations invalides sans planter", () => {
    const dirty: AlcoholEvent[] = [
      { consumedAt: "pas une date", pureAlcoholGrams: 12 },
      { consumedAt: at(20), pureAlcoholGrams: Number.NaN },
      { consumedAt: at(20), pureAlcoholGrams: 0 },
      { consumedAt: at(20), pureAlcoholGrams: whisky },
    ];
    expect(bacAt(21, dirty)).toBeGreaterThan(0);
  });
});

describe("buildBacCurve", () => {
  it("monte pendant l’absorption puis redescend", () => {
    const points = buildBacCurve(profile(), events([20, whisky]), { until: at(23) });
    const values = points.map((point) => point.gPerL);
    expect(values[0]).toBe(0);
    // Sommet atteint en fin d’absorption : 0,265 g/L moins la demi-heure éliminée entre-temps.
    expect(Math.max(...values)).toBeCloseTo(12.624 / (70 * 0.68) - ELIMINATION_RATE_G_PER_L_PER_HOUR * 0.5, 3);
    expect(values[values.length - 1]).toBeLessThan(Math.max(...values));
  });

  it("repasse exactement par zéro et y reste", () => {
    const points = buildBacCurve(profile(), events([20, whisky]), { until: "2026-09-13T12:00:00.000Z" });
    expect(points.some((point) => point.gPerL === 0 && Date.parse(point.at) > Date.parse(at(20)))).toBe(true);
    expect(points.every((point) => point.gPerL >= 0)).toBe(true);
  });

  it("repart correctement après un retour à zéro", () => {
    const long = [...events([18, whisky]), { consumedAt: "2026-09-13T02:00:00.000Z", pureAlcoholGrams: whisky }];
    const late = estimateBacAt({ profile: profile(), events: long, at: "2026-09-13T03:00:00.000Z" }).estimatedGPerL;
    const alone = estimateBacAt({ profile: profile(), events: [{ consumedAt: "2026-09-13T02:00:00.000Z", pureAlcoholGrams: whisky }], at: "2026-09-13T03:00:00.000Z" }).estimatedGPerL;
    // Le premier verre est éliminé depuis longtemps : il ne doit pas creuser une dette.
    expect(late).toBeCloseTo(alone, 5);
  });
});

describe("findPeakBac", () => {
  it("trouve le maximum et son heure", () => {
    const list = events([20, whisky], [21, whisky]);
    const peak = findPeakBac(buildBacCurve(profile(), list, { until: at(23) }));
    expect(peak).not.toBeNull();
    expect(peak?.gPerL).toBeGreaterThan(estimateBacAt({ profile: profile(), events: list, at: at(23) }).estimatedGPerL);
    expect(Date.parse(peak?.at ?? "")).toBeGreaterThanOrEqual(Date.parse(at(21)));
  });

  it("renvoie null sans consommation", () => {
    expect(findPeakBac(buildBacCurve(profile(), [], { until: at(23) }))).toBeNull();
  });
});

describe("buildBacTimeline", () => {
  it("borne la courbe à la fenêtre demandée", () => {
    const points = buildBacTimeline({ profile: profile(), events: events([20, whisky], [22, whisky]), from: at(18), to: "2026-09-13T04:00:00.000Z" });
    expect(points.length).toBeGreaterThan(2);
    expect(Date.parse(points[0].at)).toBeGreaterThanOrEqual(Date.parse(at(18)));
    expect(Date.parse(points[points.length - 1].at)).toBeLessThanOrEqual(Date.parse("2026-09-13T04:00:00.000Z"));
  });

  it("renvoie une courbe vide sans profil exploitable", () => {
    expect(buildBacTimeline({ profile: null, events: events([20, whisky]), from: at(18), to: at(23) })).toEqual([]);
  });
});

describe("calculateParticipantBacStats", () => {
  const timezone = "Africa/Casablanca";

  it("expose le taux courant, le pic du séjour et les pics quotidiens", () => {
    const list = [
      { consumedAt: "2026-09-11T21:00:00.000Z", pureAlcoholGrams: whisky },
      { consumedAt: "2026-09-11T22:00:00.000Z", pureAlcoholGrams: whisky },
      { consumedAt: "2026-09-12T20:00:00.000Z", pureAlcoholGrams: whisky },
    ];
    const stats = calculateParticipantBacStats({ profile: profile(), events: list, now: "2026-09-12T21:30:00.000Z", timezone });
    expect(stats.current.estimatedGPerL).toBeGreaterThan(0);
    expect(stats.tripPeak).not.toBeNull();
    expect(stats.dailyPeaks).toHaveLength(2);
    expect(stats.dailyPeaks[0].date < stats.dailyPeaks[1].date).toBe(true);
    expect(stats.dailyPeaks[0].gPerL).toBeGreaterThan(stats.dailyPeaks[1].gPerL);
  });

  it("reste vide et à zéro sans consommation", () => {
    const stats = calculateParticipantBacStats({ profile: profile(), events: [], now: at(23), timezone });
    expect(stats.current.estimatedGPerL).toBe(0);
    expect(stats.tripPeak).toBeNull();
    expect(stats.dailyPeaks).toEqual([]);
  });

  it("ne calcule rien quand l’estimation n’est pas configurée", () => {
    const stats = calculateParticipantBacStats({ profile: null, events: events([20, whisky]), now: at(23), timezone });
    expect(stats.current.estimatedGPerL).toBe(0);
    expect(stats.dailyPeaks).toEqual([]);
  });
});

describe("estimation à l’instant présent", () => {
  const profile = { weightKg: 80, distributionRatio: 0.68, eliminationRate: 0.15, absorptionMinutes: 30 };
  const at = (iso: string) => Date.parse(iso);

  it("recalcule pour l’heure de consultation, pas pour l’heure du verre", () => {
    // Vodka 12,6 g à 13:00 ; on consulte à 15:23, soit 2 h 23 plus tard.
    const events = [{ consumedAt: "2026-08-27T11:00:00.000Z", pureAlcoholGrams: 12.6 }];
    const auVerre = estimateBacAt({ profile, events, at: at("2026-08-27T11:30:00.000Z") }).estimatedGPerL;
    const maintenant = estimateBacAt({ profile, events, at: at("2026-08-27T13:23:00.000Z") }).estimatedGPerL;
    // Le pic d’absorption est atteint à 13:30 ; à 15:23 il reste bien moins.
    expect(auVerre).toBeGreaterThan(maintenant);
    expect(maintenant).toBeCloseTo(Math.max(0, 12.6 / (80 * 0.68) - 0.15 * (113 / 60)), 3);
  });

  it("décroît régulièrement pendant la phase d’élimination", () => {
    const events = [{ consumedAt: "2026-08-27T11:00:00.000Z", pureAlcoholGrams: 34 }];
    const valeurs = ["12:00", "13:00", "14:00"].map((heure) =>
      estimateBacAt({ profile, events, at: at(`2026-08-27T${heure}:00.000Z`) }).estimatedGPerL);
    expect(valeurs[0]).toBeGreaterThan(valeurs[1]);
    expect(valeurs[1]).toBeGreaterThan(valeurs[2]);
  });

  it("ne dépend pas du fuseau : seul l’écart d’instants compte", () => {
    const events = [{ consumedAt: "2026-08-27T11:00:00.000Z", pureAlcoholGrams: 12.6 }];
    const parIso = estimateBacAt({ profile, events, at: "2026-08-27T13:23:00.000Z" }).estimatedGPerL;
    const parEpoch = estimateBacAt({ profile, events, at: at("2026-08-27T13:23:00.000Z") }).estimatedGPerL;
    expect(parIso).toBe(parEpoch);
  });
});
