import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { db, MarrakechDatabase } from "./database";
import { resetLocalData } from "./repository";
import type { Trip } from "@/domain/types";

const trip: Trip = {
  id: "00000000-0000-4000-8000-000000000999",
  tripId: "00000000-0000-4000-8000-000000000999",
  name: "À effacer",
  shareCode: "RESET-TEST",
  startDate: "2026-09-07",
  endDate: "2026-09-16",
  timezone: "Africa/Casablanca",
  createdBy: "00000000-0000-4000-8000-000000000998",
  createdAt: "2026-09-07T00:00:00.000Z",
  updatedAt: "2026-09-07T00:00:00.000Z",
  deletedAt: null,
};

describe("resetLocalData", () => {
  it("supprime complètement la base IndexedDB locale", async () => {
    await db.trips.put(trip);
    expect(await db.trips.count()).toBe(1);
    await resetLocalData();
    const reopened = new MarrakechDatabase();
    expect(await reopened.trips.count()).toBe(0);
    expect(await reopened.settings.count()).toBe(0);
    await reopened.delete();
  });
});
