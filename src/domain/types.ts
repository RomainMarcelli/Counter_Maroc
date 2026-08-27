import type { AlcoholComponent } from "./bac/types";

export type { AlcoholComponent };

export type DrinkCategory = "beer" | "wine" | "spirit" | "cocktail";
export type EntityType = "trip" | "participant" | "drink" | "drinkEntry" | "waterEntry" | "challenge" | "forfeit" | "tripPhoto";
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
  /**
   * Compte Supabase rattaché à ce participant. `null` tant que la personne n’a pas
   * rejoint le séjour : quelqu’un peut ajouter « Lucas » avant que Lucas installe
   * l’application. Seul le RPC `claim_participant` renseigne ce champ.
   */
  userId: string | null;
  /** Estimation d’alcoolémie — facultatif, désactivé tant que la personne ne l’active pas. */
  bacEnabled: boolean;
  weightKg: number | null;
  /** Coefficient de répartition de Widmark. Seul ce nombre est stocké, jamais de donnée corporelle. */
  distributionRatio: number | null;
  /** Ne montrer l’estimation que sur le téléphone de la personne concernée. */
  bacPrivate: boolean;
}

export interface Drink extends EntityBase {
  name: string;
  category: DrinkCategory;
  icon: string;
  isAlcohol: boolean;
  isSystem: boolean;
  sortOrder: number;
  /** Volume du verre servi, en ml. */
  servingVolumeMl: number | null;
  /** Degré du verre entier, utilisé quand la boisson n’a pas de composants détaillés. */
  abvPercent: number | null;
  /** Alcools de la recette : un cocktail n’est jamais calculé sur son volume total. */
  alcoholComponents: AlcoholComponent[] | null;
  /** false tant que personne n’a validé la dose réellement servie. */
  compositionConfirmed: boolean;
  /** Prix unitaire pour l’addition du séjour, en centimes. */
  priceCents: number | null;
}

export interface DrinkEntry extends EntityBase {
  participantId: string;
  drinkId: string;
  consumedAt: string;
  actionBy: string;
  deviceId: string;
  roundId: string | null;
  /** Snapshot de l’alcool pur au moment du verre : modifier une recette ne réécrit pas le passé. */
  alcoholGrams: number | null;
  drinkNameSnapshot: string | null;
  /** Qui a payé ce verre (participant), pour l’addition. */
  paidBy: string | null;
  priceCentsSnapshot: number | null;
}

export interface WaterEntry extends EntityBase {
  participantId: string;
  consumedAt: string;
  actionBy: string;
  deviceId: string;
  roundId: string | null;
}

export type ChallengeScope = "individual" | "group";
export type ChallengePeriod = "day" | "trip";
export type ChallengeTarget =
  | "manual"
  | "water_count"
  | "drink_variety"
  | "no_spirits"
  | "water_after_13"
  | "new_cocktail"
  | "water_between_drinks"
  | "full_round"
  | "group_photo"
  | "category_variety"
  // Découverte et variété : jamais de vitesse ni de quantité.
  | "cocktail_variety"
  | "new_drink"
  | "all_categories"
  | "other_favorite"
  | "signature_drink"
  | "own_favorite"
  | "different_from_yesterday"
  | "same_cocktail_round";

export interface Challenge extends EntityBase {
  title: string;
  description: string;
  scope: ChallengeScope;
  period: ChallengePeriod;
  /** Clé locale YYYY-MM-DD de la journée 08h→08h, uniquement pour un challenge quotidien. */
  dayKey: string | null;
  targetType: ChallengeTarget;
  targetValue: number;
  /** null pour un challenge collectif ou attribué à tout le groupe. */
  participantId: string | null;
  reward: string | null;
  status: "active" | "completed" | "failed";
  completedAt: string | null;
  createdBy: string;
}

export interface Forfeit extends EntityBase {
  title: string;
  description: string;
  participantId: string | null;
  challengeId: string | null;
  status: "pending" | "completed";
  completedAt: string | null;
  createdBy: string;
}

export interface TripPhoto extends EntityBase {
  storagePath: string;
  takenAt: string;
  uploadedBy: string;
  caption: string | null;
}

/** File locale séparée : le blob optimisé ne transite jamais dans la file JSON de synchronisation. */
export interface PhotoUpload {
  id: string;
  tripId: string;
  kind: "avatar" | "memory";
  participantId: string | null;
  photoId: string | null;
  blob: Blob;
  extension: "webp" | "jpeg";
  takenAt: string;
  createdAt: string;
  status: "pending" | "uploading" | "failed";
  attempts: number;
  lastError: string | null;
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
  challenges: Challenge[];
  forfeits: Forfeit[];
  tripPhotos: TripPhoto[];
}

export interface UndoBatch {
  drinkEntryIds: string[];
  waterEntryIds: string[];
}
