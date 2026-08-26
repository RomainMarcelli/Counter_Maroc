import type { Drink, DrinkEntry } from "./types";

export function sortSmartFavorites(drinks: Drink[], entries: DrinkEntry[], selectedParticipantIds: string[]): Drink[] {
  const activeEntries = entries.filter((entry) => !entry.deletedAt);
  const usePersonal = selectedParticipantIds.length === 1;
  const relevant = usePersonal
    ? activeEntries.filter((entry) => entry.participantId === selectedParticipantIds[0])
    : activeEntries;
  const counts = relevant.reduce<Record<string, number>>((result, entry) => {
    result[entry.drinkId] = (result[entry.drinkId] ?? 0) + 1;
    return result;
  }, {});
  return [...drinks]
    .filter((drink) => !drink.deletedAt)
    .sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0) || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}
