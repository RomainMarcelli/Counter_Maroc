import type { DrinkCategory } from "./types";

/**
 * Pictogramme d’une boisson. La clé est stockée telle quelle dans `Drink.icon`,
 * qui contenait jusqu’ici un emoji : les deux cohabitent sans migration, et les
 * anciennes boissons sont réinterprétées à l’affichage.
 */
export type DrinkIconKey = "beer" | "wine" | "cocktail" | "whisky" | "rum" | "vodka" | "gin" | "generic";

export const DRINK_ICON_KEYS: readonly DrinkIconKey[] = ["beer", "wine", "cocktail", "whisky", "rum", "vodka", "gin", "generic"];

export const DRINK_ICON_LABELS: Record<DrinkIconKey, string> = {
  beer: "Bière",
  wine: "Vin",
  cocktail: "Cocktail",
  whisky: "Whisky",
  rum: "Rhum",
  vodka: "Vodka",
  gin: "Gin",
  generic: "Autre",
};

const KEYS = new Set<string>(DRINK_ICON_KEYS);

export function isDrinkIconKey(value: string): value is DrinkIconKey {
  return KEYS.has(value);
}

/** Emojis de l’ancien sélecteur, conservés pour relire les boissons déjà créées. */
const BY_EMOJI: Record<string, DrinkIconKey> = {
  "🍺": "beer",
  "🍻": "beer",
  "🍷": "wine",
  "🥂": "wine",
  "🍾": "wine",
  "🍸": "cocktail",
  "🍹": "cocktail",
  "🥃": "whisky",
};

const BY_CATEGORY: Record<DrinkCategory, DrinkIconKey> = {
  beer: "beer",
  wine: "wine",
  spirit: "generic",
  cocktail: "cocktail",
};

/** Un spiritueux se reconnaît à son nom bien mieux qu’à son emoji : « Gin » n’est pas « Gin Tonic ». */
const SPIRIT_KEYWORDS: ReadonlyArray<[RegExp, DrinkIconKey]> = [
  [/whisk(y|ey)|bourbon|scotch/, "whisky"],
  [/\brhum\b|\brum\b/, "rum"],
  [/vodka/, "vodka"],
  [/\bgin\b/, "gin"],
];

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Résout le pictogramme à afficher. L’ordre compte : une clé explicite gagne
 * toujours, puis le nom pour les spiritueux, puis l’emoji choisi autrefois, et
 * seulement ensuite la catégorie.
 */
export function resolveDrinkIconKey(drink: { icon: string; name: string; category: DrinkCategory }): DrinkIconKey {
  if (isDrinkIconKey(drink.icon)) return drink.icon;

  const name = normalize(drink.name);
  if (drink.category === "spirit") {
    for (const [pattern, key] of SPIRIT_KEYWORDS) if (pattern.test(name)) return key;
  }

  const fromEmoji = BY_EMOJI[drink.icon];
  if (fromEmoji) return fromEmoji;

  for (const [pattern, key] of SPIRIT_KEYWORDS) if (pattern.test(name)) return key;

  return BY_CATEGORY[drink.category] ?? "generic";
}

/** Pictogramme proposé par défaut à la création d’une boisson. */
export function defaultIconKeyForCategory(category: DrinkCategory): DrinkIconKey {
  return BY_CATEGORY[category] ?? "generic";
}

/**
 * Teinte du pictogramme : chaque verre porte la couleur de ce qu’il contient —
 * bière dorée, vin rouge bordeaux, Cuba Libre brun.
 *
 * Comme la clé d’icône, la teinte n’est PAS stockée : elle se déduit du nom et
 * du pictogramme. Les boissons déjà créées se colorent donc sans migration, et
 * renommer « Vin » en « Vin blanc » suffit à changer la couleur.
 *
 * La palette reste sourde et chaude, dans le ton de la DA, et chaque teinte
 * tient au moins 3:1 sur les fonds clairs de l’application (WCAG 1.4.11).
 */
export type DrinkTint =
  | "blonde" | "ambre" | "brune" | "bordeaux" | "rose"
  | "paille" | "menthe" | "genievre" | "glace" | "terra" | "morocco";

export const DRINK_TINTS: Record<DrinkTint, string> = {
  blonde: "#B07C0A",   // bière blonde, tequila
  ambre: "#8F4E14",    // whisky, rhum ambré, bière rousse
  brune: "#5B3520",    // Cuba Libre, cola, stout
  bordeaux: "#7B2233", // vin rouge, sangria
  rose: "#B94E72",     // vin rosé, vin gris
  paille: "#77792F",   // vin blanc, pastis, margarita
  menthe: "#2E7D55",   // mojito, caipirinha
  genievre: "#1F7A72", // gin, gin tonic
  glace: "#6A7480",    // vodka, rhum blanc
  terra: "#B5543C",    // cocktails — couleur de la DA
  morocco: "#1E4A3A",  // boisson non identifiée — couleur de la DA
};

/**
 * Le nom décide avant le verre : deux boissons partagent le pictogramme
 * « cocktail » sans partager la couleur. L’ordre compte — « Vodka Orange » doit
 * être orange, pas glacé, donc la règle du jus passe avant celle de l’alcool.
 */
const TINT_KEYWORDS: ReadonlyArray<[RegExp, DrinkTint]> = [
  [/cuba libre|rhum[ -]?coca|rum[ -]?coke|\bcoca\b|\bcola\b/, "brune"],
  [/mojito|caipi|\bmenthe\b|\bmint\b|absinthe/, "menthe"],
  [/gin[ -]?tonic|\bgin\b|genievre/, "genievre"],
  [/spritz|aperol|campari|negroni|punch|sunrise|mai tai|\borange\b/, "terra"],
  [/cosmopolitan|vin (rose|gris)|\brose\b|\bgris\b/, "rose"],
  [/colada|margarita|pastis|ricard|anis|limoncello|\bcitron\b|vin blanc|champagne|prosecco|cremant|mousseux/, "paille"],
  [/whisk(y|ey)|bourbon|scotch|cognac|armagnac|brandy|\bipa\b|ambre|rousse/, "ambre"],
  [/\bstout\b|\bporter\b|\bbrune\b|\bnoire\b/, "brune"],
  [/sangria|\brouge\b|merlot|syrah|cabernet|pinot|bordeaux/, "bordeaux"],
  [/rhum blanc|white rum|\bvodka\b/, "glace"],
  [/\btequila\b|mezcal|\bblonde\b|\bblanche\b|\bpils\b|lager|weizen/, "blonde"],
];

const TINT_BY_ICON: Record<DrinkIconKey, DrinkTint> = {
  beer: "blonde",
  wine: "bordeaux",
  cocktail: "terra",
  whisky: "ambre",
  rum: "ambre",
  vodka: "glace",
  gin: "genievre",
  generic: "morocco",
};

export function resolveDrinkTint(drink: { icon: string; name: string; category: DrinkCategory }): DrinkTint {
  const name = normalize(drink.name);
  for (const [pattern, tint] of TINT_KEYWORDS) if (pattern.test(name)) return tint;
  return TINT_BY_ICON[resolveDrinkIconKey(drink)] ?? "morocco";
}

/** Teinte d’un pictogramme seul, pour le sélecteur de la fiche boisson. */
export function tintForIconKey(key: DrinkIconKey): DrinkTint {
  return TINT_BY_ICON[key] ?? "morocco";
}
