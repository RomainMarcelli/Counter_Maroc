import { describe, expect, it } from "vitest";
import { sortSmartFavorites } from "./favorites";
import type { Drink, DrinkEntry } from "./types";

const base = { tripId: "trip", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", deletedAt: null };
const drinks: Drink[] = [
  { ...base, id: "beer", name: "Bière", category: "beer", icon: "🍺", isAlcohol: true, isSystem: true, sortOrder: 0 },
  { ...base, id: "mojito", name: "Mojito", category: "cocktail", icon: "🌿", isAlcohol: true, isSystem: true, sortOrder: 1 },
];
const makeEntry = (id: string, participantId: string, drinkId: string): DrinkEntry => ({ ...base, id, participantId, drinkId, consumedAt: base.createdAt, actionBy: "user", deviceId: "device", roundId: null });

describe("sortSmartFavorites", () => {
  it("privilégie les habitudes du participant quand il est seul", () => {
    const entries = [makeEntry("1", "romain", "mojito"), makeEntry("2", "romain", "mojito"), makeEntry("3", "lucas", "beer"), makeEntry("4", "lucas", "beer"), makeEntry("5", "lucas", "beer")];
    expect(sortSmartFavorites(drinks, entries, ["romain"])[0].id).toBe("mojito");
    expect(sortSmartFavorites(drinks, entries, ["romain", "lucas"])[0].id).toBe("beer");
  });
});
