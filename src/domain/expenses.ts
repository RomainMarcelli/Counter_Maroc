import type { Drink, DrinkEntry, Participant } from "./types";

/** Monnaie du séjour : le bar de Marrakech encaisse en dirhams. */
export const CURRENCY_LABEL = "DH";

export interface ExpenseBalance {
  participantId: string;
  name: string;
  paidCents: number;
  consumedCents: number;
  /** Positif : le crew lui doit de l’argent. Négatif : il doit au crew. */
  balanceCents: number;
}

export interface Settlement {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amountCents: number;
}

export interface TripExpenses {
  totalCents: number;
  pricedEntries: number;
  unpricedEntries: number;
  balances: ExpenseBalance[];
  settlements: Settlement[];
}

/** Prix d’une consommation : le snapshot du jour prime sur le tarif actuel de la carte. */
export function entryPriceCents(entry: DrinkEntry, drinkById: Map<string, Drink>): number | null {
  if (typeof entry.priceCentsSnapshot === "number" && Number.isFinite(entry.priceCentsSnapshot)) return entry.priceCentsSnapshot;
  const price = drinkById.get(entry.drinkId)?.priceCents;
  return typeof price === "number" && Number.isFinite(price) ? price : null;
}

export function formatCents(cents: number): string {
  return `${(Math.round(cents) / 100).toFixed(2).replace(".", ",")} ${CURRENCY_LABEL}`;
}

/**
 * Qui a payé quoi, qui a bu quoi, et le plus court chemin pour se rembourser.
 * Une consommation sans prix connu est comptée à part plutôt qu’estimée à zéro en silence.
 */
export function calculateTripExpenses(participants: Participant[], drinks: Drink[], entries: DrinkEntry[]): TripExpenses {
  const activeParticipants = participants.filter((participant) => !participant.deletedAt);
  const drinkById = new Map(drinks.map((drink) => [drink.id, drink]));
  const known = new Set(activeParticipants.map((participant) => participant.id));
  const paid = new Map<string, number>();
  const consumed = new Map<string, number>();
  let totalCents = 0;
  let pricedEntries = 0;
  let unpricedEntries = 0;

  for (const entry of entries) {
    if (entry.deletedAt || !known.has(entry.participantId)) continue;
    const price = entryPriceCents(entry, drinkById);
    if (price === null || price <= 0) {
      unpricedEntries += 1;
      continue;
    }
    pricedEntries += 1;
    totalCents += price;
    consumed.set(entry.participantId, (consumed.get(entry.participantId) ?? 0) + price);
    const payer = entry.paidBy && known.has(entry.paidBy) ? entry.paidBy : entry.participantId;
    paid.set(payer, (paid.get(payer) ?? 0) + price);
  }

  const balances: ExpenseBalance[] = activeParticipants
    .map((participant) => {
      const paidCents = paid.get(participant.id) ?? 0;
      const consumedCents = consumed.get(participant.id) ?? 0;
      return { participantId: participant.id, name: participant.name, paidCents, consumedCents, balanceCents: paidCents - consumedCents };
    })
    .sort((a, b) => b.balanceCents - a.balanceCents);

  const creditors = balances.filter((item) => item.balanceCents > 0).map((item) => ({ ...item }));
  const debtors = balances.filter((item) => item.balanceCents < 0).map((item) => ({ ...item, balanceCents: -item.balanceCents }));
  const settlements: Settlement[] = [];
  let creditorIndex = 0;
  let debtorIndex = 0;
  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const amountCents = Math.min(creditor.balanceCents, debtor.balanceCents);
    if (amountCents >= 1) settlements.push({ fromId: debtor.participantId, fromName: debtor.name, toId: creditor.participantId, toName: creditor.name, amountCents });
    creditor.balanceCents -= amountCents;
    debtor.balanceCents -= amountCents;
    if (creditor.balanceCents < 1) creditorIndex += 1;
    if (debtor.balanceCents < 1) debtorIndex += 1;
  }

  return { totalCents, pricedEntries, unpricedEntries, balances, settlements };
}
