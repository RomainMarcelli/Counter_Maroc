import type { Drink, DrinkEntry, Participant, Trip, TripPhoto, WaterEntry } from "./types";
import { calculateStats, type TripStats } from "./stats";
import { addCalendarDays, getTripDayKey, getTripDayRange, tripDayNumber } from "@/lib/trip-day";
import { deviceTimeZone, getZonedParts } from "@/lib/timezone";

export interface DailyRecap {
  dayKey: string;
  dayNumber: number;
  range: { start: string; end: string };
  stats: TripStats;
  photos: TripPhoto[];
  quirkyLine: string | null;
}

export function buildDailyRecap(
  dayKey: string,
  trip: Trip,
  participants: Participant[],
  drinks: Drink[],
  drinkEntries: DrinkEntry[],
  waterEntries: WaterEntry[],
  photos: TripPhoto[] = [],
  timezone = deviceTimeZone(),
): DailyRecap {
  const inDay = (timestamp: string) => getTripDayKey(timestamp, timezone) === dayKey;
  const dayDrinks = drinkEntries.filter((entry) => inDay(entry.consumedAt));
  const dayWaters = waterEntries.filter((entry) => inDay(entry.consumedAt));
  const dayPhotos = photos.filter((photo) => !photo.deletedAt && inDay(photo.takenAt)).sort((a, b) => a.takenAt.localeCompare(b.takenAt));
  const stats = calculateStats(trip, participants, drinks, dayDrinks, dayWaters);
  const explorer = stats.unusual.explorer;
  return {
    dayKey,
    dayNumber: tripDayNumber(dayKey, trip.startDate),
    range: getTripDayRange(dayKey, timezone),
    stats,
    photos: dayPhotos,
    quirkyLine: explorer ? `${explorer.name} a testé ${explorer.distinctDrinks} boisson${explorer.distinctDrinks > 1 ? "s" : ""} différente${explorer.distinctDrinks > 1 ? "s" : ""}.` : null,
  };
}

export function listDailyRecaps(
  trip: Trip,
  participants: Participant[],
  drinks: Drink[],
  drinkEntries: DrinkEntry[],
  waterEntries: WaterEntry[],
  photos: TripPhoto[] = [],
  timezone = deviceTimeZone(),
): DailyRecap[] {
  const keys = new Set<string>();
  drinkEntries.filter((entry) => !entry.deletedAt).forEach((entry) => keys.add(getTripDayKey(entry.consumedAt, timezone)));
  waterEntries.filter((entry) => !entry.deletedAt).forEach((entry) => keys.add(getTripDayKey(entry.consumedAt, timezone)));
  photos.filter((photo) => !photo.deletedAt).forEach((photo) => keys.add(getTripDayKey(photo.takenAt, timezone)));
  return [...keys].sort().reverse().map((key) => buildDailyRecap(key, trip, participants, drinks, drinkEntries, waterEntries, photos, timezone));
}

/** Après 09h locale, le récap proposé est toujours la journée de voyage précédente. */
export function recapPromptDay(now = new Date(), timezone = deviceTimeZone()): string | null {
  if (getZonedParts(now.toISOString(), timezone).hour < 9) return null;
  return addCalendarDays(getTripDayKey(now, timezone), -1);
}

export function shouldShowRecapPrompt(input: { candidateDay: string | null; lastSeenDay: string | null; dismissedDay: string | null; hasData: boolean }): boolean {
  return Boolean(input.candidateDay && input.hasData && input.candidateDay !== input.lastSeenDay && input.candidateDay !== input.dismissedDay);
}
