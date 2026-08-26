import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { db } from "./database";
import { isRemoteNewer, retryDelayMs } from "./queue";
import { fromRemote, TABLE_BY_ENTITY, toRemote } from "./sync-mappers";
import { getSupabase } from "./supabase";
import type { EntityBase, EntityType, SyncOperation } from "@/domain/types";

const PRIORITY: Record<EntityType, number> = { trip: 0, participant: 1, drink: 2, drinkEntry: 3, waterEntry: 3 };

function announce(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("marrakech-sync"));
}

async function ensureAuth(client: SupabaseClient): Promise<string> {
  const { data } = await client.auth.getSession();
  if (data.session?.user.id) return data.session.user.id;
  const { data: signedIn, error } = await client.auth.signInAnonymously();
  if (error || !signedIn.user) throw error ?? new Error("Impossible de créer une session invitée");
  return signedIn.user.id;
}

async function localEntity(entityType: EntityType, id: string): Promise<EntityBase | undefined> {
  if (entityType === "trip") return db.trips.get(id);
  if (entityType === "participant") return db.participants.get(id);
  if (entityType === "drink") return db.drinks.get(id);
  if (entityType === "drinkEntry") return db.drinkEntries.get(id);
  return db.waterEntries.get(id);
}

async function mergeRemote(entityType: EntityType, row: Record<string, unknown>): Promise<void> {
  const remote = fromRemote(entityType, row);
  const local = await localEntity(entityType, remote.id);
  if (!isRemoteNewer(local?.updatedAt, remote.updatedAt)) return;
  const queued = await db.syncQueue.get(`${entityType}:${remote.id}`);
  if (queued && !isRemoteNewer(queued.updatedAt, remote.updatedAt)) return;
  if (entityType === "trip") await db.trips.put(remote as never);
  else if (entityType === "participant") await db.participants.put(remote as never);
  else if (entityType === "drink") await db.drinks.put(remote as never);
  else if (entityType === "drinkEntry") await db.drinkEntries.put(remote as never);
  else await db.waterEntries.put(remote as never);
  if (queued) await db.syncQueue.delete(queued.id);
}

class SyncEngine {
  private running = false;
  private started = false;
  private channels: RealtimeChannel[] = [];
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  start(): void {
    if (this.started || typeof window === "undefined") return;
    this.started = true;
    window.addEventListener("online", this.flush);
    window.addEventListener("marrakech-local-change", this.flush);
    void this.flush();
  }

  stop(): void {
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.flush);
      window.removeEventListener("marrakech-local-change", this.flush);
    }
    const client = getSupabase();
    this.channels.forEach((channel) => void client?.removeChannel(channel));
    this.channels = [];
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.started = false;
  }

  flush = async (): Promise<void> => {
    const client = getSupabase();
    if (this.running || !client || (typeof navigator !== "undefined" && !navigator.onLine)) return;
    this.running = true;
    try {
      const userId = await ensureAuth(client);
      await db.settings.delete("syncError");
      const timestamp = new Date().toISOString();
      const operations = (await db.syncQueue.toArray())
        .filter((operation) => !operation.nextAttemptAt || operation.nextAttemptAt <= timestamp)
        .sort((a, b) => PRIORITY[a.entityType] - PRIORITY[b.entityType] || a.createdAt.localeCompare(b.createdAt));
      for (const operation of operations) await this.pushOperation(client, userId, operation);
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "Erreur d’authentification Supabase";
      const message = rawMessage.toLowerCase().includes("anonymous sign-ins are disabled")
        ? "Activez les connexions anonymes dans Supabase Auth"
        : rawMessage;
      await db.settings.put({ key: "syncError", value: message });
      const operations = await db.syncQueue.toArray();
      const nextAttemptAt = new Date(Date.now() + 60_000).toISOString();
      await Promise.all(operations.map((operation) => db.syncQueue.update(operation.id, {
        status: "failed",
        lastError: message,
        nextAttemptAt,
      })));
    } finally {
      this.running = false;
      announce();
      await this.scheduleRetry();
    }
  };

  private async scheduleRetry(): Promise<void> {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    const queued = await db.syncQueue.toArray();
    const next = queued.map((operation) => operation.nextAttemptAt).filter((value): value is string => Boolean(value)).sort()[0];
    if (!next) return;
    const delay = Math.max(250, Date.parse(next) - Date.now());
    this.retryTimer = setTimeout(() => void this.flush(), delay);
  }

  private async pushOperation(client: SupabaseClient, userId: string, operation: SyncOperation): Promise<void> {
    await db.syncQueue.update(operation.id, { status: "syncing", lastError: null });
    announce();
    try {
      const payload = toRemote(operation.entityType, operation.payload as never, userId);
      const { error } = await client.from(TABLE_BY_ENTITY[operation.entityType]).upsert(payload, { onConflict: "id" });
      if (error) throw error;
      await db.syncQueue.delete(operation.id);
    } catch (error) {
      const attempts = operation.attempts + 1;
      await db.syncQueue.update(operation.id, {
        status: "failed",
        attempts,
        lastError: error instanceof Error ? error.message : "Erreur de synchronisation",
        nextAttemptAt: new Date(Date.now() + retryDelayMs(attempts)).toISOString(),
      });
    }
  }

  subscribe(tripId: string): void {
    const client = getSupabase();
    if (!client) return;
    this.channels.forEach((channel) => void client.removeChannel(channel));
    this.channels = [];
    const entities: EntityType[] = ["trip", "participant", "drink", "drinkEntry", "waterEntry"];
    for (const entityType of entities) {
      const table = TABLE_BY_ENTITY[entityType];
      const filter = entityType === "trip" ? `id=eq.${tripId}` : `trip_id=eq.${tripId}`;
      const channel = client
        .channel(`${table}:${tripId}`)
        .on("postgres_changes", { event: "*", schema: "public", table, filter }, (payload) => {
          void mergeRemote(entityType, payload.new as Record<string, unknown>).then(announce);
        })
        .subscribe();
      this.channels.push(channel);
    }
  }

  async joinTrip(shareCode: string): Promise<string> {
    const client = getSupabase();
    if (!client) throw new Error("Configurez Supabase pour rejoindre un séjour partagé.");
    const userId = await ensureAuth(client);
    const { data, error } = await client.rpc("join_trip_by_code", { p_share_code: shareCode.trim().toUpperCase() });
    if (error) throw error;
    const tripId = String(data);
    const tableTypes: EntityType[] = ["trip", "participant", "drink", "drinkEntry", "waterEntry"];
    for (const entityType of tableTypes) {
      const query = client.from(TABLE_BY_ENTITY[entityType]).select("*");
      const { data: rows, error: selectError } = entityType === "trip" ? await query.eq("id", tripId) : await query.eq("trip_id", tripId);
      if (selectError) throw selectError;
      for (const row of rows ?? []) await mergeRemote(entityType, row);
    }
    await db.settings.put({ key: "activeTripId", value: tripId });
    await db.settings.put({ key: "supabaseUserId", value: userId });
    this.subscribe(tripId);
    return tripId;
  }
}

export const syncEngine = new SyncEngine();

export function notifyLocalChange(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("marrakech-local-change"));
}
