import type { Challenge, ChallengeTarget, Drink, DrinkEntry, Participant, TripPhoto, WaterEntry } from "./types";
import { getTripDayKey, getTripDayRange } from "@/lib/trip-day";
import { getZonedParts } from "@/lib/timezone";

export interface ChallengeProgress {
  current: number;
  target: number;
  completed: boolean;
  automatic: boolean;
  label: string;
}

export interface ChallengePreset {
  title: string;
  description: string;
  targetType: ChallengeTarget;
  targetValue: number;
  period: "day" | "trip";
}

export const CHALLENGE_PRESETS: ChallengePreset[] = [
  { title: "Hydratation", description: "Boire 4 eaux pendant la journée de voyage.", targetType: "water_count", targetValue: 4, period: "day" },
  { title: "Explorateur", description: "Tester 5 boissons différentes pendant le séjour.", targetType: "drink_variety", targetValue: 5, period: "trip" },
  { title: "Sans spiritueux", description: "Terminer une journée sans spiritueux.", targetType: "no_spirits", targetValue: 1, period: "day" },
  { title: "Eau de l’après-midi", description: "Enregistrer une eau après 13h.", targetType: "water_after_13", targetValue: 1, period: "day" },
  { title: "Nouveau cocktail", description: "Découvrir un cocktail jamais encore essayé.", targetType: "new_cocktail", targetValue: 1, period: "trip" },
  { title: "Bon réflexe", description: "Boire une eau entre deux consommations.", targetType: "water_between_drinks", targetValue: 1, period: "day" },
  { title: "Le crew entier", description: "Faire une tournée pour tout le groupe.", targetType: "full_round", targetValue: 1, period: "day" },
  { title: "Souvenir de groupe", description: "Ajouter une photo avec tout le groupe.", targetType: "group_photo", targetValue: 1, period: "day" },
  { title: "Tour du bar", description: "Goûter trois catégories différentes dans la journée.", targetType: "category_variety", targetValue: 3, period: "day" },
  { title: "Choix du crew", description: "Faire choisir sa prochaine boisson par un autre membre.", targetType: "manual", targetValue: 1, period: "day" },
];

export const SAFE_FORFEITS = [
  "Faire choisir ta prochaine boisson par le groupe",
  "Faire une photo ridicule",
  "Faire le prochain toast",
  "Choisir la prochaine musique",
  "Commander avec un accent choisi par le groupe",
  "Faire une photo avec un accessoire improbable",
  "Raconter ton moment le plus gênant",
  "Faire une tournée d’eau pour tout le monde",
] as const;

function relevant<T extends { participantId: string }>(items: T[], challenge: Challenge): T[] {
  return challenge.scope === "individual" && challenge.participantId
    ? items.filter((item) => item.participantId === challenge.participantId)
    : items;
}

function inPeriod(timestamp: string, challenge: Challenge, timezone?: string): boolean {
  return challenge.period === "trip" || getTripDayKey(timestamp, timezone) === challenge.dayKey;
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
    case "manual":
      current = 0; label = "À valider ensemble"; break;
  }
  return { current: Math.min(current, target), target, completed: current >= target, automatic: challenge.targetType !== "manual", label };
}

export function effectiveChallengeStatus(challenge: Challenge, progress: ChallengeProgress): Challenge["status"] {
  if (challenge.status !== "active") return challenge.status;
  return progress.completed ? "completed" : "active";
}
