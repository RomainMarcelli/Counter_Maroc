"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/data/database";
import { bootstrapDemoIfEnabled, getActiveTripId } from "@/data/repository";
import { syncEngine } from "@/data/sync-engine";
import { useAuth } from "./auth-provider";
import type { Challenge, Drink, DrinkEntry, Forfeit, Participant, SyncOperation, Trip, TripPhoto, WaterEntry } from "@/domain/types";

interface TripContextValue {
  ready: boolean;
  trip: Trip | null;
  participants: Participant[];
  activeParticipants: Participant[];
  drinks: Drink[];
  activeDrinks: Drink[];
  drinkEntries: DrinkEntry[];
  waterEntries: WaterEntry[];
  challenges: Challenge[];
  forfeits: Forfeit[];
  tripPhotos: TripPhoto[];
  queue: SyncOperation[];
  /** Identifiant du participant que le compte connecté incarne dans ce séjour. */
  actorId: string | null;
  /** Identifiant du compte connecté : c’est lui qui signe `actionBy`. */
  authorId: string | null;
  selectedParticipantIds: string[];
  setSelectedParticipantIds: React.Dispatch<React.SetStateAction<string[]>>;
  refreshActiveTrip: () => Promise<void>;
}

const TripContext = createContext<TripContextValue | null>(null);

export function TripProvider({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const [ready, setReady] = useState(false);
  const [activeTripId, setActiveTripIdState] = useState<string | null>(null);
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const trip = useLiveQuery(() => (activeTripId ? db.trips.get(activeTripId) : undefined), [activeTripId]);
  const participants = useLiveQuery(() => (activeTripId ? db.participants.where("tripId").equals(activeTripId).sortBy("sortOrder") : []), [activeTripId], []);
  const drinks = useLiveQuery(() => (activeTripId ? db.drinks.where("tripId").equals(activeTripId).sortBy("sortOrder") : []), [activeTripId], []);
  const drinkEntries = useLiveQuery(() => (activeTripId ? db.drinkEntries.where("tripId").equals(activeTripId).toArray() : []), [activeTripId], []);
  const waterEntries = useLiveQuery(() => (activeTripId ? db.waterEntries.where("tripId").equals(activeTripId).toArray() : []), [activeTripId], []);
  const challenges = useLiveQuery(() => (activeTripId ? db.challenges.where("tripId").equals(activeTripId).toArray() : []), [activeTripId], []);
  const forfeits = useLiveQuery(() => (activeTripId ? db.forfeits.where("tripId").equals(activeTripId).toArray() : []), [activeTripId], []);
  const tripPhotos = useLiveQuery(() => (activeTripId ? db.tripPhotos.where("tripId").equals(activeTripId).toArray() : []), [activeTripId], []);
  const queue = useLiveQuery(() => (activeTripId ? db.syncQueue.where("tripId").equals(activeTripId).toArray() : []), [activeTripId], []);
  const authorId = useLiveQuery(() => db.settings.get("authUserId").then((setting) => setting?.value ?? null), [], null);

  const refreshActiveTrip = async () => setActiveTripIdState(await getActiveTripId());

  // Le séjour local n’est lu qu’une fois la session connue : sans compte, il n’y a
  // rien à ouvrir, et surtout rien à pousser.
  useEffect(() => {
    if (status === "loading") return;
    let cancelled = false;
    void bootstrapDemoIfEnabled().then(async () => {
      if (cancelled) return;
      await refreshActiveTrip();
      if (!cancelled) setReady(true);
    });
    return () => { cancelled = true; };
  }, [status]);

  useEffect(() => {
    if (!activeTripId || status !== "authenticated") return;
    syncEngine.subscribe(activeTripId);
    void syncEngine.pullTrip(activeTripId).catch(() => undefined);
  }, [activeTripId, status, authorId]);

  const activeParticipants = useMemo(() => participants.filter((item) => !item.deletedAt), [participants]);
  const activeDrinks = useMemo(() => drinks.filter((item) => !item.deletedAt), [drinks]);
  const actorId = useMemo(
    () => (authorId ? activeParticipants.find((participant) => participant.userId === authorId)?.id ?? null : null),
    [activeParticipants, authorId],
  );

  useEffect(() => {
    setSelectedParticipantIds((current) => {
      const valid = current.filter((id) => activeParticipants.some((participant) => participant.id === id));
      if (valid.length) return valid;
      // À l’ouverture, on présélectionne la personne qui tient le téléphone.
      const mine = activeParticipants.find((participant) => participant.id === actorId);
      const first = mine ?? activeParticipants[0];
      return first ? [first.id] : [];
    });
  }, [activeParticipants, actorId]);

  const value = useMemo<TripContextValue>(() => ({
    ready,
    trip: trip ?? null,
    participants,
    activeParticipants,
    drinks,
    activeDrinks,
    drinkEntries,
    waterEntries,
    challenges,
    forfeits,
    tripPhotos,
    queue,
    actorId,
    authorId,
    selectedParticipantIds,
    setSelectedParticipantIds,
    refreshActiveTrip,
  }), [ready, trip, participants, activeParticipants, drinks, activeDrinks, drinkEntries, waterEntries, challenges, forfeits, tripPhotos, queue, actorId, authorId, selectedParticipantIds]);

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip(): TripContextValue {
  const value = useContext(TripContext);
  if (!value) throw new Error("useTrip doit être utilisé dans TripProvider");
  return value;
}
