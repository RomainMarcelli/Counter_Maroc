"use client";

import clsx from "clsx";
import { Check, Users } from "lucide-react";
import { useTrip } from "@/components/providers/trip-provider";
import { ParticipantAvatar } from "@/components/participants/participant-avatar";

/**
 * Grille 2 × 2 : le crew tient à quatre, et une carte large se vise au pouce
 * bien mieux qu’un rail horizontal où les derniers noms sortent de l’écran.
 * Au-delà de quatre personnes la grille se prolonge simplement en lignes.
 */
export function ParticipantPicker() {
  const { activeParticipants, selectedParticipantIds, setSelectedParticipantIds } = useTrip();
  const allSelected = activeParticipants.length > 0 && selectedParticipantIds.length === activeParticipants.length;
  // On ne descend jamais à zéro sélectionné : sinon l’étape 2 ne mènerait nulle part.
  const toggle = (id: string) => setSelectedParticipantIds((current) => current.includes(id)
    ? (current.length === 1 ? current : current.filter((item) => item !== id))
    : [...current, id]);

  return (
    <section aria-labelledby="participant-title">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-terra">Étape 1</p>
          <h2 id="participant-title" className="font-display text-2xl font-bold">Pour qui ?</h2>
        </div>
        <span className="shrink-0 text-xs font-bold text-morocco/50">{selectedParticipantIds.length} sélectionné{selectedParticipantIds.length > 1 ? "s" : ""}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {activeParticipants.map((participant) => {
          const selected = selectedParticipantIds.includes(participant.id);
          return (
            <button
              key={participant.id}
              onClick={() => toggle(participant.id)}
              // L’avatar porte son propre libellé : sans ce nom explicite, la carte
              // s’annoncerait « Photo de Romain Romain » au lieu du simple prénom.
              aria-label={participant.name}
              aria-pressed={selected}
              className={clsx(
                "tap-bump relative flex min-h-[84px] flex-col items-center justify-center gap-2 rounded-[22px] border-2 px-2 text-center text-sm font-extrabold transition",
                selected ? "select-pop border-morocco bg-morocco text-ivory shadow-card" : "border-sand/70 bg-white/70 text-morocco",
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

      <button
        onClick={() => setSelectedParticipantIds(allSelected ? [activeParticipants[0]?.id].filter(Boolean) : activeParticipants.map((item) => item.id))}
        aria-pressed={allSelected}
        className={clsx(
          "tap-bump mt-2.5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 text-sm font-black transition",
          allSelected ? "border-terra bg-terra text-ivory" : "border-sand/70 bg-white/60 text-morocco",
        )}
      >
        <Users size={17} />Tout le monde
      </button>
    </section>
  );
}
