import { describe, expect, it } from "vitest";
import { calculateChallengeProgress, effectiveChallengeStatus } from "./challenges";
import type { Challenge, Drink, DrinkEntry, Participant, WaterEntry } from "./types";

const base = { tripId: "trip", createdAt: "2026-08-27T08:00:00.000Z", updatedAt: "2026-08-27T08:00:00.000Z", deletedAt: null };
const people = [{ ...base, id: "p1", name: "Romain", avatarUrl: null, colorIndex: 0, sortOrder: 0, userId: "u1", bacEnabled: false, weightKg: null, distributionRatio: null, bacPrivate: false }] satisfies Participant[];
const drinks = [
  { ...base, id: "beer", name: "Bière", category: "beer", icon: "beer", isAlcohol: true, isSystem: true, sortOrder: 0, servingVolumeMl: 330, abvPercent: 5, alcoholComponents: null, compositionConfirmed: true, priceCents: null },
  { ...base, id: "wine", name: "Vin", category: "wine", icon: "wine", isAlcohol: true, isSystem: true, sortOrder: 1, servingVolumeMl: 120, abvPercent: 12, alcoholComponents: null, compositionConfirmed: true, priceCents: null },
] satisfies Drink[];
const challenge = (changes: Partial<Challenge> = {}): Challenge => ({ ...base, id: "c1", title: "Test", description: "", scope: "individual", period: "day", dayKey: "2026-08-27", targetType: "water_count", targetValue: 2, participantId: "p1", reward: null, status: "active", completedAt: null, createdBy: "u1", ...changes });
const water = (id: string, consumedAt: string): WaterEntry => ({ ...base, id, participantId: "p1", consumedAt, actionBy: "u1", deviceId: "d", roundId: null });
const alcohol = (id: string, drinkId: string, consumedAt: string): DrinkEntry => ({ ...base, id, participantId: "p1", drinkId, consumedAt, actionBy: "u1", deviceId: "d", roundId: null, alcoholGrams: 10, drinkNameSnapshot: null, paidBy: null, priceCentsSnapshot: null });

describe("calculateChallengeProgress", () => {
  it("compte jusqu’à 07:59 dans le challenge quotidien puis change à 08:00", () => {
    const result = calculateChallengeProgress(challenge(), people, drinks, [], [water("w1", "2026-08-28T07:59:00Z"), water("w2", "2026-08-28T08:00:00Z")], [], new Date("2026-08-28T09:00:00Z"), "UTC");
    expect(result.current).toBe(1);
  });

  it("termine automatiquement une progression atteinte", () => {
    const result = calculateChallengeProgress(challenge(), people, drinks, [], [water("w1", "2026-08-27T10:00:00Z"), water("w2", "2026-08-28T02:00:00Z")], [], new Date(), "UTC");
    expect(result.completed).toBe(true);
    expect(effectiveChallengeStatus(challenge(), result)).toBe("completed");
  });

  it("ne double pas les boissons pour un objectif de variété", () => {
    const item = challenge({ period: "trip", dayKey: null, targetType: "drink_variety", targetValue: 2 });
    const result = calculateChallengeProgress(item, people, drinks, [alcohol("a", "beer", "2026-08-27T10:00:00Z"), alcohol("b", "beer", "2026-08-27T11:00:00Z"), alcohol("c", "wine", "2026-08-27T12:00:00Z")], [], [], new Date(), "UTC");
    expect(result.current).toBe(2);
  });

  it("une seconde validation manuelle garde un état terminé idempotent", () => {
    const done = challenge({ status: "completed", completedAt: "2026-08-27T12:00:00Z", targetType: "manual" });
    const result = calculateChallengeProgress(done, people, drinks, [], []);
    expect(result.completed).toBe(true);
    expect(effectiveChallengeStatus(done, result)).toBe("completed");
  });
});
