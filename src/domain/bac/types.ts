/**
 * Types du moteur d’estimation d’alcoolémie.
 *
 * Tout ce qui est exposé ici décrit une ESTIMATION THÉORIQUE : aucune de ces valeurs
 * ne mesure une alcoolémie réelle et aucune ne doit servir à décider de conduire.
 * Voir docs/BAC_ESTIMATION.md pour les hypothèses et les limites du modèle.
 */

/** Un alcool présent dans une boisson : 4 cl de rhum à 40 % par exemple. */
export interface AlcoholComponent {
  name: string;
  volumeMl: number;
  abvPercent: number;
}

/** Ce qu’il faut connaître d’une boisson pour en déduire l’alcool pur. */
export interface DrinkComposition {
  isAlcohol: boolean;
  servingVolumeMl: number | null;
  abvPercent: number | null;
  alcoholComponents: AlcoholComponent[] | null;
}

/** Paramètres personnels utilisés par le modèle de Widmark. */
export interface BacProfile {
  weightKg: number;
  /** Coefficient de répartition (Widmark r). */
  distributionRatio: number;
  /** Élimination en g/L par heure. */
  eliminationRate: number;
  /** Durée d’absorption d’un verre, en minutes. */
  absorptionMinutes: number;
}

/** Une consommation ramenée à ce qui compte pour le calcul. */
export interface AlcoholEvent {
  consumedAt: string;
  pureAlcoholGrams: number;
}

/** Estimation à un instant donné, avec sa plage d’incertitude. */
export interface BacEstimate {
  estimatedGPerL: number;
  lowEstimateGPerL: number;
  highEstimateGPerL: number;
}

export interface BacPoint {
  at: string;
  gPerL: number;
}

export interface BacPeak {
  at: string;
  gPerL: number;
}

export interface DailyBacPeak extends BacPeak {
  date: string;
}

export interface ParticipantBacStats {
  current: BacEstimate;
  tripPeak: BacPeak | null;
  dailyPeaks: DailyBacPeak[];
}
