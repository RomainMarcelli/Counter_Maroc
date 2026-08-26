import { describe, expect, it } from "vitest";
import { calculateStats } from "./stats";
import type { Drink, DrinkEntry, Participant, Trip, WaterEntry } from "./types";

const base = { tripId: "trip", createdAt: "2026-09-07T10:00:00.000Z", updatedAt: "2026-09-07T10:00:00.000Z", deletedAt: null };
const trip: Trip = { ...base, id: "trip", name: "Marrakech 2026", shareCode: "CODE", startDate: "2026-09-07", endDate: "2026-09-16", timezone: "Africa/Casablanca", createdBy: "user" };
const participants: Participant[] = [
  { ...base, id: "romain", name: "Romain", avatarUrl: null, colorIndex: 0, sortOrder: 0 },
  { ...base, id: "lucas", name: "Lucas", avatarUrl: null, colorIndex: 1, sortOrder: 1 },
];
const drinks: Drink[] = [
  { ...base, id: "mojito", name: "Mojito", icon: "🌿", category: "cocktail", isAlcohol: true, isSystem: true, sortOrder: 0 },
  { ...base, id: "beer", name: "Bière", icon: "🍺", category: "beer", isAlcohol: true, isSystem: true, sortOrder: 1 },
];

function entry(id: string, participantId: string, drinkId: string, consumedAt: string): DrinkEntry {
  return { ...base, id, participantId, drinkId, consumedAt, actionBy: "user", deviceId: "device", roundId: null };
}

describe("calculateStats", () => {
  it("calcule classement, pic horaire, jours et boissons sans compter l’eau", () => {
    const entries = [
      entry("1", "romain", "mojito", "2026-09-07T21:10:00.000Z"),
      entry("2", "romain", "mojito", "2026-09-07T21:30:00.000Z"),
      entry("3", "lucas", "beer", "2026-09-07T20:30:00.000Z"),
      entry("4", "romain", "beer", "2026-09-08T21:30:00.000Z"),
    ];
    const waters: WaterEntry[] = [{ ...base, id: "w1", participantId: "lucas", consumedAt: "2026-09-07T18:00:00.000Z", actionBy: "user", deviceId: "device", roundId: null }];
    const stats = calculateStats(trip, participants, drinks, entries, waters);
    expect(stats.totalAlcohol).toBe(4);
    expect(stats.totalWater).toBe(1);
    expect(stats.participants[0]).toMatchObject({ name: "Romain", total: 3, rank: 1, percentage: 75 });
    expect(stats.drinks.find((item) => item.name === "Mojito")).toMatchObject({ total: 2 });
    expect(stats.activeDays).toBe(2);
    expect(stats.peakHour).toBe(22);
    expect(stats.days).toHaveLength(10);
  });

  it("ne crée pas de trophées absurdes sans données suffisantes", () => {
    const stats = calculateStats(trip, participants, drinks, [entry("1", "romain", "mojito", "2026-09-07T21:10:00.000Z")], []);
    expect(stats.trophies).toEqual([]);
  });

  it("gère les ex æquo dans le classement", () => {
    const stats = calculateStats(trip, participants, drinks, [entry("1", "romain", "mojito", "2026-09-07T21:10:00.000Z"), entry("2", "lucas", "beer", "2026-09-07T21:12:00.000Z")], []);
    expect(stats.participants.map((item) => item.rank)).toEqual([1, 1]);
  });
});
