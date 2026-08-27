import { Award, Crown, Medal } from "lucide-react";
import { ParticipantAvatar } from "@/components/participants/participant-avatar";
import { DrinkIcon, DrinkIconGlyph } from "@/components/drinks/drink-icon";
import type { Drink, Participant } from "@/domain/types";
import type { RankedValue } from "@/domain/stats";

/**
 * Podium à trois marches, suivi du reste du crew.
 *
 * Le séjour se joue à quatre : la quatrième personne ne doit pas disparaître
 * sous prétexte qu'il n'y a que trois marches. Elle est rappelée juste en
 * dessous, sur une ligne compacte.
 *
 * Contraintes de largeur : sur un iPhone 13 mini, une colonne fait environ
 * 109 px. Rien n'y est tronqué — un prénom long passe sur deux lignes plutôt
 * que d'être coupé — et aucune taille n'est figée en dur au-delà de ce que
 * cette largeur permet.
 */
export function HallPodium({
  podium,
  participants,
  drinks,
  favorites,
}: {
  /** Classement complet, déjà trié : les trois premiers montent, les autres suivent. */
  podium: RankedValue[];
  participants: Participant[];
  drinks: Drink[];
  favorites: Record<string, RankedValue[]>;
}) {
  const participantById = new Map(participants.map((item) => [item.id, item]));
  const drinkById = new Map(drinks.map((item) => [item.id, item]));
  const top = podium.slice(0, 3);
  const rest = podium.slice(3);
  const ordered = [top[1], top[0], top[2]];

  return (
    <div className="mt-7">
      <div className="grid grid-cols-3 items-end gap-1.5 sm:gap-3" aria-label="Podium du séjour">
        {ordered.map((person, column) => {
          if (!person) return <div key={`empty-${column}`} />;
          const rank = column === 1 ? 1 : column === 0 ? 2 : 3;
          const first = rank === 1;
          const favorite = favorites[person.id]?.[0] ?? null;
          const drink = favorite ? drinkById.get(favorite.id) : null;
          const RankIcon = first ? Crown : rank === 2 ? Medal : Award;
          return (
            <article
              key={person.id}
              className={`podium-enter relative isolate overflow-hidden border text-center shadow-xl ${first ? "podium-first min-h-[236px] rounded-[26px] border-sand/45 bg-ivory px-1.5 pb-5 pt-7 text-morocco sm:px-2" : "min-h-[196px] rounded-[22px] border-ivory/15 bg-ivory/10 px-1.5 pb-4 pt-5 text-ivory sm:px-2"}`}
              style={{ animationDelay: first ? "260ms" : rank === 2 ? "80ms" : "170ms" }}
            >
              <span className={`absolute left-1/2 top-0 -z-10 aspect-square -translate-x-1/2 rounded-full ${first ? "w-32 bg-sand/35" : "w-24 bg-sand/10"}`} aria-hidden="true" />
              <span className={`absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full text-[10px] font-black ${first ? "bg-terra text-ivory" : "bg-sand text-morocco"}`} aria-label={`Rang ${rank}`}>{rank}</span>
              <ParticipantAvatar
                participant={participantById.get(person.id) ?? { name: person.name, avatarUrl: null }}
                size={first ? "xl" : "lg"}
                className={`mx-auto ${first ? "ring-4 ring-terra/25" : "ring-2 ring-sand/35"}`}
              />
              <span className={`mx-auto -mt-3 flex size-8 items-center justify-center rounded-xl shadow-sm ${first ? "bg-terra text-ivory" : "bg-sand text-morocco"}`} aria-hidden="true"><RankIcon size={17} strokeWidth={2.4} /></span>
              {/* Deux lignes maximum, coupure autorisée dans le mot : un prénom long
                  reste lisible en entier au lieu d'être rogné par une ellipse. */}
              <h3 className={`mt-1.5 line-clamp-2 font-display font-bold leading-tight [overflow-wrap:anywhere] ${first ? "text-lg" : "text-sm"}`}>{person.name}</h3>
              <p className={`font-display font-bold tabular-nums leading-none ${first ? "mt-1 text-4xl text-terra" : "mt-1 text-2xl text-sand"}`}>{person.total}</p>
              <p className={`mt-0.5 text-[9px] font-black uppercase tracking-wider ${first ? "text-morocco/45" : "text-sand/70"}`}>verres</p>
              {favorite ? (
                <p className={`mt-1.5 flex items-center justify-center gap-1 text-[10px] font-bold ${first ? "text-morocco/65" : "text-ivory/70"}`}>
                  <span className="shrink-0">{drink ? <DrinkIcon drink={drink} tinted={first} size={12} /> : <DrinkIconGlyph iconKey="generic" size={12} />}</span>
                  <span className="min-w-0 truncate">{favorite.name}</span>
                </p>
              ) : null}
            </article>
          );
        })}
      </div>

      {rest.length ? (
        <ul className="mt-3 space-y-1.5">
          {rest.map((person, index) => (
            <li
              key={person.id}
              className="podium-enter flex min-h-12 items-center gap-3 rounded-2xl border border-ivory/12 bg-ivory/5 px-3 text-ivory"
              style={{ animationDelay: `${340 + index * 60}ms` }}
            >
              {/* La position, pas le rang : à égalité de verres tout le monde partage
                  le rang 1, ce qui afficherait « 1 » à côté de la quatrième personne. */}
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-sand/20 text-[10px] font-black text-sand">{top.length + index + 1}</span>
              <ParticipantAvatar participant={participantById.get(person.id) ?? { name: person.name, avatarUrl: null }} size="sm" className="shrink-0 bg-ivory/10" />
              <span className="min-w-0 flex-1 truncate text-sm font-extrabold">{person.name}</span>
              <span className="shrink-0 font-display text-lg font-bold tabular-nums text-sand">{person.total}</span>
              <span className="shrink-0 text-[9px] font-black uppercase tracking-wider text-sand/60">verres</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
