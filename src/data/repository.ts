import { db } from "./database";
import { queueOperation } from "./queue";
import { demoSnapshot } from "./seed";
import { SYSTEM_DRINKS, TRIP_TIMEZONE } from "@/domain/constants";
import type { Drink, DrinkCategory, DrinkEntry, EntityBase, EntityType, Participant, Trip, UndoBatch, WaterEntry } from "@/domain/types";
import { createId, createShareCode } from "@/lib/id";

const ACTIVE_TRIP_KEY = "activeTripId";
const DEVICE_KEY = "deviceId";
const ACTOR_KEY = "actorId";

function nowIso(): string {
  return new Date().toISOString();
}

function signalLocalChange(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("marrakech-local-change"));
}

async function putWithQueue<T extends EntityBase>(entityType: EntityType, entity: T): Promise<void> {
  const table = entityType === "trip" ? db.trips : entityType === "participant" ? db.participants : entityType === "drink" ? db.drinks : entityType === "drinkEntry" ? db.drinkEntries : db.waterEntries;
  await db.transaction("rw", table, db.syncQueue, async () => {
    await table.put(entity as never);
    await db.syncQueue.put(queueOperation(entityType, entity));
  });
  signalLocalChange();
}

export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await db.settings.get(DEVICE_KEY);
  if (existing) return existing.value;
  const value = createId();
  await db.settings.put({ key: DEVICE_KEY, value });
  return value;
}

export async function getActorId(): Promise<string> {
  return (await db.settings.get(ACTOR_KEY))?.value ?? getOrCreateDeviceId();
}

export async function setActorId(value: string): Promise<void> {
  await db.settings.put({ key: ACTOR_KEY, value });
}

export async function getActiveTripId(): Promise<string | null> {
  return (await db.settings.get(ACTIVE_TRIP_KEY))?.value ?? null;
}

export async function setActiveTripId(value: string): Promise<void> {
  await db.settings.put({ key: ACTIVE_TRIP_KEY, value });
}

export async function seedDemo(): Promise<string> {
  const snapshot = demoSnapshot();
  await db.transaction("rw", [db.trips, db.participants, db.drinks, db.drinkEntries, db.waterEntries, db.settings], async () => {
    await db.trips.put(snapshot.trip);
    await db.participants.bulkPut(snapshot.participants);
    await db.drinks.bulkPut(snapshot.drinks);
    await db.drinkEntries.bulkPut(snapshot.drinkEntries);
    await db.waterEntries.bulkPut(snapshot.waterEntries);
    await db.settings.put({ key: ACTIVE_TRIP_KEY, value: snapshot.trip.id });
    await db.settings.put({ key: ACTOR_KEY, value: snapshot.participants[0].id });
  });
  return snapshot.trip.id;
}

export async function bootstrapDemoIfEnabled(): Promise<string | null> {
  const current = await getActiveTripId();
  if (current && (await db.trips.get(current))) return current;
  const enabled = process.env.NEXT_PUBLIC_ENABLE_DEMO_SEED === "true";
  return enabled ? seedDemo() : null;
}

export async function createTrip(input: { name: string; startDate: string; endDate: string; creatorName: string }): Promise<string> {
  const timestamp = nowIso();
  const tripId = createId();
  const deviceId = await getOrCreateDeviceId();
  const trip: Trip = {
    id: tripId,
    tripId,
    name: input.name.trim(),
    shareCode: createShareCode(input.name),
    startDate: input.startDate,
    endDate: input.endDate,
    timezone: TRIP_TIMEZONE,
    createdBy: deviceId,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  };
  const participant: Participant = {
    id: createId(),
    tripId,
    name: input.creatorName.trim(),
    avatarUrl: null,
    colorIndex: 0,
    sortOrder: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  };
  const drinks: Drink[] = SYSTEM_DRINKS.map((drink, index) => ({
    id: createId(),
    tripId,
    ...drink,
    isAlcohol: true,
    isSystem: true,
    sortOrder: index,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }));
  await db.transaction("rw", db.trips, db.participants, db.drinks, db.syncQueue, db.settings, async () => {
    await db.trips.put(trip);
    await db.participants.put(participant);
    await db.drinks.bulkPut(drinks);
    await db.syncQueue.bulkPut([
      queueOperation("trip", trip),
      queueOperation("participant", participant),
      ...drinks.map((drink) => queueOperation("drink", drink)),
    ]);
    await db.settings.put({ key: ACTIVE_TRIP_KEY, value: tripId });
    await db.settings.put({ key: ACTOR_KEY, value: participant.id });
  });
  signalLocalChange();
  return tripId;
}

export async function addParticipant(tripId: string, name: string, sortOrder: number): Promise<Participant> {
  const timestamp = nowIso();
  const participant: Participant = {
    id: createId(), tripId, name: name.trim(), avatarUrl: null, colorIndex: sortOrder % 4, sortOrder, createdAt: timestamp, updatedAt: timestamp, deletedAt: null,
  };
  await putWithQueue("participant", participant);
  return participant;
}

export async function updateParticipant(participant: Participant, changes: Partial<Pick<Participant, "name" | "avatarUrl">>): Promise<void> {
  await putWithQueue("participant", {
    ...participant,
    ...changes,
    name: changes.name === undefined ? participant.name : changes.name.trim(),
    updatedAt: nowIso(),
  });
}

export async function deleteParticipant(participant: Participant): Promise<void> {
  const timestamp = nowIso();
  await putWithQueue("participant", { ...participant, deletedAt: timestamp, updatedAt: timestamp });
}

export async function addDrink(tripId: string, input: { name: string; category: DrinkCategory; icon: string }, sortOrder: number): Promise<Drink> {
  const timestamp = nowIso();
  const drink: Drink = {
    id: createId(), tripId, name: input.name.trim(), category: input.category, icon: input.icon, isAlcohol: true, isSystem: false, sortOrder, createdAt: timestamp, updatedAt: timestamp, deletedAt: null,
  };
  await putWithQueue("drink", drink);
  return drink;
}

export async function updateDrink(drink: Drink, changes: Pick<Drink, "name" | "category" | "icon">): Promise<void> {
  await putWithQueue("drink", { ...drink, ...changes, name: changes.name.trim(), updatedAt: nowIso() });
}

export async function deleteDrink(drink: Drink): Promise<void> {
  const timestamp = nowIso();
  await putWithQueue("drink", { ...drink, deletedAt: timestamp, updatedAt: timestamp });
}

export async function addDrinkRound(tripId: string, participantIds: string[], drinkId: string): Promise<UndoBatch> {
  const timestamp = nowIso();
  const deviceId = await getOrCreateDeviceId();
  const actionBy = await getActorId();
  const roundId = participantIds.length > 1 ? createId() : null;
  const entries: DrinkEntry[] = participantIds.map((participantId) => ({
    id: createId(), tripId, participantId, drinkId, consumedAt: timestamp, actionBy, deviceId, roundId, createdAt: timestamp, updatedAt: timestamp, deletedAt: null,
  }));
  await db.transaction("rw", db.drinkEntries, db.syncQueue, async () => {
    await db.drinkEntries.bulkPut(entries);
    await db.syncQueue.bulkPut(entries.map((entry) => queueOperation("drinkEntry", entry)));
  });
  signalLocalChange();
  return { drinkEntryIds: entries.map((entry) => entry.id), waterEntryIds: [] };
}

export async function addWaterRound(tripId: string, participantIds: string[]): Promise<UndoBatch> {
  const timestamp = nowIso();
  const deviceId = await getOrCreateDeviceId();
  const actionBy = await getActorId();
  const roundId = participantIds.length > 1 ? createId() : null;
  const entries: WaterEntry[] = participantIds.map((participantId) => ({
    id: createId(), tripId, participantId, consumedAt: timestamp, actionBy, deviceId, roundId, createdAt: timestamp, updatedAt: timestamp, deletedAt: null,
  }));
  await db.transaction("rw", db.waterEntries, db.syncQueue, async () => {
    await db.waterEntries.bulkPut(entries);
    await db.syncQueue.bulkPut(entries.map((entry) => queueOperation("waterEntry", entry)));
  });
  signalLocalChange();
  return { drinkEntryIds: [], waterEntryIds: entries.map((entry) => entry.id) };
}

export async function updateDrinkEntry(entry: DrinkEntry, changes: Pick<DrinkEntry, "participantId" | "drinkId" | "consumedAt">): Promise<void> {
  await putWithQueue("drinkEntry", { ...entry, ...changes, updatedAt: nowIso() });
}

export async function deleteDrinkEntry(entry: DrinkEntry): Promise<void> {
  const timestamp = nowIso();
  await putWithQueue("drinkEntry", { ...entry, updatedAt: timestamp, deletedAt: timestamp });
}

export async function updateWaterEntry(entry: WaterEntry, changes: Pick<WaterEntry, "participantId" | "consumedAt">): Promise<void> {
  await putWithQueue("waterEntry", { ...entry, ...changes, updatedAt: nowIso() });
}

export async function deleteWaterEntry(entry: WaterEntry): Promise<void> {
  const timestamp = nowIso();
  await putWithQueue("waterEntry", { ...entry, updatedAt: timestamp, deletedAt: timestamp });
}

export async function undoBatch(batch: UndoBatch): Promise<void> {
  const timestamp = nowIso();
  const drinks = (await db.drinkEntries.bulkGet(batch.drinkEntryIds)).filter((entry): entry is DrinkEntry => Boolean(entry));
  const waters = (await db.waterEntries.bulkGet(batch.waterEntryIds)).filter((entry): entry is WaterEntry => Boolean(entry));
  const deletedDrinks = drinks.map((entry) => ({ ...entry, deletedAt: timestamp, updatedAt: timestamp }));
  const deletedWaters = waters.map((entry) => ({ ...entry, deletedAt: timestamp, updatedAt: timestamp }));
  await db.transaction("rw", db.drinkEntries, db.waterEntries, db.syncQueue, async () => {
    await db.drinkEntries.bulkPut(deletedDrinks);
    await db.waterEntries.bulkPut(deletedWaters);
    await db.syncQueue.bulkPut([
      ...deletedDrinks.map((entry) => queueOperation("drinkEntry", entry)),
      ...deletedWaters.map((entry) => queueOperation("waterEntry", entry)),
    ]);
  });
  signalLocalChange();
}

export async function resetLocalData(): Promise<void> {
  await db.delete();
}
