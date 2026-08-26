import { describe, expect, it } from "vitest";
import { calculateDrinkAlcoholGrams, calculatePureAlcoholGrams, equivalentAbvPercent, hasAlcoholComposition } from "./alcohol";
import type { DrinkComposition } from "./types";

const drink = (composition: Partial<DrinkComposition>): DrinkComposition => ({
  isAlcohol: true,
  servingVolumeMl: null,
  abvPercent: null,
  alcoholComponents: null,
  ...composition,
});

describe("calculatePureAlcoholGrams", () => {
  it("convertit une dose de whisky en alcool pur", () => {
    // 40 × 0,40 × 0,789 = 12,624 g
    expect(calculatePureAlcoholGrams(40, 40)).toBeCloseTo(12.624, 3);
    expect(calculatePureAlcoholGrams(40, 40)).toBeCloseTo(12.62, 2);
  });

  it("additionne deux whiskys identiques", () => {
    expect(calculatePureAlcoholGrams(40, 40) * 2).toBeCloseTo(25.248, 3);
  });

  it("convertit une bière de 25 cl à 5 %", () => {
    expect(calculatePureAlcoholGrams(250, 5)).toBeCloseTo(9.86, 2);
  });

  it("renvoie zéro pour des valeurs absentes ou absurdes", () => {
    expect(calculatePureAlcoholGrams(0, 40)).toBe(0);
    expect(calculatePureAlcoholGrams(40, 0)).toBe(0);
    expect(calculatePureAlcoholGrams(-40, 40)).toBe(0);
    expect(calculatePureAlcoholGrams(Number.NaN, 40)).toBe(0);
  });
});

describe("calculateDrinkAlcoholGrams", () => {
  it("utilise le volume et le degré d’une boisson simple", () => {
    expect(calculateDrinkAlcoholGrams(drink({ servingVolumeMl: 40, abvPercent: 40 }))).toBeCloseTo(12.624, 3);
  });

  it("ne compte que les alcools d’un cocktail, jamais le volume total du verre", () => {
    const mojito = drink({ servingVolumeMl: 250, alcoholComponents: [{ name: "Rhum", volumeMl: 40, abvPercent: 40 }] });
    expect(calculateDrinkAlcoholGrams(mojito)).toBeCloseTo(12.624, 3);
    // Un calcul naïf sur les 250 ml donnerait presque huit fois plus.
    expect(calculateDrinkAlcoholGrams(mojito)).toBeLessThan(calculatePureAlcoholGrams(250, 40));
  });

  it("additionne plusieurs alcools d’une même recette", () => {
    const cocktail = drink({
      servingVolumeMl: 200,
      alcoholComponents: [
        { name: "Vodka", volumeMl: 30, abvPercent: 40 },
        { name: "Liqueur", volumeMl: 20, abvPercent: 20 },
      ],
    });
    // 30 × 0,40 × 0,789 + 20 × 0,20 × 0,789 = 9,468 + 3,156
    expect(calculateDrinkAlcoholGrams(cocktail)).toBeCloseTo(12.624, 3);
  });

  it("privilégie les composants sur le degré global quand les deux existent", () => {
    const both = drink({ servingVolumeMl: 250, abvPercent: 40, alcoholComponents: [{ name: "Rhum", volumeMl: 40, abvPercent: 40 }] });
    expect(calculateDrinkAlcoholGrams(both)).toBeCloseTo(12.624, 3);
  });

  it("renvoie null quand la composition est inconnue", () => {
    expect(calculateDrinkAlcoholGrams(drink({}))).toBeNull();
    expect(calculateDrinkAlcoholGrams(drink({ servingVolumeMl: 250 }))).toBeNull();
    expect(hasAlcoholComposition(drink({}))).toBe(false);
    expect(hasAlcoholComposition(drink({ servingVolumeMl: 250, abvPercent: 5 }))).toBe(true);
  });

  it("renvoie zéro pour une boisson sans alcool", () => {
    expect(calculateDrinkAlcoholGrams(drink({ isAlcohol: false }))).toBe(0);
  });
});

describe("equivalentAbvPercent", () => {
  it("ramène un cocktail à un degré de verre entier", () => {
    const mojito = drink({ servingVolumeMl: 250, alcoholComponents: [{ name: "Rhum", volumeMl: 40, abvPercent: 40 }] });
    expect(equivalentAbvPercent(mojito)).toBeCloseTo(6.4, 1);
  });

  it("renvoie null sans volume connu", () => {
    expect(equivalentAbvPercent(drink({ alcoholComponents: [{ name: "Rhum", volumeMl: 40, abvPercent: 40 }] }))).toBeNull();
  });
});
