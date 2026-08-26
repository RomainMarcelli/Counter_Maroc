import type { Drink, DrinkEntry, Participant } from "../types";
import { calculateDrinkAlcoholGrams } from "./alcohol";
import { ABSORPTION_MINUTES, DEFAULT_DISTRIBUTION_RATIO, ELIMINATION_RATE_G_PER_L_PER_HOUR, MAX_DISTRIBUTION_RATIO, MAX_WEIGHT_KG, MIN_DISTRIBUTION_RATIO, MIN_WEIGHT_KG } from "./constants";
import type { AlcoholEvent, BacProfile } from "./types";

export function isValidWeight(weightKg: number | null | undefined): weightKg is number {
  return typeof weightKg === "number" && Number.isFinite(weightKg) && weightKg >= MIN_WEIGHT_KG && weightKg <= MAX_WEIGHT_KG;
}

export function isValidDistributionRatio(ratio: number | null | undefined): ratio is number {
  return typeof ratio === "number" && Number.isFinite(ratio) && ratio >= MIN_DISTRIBUTION_RATIO && ratio <= MAX_DISTRIBUTION_RATIO;
}

/** Le profil n’existe que si la personne a activé l’estimation ET renseigné un poids exploitable. */
export function buildBacProfile(participant: Pick<Participant, "bacEnabled" | "weightKg" | "distributionRatio">): BacProfile | null {
  if (!participant.bacEnabled || !isValidWeight(participant.weightKg)) return null;
  return {
    weightKg: participant.weightKg,
    distributionRatio: isValidDistributionRatio(participant.distributionRatio) ? participant.distributionRatio : DEFAULT_DISTRIBUTION_RATIO,
    eliminationRate: ELIMINATION_RATE_G_PER_L_PER_HOUR,
    absorptionMinutes: ABSORPTION_MINUTES,
  };
}

/**
 * Alcool pur d’une consommation : on privilégie le snapshot pris au moment du verre,
 * pour qu’une recette modifiée plus tard ne réécrive pas l’historique.
 */
export function entryAlcoholGrams(entry: DrinkEntry, drinkById: Map<string, Drink>): number | null {
  if (typeof entry.alcoholGrams === "number" && Number.isFinite(entry.alcoholGrams) && entry.alcoholGrams >= 0) return entry.alcoholGrams;
  const drink = drinkById.get(entry.drinkId);
  return drink ? calculateDrinkAlcoholGrams(drink) : null;
}

export function buildAlcoholEvents(entries: DrinkEntry[], drinks: Drink[], participantId: string): AlcoholEvent[] {
  const drinkById = new Map(drinks.map((drink) => [drink.id, drink]));
  return entries
    .filter((entry) => !entry.deletedAt && entry.participantId === participantId)
    .map((entry) => ({ consumedAt: entry.consumedAt, pureAlcoholGrams: entryAlcoholGrams(entry, drinkById) ?? 0 }))
    .filter((event) => event.pureAlcoholGrams > 0);
}

/**
 * Règle d’affichage : l’estimation n’apparaît que si la personne l’a activée, l’a configurée,
 * et n’a pas demandé à la garder pour elle. Le compteur de verres, lui, reste toujours visible.
 */
export function canSeeBac(participant: Pick<Participant, "id" | "bacEnabled" | "weightKg" | "bacPrivate">, actorId: string | null): boolean {
  if (!participant.bacEnabled || !isValidWeight(participant.weightKg)) return false;
  return !participant.bacPrivate || participant.id === actorId;
}
