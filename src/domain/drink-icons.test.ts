import { describe, expect, it } from "vitest";
import { DRINK_TINTS, defaultIconKeyForCategory, isDrinkIconKey, resolveDrinkIconKey, resolveDrinkTint, tintForIconKey } from "./drink-icons";
import { SYSTEM_DRINKS } from "./constants";
import type { DrinkCategory } from "./types";

const drink = (name: string, category: DrinkCategory, icon: string) => ({ name, category, icon });

describe("clé de pictogramme", () => {
  it("respecte une clé déjà enregistrée", () => {
    expect(resolveDrinkIconKey(drink("Peu importe", "beer", "whisky"))).toBe("whisky");
    expect(isDrinkIconKey("cocktail")).toBe(true);
    expect(isDrinkIconKey("🍹")).toBe(false);
  });

  it("reconnaît un spiritueux par son nom plutôt que par son emoji", () => {
    // « Gin » et « Gin Tonic » partagent l’emoji 🍸 mais ne sont pas le même verre.
    expect(resolveDrinkIconKey(drink("Gin", "spirit", "🍸"))).toBe("gin");
    expect(resolveDrinkIconKey(drink("Gin Tonic", "cocktail", "🍸"))).toBe("cocktail");
    expect(resolveDrinkIconKey(drink("Whisky", "spirit", "🥃"))).toBe("whisky");
    expect(resolveDrinkIconKey(drink("Rhum ambré", "spirit", "🥃"))).toBe("rum");
    expect(resolveDrinkIconKey(drink("Vodka", "spirit", "🧊"))).toBe("vodka");
  });

  it("ignore les accents et la casse", () => {
    expect(resolveDrinkIconKey(drink("RHUM BLANC", "spirit", ""))).toBe("rum");
    expect(resolveDrinkIconKey(drink("Whiskey irlandais", "spirit", ""))).toBe("whisky");
  });

  it("relit les anciennes boissons créées avec un emoji", () => {
    expect(resolveDrinkIconKey(drink("Bière locale", "beer", "🍺"))).toBe("beer");
    expect(resolveDrinkIconKey(drink("Vin blanc", "wine", "🥂"))).toBe("wine");
    expect(resolveDrinkIconKey(drink("Mojito", "cocktail", "🌿"))).toBe("cocktail");
  });

  it("retombe sur la catégorie quand rien d’autre ne parle", () => {
    expect(resolveDrinkIconKey(drink("Mystère du bar", "cocktail", "🌿"))).toBe("cocktail");
    expect(resolveDrinkIconKey(drink("Pastis", "spirit", "🧊"))).toBe("generic");
    expect(resolveDrinkIconKey(drink("Tequila", "spirit", "🍋"))).toBe("generic");
    expect(defaultIconKeyForCategory("wine")).toBe("wine");
  });

  it("donne un pictogramme à chaque boisson livrée avec l’application", () => {
    const mapped = SYSTEM_DRINKS.map((template) => [template.name, resolveDrinkIconKey(template)] as const);
    expect(mapped.every(([, key]) => key.length > 0)).toBe(true);
    expect(Object.fromEntries(mapped)).toMatchObject({
      "Bière locale": "beer",
      "Vin rouge": "wine",
      Whisky: "whisky",
      "Rhum blanc": "rum",
      Vodka: "vodka",
      Gin: "gin",
      Mojito: "cocktail",
      Margarita: "cocktail",
    });
  });
});

describe("teinte du verre", () => {
  it("prend la couleur du contenu, pas celle du verre", () => {
    // Même pictogramme « cocktail », trois couleurs : c’est le nom qui tranche.
    expect(resolveDrinkTint(drink("Cuba Libre", "cocktail", "cocktail"))).toBe("brune");
    expect(resolveDrinkTint(drink("Mojito", "cocktail", "cocktail"))).toBe("menthe");
    expect(resolveDrinkTint(drink("Spritz", "cocktail", "cocktail"))).toBe("terra");
  });

  it("distingue les vins entre eux", () => {
    expect(resolveDrinkTint(drink("Vin rouge", "wine", "wine"))).toBe("bordeaux");
    expect(resolveDrinkTint(drink("Vin blanc", "wine", "wine"))).toBe("paille");
    expect(resolveDrinkTint(drink("Vin rosé", "wine", "wine"))).toBe("rose");
    expect(resolveDrinkTint(drink("Vin gris", "wine", "wine"))).toBe("rose");
  });

  it("sépare le rhum blanc du rhum ambré malgré le même pictogramme", () => {
    expect(resolveDrinkIconKey(drink("Rhum blanc", "spirit", ""))).toBe("rum");
    expect(resolveDrinkIconKey(drink("Rhum ambré", "spirit", ""))).toBe("rum");
    expect(resolveDrinkTint(drink("Rhum blanc", "spirit", ""))).toBe("glace");
    expect(resolveDrinkTint(drink("Rhum ambré", "spirit", ""))).toBe("ambre");
  });

  it("montre le jus plutôt que l’alcool quand le nom le nomme", () => {
    // « Vodka Orange » est orange : la règle du jus passe avant celle de la vodka.
    expect(resolveDrinkTint(drink("Vodka Orange", "cocktail", "cocktail"))).toBe("terra");
    expect(resolveDrinkTint(drink("Vodka", "spirit", "vodka"))).toBe("glace");
  });

  it("retombe sur le pictogramme quand le nom ne dit rien", () => {
    expect(resolveDrinkTint(drink("Marrakech", "cocktail", "cocktail"))).toBe("terra");
    expect(resolveDrinkTint(drink("Mystère du bar", "spirit", "generic"))).toBe("morocco");
    expect(tintForIconKey("beer")).toBe("blonde");
  });

  it("donne une teinte connue à chaque boisson livrée avec l’application", () => {
    const mapped = SYSTEM_DRINKS.map((template) => [template.name, resolveDrinkTint(template)] as const);
    expect(mapped.every(([, tint]) => tint in DRINK_TINTS)).toBe(true);
    expect(Object.fromEntries(mapped)).toMatchObject({
      Casablanca: "blonde",
      "Vin rouge": "bordeaux",
      Whisky: "ambre",
      Gin: "genievre",
      "Cuba Libre": "brune",
      Mojito: "menthe",
      Pastis: "paille",
      Tequila: "blonde",
    });
  });
});
