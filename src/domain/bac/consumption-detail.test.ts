import { describe, expect, it } from "vitest";
import { buildBacConsumptionDetails } from "./consumption-detail";
import type { Drink, DrinkEntry } from "../types";

const base = {
  tripId: "trip",
  createdAt: "2026-08-27T11:48:00.000Z",
  updatedAt: "2026-08-27T11:48:00.000Z",
  deletedAt: null,
};

const beer = {
  ...base,
  id: "beer",
  name: "Bière locale",
  category: "beer",
  icon: "beer",
  isAlcohol: true,
  isSystem: true,
  sortOrder: 0,
  servingVolumeMl: 250,
  abvPercent: 5,
  alcoholComponents: null,
  compositionConfirmed: true,
  priceCents: null,
} satisfies Drink;

function entry(overrides: Partial<DrinkEntry> = {}): DrinkEntry {
  return {
    ...base,
    id: "entry",
    participantId: "romain",
    drinkId: "beer",
    consumedAt: "2026-08-27T11:48:00.000Z",
    actionBy: "user",
    deviceId: "phone",
    roundId: null,
    alcoholGrams: 9.9,
    drinkNameSnapshot: "Bière locale (snapshot)",
    paidBy: null,
    priceCentsSnapshot: null,
    ...overrides,
  };
}

describe("buildBacConsumptionDetails", () => {
  it("reconstruit uniquement les vrais verres de la personne avec leurs snapshots", () => {
    const details = buildBacConsumptionDetails({
      entries: [entry(), entry({ id: "lucas", participantId: "lucas" }), entry({ id: "deleted", deletedAt: "2026-08-27T12:00:00.000Z" })],
      drinks: [beer],
      participantId: "romain",
      now: "2026-08-27T12:03:00.000Z",
      absorptionMinutes: 30,
    });

    expect(details).toHaveLength(1);
    expect(details[0]).toMatchObject({ name: "Bière locale (snapshot)", pureAlcoholGrams: 9.9, absorbing: true, impact: "low" });
    expect(details[0].absorbedGrams).toBeCloseTo(4.95, 2);
  });

  it("retombe sur la recette actuelle sans snapshot d'alcool et classe la dose", () => {
    const details = buildBacConsumptionDetails({
      entries: [entry({ alcoholGrams: null, drinkNameSnapshot: null })],
      drinks: [beer],
      participantId: "romain",
      now: "2026-08-27T12:30:00.000Z",
      absorptionMinutes: 30,
    });

    expect(details[0].name).toBe("Bière locale");
    expect(details[0].pureAlcoholGrams).toBeCloseTo(9.8625, 3);
    expect(details[0].absorptionFraction).toBe(1);
    expect(details[0].absorbing).toBe(false);
  });
});

