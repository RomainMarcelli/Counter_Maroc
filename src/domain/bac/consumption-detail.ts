import type { Drink, DrinkEntry } from "../types";
import { absorbedFraction, absorbedGrams } from "./absorption";
import { entryAlcoholGrams } from "./profile";

export type AlcoholImpact = "low" | "moderate" | "high";

export interface BacConsumptionDetail {
  entryId: string;
  drinkId: string;
  name: string;
  consumedAt: string;
  pureAlcoholGrams: number;
  absorbedGrams: number;
  absorptionFraction: number;
  absorbing: boolean;
  impact: AlcoholImpact;
}

/**
 * Présentation explicative d'un verre réel. Les seuils d'impact ne sont pas une
 * classification médicale : ils servent seulement à comparer visuellement les
 * doses d'alcool pur enregistrées dans ce séjour.
 */
function impactFor(grams: number): AlcoholImpact {
  if (grams < 10) return "low";
  if (grams < 12.5) return "moderate";
  return "high";
}

export function buildBacConsumptionDetails({
  entries,
  drinks,
  participantId,
  now,
  absorptionMinutes,
}: {
  entries: DrinkEntry[];
  drinks: Drink[];
  participantId: string;
  now: string | number | Date;
  absorptionMinutes: number;
}): BacConsumptionDetail[] {
  const drinkById = new Map(drinks.map((drink) => [drink.id, drink]));
  const nowMs = now instanceof Date ? now.getTime() : typeof now === "number" ? now : Date.parse(now);

  return entries
    .filter((entry) => !entry.deletedAt && entry.participantId === participantId)
    .map((entry): BacConsumptionDetail | null => {
      const grams = entryAlcoholGrams(entry, drinkById);
      const consumedAt = Date.parse(entry.consumedAt);
      if (grams === null || grams <= 0 || !Number.isFinite(consumedAt) || !Number.isFinite(nowMs)) return null;
      const elapsedMinutes = (nowMs - consumedAt) / 60_000;
      const fraction = absorbedFraction(elapsedMinutes, absorptionMinutes);
      return {
        entryId: entry.id,
        drinkId: entry.drinkId,
        name: entry.drinkNameSnapshot ?? drinkById.get(entry.drinkId)?.name ?? "Boisson alcoolisée",
        consumedAt: entry.consumedAt,
        pureAlcoholGrams: grams,
        absorbedGrams: absorbedGrams(grams, elapsedMinutes, absorptionMinutes),
        absorptionFraction: fraction,
        absorbing: elapsedMinutes >= 0 && fraction < 1,
        impact: impactFor(grams),
      };
    })
    .filter((detail): detail is BacConsumptionDetail => detail !== null)
    .sort((a, b) => b.consumedAt.localeCompare(a.consumedAt));
}

