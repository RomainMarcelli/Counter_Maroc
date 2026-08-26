import { SYSTEM_DRINKS, TRIP_TIMEZONE } from "@/domain/constants";
import { calculateDrinkAlcoholGrams } from "@/domain/bac";
import type { Drink, DrinkEntry, LocalSnapshot, Participant, Trip, WaterEntry } from "@/domain/types";

const uuid = (suffix: number) => `00000000-0000-4000-8000-${suffix.toString().padStart(12, "0")}`;

export function demoSnapshot(): LocalSnapshot {
  const createdAt = "2026-09-07T10:00:00.000Z";
  const tripId = uuid(1);
  const trip: Trip = {
    id: tripId,
    tripId,
    name: "Marrakech 2026",
    shareCode: "MAROC-26-X7K4",
    startDate: "2026-09-07",
    endDate: "2026-09-16",
    timezone: TRIP_TIMEZONE,
    createdBy: uuid(90),
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
  };
  const names = ["Romain", "Lucas", "Théo", "Max"];
  const participants: Participant[] = names.map((name, index) => ({
    id: uuid(100 + index),
    tripId,
    name,
    avatarUrl: null,
    colorIndex: index,
    sortOrder: index,
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
    bacEnabled: index === 0,
    weightKg: index === 0 ? 78 : null,
    distributionRatio: index === 0 ? 0.68 : null,
    bacPrivate: false,
  }));
  const drinks: Drink[] = SYSTEM_DRINKS.map((drink, index) => ({
    id: uuid(200 + index),
    tripId,
    ...drink,
    alcoholComponents: drink.alcoholComponents ? drink.alcoholComponents.map((component) => ({ ...component })) : null,
    compositionConfirmed: false,
    priceCents: 4500 + (index % 5) * 1000,
    isAlcohol: true,
    isSystem: true,
    sortOrder: index,
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
  }));
  const drinkEntries: DrinkEntry[] = [];
  const waterEntries: WaterEntry[] = [];
  let entryCounter = 1000;
  for (let day = 0; day < 6; day += 1) {
    const entriesForDay = 5 + day * 2;
    for (let index = 0; index < entriesForDay; index += 1) {
      const participant = participants[(index + day) % participants.length];
      const favorites = [8, 0, 11, 7, 8, 0, 4, 10];
      const drink = drinks[favorites[(index + participant.sortOrder) % favorites.length]];
      const hour = 18 + ((index + day) % 6);
      const consumedAt = new Date(Date.UTC(2026, 8, 7 + day, hour, (index * 7) % 60)).toISOString();
      drinkEntries.push({
        id: uuid(entryCounter++),
        tripId,
        participantId: participant.id,
        drinkId: drink.id,
        consumedAt,
        actionBy: uuid(90),
        deviceId: uuid(91),
        roundId: index % 5 === 0 ? uuid(5000 + day) : null,
        createdAt: consumedAt,
        updatedAt: consumedAt,
        deletedAt: null,
        alcoholGrams: calculateDrinkAlcoholGrams(drink),
        drinkNameSnapshot: drink.name,
        paidBy: participants[day % participants.length].id,
        priceCentsSnapshot: drink.priceCents,
      });
    }
    for (let index = 0; index < 4 + day; index += 1) {
      const participant = participants[(index + day * 2) % participants.length];
      const consumedAt = new Date(Date.UTC(2026, 8, 7 + day, 12 + (index % 10), index * 5)).toISOString();
      waterEntries.push({
        id: uuid(entryCounter++),
        tripId,
        participantId: participant.id,
        consumedAt,
        actionBy: uuid(90),
        deviceId: uuid(91),
        roundId: null,
        createdAt: consumedAt,
        updatedAt: consumedAt,
        deletedAt: null,
      });
    }
  }
  return { trip, participants, drinks, drinkEntries, waterEntries };
}
