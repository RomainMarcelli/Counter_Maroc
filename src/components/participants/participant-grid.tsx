"use client";

import clsx from "clsx";
import { Check, Users } from "lucide-react";
import { ParticipantAvatar } from "./participant-avatar";
import type { Participant } from "@/domain/types";

/**
 * Grille 2 × 2 de sélection d’une personne, dans le même langage visuel que
 * l’écran Rapide : à quatre, une carte large se vise au pouce bien mieux qu’un
 * `<select>` iOS, dont on ne maîtrise ni la hauteur de ligne ni la typographie.
 *
 * Sélection simple ici, contrairement à Rapide où l’on compose une tournée.
 */
export function ParticipantGrid({
  participants,
  value,
  onChange,
  groupLabel,
  highlight = "morocco",
}: {
  participants: Participant[];
  /** `null` désigne le groupe entier lorsque `groupLabel` est fourni. */
  value: string | null;
  onChange: (participantId: string | null) => void;
  /** Affiche un bouton pleine largeur pour viser tout le crew. */
  groupLabel?: string;
  highlight?: "morocco" | "terra";
}) {
  const selectedClass = highlight === "terra" ? "border-terra bg-terra text-ivory" : "border-morocco bg-morocco text-ivory";

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        {participants.map((participant) => {
          const selected = value === participant.id;
          return (
            <button
              key={participant.id}
              type="button"
              onClick={() => onChange(participant.id)}
              aria-pressed={selected}
              className={clsx(
                "tap-bump relative flex min-h-[84px] flex-col items-center justify-center gap-2 rounded-[22px] border-2 px-2 text-center text-sm font-extrabold transition",
                selected ? `select-pop ${selectedClass} shadow-card` : "border-sand/70 bg-white/70 text-morocco",
              )}
            >
              <ParticipantAvatar participant={participant} size="sm" className={selected ? "bg-ivory/15" : "bg-sand/45"} />
              <span className="w-full truncate px-1">{participant.name}</span>
              {selected ? (
                <span className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-ivory/20" aria-hidden="true">
                  <Check size={13} strokeWidth={3.5} />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {groupLabel ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-pressed={value === null}
          className={clsx(
            "tap-bump mt-2.5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 text-sm font-black transition",
            value === null ? selectedClass : "border-sand/70 bg-white/60 text-morocco",
          )}
        >
          <Users size={17} />{groupLabel}
        </button>
      ) : null}
    </div>
  );
}
