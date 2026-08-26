import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { SYSTEM_DRINKS } from "@/domain/constants";
import { db } from "./database";
import { createTrip, resetLocalData } from "./repository";

describe("boissons par défaut", () => {
  afterEach(async () => {
    await resetLocalData();
  });

  it("ajoute et met en attente de synchronisation la sélection au nouveau séjour", async () => {
    const tripId = await createTrip({
      name: "Marrakech 2026",
      creatorName: "Romain",
      startDate: "2026-09-07",
      endDate: "2026-09-16",
    });

    const drinks = await db.drinks.where("tripId").equals(tripId).toArray();
    const queuedDrinks = await db.syncQueue.where("tripId").equals(tripId).filter((item) => item.entityType === "drink").count();

    expect(drinks).toHaveLength(SYSTEM_DRINKS.length);
    expect(queuedDrinks).toBe(SYSTEM_DRINKS.length);
    expect(drinks.map((drink) => drink.name)).toEqual(expect.arrayContaining(["Casablanca", "Vin rosé", "Mojito", "Gin Tonic"]));
    expect(drinks.every((drink) => drink.isSystem && drink.isAlcohol)).toBe(true);
  });
});
