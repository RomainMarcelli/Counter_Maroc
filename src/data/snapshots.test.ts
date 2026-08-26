import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "./database";
import { addDrink, addDrinkRound, createTrip, getAuthorId, getMyParticipantId, refreshEntrySnapshots, updateDrink, updateDrinkEntry } from "./repository";
import { calculatePureAlcoholGrams } from "@/domain/bac";

async function freshTrip(): Promise<string> {
  return createTrip({ name: "Marrakech 2026", creatorName: "Romain", startDate: "2026-09-07", endDate: "2026-09-16" });
}

async function drink(tripId: string, name: string) {
  const found = await db.drinks.where("tripId").equals(tripId).filter((item) => item.name === name).first();
  if (!found) throw new Error(`Boisson introuvable : ${name}`);
  return found;
}

describe("snapshot d’alcool par consommation", () => {
  afterEach(async () => {
    await Promise.all([db.trips, db.participants, db.drinks, db.drinkEntries, db.waterEntries, db.syncQueue, db.settings].map((table) => table.clear()));
  });

  it("fige l’alcool pur au moment du verre", async () => {
    const tripId = await freshTrip();
    const whisky = await drink(tripId, "Whisky");
    const batch = await addDrinkRound(tripId, ["romain"], whisky.id);

    const entry = await db.drinkEntries.get(batch.drinkEntryIds[0]);
    expect(entry?.alcoholGrams).toBeCloseTo(calculatePureAlcoholGrams(40, 40), 3);
    expect(entry?.drinkNameSnapshot).toBe("Whisky");
  });

  it("ne compte que le rhum d’un mojito, pas les 25 cl du verre", async () => {
    const tripId = await freshTrip();
    const mojito = await drink(tripId, "Mojito");
    const batch = await addDrinkRound(tripId, ["romain"], mojito.id);

    const entry = await db.drinkEntries.get(batch.drinkEntryIds[0]);
    expect(entry?.alcoholGrams).toBeCloseTo(calculatePureAlcoholGrams(40, 40), 3);
    expect(entry?.alcoholGrams).toBeLessThan(calculatePureAlcoholGrams(250, 40));
  });

  it("ne réécrit pas l’historique quand la recette change plus tard", async () => {
    const tripId = await freshTrip();
    const mojito = await drink(tripId, "Mojito");
    const batch = await addDrinkRound(tripId, ["romain"], mojito.id);
    const before = (await db.drinkEntries.get(batch.drinkEntryIds[0]))?.alcoholGrams;

    // Jour 8 : le barman sert en réalité 6 cl de rhum.
    await updateDrink(mojito, { name: mojito.name, category: mojito.category, icon: mojito.icon, servingVolumeMl: 250, abvPercent: null, alcoholComponents: [{ name: "Rhum blanc", volumeMl: 60, abvPercent: 40 }], compositionConfirmed: true, priceCents: null });

    expect((await db.drinkEntries.get(batch.drinkEntryIds[0]))?.alcoholGrams).toBe(before);
  });

  it("recalcule explicitement une entrée à la demande", async () => {
    const tripId = await freshTrip();
    const mojito = await drink(tripId, "Mojito");
    const batch = await addDrinkRound(tripId, ["romain"], mojito.id);
    await updateDrink(mojito, { name: mojito.name, category: mojito.category, icon: mojito.icon, servingVolumeMl: 250, abvPercent: null, alcoholComponents: [{ name: "Rhum blanc", volumeMl: 60, abvPercent: 40 }], compositionConfirmed: true, priceCents: null });

    expect(await refreshEntrySnapshots(batch.drinkEntryIds)).toBe(1);
    expect((await db.drinkEntries.get(batch.drinkEntryIds[0]))?.alcoholGrams).toBeCloseTo(calculatePureAlcoholGrams(60, 40), 3);
  });

  it("reprend un snapshot quand l’entrée change de boisson", async () => {
    const tripId = await freshTrip();
    const whisky = await drink(tripId, "Whisky");
    const biere = await drink(tripId, "Bière locale");
    const batch = await addDrinkRound(tripId, ["romain"], whisky.id);
    const entry = await db.drinkEntries.get(batch.drinkEntryIds[0]);

    await updateDrinkEntry(entry!, { drinkId: biere.id });

    const updated = await db.drinkEntries.get(batch.drinkEntryIds[0]);
    expect(updated?.drinkNameSnapshot).toBe("Bière locale");
    expect(updated?.alcoholGrams).toBeCloseTo(calculatePureAlcoholGrams(250, 5), 3);
  });

  it("laisse le snapshot vide quand la composition est inconnue", async () => {
    const tripId = await freshTrip();
    const mystere = await addDrink(tripId, { name: "Mystère du bar", category: "cocktail", icon: "🍹", servingVolumeMl: null, abvPercent: null, alcoholComponents: null }, 99);
    const batch = await addDrinkRound(tripId, ["romain"], mystere.id);

    expect((await db.drinkEntries.get(batch.drinkEntryIds[0]))?.alcoholGrams).toBeNull();
  });

  it("désigne par défaut celui qui saisit comme payeur", async () => {
    const tripId = await freshTrip();
    // Le payeur est un participant, pas un compte : c’est celui que le compte
    // connecté incarne dans ce séjour — ici le créateur.
    const me = await getMyParticipantId(tripId);
    const whisky = await drink(tripId, "Whisky");
    const batch = await addDrinkRound(tripId, ["romain", "lucas"], whisky.id);

    expect(me).not.toBeNull();
    const entries = await db.drinkEntries.bulkGet(batch.drinkEntryIds);
    expect(entries.every((entry) => entry?.paidBy === me)).toBe(true);
  });

  it("signe chaque verre avec le compte connecté, pas avec le buveur", async () => {
    const tripId = await freshTrip();
    const author = await getAuthorId();
    const whisky = await drink(tripId, "Whisky");
    const batch = await addDrinkRound(tripId, ["lucas"], whisky.id);

    // `action_by = auth.uid()` est exigé par la policy d’insertion, alors que le
    // participant peut être n’importe qui du séjour.
    const entry = await db.drinkEntries.get(batch.drinkEntryIds[0]);
    expect(entry?.actionBy).toBe(author);
    expect(entry?.participantId).toBe("lucas");
  });

  it("horodate un verre saisi en retard à l’heure demandée", async () => {
    const tripId = await freshTrip();
    const whisky = await drink(tripId, "Whisky");
    const consumedAt = new Date(Date.now() - 2 * 3_600_000).toISOString();
    const batch = await addDrinkRound(tripId, ["romain"], whisky.id, consumedAt);

    expect((await db.drinkEntries.get(batch.drinkEntryIds[0]))?.consumedAt).toBe(consumedAt);
  });
});
