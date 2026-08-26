"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/data/database";
import { bootstrapDemoIfEnabled, getActiveTripId } from "@/data/repository";
import { syncEngine } from "@/data/sync-engine";
import type { Drink, DrinkEntry, Participant, SyncOperation, Trip, WaterEntry } from "@/domain/types";

interface TripContextValue {
  ready: boolean;
  trip: Trip | null;
  participants: Participant[];
  activeParticipants: Participant[];
  drinks: Drink[];
  activeDrinks: Drink[];
  drinkEntries: DrinkEntry[];
  waterEntries: WaterEntry[];
  queue: SyncOperation[];
  actorId: string | null;
  selectedParticipantIds: string[];
  setSelectedParticipantIds: React.Dispatch<React.SetStateAction<string[]>>;
  refreshActiveTrip: () => Promise<void>;
}

const TripContext = createContext<TripContextValue | null>(null);

export function TripProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [activeTripId, setActiveTripIdState] = useState<string | null>(null);
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const trip = useLiveQuery(() => (activeTripId ? db.trips.get(activeTripId) : undefined), [activeTripId]);
  const participants = useLiveQuery(() => (activeTripId ? db.participants.where("tripId").equals(activeTripId).sortBy("sortOrder") : []), [activeTripId], []);
  const drinks = useLiveQuery(() => (activeTripId ? db.drinks.where("tripId").equals(activeTripId).sortBy("sortOrder") : []), [activeTripId], []);
  const drinkEntries = useLiveQuery(() => (activeTripId ? db.drinkEntries.where("tripId").equals(activeTripId).toArray() : []), [activeTripId], []);
  const waterEntries = useLiveQuery(() => (activeTripId ? db.waterEntries.where("tripId").equals(activeTripId).toArray() : []), [activeTripId], []);
  const queue = useLiveQuery(() => (activeTripId ? db.syncQueue.where("tripId").equals(activeTripId).toArray() : []), [activeTripId], []);
  const actorId = useLiveQuery(() => db.settings.get("actorId").then((setting) => setting?.value ?? null), [], null);

  const refreshActiveTrip = async () => setActiveTripIdState(await getActiveTripId());

  useEffect(() => {
    void bootstrapDemoIfEnabled().then(async () => {
      await refreshActiveTrip();
      setReady(true);
    });
    syncEngine.start();
    return () => syncEngine.stop();
  }, []);

  useEffect(() => {
    if (!activeTripId) return;
    syncEngine.subscribe(activeTripId);
    void syncEngine.pullTrip(activeTripId).catch(() => undefined);
  }, [activeTripId]);

  const activeParticipants = useMemo(() => participants.filter((item) => !item.deletedAt), [participants]);
  const activeDrinks = useMemo(() => drinks.filter((item) => !item.deletedAt), [drinks]);

  useEffect(() => {
    setSelectedParticipantIds((current) => {
      const valid = current.filter((id) => activeParticipants.some((participant) => participant.id === id));
      return valid.length ? valid : activeParticipants[0] ? [activeParticipants[0].id] : [];
    });
  }, [activeParticipants]);

  const value = useMemo<TripContextValue>(() => ({
    ready,
    trip: trip ?? null,
    participants,
    activeParticipants,
    drinks,
    activeDrinks,
    drinkEntries,
    waterEntries,
    queue,
    actorId,
    selectedParticipantIds,
    setSelectedParticipantIds,
    refreshActiveTrip,
  }), [ready, trip, participants, activeParticipants, drinks, activeDrinks, drinkEntries, waterEntries, queue, actorId, selectedParticipantIds]);

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip(): TripContextValue {
  const value = useContext(TripContext);
  if (!value) throw new Error("useTrip doit être utilisé dans TripProvider");
  return value;
}
