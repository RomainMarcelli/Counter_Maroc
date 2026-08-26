import type { Drink, DrinkEntry, EntityType, Participant, Trip, WaterEntry } from "@/domain/types";

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

export function toRemote(entityType: EntityType, value: Trip | Participant | Drink | DrinkEntry | WaterEntry, authUserId: string): RemoteRow {
  if (entityType === "trip") {
    const entity = value as Trip;
    return { ...base(entity), name: entity.name, share_code: entity.shareCode, start_date: entity.startDate, end_date: entity.endDate, timezone: entity.timezone, created_by: authUserId };
  }
  const entity = value as Participant | Drink | DrinkEntry | WaterEntry;
  if (entityType === "participant") {
    const participant = entity as Participant;
    return { ...base(participant), trip_id: participant.tripId, name: participant.name, avatar_url: participant.avatarUrl, color_index: participant.colorIndex, sort_order: participant.sortOrder };
  }
  if (entityType === "drink") {
    const drink = entity as Drink;
    return { ...base(drink), trip_id: drink.tripId, name: drink.name, category: drink.category, icon: drink.icon, is_alcohol: drink.isAlcohol, is_system: drink.isSystem, sort_order: drink.sortOrder };
  }
  if (entityType === "drinkEntry") {
    const entry = entity as DrinkEntry;
    return { ...base(entry), trip_id: entry.tripId, participant_id: entry.participantId, drink_id: entry.drinkId, consumed_at: entry.consumedAt, action_by: authUserId, device_id: entry.deviceId, round_id: entry.roundId };
  }
  const entry = entity as WaterEntry;
  return { ...base(entry), trip_id: entry.tripId, participant_id: entry.participantId, consumed_at: entry.consumedAt, action_by: authUserId, device_id: entry.deviceId, round_id: entry.roundId };
}

const text = (row: RemoteRow, key: string) => String(row[key] ?? "");
const nullable = (row: RemoteRow, key: string) => (row[key] ? String(row[key]) : null);

export function fromRemote(entityType: EntityType, row: RemoteRow): Trip | Participant | Drink | DrinkEntry | WaterEntry {
  const common = { id: text(row, "id"), createdAt: text(row, "created_at"), updatedAt: text(row, "updated_at"), deletedAt: nullable(row, "deleted_at") };
  if (entityType === "trip") {
    return { ...common, tripId: common.id, name: text(row, "name"), shareCode: text(row, "share_code"), startDate: text(row, "start_date"), endDate: text(row, "end_date"), timezone: text(row, "timezone"), createdBy: text(row, "created_by") };
  }
  const tripId = text(row, "trip_id");
  if (entityType === "participant") return { ...common, tripId, name: text(row, "name"), avatarUrl: nullable(row, "avatar_url"), colorIndex: Number(row.color_index ?? 0), sortOrder: Number(row.sort_order ?? 0) };
  if (entityType === "drink") return { ...common, tripId, name: text(row, "name"), category: text(row, "category") as Drink["category"], icon: text(row, "icon"), isAlcohol: Boolean(row.is_alcohol), isSystem: Boolean(row.is_system), sortOrder: Number(row.sort_order ?? 0) };
  if (entityType === "drinkEntry") return { ...common, tripId, participantId: text(row, "participant_id"), drinkId: text(row, "drink_id"), consumedAt: text(row, "consumed_at"), actionBy: text(row, "action_by"), deviceId: text(row, "device_id"), roundId: nullable(row, "round_id") };
  return { ...common, tripId, participantId: text(row, "participant_id"), consumedAt: text(row, "consumed_at"), actionBy: text(row, "action_by"), deviceId: text(row, "device_id"), roundId: nullable(row, "round_id") };
}
