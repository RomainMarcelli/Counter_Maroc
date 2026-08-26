import { CATEGORY_LABELS } from "./constants";
import type { Drink, DrinkCategory, DrinkEntry } from "./types";

export type DrinkFilter = "all" | "favorites" | DrinkCategory;

export interface DrinkSuggestion {
  drink: Drink;
  count: number;
  isFavorite: boolean;
}

/** Une boisson n’est favorite que si elle a réellement été bue au moins une fois. */
export const FAVORITE_MIN_COUNT = 1;

export const DRINK_FILTERS: ReadonlyArray<{ id: DrinkFilter; label: string }> = [
  { id: "all", label: "Tous" },
  { id: "favorites", label: "Favoris" },
  { id: "cocktail", label: CATEGORY_LABELS.cocktail },
  { id: "beer", label: CATEGORY_LABELS.beer },
  { id: "wine", label: CATEGORY_LABELS.wine },
  { id: "spirit", label: CATEGORY_LABELS.spirit },
];

export function isDrinkFilter(value: string): value is DrinkFilter {
  return DRINK_FILTERS.some((filter) => filter.id === value);
}

/**
 * Une seule personne sélectionnée : on compte son historique personnel.
 * Zéro ou plusieurs : on compte l’historique global du groupe.
 */
export function countDrinks(entries: DrinkEntry[], selectedParticipantIds: string[]): Record<string, number> {
  const personalOnly = selectedParticipantIds.length === 1;
  return entries
    .filter((entry) => !entry.deletedAt)
    .filter((entry) => !personalOnly || entry.participantId === selectedParticipantIds[0])
    .reduce<Record<string, number>>((result, entry) => {
      result[entry.drinkId] = (result[entry.drinkId] ?? 0) + 1;
      return result;
    }, {});
}

/** Classe les boissons de la plus bue à la moins bue sans jamais inventer de favori. */
export function buildDrinkSuggestions(drinks: Drink[], entries: DrinkEntry[], selectedParticipantIds: string[]): DrinkSuggestion[] {
  const counts = countDrinks(entries, selectedParticipantIds);
  return drinks
    .filter((drink) => !drink.deletedAt)
    .map((drink) => {
      const count = counts[drink.id] ?? 0;
      return { drink, count, isFavorite: count >= FAVORITE_MIN_COUNT };
    })
    .sort((a, b) => b.count - a.count || a.drink.sortOrder - b.drink.sortOrder || a.drink.name.localeCompare(b.drink.name));
}

export function filterSuggestions(suggestions: DrinkSuggestion[], filter: DrinkFilter): DrinkSuggestion[] {
  if (filter === "all") return suggestions;
  if (filter === "favorites") return suggestions.filter((suggestion) => suggestion.isFavorite);
  return suggestions.filter((suggestion) => suggestion.drink.category === filter);
}

export function sortSmartFavorites(drinks: Drink[], entries: DrinkEntry[], selectedParticipantIds: string[]): Drink[] {
  return buildDrinkSuggestions(drinks, entries, selectedParticipantIds).map((suggestion) => suggestion.drink);
}
