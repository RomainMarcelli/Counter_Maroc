import { db } from "./database";
import { queueOperation } from "./queue";
import { demoSnapshot } from "./seed";
import { CATEGORY_DEFAULTS, SYSTEM_DRINKS, TRIP_TIMEZONE } from "@/domain/constants";
import type { AlcoholComponent, Drink, DrinkCategory, DrinkEntry, EntityBase, EntityType, Participant, Trip, UndoBatch, WaterEntry } from "@/domain/types";
import { calculateDrinkAlcoholGrams } from "@/domain/bac";
import { createId, createShareCode } from "@/lib/id";

const ACTIVE_TRIP_KEY = "activeTripId";
const DEVICE_KEY = "deviceId";
/** Compte connecté sur ce téléphone : auteur de toutes les actions locales. */
const AUTH_USER_KEY = "authUserId";
/** Dernier compte ayant possédé les données locales, pour la séparation par compte. */
const LOCAL_OWNER_KEY = "localOwnerId";

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

/**
 * Auteur des actions locales. C’est le compte Supabase connecté : il part tel quel
 * dans `action_by`, ce que la policy d’insertion exige. Sans compte (mode démo ou
 * local pur), on retombe sur l’identifiant de l’appareil.
 */
export async function getAuthorId(): Promise<string> {
  return (await db.settings.get(AUTH_USER_KEY))?.value ?? getOrCreateDeviceId();
}

export async function setAuthUserId(value: string | null): Promise<void> {
  if (value) await db.settings.put({ key: AUTH_USER_KEY, value });
  else await db.settings.delete(AUTH_USER_KEY);
}

/** Le participant que le compte connecté incarne dans ce séjour, s’il en a choisi un. */
export async function getMyParticipantId(tripId: string): Promise<string | null> {
  const authorId = await getAuthorId();
  const participants = await db.participants.where("tripId").equals(tripId).toArray();
  return participants.find((participant) => participant.userId === authorId && !participant.deletedAt)?.id ?? null;
}

/**
 * Séparation locale par compte : si un autre compte se connecte sur ce navigateur,
 * les données du précédent ne doivent pas rester visibles. Se reconnecter avec le
 * même compte ne touche à rien — la déconnexion seule n’efface jamais.
 */
export async function claimLocalData(userId: string): Promise<boolean> {
  const previous = (await db.settings.get(LOCAL_OWNER_KEY))?.value ?? null;
  if (previous === userId) return false;
  if (previous) {
    await db.transaction("rw", [db.trips, db.participants, db.drinks, db.drinkEntries, db.waterEntries, db.syncQueue], async () => {
      await Promise.all([db.trips.clear(), db.participants.clear(), db.drinks.clear(), db.drinkEntries.clear(), db.waterEntries.clear(), db.syncQueue.clear()]);
    });
    await db.settings.delete(ACTIVE_TRIP_KEY);
  }
  await db.settings.put({ key: LOCAL_OWNER_KEY, value: userId });
  return Boolean(previous);
}

/**
 * Reflète localement le rattachement compte ↔ participant décidé par le RPC
 * `claim_participant`. `user_id` ne transite jamais par la file de synchronisation :
 * seul le serveur arbitre qui détient une identité.
 */
export async function linkParticipantToAccount(participant: Participant, userId: string): Promise<void> {
  const siblings = await db.participants.where("tripId").equals(participant.tripId).toArray();
  const released = siblings
    .filter((item) => item.userId === userId && item.id !== participant.id)
    .map((item) => ({ ...item, userId: null }));
  // `updatedAt` n’est pas touché : ce champ arbitre les conflits de synchronisation,
  // et le rattachement n’emprunte pas ce chemin. Le bousculer bloquerait une mise à
  // jour légitime venue d’un autre téléphone.
  await db.participants.bulkPut([...released, { ...participant, userId }]);
  signalLocalChange();
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
    await db.settings.put({ key: AUTH_USER_KEY, value: snapshot.trip.createdBy });
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
  const authorId = await getAuthorId();
  const trip: Trip = {
    id: tripId,
    tripId,
    name: input.name.trim(),
    shareCode: createShareCode(input.name),
    startDate: input.startDate,
    endDate: input.endDate,
    timezone: TRIP_TIMEZONE,
    createdBy: authorId,
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
    // Le créateur incarne son propre participant dès la création.
    userId: authorId,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    bacEnabled: false,
    weightKg: null,
    distributionRatio: null,
    bacPrivate: false,
  };
  const drinks: Drink[] = SYSTEM_DRINKS.map((drink, index) => ({
    id: createId(),
    tripId,
    ...drink,
    alcoholComponents: drink.alcoholComponents ? drink.alcoholComponents.map((component) => ({ ...component })) : null,
    // Les doses livrées sont des ordres de grandeur : le séjour les confirme depuis les Réglages.
    compositionConfirmed: false,
    priceCents: null,
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
  });
  signalLocalChange();
  return tripId;
}

export async function addParticipant(tripId: string, name: string, sortOrder: number): Promise<Participant> {
  const timestamp = nowIso();
  const participant: Participant = {
    id: createId(), tripId, name: name.trim(), avatarUrl: null, colorIndex: sortOrder % 4, sortOrder, createdAt: timestamp, updatedAt: timestamp, deletedAt: null,
    // Un participant peut exister sans compte : il sera rattaché quand la personne rejoindra.
    userId: null,
    bacEnabled: false, weightKg: null, distributionRatio: null, bacPrivate: false,
  };
  await putWithQueue("participant", participant);
  return participant;
}

export async function updateParticipant(participant: Participant, changes: Partial<Pick<Participant, "name" | "avatarUrl" | "bacEnabled" | "weightKg" | "distributionRatio" | "bacPrivate">>): Promise<void> {
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

export interface DrinkCompositionInput {
  servingVolumeMl: number | null;
  abvPercent: number | null;
  alcoholComponents: AlcoholComponent[] | null;
  compositionConfirmed: boolean;
  priceCents: number | null;
}

export type DrinkInput = { name: string; category: DrinkCategory; icon: string } & Partial<DrinkCompositionInput>;

/**
 * `undefined` : rien n’a été précisé, on propose la dose type de la catégorie (à confirmer).
 * `null` : la valeur a été explicitement vidée, la composition reste inconnue plutôt qu’inventée.
 */
function drinkComposition(input: Partial<DrinkCompositionInput>, category: DrinkCategory): DrinkCompositionInput {
  const fallback = CATEGORY_DEFAULTS[category];
  const components = input.alcoholComponents?.length ? input.alcoholComponents : null;
  return {
    servingVolumeMl: input.servingVolumeMl === undefined ? fallback.servingVolumeMl : input.servingVolumeMl,
    abvPercent: components ? input.abvPercent ?? null : input.abvPercent === undefined ? fallback.abvPercent : input.abvPercent,
    alcoholComponents: components,
    compositionConfirmed: input.compositionConfirmed ?? false,
    priceCents: input.priceCents ?? null,
  };
}

export async function addDrink(tripId: string, input: DrinkInput, sortOrder: number): Promise<Drink> {
  const timestamp = nowIso();
  const drink: Drink = {
    id: createId(), tripId, name: input.name.trim(), category: input.category, icon: input.icon, isAlcohol: true, isSystem: false, sortOrder, createdAt: timestamp, updatedAt: timestamp, deletedAt: null,
    ...drinkComposition(input, input.category),
  };
  await putWithQueue("drink", drink);
  return drink;
}

export async function updateDrink(drink: Drink, changes: Pick<Drink, "name" | "category" | "icon"> & Partial<DrinkCompositionInput>): Promise<void> {
  await putWithQueue("drink", {
    ...drink,
    ...changes,
    alcoholComponents: changes.alcoholComponents?.length ? changes.alcoholComponents : null,
    name: changes.name.trim(),
    updatedAt: nowIso(),
  });
}

export async function deleteDrink(drink: Drink): Promise<void> {
  const timestamp = nowIso();
  await putWithQueue("drink", { ...drink, deletedAt: timestamp, updatedAt: timestamp });
}

/**
 * Photographie de la boisson au moment du verre : si la recette du Mojito change au jour 8,
 * les Mojitos des sept premiers jours gardent l’alcool et le prix qu’ils avaient réellement.
 */
function entrySnapshot(drink: Drink | undefined): Pick<DrinkEntry, "alcoholGrams" | "drinkNameSnapshot" | "priceCentsSnapshot"> {
  if (!drink) return { alcoholGrams: null, drinkNameSnapshot: null, priceCentsSnapshot: null };
  return {
    alcoholGrams: calculateDrinkAlcoholGrams(drink),
    drinkNameSnapshot: drink.name,
    priceCentsSnapshot: drink.priceCents,
  };
}

export async function addDrinkRound(tripId: string, participantIds: string[], drinkId: string, consumedAt?: string): Promise<UndoBatch> {
  const timestamp = nowIso();
  const consumedIso = consumedAt ?? timestamp;
  const deviceId = await getOrCreateDeviceId();
  const actionBy = await getAuthorId();
  const payer = await getMyParticipantId(tripId);
  const roundId = participantIds.length > 1 ? createId() : null;
  const snapshot = entrySnapshot(await db.drinks.get(drinkId));
  const entries: DrinkEntry[] = participantIds.map((participantId) => ({
    id: createId(), tripId, participantId, drinkId, consumedAt: consumedIso, actionBy, deviceId, roundId, createdAt: timestamp, updatedAt: timestamp, deletedAt: null,
    ...snapshot,
    // Celui qui saisit la tournée est présumé l’avoir payée ; le Journal permet de corriger.
    paidBy: payer,
  }));
  await db.transaction("rw", db.drinkEntries, db.syncQueue, async () => {
    await db.drinkEntries.bulkPut(entries);
    await db.syncQueue.bulkPut(entries.map((entry) => queueOperation("drinkEntry", entry)));
  });
  signalLocalChange();
  return { drinkEntryIds: entries.map((entry) => entry.id), waterEntryIds: [] };
}

export async function addWaterRound(tripId: string, participantIds: string[], consumedAt?: string): Promise<UndoBatch> {
  const timestamp = nowIso();
  const deviceId = await getOrCreateDeviceId();
  const actionBy = await getAuthorId();
  const roundId = participantIds.length > 1 ? createId() : null;
  const entries: WaterEntry[] = participantIds.map((participantId) => ({
    id: createId(), tripId, participantId, consumedAt: consumedAt ?? timestamp, actionBy, deviceId, roundId, createdAt: timestamp, updatedAt: timestamp, deletedAt: null,
  }));
  await db.transaction("rw", db.waterEntries, db.syncQueue, async () => {
    await db.waterEntries.bulkPut(entries);
    await db.syncQueue.bulkPut(entries.map((entry) => queueOperation("waterEntry", entry)));
  });
  signalLocalChange();
  return { drinkEntryIds: [], waterEntryIds: entries.map((entry) => entry.id) };
}

/**
 * Modifier une entrée reprend un snapshot explicite dès que la boisson change :
 * l’alcool estimé et le prix suivent la boisson réellement bue.
 */
export async function updateDrinkEntry(entry: DrinkEntry, changes: Partial<Pick<DrinkEntry, "participantId" | "drinkId" | "consumedAt" | "paidBy">>): Promise<void> {
  const next = { ...entry, ...changes, updatedAt: nowIso() };
  const snapshot = changes.drinkId && changes.drinkId !== entry.drinkId ? entrySnapshot(await db.drinks.get(changes.drinkId)) : {};
  await putWithQueue("drinkEntry", { ...next, ...snapshot });
}

/** Modification groupée depuis le Journal : réattribuer, décaler l’heure, changer le payeur. */
export async function updateEntries(batch: UndoBatch, changes: { participantId?: string; paidBy?: string; shiftMinutes?: number }): Promise<void> {
  const timestamp = nowIso();
  const shift = (changes.shiftMinutes ?? 0) * 60_000;
  const applyTime = (consumedAt: string) => (shift ? new Date(Date.parse(consumedAt) + shift).toISOString() : consumedAt);
  const drinks = (await db.drinkEntries.bulkGet(batch.drinkEntryIds)).filter((entry): entry is DrinkEntry => Boolean(entry));
  const waters = (await db.waterEntries.bulkGet(batch.waterEntryIds)).filter((entry): entry is WaterEntry => Boolean(entry));
  const nextDrinks = drinks.map((entry) => ({
    ...entry,
    participantId: changes.participantId ?? entry.participantId,
    paidBy: changes.paidBy ?? entry.paidBy,
    consumedAt: applyTime(entry.consumedAt),
    updatedAt: timestamp,
  }));
  const nextWaters = waters.map((entry) => ({
    ...entry,
    participantId: changes.participantId ?? entry.participantId,
    consumedAt: applyTime(entry.consumedAt),
    updatedAt: timestamp,
  }));
  await db.transaction("rw", db.drinkEntries, db.waterEntries, db.syncQueue, async () => {
    await db.drinkEntries.bulkPut(nextDrinks);
    await db.waterEntries.bulkPut(nextWaters);
    await db.syncQueue.bulkPut([
      ...nextDrinks.map((entry) => queueOperation("drinkEntry", entry)),
      ...nextWaters.map((entry) => queueOperation("waterEntry", entry)),
    ]);
  });
  signalLocalChange();
}

/** Recalcule le snapshot d’alcool et de prix à partir de la carte actuelle. */
export async function refreshEntrySnapshots(entryIds: string[]): Promise<number> {
  const timestamp = nowIso();
  const entries = (await db.drinkEntries.bulkGet(entryIds)).filter((entry): entry is DrinkEntry => Boolean(entry));
  const drinks = new Map((await db.drinks.bulkGet([...new Set(entries.map((entry) => entry.drinkId))])).filter((drink): drink is Drink => Boolean(drink)).map((drink) => [drink.id, drink]));
  const next = entries.map((entry) => ({ ...entry, ...entrySnapshot(drinks.get(entry.drinkId)), updatedAt: timestamp }));
  if (!next.length) return 0;
  await db.transaction("rw", db.drinkEntries, db.syncQueue, async () => {
    await db.drinkEntries.bulkPut(next);
    await db.syncQueue.bulkPut(next.map((entry) => queueOperation("drinkEntry", entry)));
  });
  signalLocalChange();
  return next.length;
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

async function setEntriesDeleted(batch: UndoBatch, deleted: boolean): Promise<void> {
  const timestamp = nowIso();
  const deletedAt = deleted ? timestamp : null;
  const drinks = (await db.drinkEntries.bulkGet(batch.drinkEntryIds)).filter((entry): entry is DrinkEntry => Boolean(entry));
  const waters = (await db.waterEntries.bulkGet(batch.waterEntryIds)).filter((entry): entry is WaterEntry => Boolean(entry));
  const nextDrinks = drinks.map((entry) => ({ ...entry, deletedAt, updatedAt: timestamp }));
  const nextWaters = waters.map((entry) => ({ ...entry, deletedAt, updatedAt: timestamp }));
  await db.transaction("rw", db.drinkEntries, db.waterEntries, db.syncQueue, async () => {
    await db.drinkEntries.bulkPut(nextDrinks);
    await db.waterEntries.bulkPut(nextWaters);
    await db.syncQueue.bulkPut([
      ...nextDrinks.map((entry) => queueOperation("drinkEntry", entry)),
      ...nextWaters.map((entry) => queueOperation("waterEntry", entry)),
    ]);
  });
  signalLocalChange();
}

/** Annule un ajout depuis l’écran Rapide : les verres qui viennent d’être créés repartent. */
export async function undoBatch(batch: UndoBatch): Promise<void> {
  await setEntriesDeleted(batch, true);
}

/** Suppression groupée depuis le Journal. */
export async function deleteEntries(batch: UndoBatch): Promise<void> {
  await setEntriesDeleted(batch, true);
}

/** Annulation d’une suppression groupée : les entrées reviennent telles quelles. */
export async function restoreEntries(batch: UndoBatch): Promise<void> {
  await setEntriesDeleted(batch, false);
}

export interface DeletedEntry {
  kind: "drink" | "water";
  id: string;
  participantId: string;
  drinkId: string | null;
  drinkName: string | null;
  consumedAt: string;
  deletedAt: string;
}

/** Corbeille du séjour : ce qui a été supprimé reste restaurable tant qu’il est en base locale. */
export async function listDeletedEntries(tripId: string, limit = 40): Promise<DeletedEntry[]> {
  const [drinkEntries, waterEntries] = await Promise.all([
    db.drinkEntries.where("tripId").equals(tripId).filter((entry) => Boolean(entry.deletedAt)).toArray(),
    db.waterEntries.where("tripId").equals(tripId).filter((entry) => Boolean(entry.deletedAt)).toArray(),
  ]);
  return [
    ...drinkEntries.map((entry) => ({ kind: "drink" as const, id: entry.id, participantId: entry.participantId, drinkId: entry.drinkId, drinkName: entry.drinkNameSnapshot, consumedAt: entry.consumedAt, deletedAt: entry.deletedAt ?? "" })),
    ...waterEntries.map((entry) => ({ kind: "water" as const, id: entry.id, participantId: entry.participantId, drinkId: null, drinkName: null, consumedAt: entry.consumedAt, deletedAt: entry.deletedAt ?? "" })),
  ]
    .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))
    .slice(0, limit);
}

export async function resetLocalData(): Promise<void> {
  await db.delete();
}
