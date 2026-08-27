import { Award, Crown, Medal } from "lucide-react";
import { ParticipantAvatar } from "@/components/participants/participant-avatar";
import { DrinkIcon, DrinkIconGlyph } from "@/components/drinks/drink-icon";
import type { Drink, Participant } from "@/domain/types";
import type { RankedValue } from "@/domain/stats";

export function HallPodium({
  podium,
  participants,
  drinks,
  favorites,
}: {
  podium: RankedValue[];
  participants: Participant[];
  drinks: Drink[];
  favorites: Record<string, RankedValue[]>;
}) {
  const participantById = new Map(participants.map((item) => [item.id, item]));
  const drinkById = new Map(drinks.map((item) => [item.id, item]));
  const ordered = [podium[1], podium[0], podium[2]];

  return (
    <div className="mt-7 grid grid-cols-3 items-end gap-2 sm:gap-3" aria-label="Podium du séjour">
      {ordered.map((person, column) => {
        if (!person) return <div key={`empty-${column}`} />;
        const rank = column === 1 ? 1 : column === 0 ? 2 : 3;
        const favorite = favorites[person.id]?.[0] ?? null;
        const drink = favorite ? drinkById.get(favorite.id) : null;
        const RankIcon = rank === 1 ? Crown : rank === 2 ? Medal : Award;
        return (
          <article
            key={person.id}
            className={`podium-enter relative isolate overflow-hidden border text-center shadow-xl ${rank === 1 ? "podium-first min-h-[238px] rounded-[28px] border-sand/45 bg-ivory px-2 pb-5 pt-7 text-morocco" : "min-h-[194px] rounded-[24px] border-ivory/15 bg-ivory/10 px-2 pb-4 pt-5 text-ivory"}`}
            style={{ animationDelay: rank === 1 ? "80ms" : rank === 2 ? "180ms" : "260ms" }}
          >
            <span className={`absolute left-1/2 top-0 -z-10 aspect-square -translate-x-1/2 rounded-full ${rank === 1 ? "w-32 bg-sand/35" : "w-24 bg-sand/10"}`} aria-hidden="true" />
            <span className={`absolute right-2 top-2 flex size-7 items-center justify-center rounded-full text-[11px] font-black ${rank === 1 ? "bg-terra text-ivory" : "bg-sand text-morocco"}`} aria-label={`Rang ${rank}`}>{rank}</span>
            <ParticipantAvatar
              participant={participantById.get(person.id) ?? { name: person.name, avatarUrl: null }}
              size={rank === 1 ? "xl" : "lg"}
              className={`mx-auto ${rank === 1 ? "ring-4 ring-terra/25" : "ring-2 ring-sand/35"}`}
            />
            <span className={`mx-auto -mt-3 flex size-9 items-center justify-center rounded-xl shadow-sm ${rank === 1 ? "bg-terra text-ivory" : "bg-sand text-morocco"}`} aria-hidden="true"><RankIcon size={19} strokeWidth={2.4} /></span>
            <h3 className={`mt-2 truncate font-display font-bold ${rank === 1 ? "text-xl" : "text-base"}`}>{person.name}</h3>
            <p className={`font-display font-bold ${rank === 1 ? "text-4xl text-terra" : "text-3xl text-sand"}`}>{person.total}</p>
            <p className={`text-[10px] font-black uppercase tracking-wider ${rank === 1 ? "text-morocco/45" : "text-sand/70"}`}>verres</p>
            {favorite ? (
              <p className={`mx-auto mt-2 flex max-w-full items-center justify-center gap-1 truncate text-[10px] font-bold ${rank === 1 ? "text-morocco/65" : "text-ivory/70"}`}>
                {drink ? <DrinkIcon drink={drink} tinted={rank === 1} size={13} /> : <DrinkIconGlyph iconKey="generic" size={13} />}
                <span className="truncate">{favorite.name}</span>
              </p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

