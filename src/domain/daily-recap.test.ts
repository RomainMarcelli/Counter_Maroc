import { describe, expect, it } from "vitest";
import { buildDailyRecap, recapPromptDay, shouldShowRecapPrompt } from "./daily-recap";
import type { Drink, DrinkEntry, Participant, Trip } from "./types";

describe("recapPromptDay", () => {
  it("ne propose rien avant 09h", () => expect(recapPromptDay(new Date("2026-08-28T08:59:00Z"), "UTC")).toBeNull());
  it("propose la journée 08h→08h précédente après 09h", () => expect(recapPromptDay(new Date("2026-08-28T09:00:00Z"), "UTC")).toBe("2026-08-27"));
  it("garde les consommations de 04h dans la journée précédente", () => expect(recapPromptDay(new Date("2026-08-28T04:00:00Z"), "UTC")).toBeNull());
});

describe("shouldShowRecapPrompt", () => {
  const base = { candidateDay: "2026-08-27", lastSeenDay: null, dismissedDay: null, hasData: true };
  it("s’affiche une fois quand le récap a des données", () => expect(shouldShowRecapPrompt(base)).toBe(true));
  it("ne revient pas après avoir été vu", () => expect(shouldShowRecapPrompt({ ...base, lastSeenDay: "2026-08-27" })).toBe(false));
  it("ne revient pas dans la même ouverture après Plus tard", () => expect(shouldShowRecapPrompt({ ...base, dismissedDay: "2026-08-27" })).toBe(false));
});

it("construit le récap avec la frontière 08h, pas minuit", () => {
  const base = { tripId: "trip", createdAt: "2026-08-27T08:00:00Z", updatedAt: "2026-08-27T08:00:00Z", deletedAt: null };
  const trip = { ...base, id: "trip", name: "Marrakech", shareCode: "CREW", startDate: "2026-08-27", endDate: "2026-09-05", timezone: "UTC", createdBy: "u" } satisfies Trip;
  const participant = { ...base, id: "p", name: "Romain", avatarUrl: null, colorIndex: 0, sortOrder: 0, userId: "u", bacEnabled: false, weightKg: null, distributionRatio: null, bacPrivate: false } satisfies Participant;
  const drink = { ...base, id: "d", name: "Mojito", category: "cocktail", icon: "cocktail", isAlcohol: true, isSystem: true, sortOrder: 0, servingVolumeMl: 250, abvPercent: null, alcoholComponents: null, compositionConfirmed: false, priceCents: null } satisfies Drink;
  const entry = (id: string, consumedAt: string): DrinkEntry => ({ ...base, id, participantId: "p", drinkId: "d", consumedAt, actionBy: "u", deviceId: "device", roundId: null, alcoholGrams: null, drinkNameSnapshot: "Mojito", paidBy: null, priceCentsSnapshot: null });
  const recap = buildDailyRecap("2026-08-27", trip, [participant], [drink], [entry("late", "2026-08-28T04:00:00Z"), entry("next", "2026-08-28T08:00:00Z")], [], [], "UTC");
  expect(recap.stats.totalAlcohol).toBe(1);
  expect(recap.dayNumber).toBe(1);
});
