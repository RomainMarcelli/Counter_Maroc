import { describe, expect, it } from "vitest";
import { calculateUnusualStats } from "./unusual-stats";
import type { Drink, DrinkEntry, Participant, WaterEntry } from "./types";
import { DRINK_DEFAULTS, ENTRY_DEFAULTS, PARTICIPANT_DEFAULTS } from "@/test/factories";
import { zonedInputToIso } from "@/lib/timezone";

const zone = "Europe/Paris";
const base = { tripId: "trip", createdAt: "2026-08-27T10:00:00.000Z", updatedAt: "2026-08-27T10:00:00.000Z", deletedAt: null };
const participants: Participant[] = [
  { ...base, ...PARTICIPANT_DEFAULTS, id: "romain", name: "Romain", avatarUrl: null, colorIndex: 0, sortOrder: 0, userId: "user-romain" },
  { ...base, ...PARTICIPANT_DEFAULTS, id: "lucas", name: "Lucas", avatarUrl: null, colorIndex: 1, sortOrder: 1, userId: "user-lucas" },
  { ...base, ...PARTICIPANT_DEFAULTS, id: "theo", name: "Théo", avatarUrl: null, colorIndex: 2, sortOrder: 2 },
];
const drinks: Drink[] = ["Mojito", "Bière", "Vodka"].map((name, index) => ({ ...base, ...DRINK_DEFAULTS, id: `d${index}`, name, icon: "generic", category: index === 2 ? "spirit" : index === 1 ? "beer" : "cocktail", isAlcohol: true, isSystem: true, sortOrder: index }));
let id = 0;
const at = (local: string) => zonedInputToIso(local, zone);
const drink = (participantId: string, drinkId: string, local: string, roundId: string | null = null, actionBy = "user-romain"): DrinkEntry => ({ ...base, ...ENTRY_DEFAULTS, id: `e${++id}`, participantId, drinkId, consumedAt: at(local), actionBy, deviceId: "phone", roundId });
const water = (participantId: string, local: string): WaterEntry => ({ ...base, id: `w${++id}`, participantId, consumedAt: at(local), actionBy: "user", deviceId: "phone", roundId: null });

describe("statistiques insolites", () => {
  it("calcule variété, fidélité et ratio d'hydratation", () => {
    const entries = [
      drink("romain", "d0", "2026-08-27T20:00"), drink("romain", "d0", "2026-08-27T21:00"), drink("romain", "d0", "2026-08-27T22:00"),
      drink("lucas", "d0", "2026-08-27T20:10"), drink("lucas", "d1", "2026-08-27T21:10"), drink("lucas", "d2", "2026-08-27T22:10"),
    ];
    const result = calculateUnusualStats(participants, drinks, entries, [water("lucas", "2026-08-27T20:30"), water("lucas", "2026-08-27T21:30"), water("romain", "2026-08-27T20:40")], zone);
    expect(result.explorer).toMatchObject({ name: "Lucas", distinctDrinks: 3 });
    expect(result.loyalty).toMatchObject({ name: "Romain", drinkName: "Mojito", count: 3, percentage: 100 });
    expect(result.hydration).toMatchObject({ name: "Lucas", waters: 2, alcohols: 3 });
  });

  it("garde les pauses dans une même journée 08h et ignore la nuit entre deux journées", () => {
    const result = calculateUnusualStats(participants, drinks, [
      drink("theo", "d0", "2026-08-27T21:00"),
      drink("theo", "d1", "2026-08-28T03:00"),
      drink("theo", "d1", "2026-08-28T19:00"),
    ], [], zone);
    expect(result.longestPause).toMatchObject({ name: "Théo", minutes: 360, dayKey: "2026-08-27" });
  });

  it("utilise roundId pour la plus grosse tournée et le duo", () => {
    const entries = [
      drink("romain", "d0", "2026-08-27T23:42", "round-a"),
      drink("lucas", "d0", "2026-08-27T23:42", "round-a"),
      drink("theo", "d1", "2026-08-27T23:42", "round-a"),
      drink("romain", "d2", "2026-08-28T01:00", "round-b", "user-lucas"),
      drink("lucas", "d2", "2026-08-28T01:00", "round-b", "user-lucas"),
    ];
    const result = calculateUnusualStats(participants, drinks, entries, [], zone);
    expect(result.largestRound).toMatchObject({ roundId: "round-a", actorName: "Romain", participantCount: 3 });
    expect(result.duo).toMatchObject({ names: ["Lucas", "Romain"], sharedRounds: 2 });
  });

  it("classe les journées actives avec la coupure de 08h", () => {
    const entries = [
      drink("romain", "d0", "2026-08-27T23:00"),
      drink("lucas", "d1", "2026-08-28T04:00"),
      drink("romain", "d0", "2026-08-28T09:00"),
    ];
    const result = calculateUnusualStats(participants, drinks, entries, [], zone);
    expect(result.activeDay).toEqual({ dayKey: "2026-08-27", count: 2 });
    expect(result.calmDay).toEqual({ dayKey: "2026-08-28", count: 1 });
  });
});

