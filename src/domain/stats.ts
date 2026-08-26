import type { Drink, DrinkEntry, Participant, Trip, WaterEntry } from "./types";
import { formatDateKey, getZonedParts, zonedDayKey } from "@/lib/timezone";

export interface RankedValue {
  id: string;
  name: string;
  icon?: string;
  total: number;
  percentage: number;
  rank: number;
  averagePerDay: number;
}

export interface DayStat {
  date: string;
  total: number;
  percentage: number;
  rank: number;
  favoriteDrink: string | null;
  peakHour: number | null;
  water: number;
}

export interface Trophy {
  key: string;
  icon: string;
  label: string;
  winner: string;
  detail: string;
}

export interface TripStats {
  totalAlcohol: number;
  totalWater: number;
  averagePerDay: number;
  activeDays: number;
  distinctDrinks: number;
  peakHour: number | null;
  participants: RankedValue[];
  drinks: RankedValue[];
  hourly: number[];
  days: DayStat[];
  trophies: Trophy[];
  personalBreakdown: Record<string, RankedValue[]>;
}

function percentage(value: number, total: number): number {
  return total ? Math.round((value / total) * 100) : 0;
}

function rankCounts<T extends { id: string; name: string; icon?: string }>(
  items: T[],
  counts: Record<string, number>,
  total: number,
  activeDays: number,
): RankedValue[] {
  const ranked = items
    .map((item) => ({
      id: item.id,
      name: item.name,
      icon: item.icon,
      total: counts[item.id] ?? 0,
      percentage: percentage(counts[item.id] ?? 0, total),
      rank: 0,
      averagePerDay: activeDays ? Number(((counts[item.id] ?? 0) / activeDays).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  let currentRank = 0;
  ranked.forEach((item, index) => {
    if (index === 0 || ranked[index - 1].total !== item.total) currentRank = index + 1;
    item.rank = currentRank;
  });
  return ranked;
}

function modeKey(counts: Record<string, number>): string | null {
  return Object.entries(counts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;
}

function tripDateKeys(startDate: string, endDate: string): string[] {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  const keys: string[] = [];
  for (let cursor = start.getTime(); cursor <= end.getTime() && keys.length < 366; cursor += 86_400_000) {
    keys.push(new Date(cursor).toISOString().slice(0, 10));
  }
  return keys;
}

export function calculateStats(
  trip: Trip,
  participants: Participant[],
  drinks: Drink[],
  allEntries: DrinkEntry[],
  allWater: WaterEntry[],
): TripStats {
  const participantById = new Map(participants.map((item) => [item.id, item]));
  const drinkById = new Map(drinks.map((item) => [item.id, item]));
  const entries = allEntries.filter((entry) => !entry.deletedAt && participantById.has(entry.participantId) && drinkById.get(entry.drinkId)?.isAlcohol);
  const waters = allWater.filter((entry) => !entry.deletedAt && participantById.has(entry.participantId));
  const dayKeys = new Set(entries.map((entry) => zonedDayKey(entry.consumedAt, trip.timezone)));
  const activeDays = dayKeys.size;
  const participantCounts: Record<string, number> = {};
  const drinkCounts: Record<string, number> = {};
  const waterCounts: Record<string, number> = {};
  const hourly = Array.from({ length: 24 }, () => 0);
  const dayEntryCounts: Record<string, Record<string, number>> = {};
  const dayDrinkCounts: Record<string, Record<string, number>> = {};
  const dayHourCounts: Record<string, Record<string, number>> = {};
  const dayWaterCounts: Record<string, number> = {};

  for (const entry of entries) {
    const day = zonedDayKey(entry.consumedAt, trip.timezone);
    const hour = getZonedParts(entry.consumedAt, trip.timezone).hour;
    participantCounts[entry.participantId] = (participantCounts[entry.participantId] ?? 0) + 1;
    drinkCounts[entry.drinkId] = (drinkCounts[entry.drinkId] ?? 0) + 1;
    hourly[hour] += 1;
    dayEntryCounts[day] ??= {};
    dayEntryCounts[day].total = (dayEntryCounts[day].total ?? 0) + 1;
    dayDrinkCounts[day] ??= {};
    dayDrinkCounts[day][entry.drinkId] = (dayDrinkCounts[day][entry.drinkId] ?? 0) + 1;
    dayHourCounts[day] ??= {};
    dayHourCounts[day][hour] = (dayHourCounts[day][hour] ?? 0) + 1;
  }
  for (const entry of waters) {
    const day = zonedDayKey(entry.consumedAt, trip.timezone);
    waterCounts[entry.participantId] = (waterCounts[entry.participantId] ?? 0) + 1;
    dayWaterCounts[day] = (dayWaterCounts[day] ?? 0) + 1;
  }

  const totalAlcohol = entries.length;
  const participantRanking = rankCounts([...participantById.values()], participantCounts, totalAlcohol, activeDays);
  const drinkRanking = rankCounts([...drinkById.values()].filter((drink) => drink.isAlcohol), drinkCounts, totalAlcohol, activeDays);
  const dayList: DayStat[] = [...new Set([...tripDateKeys(trip.startDate, trip.endDate), ...Object.keys(dayEntryCounts), ...Object.keys(dayWaterCounts)])]
    .sort()
    .map((date) => {
      const total = dayEntryCounts[date]?.total ?? 0;
      const favoriteId = modeKey(dayDrinkCounts[date] ?? {});
      const peak = modeKey(dayHourCounts[date] ?? {});
      return {
        date,
        total,
        percentage: percentage(total, totalAlcohol),
        rank: 0,
        favoriteDrink: favoriteId ? drinkById.get(favoriteId)?.name ?? null : null,
        peakHour: peak === null ? null : Number(peak),
        water: dayWaterCounts[date] ?? 0,
      };
    });
  const rankedDays = [...dayList].sort((a, b) => b.total - a.total || a.date.localeCompare(b.date));
  let currentDayRank = 0;
  const dayRanks = new Map<string, number>();
  rankedDays.forEach((day, index) => {
    if (index === 0 || rankedDays[index - 1].total !== day.total) currentDayRank = index + 1;
    dayRanks.set(day.date, currentDayRank);
  });
  dayList.forEach((day) => (day.rank = dayRanks.get(day.date) ?? 0));

  const personalBreakdown: Record<string, RankedValue[]> = {};
  for (const participant of participantById.values()) {
    const personalEntries = entries.filter((entry) => entry.participantId === participant.id);
    const personalCounts = personalEntries.reduce<Record<string, number>>((result, entry) => {
      result[entry.drinkId] = (result[entry.drinkId] ?? 0) + 1;
      return result;
    }, {});
    personalBreakdown[participant.id] = rankCounts([...drinkById.values()].filter((drink) => drink.isAlcohol), personalCounts, personalEntries.length, activeDays).filter((item) => item.total > 0);
  }

  const peakHour = hourly.some(Boolean) ? hourly.indexOf(Math.max(...hourly)) : null;
  const trophies: Trophy[] = [];
  const leader = participantRanking.find((item) => item.total > 0);
  if (leader && totalAlcohol >= 3) trophies.push({ key: "leader", icon: "👑", label: "Plus gros buveur", winner: leader.name, detail: `${leader.total} verres` });
  const topDrink = drinkRanking.find((item) => item.total > 0);
  if (topDrink && totalAlcohol >= 3) trophies.push({ key: "drink", icon: topDrink.icon ?? "🍹", label: "Boisson du séjour", winner: topDrink.name, detail: `${topDrink.total} verres` });
  const biggestDay = rankedDays.find((item) => item.total > 0);
  if (biggestDay && totalAlcohol >= 5) trophies.push({ key: "day", icon: "🔥", label: "Plus grosse journée", winner: formatDateKey(biggestDay.date), detail: `${biggestDay.total} verres` });
  if (peakHour !== null && totalAlcohol >= 5) trophies.push({ key: "hour", icon: "🕒", label: "Heure de pointe", winner: `${peakHour}h–${(peakHour + 1) % 24}h`, detail: `${hourly[peakHour]} verres` });
  const waterWinner = rankCounts([...participantById.values()], waterCounts, waters.length, Math.max(activeDays, 1)).find((item) => item.total > 0);
  if (waterWinner && waters.length >= 2) trophies.push({ key: "water", icon: "💧", label: "Hydratation MVP", winner: waterWinner.name, detail: `${waterWinner.total} eaux` });
  const variety = [...participantById.values()]
    .map((participant) => ({ participant, count: new Set(entries.filter((entry) => entry.participantId === participant.id).map((entry) => entry.drinkId)).size }))
    .sort((a, b) => b.count - a.count)[0];
  if (variety && variety.count >= 3) trophies.push({ key: "variety", icon: "🌈", label: "Plus grande variété", winner: variety.participant.name, detail: `${variety.count} boissons` });

  const categoryTrophies = [
    { category: "spirit", key: "spirit", icon: "🥃", label: "Fan de spiritueux" },
    { category: "beer", key: "beer", icon: "🍺", label: "Roi de la bière" },
    { category: "cocktail", key: "cocktail", icon: "🍹", label: "Roi des cocktails" },
    { category: "wine", key: "wine", icon: "🥂", label: "Roi du vin" },
  ] as const;
  for (const trophy of categoryTrophies) {
    const categoryDrinkIds = new Set([...drinkById.values()].filter((drink) => drink.category === trophy.category).map((drink) => drink.id));
    const categoryEntries = entries.filter((entry) => categoryDrinkIds.has(entry.drinkId));
    if (categoryEntries.length < 3) continue;
    const counts = categoryEntries.reduce<Record<string, number>>((result, entry) => {
      result[entry.participantId] = (result[entry.participantId] ?? 0) + 1;
      return result;
    }, {});
    const winner = rankCounts([...participantById.values()], counts, categoryEntries.length, Math.max(activeDays, 1))[0];
    if (winner?.total >= 2) trophies.push({ key: trophy.key, icon: trophy.icon, label: trophy.label, winner: winner.name, detail: `${winner.total} verres` });
  }

  return {
    totalAlcohol,
    totalWater: waters.length,
    averagePerDay: activeDays ? Number((totalAlcohol / activeDays).toFixed(1)) : 0,
    activeDays,
    distinctDrinks: Object.values(drinkCounts).filter(Boolean).length,
    peakHour,
    participants: participantRanking,
    drinks: drinkRanking,
    hourly,
    days: dayList,
    trophies,
    personalBreakdown,
  };
}
