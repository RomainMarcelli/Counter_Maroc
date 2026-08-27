"use client";

import { createContext, useCallback, useContext, useEffect, useMemo } from "react";
import { useTrip } from "./trip-provider";
import { useClock } from "@/lib/use-now";
import {
  ABSORPTION_MINUTES,
  buildAlcoholEvents,
  buildBacProfile,
  calculateParticipantBacStats,
  canSeeBac,
} from "@/domain/bac";
import type { AlcoholEvent, BacProfile, ParticipantBacStats } from "@/domain/bac";
import type { Participant } from "@/domain/types";

/**
 * L’absorption monte sans qu’on touche à l’écran : il faut recalculer tout seul.
 * Une demi-minute suffit — la courbe est linéaire par morceaux, pas besoin d’aller
 * à la seconde.
 */
const REFRESH_MS = 30_000;

/**
 * Petite tolérance de gigue : `refresh()` est déclenché juste après l’écriture du
 * verre, l’écart ne peut être que de quelques millisecondes.
 */
const JITTER_MS = 2_000;

export interface BacRow {
  participant: Participant;
  profile: BacProfile | null;
  /** `false` quand la personne garde son taux pour elle. */
  visible: boolean;
  events: AlcoholEvent[];
  /** `null` sans profil exploitable, ou si le taux est privé. */
  stats: ParticipantBacStats | null;
  /** Verres encore en cours d’absorption : pas encore passés dans le sang. */
  absorbing: number;
}

interface BacContextValue {
  /** L’instant partagé par TOUTES les vues d’alcoolémie. */
  now: number;
  /** Recale l’horloge : le bouton de la page Alcoolémie et l’ajout d’un verre s’en servent. */
  refresh: () => void;
  /** Une ligne par participant encore présent, dans l’ordre du séjour. */
  rows: BacRow[];
  rowFor: (participantId: string | null | undefined) => BacRow | null;
}

const BacContext = createContext<BacContextValue | null>(null);

/**
 * Source de vérité unique de l’alcoolémie.
 *
 * Le résumé de l’écran Rapide, les cartes de la page Alcoolémie, la modale de
 * détail et le Bilan lisaient auparavant chacun leur propre horloge et refaisaient
 * leur propre calcul. Deux vues ouvertes au même moment pouvaient donc afficher
 * deux taux différents, l’écart valant simplement le décalage entre leurs horloges
 * — ce qui, en pleine absorption, se voit tout de suite.
 *
 * Ici, un seul `now`, une seule construction des événements, un seul appel moteur.
 * Les vues ne font plus que lire.
 */
export function BacProvider({ children }: { children: React.ReactNode }) {
  const { participants, activeParticipants, drinks, drinkEntries, actorId } = useTrip();
  const { now, refresh } = useClock(REFRESH_MS);

  // Un verre ajouté entre deux tics doit compter immédiatement. Sans ce recalage,
  // l’estimation restait évaluée à un instant ANTÉRIEUR à la consommation : le verre
  // pesait zéro et l’affichage semblait figé jusqu’au tic suivant.
  useEffect(() => { refresh(); }, [drinkEntries, refresh]);

  const byId = useMemo(() => {
    const rows = new Map<string, BacRow>();
    for (const participant of participants) {
      const visible = canSeeBac(participant, actorId);
      const profile = buildBacProfile(participant);
      const events = buildAlcoholEvents(drinkEntries, drinks, participant.id);
      const stats = profile && visible ? calculateParticipantBacStats({ profile, events, now }) : null;
      const absorbing = events.filter((event) => {
        const elapsed = now - Date.parse(event.consumedAt);
        return elapsed > -JITTER_MS && elapsed < ABSORPTION_MINUTES * 60_000;
      }).length;
      rows.set(participant.id, { participant, profile, visible, events, stats, absorbing });
    }
    return rows;
  }, [participants, drinks, drinkEntries, actorId, now]);

  const rows = useMemo(
    () => activeParticipants.map((participant) => byId.get(participant.id)).filter((row): row is BacRow => Boolean(row)),
    [activeParticipants, byId],
  );

  const rowFor = useCallback(
    (participantId: string | null | undefined) => (participantId ? byId.get(participantId) ?? null : null),
    [byId],
  );

  const value = useMemo<BacContextValue>(() => ({ now, refresh, rows, rowFor }), [now, refresh, rows, rowFor]);
  return <BacContext.Provider value={value}>{children}</BacContext.Provider>;
}

export function useBac(): BacContextValue {
  const value = useContext(BacContext);
  if (!value) throw new Error("useBac doit être utilisé dans BacProvider");
  return value;
}
