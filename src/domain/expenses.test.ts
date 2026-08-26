import { describe, expect, it } from "vitest";
import { calculateTripExpenses, formatCents } from "./expenses";
import type { Drink, DrinkEntry, Participant } from "./types";
import { DRINK_DEFAULTS, ENTRY_DEFAULTS, PARTICIPANT_DEFAULTS } from "@/test/factories";

const base = { tripId: "trip", createdAt: "2026-09-07T10:00:00Z", updatedAt: "2026-09-07T10:00:00Z", deletedAt: null };
const participants: Participant[] = [
  { ...base, ...PARTICIPANT_DEFAULTS, id: "romain", name: "Romain", avatarUrl: null, colorIndex: 0, sortOrder: 0 },
  { ...base, ...PARTICIPANT_DEFAULTS, id: "lucas", name: "Lucas", avatarUrl: null, colorIndex: 1, sortOrder: 1 },
  { ...base, ...PARTICIPANT_DEFAULTS, id: "theo", name: "Théo", avatarUrl: null, colorIndex: 2, sortOrder: 2 },
];
const drinks: Drink[] = [
  { ...base, ...DRINK_DEFAULTS, id: "beer", name: "Bière locale", category: "beer", icon: "🍺", isAlcohol: true, isSystem: true, sortOrder: 0, priceCents: 5000 },
  { ...base, ...DRINK_DEFAULTS, id: "mojito", name: "Mojito", category: "cocktail", icon: "🌿", isAlcohol: true, isSystem: true, sortOrder: 1, priceCents: 9000 },
  { ...base, ...DRINK_DEFAULTS, id: "mystere", name: "Sans prix", category: "cocktail", icon: "🍹", isAlcohol: true, isSystem: true, sortOrder: 2 },
];
let sequence = 0;
const entry = (participantId: string, drinkId: string, paidBy: string | null, overrides: Partial<DrinkEntry> = {}): DrinkEntry => ({
  ...base, ...ENTRY_DEFAULTS, id: `e${(sequence += 1)}`, participantId, drinkId, consumedAt: base.createdAt, actionBy: "device", deviceId: "device", roundId: null, paidBy, ...overrides,
});

describe("calculateTripExpenses", () => {
  it("attribue la dépense au payeur et la consommation au buveur", () => {
    // Romain paie une tournée de trois bières.
    const entries = participants.map((participant) => entry(participant.id, "beer", "romain"));
    const expenses = calculateTripExpenses(participants, drinks, entries);

    expect(expenses.totalCents).toBe(15_000);
    expect(expenses.balances.find((item) => item.participantId === "romain")).toMatchObject({ paidCents: 15_000, consumedCents: 5_000, balanceCents: 10_000 });
    expect(expenses.balances.find((item) => item.participantId === "lucas")).toMatchObject({ paidCents: 0, consumedCents: 5_000, balanceCents: -5_000 });
  });

  it("propose le remboursement le plus court", () => {
    const entries = participants.map((participant) => entry(participant.id, "beer", "romain"));
    const { settlements } = calculateTripExpenses(participants, drinks, entries);

    expect(settlements).toHaveLength(2);
    expect(settlements.every((settlement) => settlement.toId === "romain")).toBe(true);
    expect(settlements.reduce((total, settlement) => total + settlement.amountCents, 0)).toBe(10_000);
  });

  it("s’équilibre quand chacun a payé sa part", () => {
    const entries = participants.map((participant) => entry(participant.id, "beer", participant.id));
    const { settlements, balances } = calculateTripExpenses(participants, drinks, entries);

    expect(settlements).toEqual([]);
    expect(balances.every((item) => item.balanceCents === 0)).toBe(true);
  });

  it("compte à part les consommations sans prix connu au lieu de les estimer à zéro", () => {
    const entries = [entry("romain", "beer", "romain"), entry("lucas", "mystere", "romain")];
    const expenses = calculateTripExpenses(participants, drinks, entries);

    expect(expenses.pricedEntries).toBe(1);
    expect(expenses.unpricedEntries).toBe(1);
    expect(expenses.totalCents).toBe(5_000);
  });

  it("utilise le prix figé au moment du verre plutôt que le tarif actuel", () => {
    const entries = [entry("romain", "mojito", "romain", { priceCentsSnapshot: 6_000 })];
    expect(calculateTripExpenses(participants, drinks, entries).totalCents).toBe(6_000);
  });

  it("retombe sur le buveur quand le payeur est inconnu", () => {
    const entries = [entry("lucas", "beer", "quelqu-un-hors-sejour")];
    const expenses = calculateTripExpenses(participants, drinks, entries);
    expect(expenses.balances.find((item) => item.participantId === "lucas")).toMatchObject({ paidCents: 5_000, balanceCents: 0 });
  });

  it("ignore les consommations supprimées", () => {
    const entries = [entry("romain", "beer", "romain", { deletedAt: "2026-09-08T10:00:00Z" })];
    expect(calculateTripExpenses(participants, drinks, entries).totalCents).toBe(0);
  });
});

describe("formatCents", () => {
  it("affiche un montant en dirhams", () => {
    expect(formatCents(5_000)).toBe("50,00 DH");
    expect(formatCents(0)).toBe("0,00 DH");
  });
});
