import type { AlcoholComponent, DrinkCategory } from "./types";

export const CATEGORY_LABELS: Record<DrinkCategory, string> = {
  beer: "Bières",
  wine: "Vins",
  spirit: "Spiritueux",
  cocktail: "Cocktails",
};

/** Ancienne palette d’emojis. Conservée pour relire les boissons créées avant les pictogrammes. */
export const LEGACY_DRINK_EMOJIS = ["🍹", "🍸", "🍺", "🍷", "🥂", "🥃", "🌿", "🍍", "🍋", "🧊"];

/** Doses proposées par défaut quand on crée une boisson : un point de départ, à confirmer au bar. */
export const CATEGORY_DEFAULTS: Record<DrinkCategory, { servingVolumeMl: number; abvPercent: number }> = {
  beer: { servingVolumeMl: 250, abvPercent: 5 },
  wine: { servingVolumeMl: 120, abvPercent: 12 },
  spirit: { servingVolumeMl: 40, abvPercent: 40 },
  cocktail: { servingVolumeMl: 250, abvPercent: 12 },
};

export interface SystemDrinkTemplate {
  name: string;
  category: DrinkCategory;
  icon: string;
  servingVolumeMl: number;
  abvPercent: number | null;
  alcoholComponents: AlcoholComponent[] | null;
}

const simple = (name: string, category: DrinkCategory, icon: string, servingVolumeMl: number, abvPercent: number): SystemDrinkTemplate => ({ name, category, icon, servingVolumeMl, abvPercent, alcoholComponents: null });
const cocktail = (name: string, icon: string, servingVolumeMl: number, alcoholComponents: AlcoholComponent[]): SystemDrinkTemplate => ({ name, category: "cocktail", icon, servingVolumeMl, abvPercent: null, alcoholComponents });

/**
 * Compositions livrées avec l’application. Ce sont des ORDRES DE GRANDEUR :
 * les boissons partent avec `compositionConfirmed: false` et l’écran Réglages
 * affiche « Composition à confirmer » tant que personne n’a vérifié la dose servie.
 */
export const SYSTEM_DRINKS: readonly SystemDrinkTemplate[] = [
  simple("Bière locale", "beer", "beer", 250, 5),
  simple("Casablanca", "beer", "beer", 250, 5),
  simple("Flag Spéciale", "beer", "beer", 250, 5),
  simple("Stork", "beer", "beer", 250, 5),
  simple("Vin rouge", "wine", "wine", 120, 13),
  simple("Vin blanc", "wine", "wine", 120, 12),
  simple("Vin rosé", "wine", "wine", 120, 12),
  simple("Vin gris", "wine", "wine", 120, 12),
  simple("Gin", "spirit", "gin", 40, 40),
  simple("Whisky", "spirit", "whisky", 40, 40),
  simple("Vodka", "spirit", "vodka", 40, 40),
  simple("Rhum blanc", "spirit", "rum", 40, 40),
  simple("Rhum ambré", "spirit", "rum", 40, 40),
  simple("Tequila", "spirit", "generic", 40, 38),
  simple("Pastis", "spirit", "generic", 20, 45),
  cocktail("Mojito", "cocktail", 250, [{ name: "Rhum blanc", volumeMl: 40, abvPercent: 40 }]),
  cocktail("Piña Colada", "cocktail", 250, [{ name: "Rhum blanc", volumeMl: 40, abvPercent: 40 }]),
  cocktail("Sex on the Beach", "cocktail", 250, [{ name: "Vodka", volumeMl: 40, abvPercent: 40 }, { name: "Liqueur de pêche", volumeMl: 20, abvPercent: 20 }]),
  cocktail("Marrakech", "cocktail", 250, [{ name: "Gin", volumeMl: 40, abvPercent: 40 }]),
  cocktail("Gin Tonic", "cocktail", 250, [{ name: "Gin", volumeMl: 40, abvPercent: 40 }]),
  cocktail("Cuba Libre", "cocktail", 250, [{ name: "Rhum ambré", volumeMl: 40, abvPercent: 40 }]),
  cocktail("Margarita", "cocktail", 150, [{ name: "Tequila", volumeMl: 40, abvPercent: 38 }, { name: "Triple sec", volumeMl: 20, abvPercent: 30 }]),
  cocktail("Spritz", "cocktail", 200, [{ name: "Apérol", volumeMl: 60, abvPercent: 11 }, { name: "Prosecco", volumeMl: 90, abvPercent: 11 }]),
  cocktail("Punch", "cocktail", 200, [{ name: "Rhum ambré", volumeMl: 40, abvPercent: 40 }]),
  cocktail("Vodka Orange", "cocktail", 250, [{ name: "Vodka", volumeMl: 40, abvPercent: 40 }]),
];

/**
 * Métadonnée du séjour, poussée telle quelle vers Supabase. Elle n’est JAMAIS lue
 * pour afficher une heure ni pour découper les journées : tout l’affichage suit le
 * fuseau de l’appareil (`deviceTimeZone()`), et les écarts de temps du calcul
 * d’alcoolémie se font sur l’epoch. Elle ne sert que de repère au séjour lui-même.
 */
export const TRIP_TIMEZONE = "Africa/Casablanca";
