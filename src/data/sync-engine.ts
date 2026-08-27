import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { db } from "./database";
import { isRemoteNewer, retryDelayMs } from "./queue";
import { fromRemote, TABLE_BY_ENTITY, toRemote } from "./sync-mappers";
import { getSupabase } from "./supabase";
import { authErrorMessage, currentUserId, isAuthorizationError } from "./auth";
import type { EntityBase, EntityType, Participant, SyncOperation, Trip } from "@/domain/types";

const PRIORITY: Record<EntityType, number> = { trip: 0, participant: 1, drink: 2, drinkEntry: 3, waterEntry: 3, challenge: 4, forfeit: 4, tripPhoto: 4 };
const SYNCED_ENTITIES: EntityType[] = ["trip", "participant", "drink", "drinkEntry", "waterEntry", "challenge", "forfeit", "tripPhoto"];

/**
 * Un refus d’autorisation ne se résout pas en réessayant : on espace fortement la
 * reprise automatique au lieu de marteler une requête interdite. La reprise
 * immédiate reste possible en touchant l’indicateur ou en changeant de session.
 */
const AUTHORIZATION_RETRY_MS = 5 * 60_000;

export type SyncErrorKind = "auth" | "membership" | "network" | "";

function announce(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("marrakech-sync"));
}

async function localEntity(entityType: EntityType, id: string): Promise<EntityBase | undefined> {
  if (entityType === "trip") return db.trips.get(id);
  if (entityType === "participant") return db.participants.get(id);
  if (entityType === "drink") return db.drinks.get(id);
  if (entityType === "drinkEntry") return db.drinkEntries.get(id);
  if (entityType === "waterEntry") return db.waterEntries.get(id);
  if (entityType === "challenge") return db.challenges.get(id);
  if (entityType === "forfeit") return db.forfeits.get(id);
  return db.tripPhotos.get(id);
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
  else if (entityType === "waterEntry") await db.waterEntries.put(remote as never);
  else if (entityType === "challenge") await db.challenges.put(remote as never);
  else if (entityType === "forfeit") await db.forfeits.put(remote as never);
  else await db.tripPhotos.put(remote as never);
  if (queued) await db.syncQueue.delete(queued.id);
}

async function recordError(kind: SyncErrorKind, message: string): Promise<void> {
  await db.settings.put({ key: "syncErrorKind", value: kind });
  await db.settings.put({ key: "syncError", value: message });
}

async function clearError(): Promise<void> {
  await db.settings.delete("syncErrorKind");
  await db.settings.delete("syncError");
}

class SyncEngine {
  private userId: string | null = null;
  /** Faux en mode démonstration ou sans Supabase : rien ne doit partir sur le réseau. */
  private enabled = true;
  private running = false;
  private started = false;
  private channels: RealtimeChannel[] = [];
  private subscribedTripId: string | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private resumeTimer: ReturnType<typeof setTimeout> | null = null;
  /** Séjours dont le membership serveur est confirmé, par utilisateur. */
  private membership = new Map<string, string>();

  start(): void {
    if (this.started || typeof window === "undefined") return;
    this.started = true;
    window.addEventListener("online", this.onOnline);
    window.addEventListener("focus", this.onResume);
    window.addEventListener("pageshow", this.onResume);
    window.addEventListener("marrakech-local-change", this.onLocalChange);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
  }

  stop(): void {
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.onOnline);
      window.removeEventListener("focus", this.onResume);
      window.removeEventListener("pageshow", this.onResume);
      window.removeEventListener("marrakech-local-change", this.onLocalChange);
      document.removeEventListener("visibilitychange", this.onVisibilityChange);
    }
    this.unsubscribe();
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.resumeTimer) clearTimeout(this.resumeTimer);
    this.retryTimer = null;
    this.resumeTimer = null;
    this.started = false;
  }

  /**
   * Appelé par l’AuthProvider. Tant qu’aucune session n’est connue, rien n’est
   * poussé : c’est ce qui produisait les 403 en boucle du temps de l’auth anonyme.
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setUser(userId: string | null): void {
    if (this.userId === userId) return;
    this.userId = userId;
    this.membership.clear();
    if (!userId) {
      this.unsubscribe();
      void clearError().then(announce);
      return;
    }
    void this.flush();
  }

  getUserId(): string | null {
    return this.userId;
  }

  private onLocalChange = (): void => {
    void this.flush();
  };

  private onOnline = (): void => {
    this.resumeSync();
  };

  private onVisibilityChange = (): void => {
    if (document.visibilityState === "visible") this.onResume();
  };

  private onResume = (): void => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    this.resumeSync();
  };

  /**
   * Safari iOS peut suspendre les sockets Realtime quand la PWA passe en arrière-plan.
   * À la reprise on recrée les canaux, on relit le séjour et on vide la file. Les
   * événements de reprise arrivant souvent ensemble, un court délai évite les doublons.
   */
  private resumeSync(): void {
    if (!this.enabled || !this.userId || (typeof navigator !== "undefined" && !navigator.onLine)) return;
    if (this.resumeTimer) clearTimeout(this.resumeTimer);
    this.resumeTimer = setTimeout(() => {
      this.resumeTimer = null;
      const tripId = this.subscribedTripId;
      if (tripId) {
        this.subscribe(tripId, true);
        void this.pullTrip(tripId).catch(() => undefined);
      }
      void this.flush({ immediate: true });
    }, 150);
  };

  flush = async (options: { immediate?: boolean } = {}): Promise<void> => {
    const client = getSupabase();
    if (!this.enabled || this.running || !client) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    // La session peut avoir été restaurée après le démarrage : on la relit avant de pousser.
    this.userId ??= await currentUserId();
    if (!this.userId) {
      await recordError("auth", "Connecte-toi pour synchroniser le séjour.");
      announce();
      return;
    }

    this.running = true;
    try {
      const timestamp = new Date().toISOString();
      const operations = (await db.syncQueue.toArray())
        .filter((operation) => options.immediate || !operation.nextAttemptAt || operation.nextAttemptAt <= timestamp)
        .sort((a, b) => PRIORITY[a.entityType] - PRIORITY[b.entityType] || a.createdAt.localeCompare(b.createdAt));

      const byTrip = new Map<string, SyncOperation[]>();
      for (const operation of operations) {
        const bucket = byTrip.get(operation.tripId);
        if (bucket) bucket.push(operation);
        else byTrip.set(operation.tripId, [operation]);
      }

      let failure: { kind: SyncErrorKind; message: string } | null = null;
      for (const [tripId, tripOperations] of byTrip) {
        try {
          // Rien n’est poussé avant que le membership serveur soit confirmé :
          // sans lui, chaque insertion se heurterait à la RLS.
          await this.ensureTripReady(client, this.userId, tripId);
        } catch (error) {
          failure = {
            kind: isAuthorizationError(error) ? "membership" : "network",
            message: authErrorMessage(error),
          };
          await this.delayTrip(tripOperations, failure.message, isAuthorizationError(error));
          continue;
        }
        for (const operation of tripOperations) {
          const result = await this.pushOperation(client, operation);
          if (result) failure ??= result;
        }
      }

      if (failure) await recordError(failure.kind, failure.message);
      else {
        await clearError();
        await db.settings.put({ key: "syncLastSuccessAt", value: new Date().toISOString() });
      }
    } catch (error) {
      await recordError(isAuthorizationError(error) ? "auth" : "network", authErrorMessage(error));
    } finally {
      this.running = false;
      announce();
      await this.scheduleRetry();
    }
  };

  /** Confirme (ou crée) le séjour côté serveur avant toute écriture de son contenu. */
  private async ensureTripReady(client: SupabaseClient, userId: string, tripId: string): Promise<void> {
    if (this.membership.get(tripId) === userId) return;

    const { data, error } = await client
      .from("trip_members")
      .select("trip_id")
      .eq("trip_id", tripId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      this.membership.set(tripId, userId);
      return;
    }

    const trip = await db.trips.get(tripId);
    if (!trip) throw new Error("Ce séjour n’existe plus sur ce téléphone.");

    // Séjour créé ici et jamais poussé : trip + membership owner + participant
    // sont créés en une seule transaction côté serveur.
    const participant = await this.ownerParticipant(tripId, userId);
    const { error: rpcError } = await client.rpc("create_trip_with_owner", {
      p_trip_id: trip.id,
      p_name: trip.name,
      p_share_code: trip.shareCode,
      p_start_date: trip.startDate,
      p_end_date: trip.endDate,
      p_timezone: trip.timezone,
      p_participant_id: participant.id,
      p_participant_name: participant.name,
      p_created_at: trip.createdAt,
      p_updated_at: trip.updatedAt,
    });
    if (rpcError) throw rpcError;
    this.membership.set(tripId, userId);
    await this.adoptServerShareCode(client, trip);
  }

  /**
   * Le RPC retire un code de partage déjà utilisé par un autre séjour. Dans ce cas
   * le téléphone doit adopter celui qui a réellement été enregistré, sinon il
   * repousserait indéfiniment le code en collision.
   */
  private async adoptServerShareCode(client: SupabaseClient, trip: Trip): Promise<void> {
    const { data } = await client.from("trips").select("share_code").eq("id", trip.id).maybeSingle();
    const shareCode = data?.share_code as string | undefined;
    if (!shareCode || shareCode === trip.shareCode) return;
    await db.trips.update(trip.id, { shareCode });
    const queued = await db.syncQueue.get(`trip:${trip.id}`);
    if (queued) await db.syncQueue.put({ ...queued, payload: { ...(queued.payload as Trip), shareCode } as EntityBase });
  }

  private async ownerParticipant(tripId: string, userId: string): Promise<Pick<Participant, "id" | "name">> {
    const participants = await db.participants.where("tripId").equals(tripId).toArray();
    const mine = participants.find((participant) => participant.userId === userId && !participant.deletedAt);
    const fallback = participants.find((participant) => !participant.deletedAt);
    const chosen = mine ?? fallback;
    if (!chosen) throw new Error("Ce séjour n’a aucun participant à rattacher au compte.");
    return { id: chosen.id, name: chosen.name };
  }

  private async delayTrip(operations: SyncOperation[], message: string, authorization: boolean): Promise<void> {
    const nextAttemptAt = new Date(Date.now() + (authorization ? AUTHORIZATION_RETRY_MS : 30_000)).toISOString();
    // On ne consomme pas de tentative : l’échec porte sur le séjour, pas sur chaque verre.
    await Promise.all(operations.map((operation) => db.syncQueue.update(operation.id, {
      status: "failed",
      lastError: message,
      nextAttemptAt,
    })));
  }

  private async pushOperation(client: SupabaseClient, operation: SyncOperation): Promise<{ kind: SyncErrorKind; message: string } | null> {
    // La file a pu être corrigée depuis sa lecture — par exemple le code de partage
    // arbitré par le serveur. On pousse toujours la version la plus fraîche.
    const current = (await db.syncQueue.get(operation.id)) ?? operation;
    await db.syncQueue.update(operation.id, { status: "syncing", lastError: null });
    announce();
    try {
      const payload = toRemote(current.entityType, current.payload as never);
      const { error } = await client.from(TABLE_BY_ENTITY[current.entityType]).upsert(payload, { onConflict: "id" });
      if (error) throw error;
      await db.syncQueue.delete(operation.id);
      return null;
    } catch (error) {
      const authorization = isAuthorizationError(error);
      const message = authErrorMessage(error);
      const attempts = current.attempts + 1;
      await db.syncQueue.update(operation.id, {
        status: "failed",
        attempts,
        lastError: message,
        nextAttemptAt: new Date(Date.now() + (authorization ? AUTHORIZATION_RETRY_MS : retryDelayMs(attempts))).toISOString(),
      });
      return { kind: authorization ? "auth" : "network", message };
    }
  }

  private async scheduleRetry(): Promise<void> {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    if (!this.userId) return;
    const queued = await db.syncQueue.toArray();
    const next = queued.map((operation) => operation.nextAttemptAt).filter((value): value is string => Boolean(value)).sort()[0];
    if (!next) return;
    const delay = Math.max(1_000, Date.parse(next) - Date.now());
    this.retryTimer = setTimeout(() => void this.flush(), delay);
  }

  unsubscribe(): void {
    const client = getSupabase();
    this.channels.forEach((channel) => void client?.removeChannel(channel));
    this.channels = [];
    this.subscribedTripId = null;
  }

  subscribe(tripId: string, force = false): void {
    const client = getSupabase();
    if (!client || !this.userId) return;
    if (!force && this.subscribedTripId === tripId && this.channels.length) return;
    this.unsubscribe();
    this.subscribedTripId = tripId;
    for (const entityType of SYNCED_ENTITIES) {
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

  async pullTrip(tripId: string): Promise<void> {
    const client = getSupabase();
    if (!client || (typeof navigator !== "undefined" && !navigator.onLine)) return;
    this.userId ??= await currentUserId();
    if (!this.userId) return;
    try {
      for (const entityType of SYNCED_ENTITIES) {
        const query = client.from(TABLE_BY_ENTITY[entityType]).select("*");
        const { data: rows, error } = entityType === "trip" ? await query.eq("id", tripId) : await query.eq("trip_id", tripId);
        if (error) throw error;
        for (const row of rows ?? []) await mergeRemote(entityType, row);
      }

      // Une lecture distante réussie acquitte une ancienne panne réseau seulement si
      // aucune écriture locale n'est encore en échec.
      const [storedKind, failed] = await Promise.all([
        db.settings.get("syncErrorKind"),
        db.syncQueue.where("status").equals("failed").count(),
      ]);
      if (storedKind?.value === "network" && failed === 0) await clearError();
      await db.settings.put({ key: "syncLastSuccessAt", value: new Date().toISOString() });
    } catch (error) {
      await recordError(isAuthorizationError(error) ? "membership" : "network", authErrorMessage(error));
      announce();
      throw error;
    }
    announce();
  }

  /** Séjours du compte connecté, pour rouvrir directement le bon au lancement. */
  async listMyTrips(): Promise<Array<{ tripId: string; name: string; shareCode: string; role: string }>> {
    const client = getSupabase();
    if (!client) return [];
    const { data, error } = await client.rpc("my_trips");
    if (error) throw error;
    return (data ?? []).map((row: Record<string, unknown>) => ({
      tripId: String(row.trip_id),
      name: String(row.name),
      shareCode: String(row.share_code),
      role: String(row.role),
    }));
  }

  async joinTrip(shareCode: string): Promise<{ tripId: string; name: string }> {
    const client = getSupabase();
    if (!client) throw new Error("Configurez Supabase pour rejoindre un séjour partagé.");
    this.userId ??= await currentUserId();
    if (!this.userId) throw new Error("Connecte-toi avant de rejoindre un séjour.");
    const { data, error } = await client.rpc("join_trip_by_code", { p_share_code: shareCode.trim().toUpperCase() });
    if (error) throw error;
    const result = data as { trip_id: string; name: string };
    this.membership.set(result.trip_id, this.userId);
    await this.pullTrip(result.trip_id);
    await db.settings.put({ key: "activeTripId", value: result.trip_id });
    this.subscribe(result.trip_id);
    return { tripId: result.trip_id, name: result.name };
  }

  /** Rattache le compte connecté à un participant existant du séjour. */
  async claimParticipant(participantId: string): Promise<void> {
    const client = getSupabase();
    if (!client) throw new Error("Configurez Supabase pour rejoindre un séjour partagé.");
    const { error } = await client.rpc("claim_participant", { p_participant_id: participantId });
    if (error) throw error;
  }
}

export const syncEngine = new SyncEngine();

export function notifyLocalChange(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("marrakech-local-change"));
}
