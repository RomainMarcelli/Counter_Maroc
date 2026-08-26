import type { Drink, DrinkEntry, Participant } from "@/domain/types";

/** Valeurs neutres des champs facultatifs, pour que les fixtures de test restent lisibles. */
export const PARTICIPANT_DEFAULTS: Pick<Participant, "userId" | "bacEnabled" | "weightKg" | "distributionRatio" | "bacPrivate"> = {
  userId: null,
  bacEnabled: false,
  weightKg: null,
  distributionRatio: null,
  bacPrivate: false,
};

export const DRINK_DEFAULTS: Pick<Drink, "servingVolumeMl" | "abvPercent" | "alcoholComponents" | "compositionConfirmed" | "priceCents"> = {
  servingVolumeMl: null,
  abvPercent: null,
  alcoholComponents: null,
  compositionConfirmed: false,
  priceCents: null,
};

export const ENTRY_DEFAULTS: Pick<DrinkEntry, "alcoholGrams" | "drinkNameSnapshot" | "paidBy" | "priceCentsSnapshot"> = {
  alcoholGrams: null,
  drinkNameSnapshot: null,
  paidBy: null,
  priceCentsSnapshot: null,
};
