import type { DrinkCategory } from "./types";

export const CATEGORY_LABELS: Record<DrinkCategory, string> = {
  beer: "Bières",
  wine: "Vins",
  spirit: "Spiritueux",
  cocktail: "Cocktails",
};

export const DRINK_ICONS = ["🍹", "🍸", "🍺", "🍷", "🥂", "🥃", "🌿", "🍍", "🍋", "🧊"];

export const SYSTEM_DRINKS = [
  { name: "Bière locale", category: "beer", icon: "🍺" },
  { name: "Casablanca", category: "beer", icon: "🍺" },
  { name: "Flag Spéciale", category: "beer", icon: "🍺" },
  { name: "Stork", category: "beer", icon: "🍺" },
  { name: "Vin rouge", category: "wine", icon: "🍷" },
  { name: "Vin blanc", category: "wine", icon: "🥂" },
  { name: "Vin rosé", category: "wine", icon: "🍷" },
  { name: "Vin gris", category: "wine", icon: "🥂" },
  { name: "Gin", category: "spirit", icon: "🍸" },
  { name: "Whisky", category: "spirit", icon: "🥃" },
  { name: "Vodka", category: "spirit", icon: "🧊" },
  { name: "Rhum blanc", category: "spirit", icon: "🥃" },
  { name: "Rhum ambré", category: "spirit", icon: "🥃" },
  { name: "Tequila", category: "spirit", icon: "🍋" },
  { name: "Pastis", category: "spirit", icon: "🧊" },
  { name: "Mojito", category: "cocktail", icon: "🌿" },
  { name: "Piña Colada", category: "cocktail", icon: "🍍" },
  { name: "Sex on the Beach", category: "cocktail", icon: "🍹" },
  { name: "Marrakech", category: "cocktail", icon: "🍹" },
  { name: "Gin Tonic", category: "cocktail", icon: "🍸" },
  { name: "Cuba Libre", category: "cocktail", icon: "🍹" },
  { name: "Margarita", category: "cocktail", icon: "🍸" },
  { name: "Spritz", category: "cocktail", icon: "🍹" },
  { name: "Punch", category: "cocktail", icon: "🍹" },
  { name: "Vodka Orange", category: "cocktail", icon: "🍊" },
] as const satisfies ReadonlyArray<{ name: string; category: DrinkCategory; icon: string }>;

export const TRIP_TIMEZONE = "Africa/Casablanca";
