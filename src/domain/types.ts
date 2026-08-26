export type DrinkCategory = "beer" | "wine" | "spirit" | "cocktail";
export type EntityType = "trip" | "participant" | "drink" | "drinkEntry" | "waterEntry";
export type QueueStatus = "pending" | "syncing" | "failed";

export interface EntityBase {
  id: string;
  tripId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface Trip extends Omit<EntityBase, "tripId"> {
  tripId: string;
  name: string;
  shareCode: string;
  startDate: string;
  endDate: string;
  timezone: string;
  createdBy: string;
}

export interface Participant extends EntityBase {
  name: string;
  avatarUrl: string | null;
  colorIndex: number;
  sortOrder: number;
}

export interface Drink extends EntityBase {
  name: string;
  category: DrinkCategory;
  icon: string;
  isAlcohol: boolean;
  isSystem: boolean;
  sortOrder: number;
}

export interface DrinkEntry extends EntityBase {
  participantId: string;
  drinkId: string;
  consumedAt: string;
  actionBy: string;
  deviceId: string;
  roundId: string | null;
}

export interface WaterEntry extends EntityBase {
  participantId: string;
  consumedAt: string;
  actionBy: string;
  deviceId: string;
  roundId: string | null;
}

export interface SyncOperation {
  id: string;
  tripId: string;
  entityType: EntityType;
  entityId: string;
  action: "upsert";
  payload: EntityBase;
  createdAt: string;
  updatedAt: string;
  status: QueueStatus;
  attempts: number;
  nextAttemptAt: string | null;
  lastError: string | null;
}

export interface LocalSetting {
  key: string;
  value: string;
}

export interface LocalSnapshot {
  trip: Trip;
  participants: Participant[];
  drinks: Drink[];
  drinkEntries: DrinkEntry[];
  waterEntries: WaterEntry[];
}

export interface UndoBatch {
  drinkEntryIds: string[];
  waterEntryIds: string[];
}
