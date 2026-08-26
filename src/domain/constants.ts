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
  { name: "Vin rouge", category: "wine", icon: "🍷" },
  { name: "Vin blanc", category: "wine", icon: "🥂" },
  { name: "Vin rosé", category: "wine", icon: "🍷" },
  { name: "Gin", category: "spirit", icon: "🍸" },
  { name: "Whisky", category: "spirit", icon: "🥃" },
  { name: "Vodka", category: "spirit", icon: "🧊" },
  { name: "Rhum", category: "spirit", icon: "🥃" },
  { name: "Mojito", category: "cocktail", icon: "🌿" },
  { name: "Piña Colada", category: "cocktail", icon: "🍍" },
  { name: "Sex on the Beach", category: "cocktail", icon: "🍹" },
  { name: "Marrakech", category: "cocktail", icon: "🍹" },
] as const;

export const TRIP_TIMEZONE = "Africa/Casablanca";
