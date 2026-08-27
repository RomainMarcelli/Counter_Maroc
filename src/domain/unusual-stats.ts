import type { Drink, DrinkEntry, Participant, WaterEntry } from "./types";
import { deviceTimeZone, getZonedParts } from "@/lib/timezone";
import { getTripDayKey } from "@/lib/trip-day";

export interface PreferredHourRecord { hour: number; count: number }
export interface ExplorerRecord { participantId: string; name: string; distinctDrinks: number }
export interface LoyaltyRecord { participantId: string; name: string; drinkId: string; drinkName: string; count: number; percentage: number }
export interface PauseRecord { participantId: string; name: string; minutes: number; dayKey: string }
export interface RoundRecord { roundId: string; actorName: string; participantCount: number; consumedAt: string; drinks: Array<{ name: string; count: number }> }
export interface DuoRecord { participantIds: [string, string]; names: [string, string]; sharedRounds: number }
export interface HydrationRecord { participantId: string; name: string; waters: number; alcohols: number; ratio: number }
export interface TravelDayRecord { dayKey: string; count: number }

export interface UnusualStats {
  preferredHour: PreferredHourRecord | null;
  explorer: ExplorerRecord | null;
  loyalty: LoyaltyRecord | null;
  longestPause: PauseRecord | null;
  largestRound: RoundRecord | null;
  duo: DuoRecord | null;
  hydration: HydrationRecord | null;
  activeDay: TravelDayRecord | null;
  calmDay: TravelDayRecord | null;
}

function increment(map: Map<string, number>, key: string, amount = 1): void {
  map.set(key, (map.get(key) ?? 0) + amount);
}

export function calculateUnusualStats(
  participants: Participant[],
  drinks: Drink[],
  allEntries: DrinkEntry[],
  allWater: WaterEntry[],
  timezone: string = deviceTimeZone(),
): UnusualStats {
  const activeParticipants = participants.filter((item) => !item.deletedAt);
  const participantById = new Map(activeParticipants.map((item) => [item.id, item]));
  const participantByUser = new Map(activeParticipants.filter((item) => item.userId).map((item) => [item.userId as string, item]));
  const drinkById = new Map(drinks.filter((item) => !item.deletedAt && item.isAlcohol).map((item) => [item.id, item]));
  const entries = allEntries.filter((entry) => !entry.deletedAt && participantById.has(entry.participantId) && drinkById.has(entry.drinkId));
  const waters = allWater.filter((entry) => !entry.deletedAt && participantById.has(entry.participantId));

  const hours = new Map<string, number>();
  const dayCounts = new Map<string, number>();
  for (const entry of entries) {
    increment(hours, String(getZonedParts(entry.consumedAt, timezone).hour));
    increment(dayCounts, getTripDayKey(entry.consumedAt, timezone));
  }
  const preferred = [...hours.entries()].sort((a, b) => b[1] - a[1] || Number(a[0]) - Number(b[0]))[0];
  const preferredHour = preferred ? { hour: Number(preferred[0]), count: preferred[1] } : null;

  const explorer = activeParticipants
    .map((participant) => ({ participantId: participant.id, name: participant.name, distinctDrinks: new Set(entries.filter((entry) => entry.participantId === participant.id).map((entry) => entry.drinkId)).size }))
    .filter((item) => item.distinctDrinks > 0)
    .sort((a, b) => b.distinctDrinks - a.distinctDrinks || a.name.localeCompare(b.name))[0] ?? null;

  const loyalties: LoyaltyRecord[] = [];
  for (const participant of activeParticipants) {
    const mine = entries.filter((entry) => entry.participantId === participant.id);
    if (mine.length < 3) continue;
    const counts = new Map<string, number>();
    mine.forEach((entry) => increment(counts, entry.drinkId));
    const favorite = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    const drink = favorite ? drinkById.get(favorite[0]) : null;
    if (favorite && drink) loyalties.push({ participantId: participant.id, name: participant.name, drinkId: drink.id, drinkName: drink.name, count: favorite[1], percentage: Math.round((favorite[1] / mine.length) * 100) });
  }
  const loyalty = loyalties.sort((a, b) => b.percentage - a.percentage || b.count - a.count || a.name.localeCompare(b.name))[0] ?? null;

  let longestPause: PauseRecord | null = null;
  for (const participant of activeParticipants) {
    const byDay = new Map<string, DrinkEntry[]>();
    for (const entry of entries.filter((item) => item.participantId === participant.id)) {
      const key = getTripDayKey(entry.consumedAt, timezone);
      const bucket = byDay.get(key);
      if (bucket) bucket.push(entry); else byDay.set(key, [entry]);
    }
    for (const [dayKey, dayEntries] of byDay) {
      dayEntries.sort((a, b) => a.consumedAt.localeCompare(b.consumedAt));
      for (let index = 1; index < dayEntries.length; index += 1) {
        const minutes = Math.round((Date.parse(dayEntries[index].consumedAt) - Date.parse(dayEntries[index - 1].consumedAt)) / 60_000);
        if (minutes > 0 && (!longestPause || minutes > longestPause.minutes)) longestPause = { participantId: participant.id, name: participant.name, minutes, dayKey };
      }
    }
  }

  const roundGroups = new Map<string, DrinkEntry[]>();
  for (const entry of entries.filter((item) => item.roundId)) {
    const bucket = roundGroups.get(entry.roundId as string);
    if (bucket) bucket.push(entry); else roundGroups.set(entry.roundId as string, [entry]);
  }
  const rounds = [...roundGroups.entries()].map(([roundId, roundEntries]): RoundRecord => {
    const counts = new Map<string, number>();
    roundEntries.forEach((entry) => increment(counts, entry.drinkId));
    const first = [...roundEntries].sort((a, b) => a.consumedAt.localeCompare(b.consumedAt))[0];
    return {
      roundId,
      actorName: participantByUser.get(first.actionBy)?.name ?? participantById.get(first.participantId)?.name ?? "Le crew",
      participantCount: new Set(roundEntries.map((entry) => entry.participantId)).size,
      consumedAt: first.consumedAt,
      drinks: [...counts.entries()].map(([drinkId, count]) => ({ name: drinkById.get(drinkId)?.name ?? "Boisson", count })).sort((a, b) => b.count - a.count),
    };
  });
  const largestRound = rounds.sort((a, b) => b.participantCount - a.participantCount || b.drinks.reduce((sum, item) => sum + item.count, 0) - a.drinks.reduce((sum, item) => sum + item.count, 0))[0] ?? null;

  const pairCounts = new Map<string, number>();
  for (const roundEntries of roundGroups.values()) {
    const ids = [...new Set(roundEntries.map((entry) => entry.participantId))].sort();
    for (let left = 0; left < ids.length; left += 1) for (let right = left + 1; right < ids.length; right += 1) increment(pairCounts, `${ids[left]}|${ids[right]}`);
  }
  const pair = [...pairCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const duoIds = pair?.[0].split("|") as [string, string] | undefined;
  const duo = pair && duoIds && participantById.get(duoIds[0]) && participantById.get(duoIds[1])
    ? { participantIds: duoIds, names: [participantById.get(duoIds[0])!.name, participantById.get(duoIds[1])!.name] as [string, string], sharedRounds: pair[1] }
    : null;

  const hydration = activeParticipants
    .map((participant): HydrationRecord => {
      const alcohols = entries.filter((entry) => entry.participantId === participant.id).length;
      const waterCount = waters.filter((entry) => entry.participantId === participant.id).length;
      return { participantId: participant.id, name: participant.name, waters: waterCount, alcohols, ratio: alcohols ? waterCount / alcohols : 0 };
    })
    .filter((item) => item.alcohols > 0 && item.waters > 0)
    .sort((a, b) => b.ratio - a.ratio || b.waters - a.waters)[0] ?? null;

  const activeDays = [...dayCounts.entries()].filter(([, count]) => count > 0).map(([dayKey, count]) => ({ dayKey, count }));
  const activeDay = [...activeDays].sort((a, b) => b.count - a.count || a.dayKey.localeCompare(b.dayKey))[0] ?? null;
  const calmDay = [...activeDays].sort((a, b) => a.count - b.count || a.dayKey.localeCompare(b.dayKey))[0] ?? null;

  return { preferredHour, explorer, loyalty, longestPause, largestRound, duo, hydration, activeDay, calmDay };
}

export function formatPause(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours} h ${String(rest).padStart(2, "0")}` : `${rest} min`;
}

