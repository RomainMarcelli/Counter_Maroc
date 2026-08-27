import type { AlcoholComponent, Drink, DrinkEntry, EntityType, Participant, Trip, WaterEntry } from "@/domain/types";

type RemoteRow = Record<string, unknown>;

export const TABLE_BY_ENTITY: Record<EntityType, string> = {
  trip: "trips",
  participant: "participants",
  drink: "drinks",
  drinkEntry: "drink_entries",
  waterEntry: "water_entries",
};

function base(entity: Trip | Participant | Drink | DrinkEntry | WaterEntry) {
  return { id: entity.id, created_at: entity.createdAt, updated_at: entity.updatedAt, deleted_at: entity.deletedAt };
}

/**
 * `participants.user_id` n’est jamais écrit par cette voie : seul le RPC
 * `claim_participant` rattache un compte à un participant. L’omettre laisse la
 * valeur serveur intacte lors d’un upsert, et évite qu’un téléphone réattribue
 * l’identité de quelqu’un d’autre en renommant simplement un participant.
 *
 * `created_by` et `action_by` portent l’auteur d’origine, jamais celui qui pousse :
 * corriger la ligne de quelqu’un ne réécrit pas sa signature.
 */
export function toRemote(entityType: EntityType, value: Trip | Participant | Drink | DrinkEntry | WaterEntry): RemoteRow {
  if (entityType === "trip") {
    const entity = value as Trip;
    // `created_by` est obligatoire même sur un upsert d’une ligne existante :
    // PostgreSQL évalue le WITH CHECK de la policy d’insertion sur la ligne
    // proposée avant de détecter le conflit. L’omettre proposait created_by NULL,
    // donc `created_by = auth.uid()` était faux et l’upsert repartait en 42501.
    return { ...base(entity), name: entity.name, share_code: entity.shareCode, start_date: entity.startDate, end_date: entity.endDate, timezone: entity.timezone, created_by: entity.createdBy };
  }
  const entity = value as Participant | Drink | DrinkEntry | WaterEntry;
  if (entityType === "participant") {
    const participant = entity as Participant;
    return {
      ...base(participant), trip_id: participant.tripId, name: participant.name, avatar_url: participant.avatarUrl, color_index: participant.colorIndex, sort_order: participant.sortOrder,
      bac_estimation_enabled: participant.bacEnabled, weight_kg: participant.weightKg, distribution_ratio: participant.distributionRatio, bac_private: participant.bacPrivate,
    };
  }
  if (entityType === "drink") {
    const drink = entity as Drink;
    return {
      ...base(drink), trip_id: drink.tripId, name: drink.name, category: drink.category, icon: drink.icon, is_alcohol: drink.isAlcohol, is_system: drink.isSystem, sort_order: drink.sortOrder,
      serving_volume_ml: drink.servingVolumeMl, abv_percent: drink.abvPercent, alcohol_components: drink.alcoholComponents, composition_confirmed: drink.compositionConfirmed, price_cents: drink.priceCents,
    };
  }
  if (entityType === "drinkEntry") {
    const entry = entity as DrinkEntry;
    return {
      ...base(entry), trip_id: entry.tripId, participant_id: entry.participantId, drink_id: entry.drinkId, consumed_at: entry.consumedAt, action_by: entry.actionBy, device_id: entry.deviceId, round_id: entry.roundId,
      alcohol_grams: entry.alcoholGrams, drink_name_snapshot: entry.drinkNameSnapshot, paid_by: entry.paidBy, price_cents_snapshot: entry.priceCentsSnapshot,
    };
  }
  const entry = entity as WaterEntry;
  return { ...base(entry), trip_id: entry.tripId, participant_id: entry.participantId, consumed_at: entry.consumedAt, action_by: entry.actionBy, device_id: entry.deviceId, round_id: entry.roundId };
}

const text = (row: RemoteRow, key: string) => String(row[key] ?? "");
const nullable = (row: RemoteRow, key: string) => (row[key] ? String(row[key]) : null);
const numberOrNull = (row: RemoteRow, key: string) => {
  const value = Number(row[key]);
  return row[key] === null || row[key] === undefined || Number.isNaN(value) ? null : value;
};

function componentsOrNull(value: unknown): AlcoholComponent[] | null {
  const raw = typeof value === "string" ? safeParse(value) : value;
  if (!Array.isArray(raw)) return null;
  const components = raw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({ name: String(item.name ?? ""), volumeMl: Number(item.volumeMl ?? 0), abvPercent: Number(item.abvPercent ?? 0) }))
    .filter((item) => Number.isFinite(item.volumeMl) && Number.isFinite(item.abvPercent));
  return components.length ? components : null;
}

function safeParse(value: string): unknown {
  try { return JSON.parse(value); } catch { return null; }
}

export function fromRemote(entityType: EntityType, row: RemoteRow): Trip | Participant | Drink | DrinkEntry | WaterEntry {
  const common = { id: text(row, "id"), createdAt: text(row, "created_at"), updatedAt: text(row, "updated_at"), deletedAt: nullable(row, "deleted_at") };
  if (entityType === "trip") {
    return { ...common, tripId: common.id, name: text(row, "name"), shareCode: text(row, "share_code"), startDate: text(row, "start_date"), endDate: text(row, "end_date"), timezone: text(row, "timezone"), createdBy: text(row, "created_by") };
  }
  const tripId = text(row, "trip_id");
  if (entityType === "participant") {
    return {
      ...common, tripId, name: text(row, "name"), avatarUrl: nullable(row, "avatar_url"), colorIndex: Number(row.color_index ?? 0), sortOrder: Number(row.sort_order ?? 0),
      userId: nullable(row, "user_id"),
      bacEnabled: Boolean(row.bac_estimation_enabled), weightKg: numberOrNull(row, "weight_kg"), distributionRatio: numberOrNull(row, "distribution_ratio"), bacPrivate: Boolean(row.bac_private),
    };
  }
  if (entityType === "drink") {
    return {
      ...common, tripId, name: text(row, "name"), category: text(row, "category") as Drink["category"], icon: text(row, "icon"), isAlcohol: Boolean(row.is_alcohol), isSystem: Boolean(row.is_system), sortOrder: Number(row.sort_order ?? 0),
      servingVolumeMl: numberOrNull(row, "serving_volume_ml"), abvPercent: numberOrNull(row, "abv_percent"), alcoholComponents: componentsOrNull(row.alcohol_components), compositionConfirmed: Boolean(row.composition_confirmed), priceCents: numberOrNull(row, "price_cents"),
    };
  }
  if (entityType === "drinkEntry") {
    return {
      ...common, tripId, participantId: text(row, "participant_id"), drinkId: text(row, "drink_id"), consumedAt: text(row, "consumed_at"), actionBy: text(row, "action_by"), deviceId: text(row, "device_id"), roundId: nullable(row, "round_id"),
      alcoholGrams: numberOrNull(row, "alcohol_grams"), drinkNameSnapshot: nullable(row, "drink_name_snapshot"), paidBy: nullable(row, "paid_by"), priceCentsSnapshot: numberOrNull(row, "price_cents_snapshot"),
    };
  }
  return { ...common, tripId, participantId: text(row, "participant_id"), consumedAt: text(row, "consumed_at"), actionBy: text(row, "action_by"), deviceId: text(row, "device_id"), roundId: nullable(row, "round_id") };
}
