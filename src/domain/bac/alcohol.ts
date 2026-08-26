import { ETHANOL_DENSITY_G_PER_ML } from "./constants";
import type { AlcoholComponent, DrinkComposition } from "./types";

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * Alcool pur contenu dans un volume servi.
 * 40 ml à 40 % → 40 × 0,40 × 0,789 ≈ 12,62 g.
 */
export function calculatePureAlcoholGrams(volumeMl: number, abvPercent: number): number {
  if (!isPositiveNumber(volumeMl) || !isPositiveNumber(abvPercent)) return 0;
  return volumeMl * (Math.min(abvPercent, 100) / 100) * ETHANOL_DENSITY_G_PER_ML;
}

export function calculateComponentsAlcoholGrams(components: AlcoholComponent[]): number {
  return components.reduce((total, component) => total + calculatePureAlcoholGrams(component.volumeMl, component.abvPercent), 0);
}

/** Une boisson est exploitable si elle décrit soit ses composants, soit un volume et un degré. */
export function hasAlcoholComposition(drink: DrinkComposition): boolean {
  if (!drink.isAlcohol) return true;
  if (drink.alcoholComponents?.some((component) => isPositiveNumber(component.volumeMl) && isPositiveNumber(component.abvPercent))) return true;
  return isPositiveNumber(drink.servingVolumeMl) && isPositiveNumber(drink.abvPercent);
}

/**
 * Alcool pur d’une boisson, ou null si sa composition est inconnue.
 * Un cocktail est calculé sur ses alcools, jamais sur le volume total du verre.
 */
export function calculateDrinkAlcoholGrams(drink: DrinkComposition): number | null {
  if (!drink.isAlcohol) return 0;
  const components = drink.alcoholComponents?.filter((component) => isPositiveNumber(component.volumeMl) && isPositiveNumber(component.abvPercent)) ?? [];
  if (components.length) return calculateComponentsAlcoholGrams(components);
  if (isPositiveNumber(drink.servingVolumeMl) && isPositiveNumber(drink.abvPercent)) return calculatePureAlcoholGrams(drink.servingVolumeMl, drink.abvPercent);
  return null;
}

/** Degré équivalent d’un verre entier, utile pour relire une recette de cocktail. */
export function equivalentAbvPercent(drink: DrinkComposition): number | null {
  const grams = calculateDrinkAlcoholGrams(drink);
  if (grams === null || !isPositiveNumber(drink.servingVolumeMl)) return null;
  return (grams / (drink.servingVolumeMl * ETHANOL_DENSITY_G_PER_ML)) * 100;
}

export function formatAlcoholGrams(grams: number): string {
  return `${grams.toFixed(1).replace(".", ",")} g`;
}
