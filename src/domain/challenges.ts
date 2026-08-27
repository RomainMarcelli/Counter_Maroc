import type { Challenge, ChallengeTarget, Drink, DrinkEntry, Participant, TripPhoto, WaterEntry } from "./types";
import { addCalendarDays as addTripDays, getTripDayKey, getTripDayRange } from "@/lib/trip-day";
import { getZonedParts } from "@/lib/timezone";

export interface ChallengeProgress {
  current: number;
  target: number;
  completed: boolean;
  automatic: boolean;
  label: string;
}

export interface ChallengePreset {
  id: string;
  title: string;
  description: string;
  targetType: ChallengeTarget;
  targetValue: number;
  period: "day" | "trip";
  /**
   * Portée par défaut du défi. Elle appartient au preset, pas à l’écran :
   * « Le crew entier » demande une tournée pour tout le groupe, il ne peut pas
   * être attribué à une seule personne.
   */
  defaultScope: "individual" | "group";
}

/**
 * Les défis portent sur la découverte, la variété et les interactions du crew.
 * Aucun ne récompense la vitesse ni la quantité : pas d’enchaînement, pas de
 * « cul sec », pas d’objectif du type « dix verres aujourd’hui ».
 */
export const CHALLENGE_PRESETS: ChallengePreset[] = [
  // — Individuels : hydratation et rythme
  { id: "hydration", title: "Hydratation", description: "Boire 4 eaux pendant la journée de voyage.", targetType: "water_count", targetValue: 4, period: "day", defaultScope: "individual" },
  { id: "afternoon-water", title: "Eau de l’après-midi", description: "Enregistrer une eau après 13h.", targetType: "water_after_13", targetValue: 1, period: "day", defaultScope: "individual" },
  { id: "good-reflex", title: "Bon réflexe", description: "Boire une eau entre deux consommations.", targetType: "water_between_drinks", targetValue: 1, period: "day", defaultScope: "individual" },
  { id: "no-spirits", title: "Sans spiritueux", description: "Terminer une journée sans spiritueux.", targetType: "no_spirits", targetValue: 1, period: "day", defaultScope: "individual" },

  // — Individuels : découverte
  { id: "cocktail-explorer", title: "Explorateur cocktails", description: "Tester 3 cocktails différents aujourd’hui.", targetType: "cocktail_variety", targetValue: 3, period: "day", defaultScope: "individual" },
  { id: "new-discovery", title: "Nouvelle découverte", description: "Commander une boisson alcoolisée jamais prise depuis le début du séjour.", targetType: "new_drink", targetValue: 1, period: "day", defaultScope: "individual" },
  { id: "bar-tour", title: "Tour du bar", description: "Goûter trois catégories différentes dans la journée.", targetType: "category_variety", targetValue: 3, period: "day", defaultScope: "individual" },
  { id: "new-cocktail", title: "Nouveau cocktail", description: "Découvrir un cocktail jamais encore essayé.", targetType: "new_cocktail", targetValue: 1, period: "trip", defaultScope: "individual" },
  { id: "neighbour-cocktail", title: "Cocktail du voisin", description: "Tester la boisson favorite d’un autre membre du crew.", targetType: "other_favorite", targetValue: 1, period: "trip", defaultScope: "individual" },
  { id: "marrakech-spirit", title: "Esprit Marrakech", description: "Tester le cocktail Marrakech de l’hôtel.", targetType: "signature_drink", targetValue: 1, period: "trip", defaultScope: "individual" },
  { id: "loyalty", title: "Fidélité", description: "Prendre sa boisson favorite au moins une fois aujourd’hui.", targetType: "own_favorite", targetValue: 1, period: "day", defaultScope: "individual" },
  { id: "new-evening", title: "Nouvelle soirée", description: "Tester au moins une boisson différente de celles de la veille.", targetType: "different_from_yesterday", targetValue: 1, period: "day", defaultScope: "individual" },
  { id: "trip-variety", title: "Variété du séjour", description: "Tester 8 boissons alcoolisées différentes pendant le séjour.", targetType: "drink_variety", targetValue: 8, period: "trip", defaultScope: "individual" },
  { id: "all-categories", title: "Les quatre familles", description: "Tester au moins une bière, un vin, un cocktail et un spiritueux pendant le séjour.", targetType: "all_categories", targetValue: 4, period: "trip", defaultScope: "individual" },

  // — Groupe : ce que personne ne peut réussir seul
  { id: "full-round", title: "Le crew entier", description: "Faire une tournée pour tout le groupe.", targetType: "full_round", targetValue: 1, period: "day", defaultScope: "group" },
  { id: "team-cocktail", title: "Team cocktail", description: "Tout le crew prend le même cocktail pendant une tournée.", targetType: "same_cocktail_round", targetValue: 1, period: "day", defaultScope: "group" },
  { id: "crew-photo", title: "Photo du crew", description: "Prendre une photo avec les quatre membres, puis la valider ensemble.", targetType: "manual", targetValue: 1, period: "day", defaultScope: "group" },
  { id: "memory-photo", title: "Souvenir du jour", description: "Ajouter une photo souvenir aujourd’hui.", targetType: "group_photo", targetValue: 1, period: "day", defaultScope: "group" },
  { id: "crew-choice", title: "Choix du crew", description: "Faire choisir sa prochaine boisson par un autre membre.", targetType: "manual", targetValue: 1, period: "day", defaultScope: "individual" },
];

export const SAFE_FORFEITS = [
  "Faire le prochain toast",
  "Choisir la prochaine musique",
  "Faire une photo ridicule",
  "Commander avec un accent choisi par le groupe",
  "Laisser le groupe choisir ta prochaine boisson",
  "Tester la boisson favorite d’un autre membre",
  "Faire une tournée d’eau pour tout le monde",
  "Raconter une anecdote gênante",
  "Choisir le prochain cocktail du groupe",
  "Faire une photo avec les quatre membres",
  "Faire une photo avec un accessoire improbable",
] as const;

function relevant<T extends { participantId: string }>(items: T[], challenge: Challenge): T[] {
  return challenge.scope === "individual" && challenge.participantId
    ? items.filter((item) => item.participantId === challenge.participantId)
    : items;
}

function inPeriod(timestamp: string, challenge: Challenge, timezone?: string): boolean {
  return challenge.period === "trip" || getTripDayKey(timestamp, timezone) === challenge.dayKey;
}

function normalizeName(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function countWaterBetween(drinks: DrinkEntry[], waters: WaterEntry[]): number {
  let count = 0;
  const byParticipant = new Map<string, Array<{ at: string; kind: "drink" | "water" }>>();
  for (const entry of drinks) {
    const bucket = byParticipant.get(entry.participantId) ?? [];
    bucket.push({ at: entry.consumedAt, kind: "drink" });
    byParticipant.set(entry.participantId, bucket);
  }
  for (const entry of waters) {
    const bucket = byParticipant.get(entry.participantId) ?? [];
    bucket.push({ at: entry.consumedAt, kind: "water" });
    byParticipant.set(entry.participantId, bucket);
  }
  for (const events of byParticipant.values()) {
    events.sort((a, b) => a.at.localeCompare(b.at));
    for (let index = 1; index < events.length - 1; index += 1) {
      if (events[index - 1].kind === "drink" && events[index].kind === "water" && events[index + 1].kind === "drink") count += 1;
    }
  }
  return count;
}

/** Boisson la plus prise par quelqu’un sur tout le séjour, hors supprimées. */
function favoriteDrinkId(entries: DrinkEntry[], participantId: string): string | null {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (entry.deletedAt || entry.participantId !== participantId) continue;
    counts.set(entry.drinkId, (counts.get(entry.drinkId) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/** Personnes concernées : la seule ciblée pour un défi individuel, tout le crew sinon. */
function targetParticipants(challenge: Challenge, participants: Participant[]): Set<string> {
  return challenge.scope === "individual" && challenge.participantId
    ? new Set([challenge.participantId])
    : new Set(participants.filter((item) => !item.deletedAt).map((item) => item.id));
}

function periodStartOf(challenge: Challenge, timezone?: string): string {
  return challenge.period === "day" && challenge.dayKey ? getTripDayRange(challenge.dayKey, timezone).start : challenge.createdAt;
}

export function calculateChallengeProgress(
  challenge: Challenge,
  participants: Participant[],
  drinks: Drink[],
  drinkEntries: DrinkEntry[],
  waterEntries: WaterEntry[],
  photos: TripPhoto[] = [],
  now = new Date(),
  timezone?: string,
): ChallengeProgress {
  const target = Math.max(1, challenge.targetValue);
  if (challenge.status === "completed") return { current: target, target, completed: true, automatic: challenge.targetType !== "manual", label: "Terminé" };
  const alcohol = relevant(drinkEntries.filter((entry) => !entry.deletedAt && inPeriod(entry.consumedAt, challenge, timezone)), challenge);
  const waters = relevant(waterEntries.filter((entry) => !entry.deletedAt && inPeriod(entry.consumedAt, challenge, timezone)), challenge);
  const periodPhotos = photos.filter((photo) => !photo.deletedAt && inPeriod(photo.takenAt, challenge, timezone));
  const drinkById = new Map(drinks.filter((drink) => !drink.deletedAt).map((drink) => [drink.id, drink]));
  let current = 0;
  let label = "À valider ensemble";

  switch (challenge.targetType) {
    case "water_count":
      current = waters.length; label = `${current} / ${target} eaux`; break;
    case "drink_variety":
      current = new Set(alcohol.map((entry) => entry.drinkId)).size; label = `${current} / ${target} boissons`; break;
    case "category_variety":
      current = new Set(alcohol.map((entry) => drinkById.get(entry.drinkId)?.category).filter(Boolean)).size; label = `${current} / ${target} catégories`; break;
    case "water_after_13":
      current = waters.some((entry) => getZonedParts(entry.consumedAt, timezone).hour >= 13) ? 1 : 0; label = current ? "Eau enregistrée après 13h" : "En attente d’une eau après 13h"; break;
    case "new_cocktail": {
      const participantIds = challenge.scope === "individual" && challenge.participantId ? new Set([challenge.participantId]) : new Set(participants.map((item) => item.id));
      const periodStart = challenge.period === "day" && challenge.dayKey ? getTripDayRange(challenge.dayKey, timezone).start : challenge.createdAt;
      const triedBefore = new Set(drinkEntries.filter((entry) => !entry.deletedAt && participantIds.has(entry.participantId) && entry.consumedAt < periodStart).map((entry) => entry.drinkId));
      current = new Set(alcohol.filter((entry) => drinkById.get(entry.drinkId)?.category === "cocktail" && !triedBefore.has(entry.drinkId)).map((entry) => entry.drinkId)).size;
      label = `${current} / ${target} nouveaux cocktails`; break;
    }
    case "water_between_drinks":
      current = countWaterBetween(alcohol, waters); label = current ? "Eau placée entre deux verres" : "En attente du bon réflexe"; break;
    case "full_round": {
      const activeCount = participants.filter((participant) => !participant.deletedAt).length;
      const rounds = new Map<string, Set<string>>();
      for (const entry of alcohol) if (entry.roundId) {
        const bucket = rounds.get(entry.roundId) ?? new Set<string>();
        bucket.add(entry.participantId); rounds.set(entry.roundId, bucket);
      }
      current = [...rounds.values()].filter((people) => people.size >= activeCount && activeCount > 1).length;
      label = current ? "Tournée complète enregistrée" : "En attente d’une tournée complète"; break;
    }
    case "group_photo":
      current = periodPhotos.length; label = `${current} / ${target} photos`; break;
    case "no_spirits": {
      const spirits = alcohol.filter((entry) => drinkById.get(entry.drinkId)?.category === "spirit").length;
      const closed = challenge.period === "day" && challenge.dayKey ? Date.parse(getTripDayRange(challenge.dayKey, timezone).end) <= now.getTime() : false;
      current = closed && spirits === 0 ? 1 : 0;
      label = spirits ? `${spirits} spiritueux enregistrés` : closed ? "Journée terminée sans spiritueux" : "Aucun spiritueux pour le moment";
      break;
    }
    case "cocktail_variety":
      current = new Set(alcohol.filter((entry) => drinkById.get(entry.drinkId)?.category === "cocktail").map((entry) => entry.drinkId)).size;
      label = `${current} / ${target} cocktails différents`; break;
    case "new_drink": {
      // « Jamais prise » se juge sur tout ce qui précède le début de la période.
      const ids = targetParticipants(challenge, participants);
      const start = periodStartOf(challenge, timezone);
      const before = new Set(drinkEntries.filter((entry) => !entry.deletedAt && ids.has(entry.participantId) && entry.consumedAt < start).map((entry) => entry.drinkId));
      current = new Set(alcohol.filter((entry) => !before.has(entry.drinkId)).map((entry) => entry.drinkId)).size;
      label = current ? "Nouvelle boisson goûtée" : "En attente d’une première"; break;
    }
    case "all_categories": {
      const families = new Set(alcohol.map((entry) => drinkById.get(entry.drinkId)?.category).filter(Boolean));
      current = families.size;
      label = `${current} / ${target} familles`; break;
    }
    case "other_favorite": {
      const ids = targetParticipants(challenge, participants);
      const others = participants.filter((item) => !item.deletedAt && !ids.has(item.id));
      const wanted = new Set(others.map((item) => favoriteDrinkId(drinkEntries, item.id)).filter((value): value is string => Boolean(value)));
      current = alcohol.some((entry) => wanted.has(entry.drinkId)) ? 1 : 0;
      label = current ? "Boisson d’un autre membre goûtée" : wanted.size ? "En attente du verre d’un autre" : "Personne n’a encore de favori"; break;
    }
    case "signature_drink": {
      // Le cocktail signature de l’hôtel : reconnu par son nom, s’il existe dans la carte.
      const signature = new Set([...drinkById.values()].filter((drink) => normalizeName(drink.name).includes("marrakech")).map((drink) => drink.id));
      current = alcohol.some((entry) => signature.has(entry.drinkId)) ? 1 : 0;
      label = !signature.size ? "Ce cocktail n’est pas dans la carte" : current ? "Cocktail Marrakech goûté" : "En attente du cocktail Marrakech"; break;
    }
    case "own_favorite": {
      const ids = [...targetParticipants(challenge, participants)];
      const wanted = new Set(ids.map((id) => favoriteDrinkId(drinkEntries, id)).filter((value): value is string => Boolean(value)));
      current = alcohol.some((entry) => wanted.has(entry.drinkId)) ? 1 : 0;
      label = !wanted.size ? "Pas encore de favori" : current ? "Favori repris" : "En attente du favori"; break;
    }
    case "different_from_yesterday": {
      const ids = targetParticipants(challenge, participants);
      const dayKey = challenge.dayKey ?? getTripDayKey(now, timezone);
      const previous = addTripDays(dayKey, -1);
      const yesterday = new Set(drinkEntries.filter((entry) => !entry.deletedAt && ids.has(entry.participantId) && getTripDayKey(entry.consumedAt, timezone) === previous).map((entry) => entry.drinkId));
      current = alcohol.some((entry) => !yesterday.has(entry.drinkId)) ? 1 : 0;
      label = current ? "Boisson différente de la veille" : yesterday.size ? "Encore les mêmes qu’hier" : "Aucune référence hier"; break;
    }
    case "same_cocktail_round": {
      const activeCount = participants.filter((participant) => !participant.deletedAt).length;
      const byRound = new Map<string, DrinkEntry[]>();
      for (const entry of alcohol) if (entry.roundId) {
        const bucket = byRound.get(entry.roundId) ?? [];
        bucket.push(entry); byRound.set(entry.roundId, bucket);
      }
      current = [...byRound.values()].filter((entries) => {
        const people = new Set(entries.map((entry) => entry.participantId));
        const uniqueDrinks = new Set(entries.map((entry) => entry.drinkId));
        return activeCount > 1 && people.size >= activeCount && uniqueDrinks.size === 1 && drinkById.get(entries[0].drinkId)?.category === "cocktail";
      }).length;
      label = current ? "Tournée du même cocktail" : "En attente d’une tournée identique"; break;
    }
    case "manual":
      current = 0; label = "À valider ensemble"; break;
  }
  return { current: Math.min(current, target), target, completed: current >= target, automatic: challenge.targetType !== "manual", label };
}

export function effectiveChallengeStatus(challenge: Challenge, progress: ChallengeProgress): Challenge["status"] {
  if (challenge.status !== "active") return challenge.status;
  return progress.completed ? "completed" : "active";
}
