import { describe, expect, it } from "vitest";
import { buildDrinkSuggestions, filterSuggestions, isDrinkFilter, sortSmartFavorites } from "./favorites";
import type { Drink, DrinkEntry } from "./types";
import { DRINK_DEFAULTS, ENTRY_DEFAULTS } from "@/test/factories";

const base = { tripId: "trip", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", deletedAt: null };
const drinks: Drink[] = [
  { ...base, ...DRINK_DEFAULTS, id: "beer", name: "Bière locale", category: "beer", icon: "🍺", isAlcohol: true, isSystem: true, sortOrder: 0 },
  { ...base, ...DRINK_DEFAULTS, id: "casa", name: "Casablanca", category: "beer", icon: "🍺", isAlcohol: true, isSystem: true, sortOrder: 1 },
  { ...base, ...DRINK_DEFAULTS, id: "wine", name: "Vin rouge", category: "wine", icon: "🍷", isAlcohol: true, isSystem: true, sortOrder: 2 },
  { ...base, ...DRINK_DEFAULTS, id: "rhum", name: "Rhum blanc", category: "spirit", icon: "🥃", isAlcohol: true, isSystem: true, sortOrder: 3 },
  { ...base, ...DRINK_DEFAULTS, id: "mojito", name: "Mojito", category: "cocktail", icon: "🌿", isAlcohol: true, isSystem: true, sortOrder: 4 },
  { ...base, ...DRINK_DEFAULTS, id: "colada", name: "Piña Colada", category: "cocktail", icon: "🍍", isAlcohol: true, isSystem: true, sortOrder: 5 },
];
let sequence = 0;
const makeEntry = (participantId: string, drinkId: string): DrinkEntry => ({ ...base, ...ENTRY_DEFAULTS, id: `entry-${(sequence += 1)}`, participantId, drinkId, consumedAt: base.createdAt, actionBy: "user", deviceId: "device", roundId: null });
const romainHistory = [makeEntry("romain", "mojito"), makeEntry("romain", "mojito"), makeEntry("romain", "mojito"), makeEntry("romain", "beer")];

describe("buildDrinkSuggestions", () => {
  it("ne marque aucune boisson favorite tant que personne n’a rien bu", () => {
    const suggestions = buildDrinkSuggestions(drinks, [], ["romain"]);
    expect(suggestions).toHaveLength(drinks.length);
    expect(suggestions.every((suggestion) => !suggestion.isFavorite && suggestion.count === 0)).toBe(true);
    // Sans historique, l’ordre reste l’ordre normal des boissons.
    expect(suggestions.map((suggestion) => suggestion.drink.id)).toEqual(drinks.map((drink) => drink.id));
  });

  it("classe les favoris personnels du participant sélectionné seul", () => {
    const suggestions = buildDrinkSuggestions(drinks, romainHistory, ["romain"]);
    expect(suggestions[0]).toMatchObject({ count: 3, isFavorite: true });
    expect(suggestions[0].drink.id).toBe("mojito");
    expect(suggestions[1]).toMatchObject({ count: 1, isFavorite: true });
    expect(suggestions[1].drink.id).toBe("beer");
    expect(suggestions.filter((suggestion) => suggestion.isFavorite)).toHaveLength(2);
  });

  it("bascule sur l’historique global dès que plusieurs personnes sont sélectionnées", () => {
    const entries = [...romainHistory, makeEntry("lucas", "beer"), makeEntry("lucas", "beer"), makeEntry("lucas", "beer"), makeEntry("theo", "beer")];
    expect(buildDrinkSuggestions(drinks, entries, ["romain"])[0].drink.id).toBe("mojito");
    const group = buildDrinkSuggestions(drinks, entries, ["romain", "lucas", "theo"]);
    expect(group[0].drink.id).toBe("beer");
    expect(group[0].count).toBe(5);
    expect(group[1].drink.id).toBe("mojito");
  });

  it("ignore les consommations et les boissons supprimées", () => {
    const entries = [...romainHistory, { ...makeEntry("romain", "colada"), deletedAt: "2026-01-02T00:00:00Z" }];
    const suggestions = buildDrinkSuggestions([...drinks, { ...drinks[0], id: "ghost", deletedAt: "2026-01-02T00:00:00Z" }], entries, ["romain"]);
    expect(suggestions.some((suggestion) => suggestion.drink.id === "ghost")).toBe(false);
    expect(suggestions.find((suggestion) => suggestion.drink.id === "colada")).toMatchObject({ count: 0, isFavorite: false });
  });
});

describe("filterSuggestions", () => {
  const suggestions = buildDrinkSuggestions(drinks, romainHistory, ["romain"]);

  it("garde toutes les boissons sur le filtre Tous", () => {
    expect(filterSuggestions(suggestions, "all")).toHaveLength(drinks.length);
  });

  it("n’affiche que des cocktails sur le filtre Cocktails", () => {
    const cocktails = filterSuggestions(suggestions, "cocktail");
    expect(cocktails.map((suggestion) => suggestion.drink.id)).toEqual(["mojito", "colada"]);
    expect(cocktails.every((suggestion) => suggestion.drink.category === "cocktail")).toBe(true);
  });

  it("n’affiche que des bières sur le filtre Bières", () => {
    const beers = filterSuggestions(suggestions, "beer");
    expect(beers.every((suggestion) => suggestion.drink.category === "beer")).toBe(true);
    expect(beers.map((suggestion) => suggestion.drink.name)).toEqual(["Bière locale", "Casablanca"]);
  });

  it("classe la plus bue en premier à l’intérieur d’une catégorie", () => {
    const entries = [makeEntry("romain", "casa"), makeEntry("romain", "casa"), makeEntry("romain", "beer")];
    const beers = filterSuggestions(buildDrinkSuggestions(drinks, entries, ["romain"]), "beer");
    expect(beers.map((suggestion) => suggestion.drink.id)).toEqual(["casa", "beer"]);
  });

  it("ne garde que les boissons réellement bues sur le filtre Favoris", () => {
    const favorites = filterSuggestions(suggestions, "favorites");
    expect(favorites.map((suggestion) => suggestion.drink.id)).toEqual(["mojito", "beer"]);
    expect(filterSuggestions(buildDrinkSuggestions(drinks, [], ["romain"]), "favorites")).toEqual([]);
  });
});

describe("isDrinkFilter", () => {
  it("valide les filtres connus et rejette le reste", () => {
    expect(isDrinkFilter("favorites")).toBe(true);
    expect(isDrinkFilter("beer")).toBe(true);
    expect(isDrinkFilter("soda")).toBe(false);
  });
});

describe("sortSmartFavorites", () => {
  it("privilégie les habitudes du participant quand il est seul", () => {
    const entries = [makeEntry("romain", "mojito"), makeEntry("romain", "mojito"), makeEntry("lucas", "beer"), makeEntry("lucas", "beer"), makeEntry("lucas", "beer")];
    expect(sortSmartFavorites(drinks, entries, ["romain"])[0].id).toBe("mojito");
    expect(sortSmartFavorites(drinks, entries, ["romain", "lucas"])[0].id).toBe("beer");
  });
});
