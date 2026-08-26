/**
 * Modèle d’absorption : un verre ne passe pas intégralement dans le sang à la
 * milliseconde du tap. On étale sa montée linéairement sur `absorptionMinutes`.
 *
 * C’est volontairement simple et isolé ici pour pouvoir être remplacé (courbe
 * en cloche, effet du repas…) sans toucher au reste du moteur.
 */
export function absorbedFraction(elapsedMinutes: number, absorptionMinutes: number): number {
  if (!Number.isFinite(elapsedMinutes) || elapsedMinutes <= 0) return 0;
  if (!Number.isFinite(absorptionMinutes) || absorptionMinutes <= 0) return 1;
  return Math.min(1, elapsedMinutes / absorptionMinutes);
}

/** Grammes déjà passés dans le sang pour un verre consommé il y a `elapsedMinutes`. */
export function absorbedGrams(totalGrams: number, elapsedMinutes: number, absorptionMinutes: number): number {
  if (!Number.isFinite(totalGrams) || totalGrams <= 0) return 0;
  return totalGrams * absorbedFraction(elapsedMinutes, absorptionMinutes);
}
