import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "./database";
import { addDrinkRound, addWaterRound, createTrip, deleteEntries, restoreEntries, undoBatch } from "./repository";

async function freshTrip(): Promise<string> {
  return createTrip({ name: "Marrakech 2026", creatorName: "Romain", startDate: "2026-09-07", endDate: "2026-09-16" });
}

async function drinkId(tripId: string, name: string): Promise<string> {
  const drink = await db.drinks.where("tripId").equals(tripId).filter((item) => item.name === name).first();
  if (!drink) throw new Error(`Boisson introuvable : ${name}`);
  return drink.id;
}

describe("annulation rapide", () => {
  afterEach(async () => {
    // On vide les tables plutôt que de supprimer la base : l’instance Dexie est partagée par les tests.
    await Promise.all([db.trips, db.participants, db.drinks, db.drinkEntries, db.waterEntries, db.syncQueue, db.settings].map((table) => table.clear()));
  });

  it("supprime localement le verre ajouté", async () => {
    const tripId = await freshTrip();
    const batch = await addDrinkRound(tripId, ["romain"], await drinkId(tripId, "Mojito"));

    expect(batch.drinkEntryIds).toHaveLength(1);
    expect((await db.drinkEntries.get(batch.drinkEntryIds[0]))?.deletedAt).toBeNull();

    await undoBatch(batch);

    const entry = await db.drinkEntries.get(batch.drinkEntryIds[0]);
    expect(entry?.deletedAt).not.toBeNull();
    expect(await db.drinkEntries.filter((item) => !item.deletedAt).count()).toBe(0);
  });

  it("annule la tournée entière, pas seulement le premier verre", async () => {
    const tripId = await freshTrip();
    const batch = await addDrinkRound(tripId, ["romain", "lucas", "theo", "hugo"], await drinkId(tripId, "Bière locale"));

    expect(batch.drinkEntryIds).toHaveLength(4);
    const roundIds = new Set((await db.drinkEntries.bulkGet(batch.drinkEntryIds)).map((entry) => entry?.roundId));
    expect(roundIds.size).toBe(1);

    await undoBatch(batch);

    const entries = await db.drinkEntries.bulkGet(batch.drinkEntryIds);
    expect(entries.every((entry) => Boolean(entry?.deletedAt))).toBe(true);
    expect(await db.drinkEntries.filter((entry) => !entry.deletedAt).count()).toBe(0);
  });

  it("ne fusionne jamais deux tournées lancées presque simultanément", async () => {
    const tripId = await freshTrip();
    const participants = ["romain", "lucas", "theo"];
    const mojitoId = await drinkId(tripId, "Mojito");

    const [first, second] = await Promise.all([
      addDrinkRound(tripId, participants, mojitoId, "2026-09-12T22:00:00.000Z"),
      addDrinkRound(tripId, participants, mojitoId, "2026-09-12T22:00:00.001Z"),
    ]);

    const firstEntries = await db.drinkEntries.bulkGet(first.drinkEntryIds);
    const secondEntries = await db.drinkEntries.bulkGet(second.drinkEntryIds);
    const firstRound = firstEntries[0]?.roundId;
    const secondRound = secondEntries[0]?.roundId;
    expect(firstRound).toBeTruthy();
    expect(secondRound).toBeTruthy();
    expect(firstRound).not.toBe(secondRound);
    expect(firstEntries.every((entry) => entry?.roundId === firstRound)).toBe(true);
    expect(secondEntries.every((entry) => entry?.roundId === secondRound)).toBe(true);
    expect(await db.drinkEntries.filter((entry) => !entry.deletedAt).count()).toBe(6);
  });

  it("annule aussi une tournée d’eau", async () => {
    const tripId = await freshTrip();
    const batch = await addWaterRound(tripId, ["romain", "lucas"]);

    await undoBatch(batch);

    const entries = await db.waterEntries.bulkGet(batch.waterEntryIds);
    expect(entries.every((entry) => Boolean(entry?.deletedAt))).toBe(true);
  });

  it("laisse une annulation hors ligne dans un état synchronisable", async () => {
    const tripId = await freshTrip();
    // Aucun moteur de synchronisation ne tourne ici : c’est exactement l’état hors ligne.
    const batch = await addDrinkRound(tripId, ["romain", "lucas"], await drinkId(tripId, "Mojito"));

    await undoBatch(batch);

    const operations = await Promise.all(batch.drinkEntryIds.map((id) => db.syncQueue.get(`drinkEntry:${id}`)));
    expect(operations).toHaveLength(2);
    for (const operation of operations) {
      expect(operation?.status).toBe("pending");
      expect(operation?.action).toBe("upsert");
      // L’opération en attente porte bien la suppression : le rejeu propagera l’annulation au groupe.
      expect(operation?.payload.deletedAt).not.toBeNull();
      expect(operation?.attempts).toBe(0);
    }
  });
});

describe("suppression groupée depuis le Journal", () => {
  afterEach(async () => {
    await Promise.all([db.trips, db.participants, db.drinks, db.drinkEntries, db.waterEntries, db.syncQueue, db.settings].map((table) => table.clear()));
  });

  it("supprime en une fois des verres et des eaux venus de tournées différentes", async () => {
    const tripId = await freshTrip();
    const mojitos = await addDrinkRound(tripId, ["romain", "lucas"], await drinkId(tripId, "Mojito"));
    const beers = await addDrinkRound(tripId, ["theo"], await drinkId(tripId, "Bière locale"));
    const waters = await addWaterRound(tripId, ["romain"]);

    const batch = {
      drinkEntryIds: [...mojitos.drinkEntryIds, ...beers.drinkEntryIds],
      waterEntryIds: waters.waterEntryIds,
    };
    await deleteEntries(batch);

    expect(await db.drinkEntries.filter((entry) => !entry.deletedAt).count()).toBe(0);
    expect(await db.waterEntries.filter((entry) => !entry.deletedAt).count()).toBe(0);
  });

  it("ne touche pas aux entrées qui ne sont pas sélectionnées", async () => {
    const tripId = await freshTrip();
    const selected = await addDrinkRound(tripId, ["romain"], await drinkId(tripId, "Mojito"));
    const kept = await addDrinkRound(tripId, ["lucas"], await drinkId(tripId, "Bière locale"));

    await deleteEntries({ drinkEntryIds: selected.drinkEntryIds, waterEntryIds: [] });

    expect((await db.drinkEntries.get(selected.drinkEntryIds[0]))?.deletedAt).not.toBeNull();
    expect((await db.drinkEntries.get(kept.drinkEntryIds[0]))?.deletedAt).toBeNull();
  });

  it("restaure exactement les entrées supprimées quand on annule", async () => {
    const tripId = await freshTrip();
    const drinks = await addDrinkRound(tripId, ["romain", "lucas", "theo"], await drinkId(tripId, "Mojito"));
    const waters = await addWaterRound(tripId, ["romain"]);
    const batch = { drinkEntryIds: drinks.drinkEntryIds, waterEntryIds: waters.waterEntryIds };
    const before = await db.drinkEntries.bulkGet(drinks.drinkEntryIds);

    await deleteEntries(batch);
    await restoreEntries(batch);

    const after = await db.drinkEntries.bulkGet(drinks.drinkEntryIds);
    expect(after.every((entry) => entry?.deletedAt === null)).toBe(true);
    expect(await db.waterEntries.filter((entry) => !entry.deletedAt).count()).toBe(1);
    // Seul updatedAt bouge : le reste de l’entrée revient à l’identique.
    expect(after.map((entry) => ({ ...entry, updatedAt: "" }))).toEqual(before.map((entry) => ({ ...entry, updatedAt: "" })));
  });

  it("laisse la restauration synchronisable hors ligne", async () => {
    const tripId = await freshTrip();
    const batch = await addDrinkRound(tripId, ["romain"], await drinkId(tripId, "Mojito"));

    await deleteEntries(batch);
    await restoreEntries(batch);

    const operation = await db.syncQueue.get(`drinkEntry:${batch.drinkEntryIds[0]}`);
    expect(operation?.status).toBe("pending");
    expect(operation?.payload.deletedAt).toBeNull();
  });
});
