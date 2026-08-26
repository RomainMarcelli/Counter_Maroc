import type { AlcoholComponent, DrinkCategory } from "./types";

export const CATEGORY_LABELS: Record<DrinkCategory, string> = {
  beer: "Bières",
  wine: "Vins",
  spirit: "Spiritueux",
  cocktail: "Cocktails",
};

export const DRINK_ICONS = ["🍹", "🍸", "🍺", "🍷", "🥂", "🥃", "🌿", "🍍", "🍋", "🧊"];

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
  simple("Bière locale", "beer", "🍺", 250, 5),
  simple("Casablanca", "beer", "🍺", 250, 5),
  simple("Flag Spéciale", "beer", "🍺", 250, 5),
  simple("Stork", "beer", "🍺", 250, 5),
  simple("Vin rouge", "wine", "🍷", 120, 13),
  simple("Vin blanc", "wine", "🥂", 120, 12),
  simple("Vin rosé", "wine", "🍷", 120, 12),
  simple("Vin gris", "wine", "🥂", 120, 12),
  simple("Gin", "spirit", "🍸", 40, 40),
  simple("Whisky", "spirit", "🥃", 40, 40),
  simple("Vodka", "spirit", "🧊", 40, 40),
  simple("Rhum blanc", "spirit", "🥃", 40, 40),
  simple("Rhum ambré", "spirit", "🥃", 40, 40),
  simple("Tequila", "spirit", "🍋", 40, 38),
  simple("Pastis", "spirit", "🧊", 20, 45),
  cocktail("Mojito", "🌿", 250, [{ name: "Rhum blanc", volumeMl: 40, abvPercent: 40 }]),
  cocktail("Piña Colada", "🍍", 250, [{ name: "Rhum blanc", volumeMl: 40, abvPercent: 40 }]),
  cocktail("Sex on the Beach", "🍹", 250, [{ name: "Vodka", volumeMl: 40, abvPercent: 40 }, { name: "Liqueur de pêche", volumeMl: 20, abvPercent: 20 }]),
  cocktail("Marrakech", "🍹", 250, [{ name: "Gin", volumeMl: 40, abvPercent: 40 }]),
  cocktail("Gin Tonic", "🍸", 250, [{ name: "Gin", volumeMl: 40, abvPercent: 40 }]),
  cocktail("Cuba Libre", "🍹", 250, [{ name: "Rhum ambré", volumeMl: 40, abvPercent: 40 }]),
  cocktail("Margarita", "🍸", 150, [{ name: "Tequila", volumeMl: 40, abvPercent: 38 }, { name: "Triple sec", volumeMl: 20, abvPercent: 30 }]),
  cocktail("Spritz", "🍹", 200, [{ name: "Apérol", volumeMl: 60, abvPercent: 11 }, { name: "Prosecco", volumeMl: 90, abvPercent: 11 }]),
  cocktail("Punch", "🍹", 200, [{ name: "Rhum ambré", volumeMl: 40, abvPercent: 40 }]),
  cocktail("Vodka Orange", "🍊", 250, [{ name: "Vodka", volumeMl: 40, abvPercent: 40 }]),
];

export const TRIP_TIMEZONE = "Africa/Casablanca";
