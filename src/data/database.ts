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
    // v3 : estimation d’alcoolémie et addition du séjour. On complète les enregistrements
    // existants au lieu de les effacer — un téléphone déjà en séjour ne perd rien.
    this.version(3).upgrade(async (transaction) => {
      await transaction.table("participants").toCollection().modify((participant: Partial<Participant>) => {
        participant.bacEnabled ??= false;
        participant.weightKg ??= null;
        participant.distributionRatio ??= null;
        participant.bacPrivate ??= false;
      });
      await transaction.table("drinks").toCollection().modify((drink: Partial<Drink>) => {
        drink.servingVolumeMl ??= null;
        drink.abvPercent ??= null;
        drink.alcoholComponents ??= null;
        drink.compositionConfirmed ??= false;
        drink.priceCents ??= null;
      });
      await transaction.table("drinkEntries").toCollection().modify((entry: Partial<DrinkEntry>) => {
        entry.alcoholGrams ??= null;
        entry.drinkNameSnapshot ??= null;
        entry.paidBy ??= null;
        entry.priceCentsSnapshot ??= null;
      });
    });
    // v4 : passage aux comptes email/mot de passe.
    //
    // Les données locales antérieures ont été produites sous authentification
    // anonyme : chaque opération en attente porte un `actionBy` qui ne référence
    // plus aucun compte, et serait refusée indéfiniment par la RLS (42501). Il
    // n’y a rien à récupérer côté serveur — ces séjours n’ont jamais été poussés,
    // c’est précisément l’origine des 403. On repart donc d’une base propre, en
    // conservant l’identifiant de l’appareil.
    this.version(4).stores({
      participants: "id, tripId, [tripId+deletedAt], updatedAt, sortOrder, userId",
    }).upgrade(async (transaction) => {
      await Promise.all([
        transaction.table("trips").clear(),
        transaction.table("participants").clear(),
        transaction.table("drinks").clear(),
        transaction.table("drinkEntries").clear(),
        transaction.table("waterEntries").clear(),
        transaction.table("syncQueue").clear(),
      ]);
      await transaction.table("settings").toCollection().modify((setting: Partial<LocalSetting>, context) => {
        // `deviceId` reste : il identifie le téléphone, pas un compte.
        if (setting.key !== "deviceId") delete context.value;
      });
    });
  }
}

export const db = new MarrakechDatabase();
