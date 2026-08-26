/**
 * Constantes du modèle d’estimation. Chaque valeur est une hypothèse documentée,
 * pas une mesure : docs/BAC_ESTIMATION.md détaille d’où elles viennent et ce qu’elles valent.
 */

/** Masse volumique de l’éthanol, en g/ml. */
export const ETHANOL_DENSITY_G_PER_ML = 0.789;

/** Coefficient de répartition retenu par défaut quand personne ne précise rien. */
export const DEFAULT_DISTRIBUTION_RATIO = 0.6;
export const MIN_DISTRIBUTION_RATIO = 0.45;
export const MAX_DISTRIBUTION_RATIO = 0.8;

/** Élimination centrale, en g/L par heure, et bornes de la plage d’incertitude. */
export const ELIMINATION_RATE_G_PER_L_PER_HOUR = 0.15;
export const MIN_ELIMINATION_RATE = 0.11;
export const MAX_ELIMINATION_RATE = 0.19;

/** Incertitude relative appliquée au coefficient de répartition pour la plage affichée. */
export const DISTRIBUTION_UNCERTAINTY = 0.08;

/** Durée pendant laquelle un verre passe progressivement dans le sang. */
export const ABSORPTION_MINUTES = 30;

export const MIN_WEIGHT_KG = 30;
export const MAX_WEIGHT_KG = 250;

/**
 * Présélections proposées dans l’interface. On ne stocke jamais de donnée
 * corporelle autre que ce nombre : seul le coefficient est enregistré.
 */
export const DISTRIBUTION_PRESETS: ReadonlyArray<{ value: number; label: string; detail: string }> = [
  { value: 0.55, label: "0,55", detail: "Moins d’eau corporelle" },
  { value: 0.6, label: "0,60", detail: "Valeur moyenne" },
  { value: 0.68, label: "0,68", detail: "Plus d’eau corporelle" },
];

export const BAC_DISCLAIMER = "Estimation indicative uniquement. Elle ne remplace pas un éthylotest ou une mesure réelle. Ne pas utiliser cette estimation pour décider de conduire.";
export const BAC_SHORT_DISCLAIMER = "Estimation uniquement";
