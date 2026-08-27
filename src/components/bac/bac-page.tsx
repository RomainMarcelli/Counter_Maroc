"use client";

import { useState } from "react";
import { ChevronRight, Info, RefreshCw, Settings2, UsersRound } from "lucide-react";
import clsx from "clsx";
import { useTrip } from "@/components/providers/trip-provider";
import { useBac } from "@/components/providers/bac-provider";
import { ParticipantAvatar } from "@/components/participants/participant-avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { syncEngine } from "@/data/sync-engine";
import { BacDetailSheet } from "./bac-detail-sheet";
import { BacProfileSheet } from "./bac-profile-sheet";
import { BAC_DISCLAIMER, formatBac } from "@/domain/bac";
import type { Participant } from "@/domain/types";

/**
 * Page dédiée à l’estimation : une carte par participant, le détail au tap, et
 * les réglages accessibles sans passer par les Paramètres.
 *
 * Aucun code couleur du vert au rouge selon la valeur : l’application n’indique
 * pas un niveau de sécurité, elle affiche une estimation théorique.
 */
export function BacPage() {
  const { trip, actorId } = useTrip();
  // Tout vient du calcul partagé : la carte, la modale et le résumé de l’écran Rapide
  // lisent exactement la même estimation, au même instant.
  const { rows, refresh } = useBac();
  const [detail, setDetail] = useState<Participant | null>(null);
  const [config, setConfig] = useState<Participant | null>(null);
  const [reloading, setReloading] = useState(false);

  // Le bouton va plus loin que l’horloge : il vide la file et rappelle le serveur,
  // pour que les verres servis par quelqu’un d’autre entrent aussi dans le calcul.
  const reload = async () => {
    setReloading(true);
    try {
      if (trip) {
        await syncEngine.flush({ immediate: true }).catch(() => undefined);
        await syncEngine.pullTrip(trip.id).catch(() => undefined);
      }
    } finally {
      refresh();
      setReloading(false);
    }
  };

  if (!trip) return null;
  const mine = rows.find((row) => row.participant.id === actorId) ?? null;

  return (
    <div>
      <header className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-terra">Estimation théorique</p>
          <h1 className="font-display text-4xl font-bold">Alcoolémie estimée</h1>
          <p className="mt-2 text-sm text-morocco/60">Recalculée à partir des verres du Journal, jamais stockée.</p>
        </div>
        <button
          type="button"
          onClick={() => void reload()}
          disabled={reloading}
          className="tap-bump flex size-11 shrink-0 items-center justify-center rounded-full border border-sand bg-white text-morocco/70 shadow-sm disabled:opacity-60"
          aria-label="Recalculer l’estimation et récupérer les derniers verres du groupe"
        >
          <RefreshCw size={18} className={reloading ? "animate-spin" : ""} />
        </button>
      </header>

      {mine && !mine.profile ? (
        <button
          onClick={() => setConfig(mine.participant)}
          className="tap-bump mb-5 flex min-h-16 w-full items-center gap-3 rounded-2xl border-2 border-dashed border-terra/45 bg-terra/5 px-4 text-left"
        >
          <Settings2 size={20} className="shrink-0 text-terra" />
          <span className="min-w-0 flex-1">
            <strong className="block text-sm font-black text-terra">Configurer mon estimation</strong>
            <span className="block text-xs font-bold text-morocco/55">Poids et répartition, facultatifs et effaçables.</span>
          </span>
        </button>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState icon={<UsersRound size={30} />} title="Personne dans le séjour" detail="Ajoutez des participants depuis les Réglages pour suivre leur estimation." />
      ) : (
        <div className="space-y-2.5">
          {rows.map(({ participant, profile, visible, stats, absorbing }) => {
            const isMine = participant.id === actorId;
            return (
              <article key={participant.id} className="flex items-stretch gap-2">
                <button
                  onClick={() => setDetail(participant)}
                  disabled={!profile}
                  className={clsx(
                    "tap-bump flex min-h-[76px] flex-1 items-center gap-3 rounded-2xl border bg-white/75 px-4 text-left shadow-sm transition disabled:opacity-70",
                    isMine ? "border-morocco/30" : "border-sand/60",
                  )}
                  aria-label={profile ? `Voir le détail de l’alcoolémie estimée de ${participant.name}` : `${participant.name} n’a pas activé l’estimation`}
                >
                  <ParticipantAvatar participant={participant} />
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm font-black">{participant.name}{isMine ? " · moi" : ""}</strong>
                    <span className="mt-0.5 block truncate text-xs font-bold text-morocco/50">
                      {!profile ? "Estimation désactivée" : !visible ? "Taux gardé privé" : absorbing ? "Absorption en cours" : "À jour"}
                    </span>
                  </span>
                  {stats ? (
                    <span className="shrink-0 text-right">
                      <strong className="block font-display text-2xl leading-none">≈ {formatBac(stats.current.estimatedGPerL)}</strong>
                      <span className="text-[10px] font-black uppercase tracking-wider text-morocco/50">g/L estimés</span>
                    </span>
                  ) : null}
                  {profile ? <ChevronRight size={18} className="shrink-0 text-morocco/35" /> : null}
                </button>
                <button
                  onClick={() => setConfig(participant)}
                  className="tap-bump flex w-12 shrink-0 items-center justify-center rounded-2xl border border-sand/60 bg-white/60 text-morocco/60"
                  aria-label={`Réglages d’alcoolémie de ${participant.name}`}
                >
                  <Settings2 size={18} />
                </button>
              </article>
            );
          })}
        </div>
      )}

      <p className="mt-6 flex gap-2 rounded-2xl border border-sand bg-sand/25 p-4 text-xs font-bold leading-relaxed text-morocco/70">
        <Info size={16} className="mt-0.5 shrink-0 text-terra" />{BAC_DISCLAIMER}
      </p>

      <BacDetailSheet participant={detail} onClose={() => setDetail(null)} />
      <BacProfileSheet participant={config} onClose={() => setConfig(null)} />
    </div>
  );
}
