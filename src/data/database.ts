import Dexie, { type EntityTable } from "dexie";
import type { Drink, DrinkEntry, LocalSetting, Participant, SyncOperation, Trip, WaterEntry } from "@/domain/types";

export class MarrakechDatabase extends Dexie {
  trips!: EntityTable<Trip, "id">;
  participants!: EntityTable<Participant, "id">;
  drinks!: EntityTable<Drink, "id">;
  drinkEntries!: EntityTable<DrinkEntry, "id">;
  waterEntries!: EntityTable<WaterEntry, "id">;
  syncQueue!: EntityTable<SyncOperation, "id">;
  settings!: EntityTable<LocalSetting, "key">;

  constructor(name = "marrakech-crew") {
    super(name);
    this.version(1).stores({
      trips: "id, shareCode, updatedAt, deletedAt",
      participants: "id, tripId, [tripId+deletedAt], updatedAt, sortOrder",
      drinks: "id, tripId, [tripId+deletedAt], updatedAt, category, sortOrder",
      drinkEntries: "id, tripId, participantId, drinkId, consumedAt, updatedAt, deletedAt, roundId",
      waterEntries: "id, tripId, participantId, consumedAt, updatedAt, deletedAt, roundId",
      syncQueue: "id, tripId, status, createdAt, nextAttemptAt, [status+nextAttemptAt]",
      settings: "key",
    });
    this.version(2).upgrade(async (transaction) => {
      await Promise.all([
        transaction.table("trips").clear(),
        transaction.table("participants").clear(),
        transaction.table("drinks").clear(),
        transaction.table("drinkEntries").clear(),
        transaction.table("waterEntries").clear(),
        transaction.table("syncQueue").clear(),
        transaction.table("settings").clear(),
      ]);
    });
  }
}

export const db = new MarrakechDatabase();
