import type { EntityBase, EntityType, SyncOperation } from "@/domain/types";

export function queueOperation(entityType: EntityType, entity: EntityBase, now = new Date().toISOString()): SyncOperation {
  return {
    id: `${entityType}:${entity.id}`,
    tripId: entity.tripId,
    entityType,
    entityId: entity.id,
    action: "upsert",
    payload: entity,
    createdAt: now,
    updatedAt: now,
    status: "pending",
    attempts: 0,
    nextAttemptAt: null,
    lastError: null,
  };
}

export function retryDelayMs(attempts: number): number {
  return Math.min(60_000, 1_000 * 2 ** Math.min(attempts, 6));
}

export function isRemoteNewer(localUpdatedAt: string | undefined, remoteUpdatedAt: string): boolean {
  return !localUpdatedAt || Date.parse(remoteUpdatedAt) > Date.parse(localUpdatedAt);
}
