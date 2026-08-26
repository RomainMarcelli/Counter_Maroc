"use client";

import { useMemo, useRef, useState } from "react";
import { Award, Crown, Download, Medal, Moon, Share2 } from "lucide-react";
import { useTrip } from "@/components/providers/trip-provider";
import { useToast } from "@/components/providers/toast-provider";
import { calculateStats } from "@/domain/stats";
import { EmptyState } from "@/components/ui/empty-state";
import { ParticipantAvatar } from "@/components/participants/participant-avatar";
import { useNow } from "@/lib/use-now";
import { formatDateKey, getZonedParts, zonedDayKey } from "@/lib/timezone";
import { BAC_SHORT_DISCLAIMER, buildAlcoholEvents, buildBacProfile, calculateParticipantBacStats, canSeeBac, formatBac, formatTripTime } from "@/domain/bac";

export function HallOfFame() {
  const { trip, participants, drinks, drinkEntries, waterEntries, actorId } = useTrip();
  const toast = useToast();
  const now = useNow(300_000);
  const cardRef = useRef<HTMLDivElement>(null);
  const [shareBac, setShareBac] = useState<Record<string, boolean>>({});
  const stats = useMemo(() => trip ? calculateStats(trip, participants, drinks, drinkEntries, waterEntries) : null, [trip, participants, drinks, drinkEntries, waterEntries]);

  const personal = useMemo(() => {
    if (!trip) return {};
    const result: Record<string, { bestDay: string | null; peakHour: number | null; bac: { gPerL: number; at: string } | null }> = {};
    for (const participant of participants) {
      const mine = drinkEntries.filter((entry) => !entry.deletedAt && entry.participantId === participant.id);
      const byDay = new Map<string, number>();
      const byHour = new Map<number, number>();
      for (const entry of mine) {
        const day = zonedDayKey(entry.consumedAt, trip.timezone);
        byDay.set(day, (byDay.get(day) ?? 0) + 1);
        const hour = getZonedParts(entry.consumedAt, trip.timezone).hour;
        byHour.set(hour, (byHour.get(hour) ?? 0) + 1);
      }
      const bestDay = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      const peakHour = [...byHour.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      const profile = canSeeBac(participant, actorId) ? buildBacProfile(participant) : null;
      const peak = profile ? calculateParticipantBacStats({ profile, events: buildAlcoholEvents(drinkEntries, drinks, participant.id), now, timezone: trip.timezone }).tripPeak : null;
      result[participant.id] = { bestDay, peakHour, bac: peak };
    }
    return result;
  }, [trip, participants, drinks, drinkEntries, actorId, now]);

  const evening = useMemo(() => {
    if (!trip || !stats) return null;
    const lastDay = [...stats.days].reverse().find((day) => day.total > 0);
    if (!lastDay) return null;
    const isSameDay = <T extends { consumedAt: string }>(entry: T) => zonedDayKey(entry.consumedAt, trip.timezone) === lastDay.date;
    return { date: lastDay.date, stats: calculateStats(trip, participants, drinks, drinkEntries.filter(isSameDay), waterEntries.filter(isSameDay)) };
  }, [trip, stats, participants, drinks, drinkEntries, waterEntries]);

  if (!trip || !stats) return null;
  if (stats.totalAlcohol < 3) return <><Header /><EmptyState icon="🏆" title="Le Hall of Fame se prépare" detail="Ajoutez au moins trois verres pour débloquer le podium et les premiers trophées." /></>;
  const podium = stats.participants.filter((item) => item.total > 0).slice(0, 3);
  const participantById = new Map(participants.map((participant) => [participant.id, participant]));

  const shareCanvas = async (canvas: HTMLCanvasElement, fileName: string, title: string, text: string) => {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;
    const file = new File([blob], fileName, { type: "image/png" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title, text, files: [file] });
    } else {
      const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = file.name; link.click(); URL.revokeObjectURL(link.href);
      toast({ message: "Carte enregistrée", detail: "Elle est prête à être partagée sur WhatsApp." });
    }
  };

  // La carte globale ne porte jamais d’alcoolémie individuelle : c’est une donnée personnelle.
  const share = () => shareCanvas(renderShareCard(trip.name, stats), "marrakech-crew-bilan.png", `${trip.name} · Hall of Fame`, `Le bilan du crew : ${stats.totalAlcohol} verres !`);
  const shareEvening = () => {
    if (!evening) return;
    return shareCanvas(renderEveningCard(formatDateKey(evening.date), evening.stats), "marrakech-crew-soiree.png", `${trip.name} · Récap de la soirée`, `Récap du ${formatDateKey(evening.date)} : ${evening.stats.totalAlcohol} verres.`);
  };

  return (
    <div className="space-y-7">
      <Header />
      <section ref={cardRef} className="zellige-card rounded-[32px] bg-morocco px-5 pb-6 pt-7 text-ivory shadow-card">
        <p className="text-center text-[10px] font-black uppercase tracking-[0.28em] text-sand">Marrakech Crew · Hall of Fame</p>
        <p className="mt-4 text-center font-display text-5xl font-bold">{stats.totalAlcohol}</p><p className="text-center text-sm font-bold text-sand">verres partagés</p>
        <div className="mt-8 grid grid-cols-3 items-end gap-2">{[podium[1], podium[0], podium[2]].map((person, index) => person ? <div key={person.id} className={`relative rounded-t-2xl bg-ivory/10 p-3 text-center ${index === 1 ? "min-h-44 pt-5" : "min-h-36 pt-4"}`}><ParticipantAvatar participant={participantById.get(person.id) ?? { name: person.name, avatarUrl: null }} size="lg" className="mx-auto mb-2 ring-2 ring-sand/30" /><PodiumIcon rank={index === 1 ? 1 : index === 0 ? 2 : 3} /><strong className="mt-2 block truncate text-sm">{person.name}</strong><span className="mt-1 block font-display text-2xl font-bold text-sand">{person.total}</span></div> : <div key={index} />)}</div>
      </section>

      {evening ? (
        <section className="rounded-3xl border border-sand/55 bg-white/75 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-terra/10 text-terra"><Moon size={20} /></span>
            <div><p className="text-[10px] font-black uppercase tracking-wider text-terra">Récap de la soirée</p><h2 className="font-display text-xl font-bold">{formatDateKey(evening.date)}</h2></div>
          </div>
          <p className="mt-4 text-sm font-bold">{evening.stats.totalAlcohol} verres · 💧 {evening.stats.totalWater} eaux{evening.stats.peakHour !== null ? ` · pic ${evening.stats.peakHour}h–${(evening.stats.peakHour + 1) % 24}h` : ""}</p>
          <p className="mt-1 text-xs font-bold text-morocco/55">{evening.stats.participants.filter((item) => item.total > 0).slice(0, 3).map((item) => `${item.name} ${item.total}`).join(" · ")}</p>
          <button onClick={() => void shareEvening()} className="tap-bump mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-morocco text-sm font-black text-morocco"><Share2 size={17} />Partager le récap</button>
        </section>
      ) : null}

      <section><h2 className="font-display text-2xl font-bold">Les trophées</h2><div className="mt-3 grid gap-3 sm:grid-cols-2">{stats.trophies.map((trophy) => <article key={trophy.key} className="card-enter rounded-3xl border border-sand/55 bg-white/75 p-5 shadow-sm"><span className="text-3xl">{trophy.icon}</span><p className="mt-3 text-[10px] font-black uppercase tracking-wider text-terra">{trophy.label}</p><h3 className="mt-1 font-display text-xl font-bold">{trophy.winner}</h3><p className="text-xs font-bold text-morocco/50">{trophy.detail}</p></article>)}</div></section>

      <section>
        <h2 className="font-display text-2xl font-bold">Mon Marrakech</h2>
        <div className="no-scrollbar -mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-2">{stats.participants.filter((item) => item.total > 0).map((person) => {
          const favorite = stats.personalBreakdown[person.id]?.[0];
          const waters = waterEntries.filter((entry) => !entry.deletedAt && entry.participantId === person.id).length;
          const extra = personal[person.id];
          return (
            <article key={person.id} className="min-w-[262px] rounded-3xl border border-sand/50 bg-white/75 p-5 shadow-card">
              <div className="flex items-center gap-3"><ParticipantAvatar participant={participantById.get(person.id) ?? { name: person.name, avatarUrl: null }} size="lg" /><div><p className="text-[10px] font-black uppercase tracking-wider text-terra">#{person.rank} du crew</p><h3 className="font-display text-2xl font-bold">{person.name}</h3></div></div>
              <p className="mt-5 font-display text-4xl font-bold">{person.total}<span className="ml-1 font-sans text-sm text-morocco/45">verres</span></p>
              <div className="mt-4 space-y-2 text-sm font-bold">
                <p>{favorite?.icon} {favorite?.name ?? "—"} · favori</p>
                {extra?.bestDay ? <p>🔥 {formatDateKey(extra.bestDay)} · jour le plus actif</p> : null}
                {extra?.peakHour !== null && extra?.peakHour !== undefined ? <p>🕒 {extra.peakHour}h–{(extra.peakHour + 1) % 24}h · heure préférée</p> : null}
                {extra?.bac ? (
                  <p className="rounded-xl bg-sand/30 px-2 py-1.5 text-xs leading-snug">
                    📈 Pic estimé ≈ {formatBac(extra.bac.gPerL)} g/L · {formatTripTime(extra.bac.at, trip.timezone)}
                    <span className="mt-0.5 block text-[10px] font-black uppercase tracking-wider text-terra">{BAC_SHORT_DISCLAIMER}</span>
                  </p>
                ) : null}
                <p>💧 {waters} eaux</p>
                <p>🌈 {stats.personalBreakdown[person.id]?.length ?? 0} boissons testées</p>
              </div>
              {extra?.bac ? (
                <label className="mt-3 flex min-h-11 items-center gap-2 text-[11px] font-bold text-morocco/60">
                  <input type="checkbox" checked={Boolean(shareBac[person.id])} onChange={(event) => setShareBac((current) => ({ ...current, [person.id]: event.target.checked }))} className="size-4 accent-[#B5543C]" />
                  Inclure mon pic estimé dans le partage
                </label>
              ) : null}
              <button onClick={() => void shareCanvas(renderPersonalCard(person.name, person.total, favorite?.name ?? null, waters, shareBac[person.id] && extra?.bac ? `≈ ${formatBac(extra.bac.gPerL)} g/L estimés` : null), `marrakech-${person.name.toLowerCase()}.png`, `${trip.name} · ${person.name}`, `${person.total} verres pour ${person.name} !`)} className="tap-bump mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-morocco text-xs font-black text-morocco"><Share2 size={15} />Partager ma carte</button>
            </article>
          );
        })}</div>
      </section>

      <button onClick={() => void share()} className="flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-terra font-black text-ivory shadow-card"><Share2 size={20} />Partager la carte <Download size={17} className="opacity-65" /></button>
    </div>
  );
}

function Header() { return <header><p className="text-[10px] font-black uppercase tracking-[0.2em] text-terra">Le bilan qui reste</p><h1 className="font-display text-4xl font-bold">Hall of Fame</h1></header>; }

function PodiumIcon({ rank }: { rank: 1 | 2 | 3 }) {
  const Icon = rank === 1 ? Crown : rank === 2 ? Medal : Award;
  return <span className="mx-auto flex size-10 items-center justify-center rounded-xl bg-sand/15 text-sand" aria-label={`Rang ${rank}`}><Icon size={23} /></span>;
}

function baseCard(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D | null } {
  const canvas = document.createElement("canvas"); canvas.width = 1080; canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (ctx) { ctx.fillStyle = "#1E4A3A"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.textAlign = "center"; }
  return { canvas, ctx };
}

function renderShareCard(name: string, stats: ReturnType<typeof calculateStats>): HTMLCanvasElement {
  const { canvas, ctx } = baseCard(); if (!ctx) return canvas;
  ctx.fillStyle = "#E9D6B5"; ctx.font = "700 38px system-ui"; ctx.fillText(name.toUpperCase(), 540, 100);
  ctx.fillStyle = "#FFF8EC"; ctx.font = "900 180px Georgia"; ctx.fillText(String(stats.totalAlcohol), 540, 300);
  ctx.fillStyle = "#E9D6B5"; ctx.font = "700 34px system-ui"; ctx.fillText("VERRES PARTAGÉS", 540, 355);
  const medals = ["1", "2", "3"];
  stats.participants.filter((item) => item.total > 0).slice(0, 3).forEach((person, index) => { const y = 500 + index * 120; ctx.fillStyle = index === 0 ? "#B5543C" : "#E9D6B5"; ctx.beginPath(); ctx.arc(180, y - 12, 42, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = index === 0 ? "#FFF8EC" : "#1E4A3A"; ctx.font = "900 34px system-ui"; ctx.fillText(medals[index], 180, y); ctx.textAlign = "left"; ctx.fillStyle = "#FFF8EC"; ctx.font = "800 48px system-ui"; ctx.fillText(person.name, 250, y); ctx.textAlign = "right"; ctx.fillStyle = "#E9D6B5"; ctx.fillText(String(person.total), 900, y); ctx.textAlign = "center"; });
  const topDrink = stats.drinks.find((item) => item.total > 0); ctx.fillStyle = "#B5543C"; ctx.fillRect(100, 880, 880, 250); ctx.fillStyle = "#FFF8EC"; ctx.font = "900 58px Georgia"; ctx.fillText(`${topDrink?.icon ?? ""} ${topDrink?.name ?? "Le Crew"}`, 540, 970); ctx.font = "700 30px system-ui"; ctx.fillText("BOISSON DU SÉJOUR", 540, 1025); ctx.fillStyle = "#E9D6B5"; ctx.fillText(`💧 ${stats.totalWater} eaux  ·  🌈 ${stats.distinctDrinks} boissons`, 540, 1095);
  ctx.fillStyle = "#E9D6B5"; ctx.font = "700 28px system-ui"; ctx.fillText("MARRAKECH CREW · OFFLINE, ENSEMBLE", 540, 1260);
  return canvas;
}

function renderEveningCard(date: string, stats: ReturnType<typeof calculateStats>): HTMLCanvasElement {
  const { canvas, ctx } = baseCard(); if (!ctx) return canvas;
  ctx.fillStyle = "#E9D6B5"; ctx.font = "700 38px system-ui"; ctx.fillText("RÉCAP DE LA SOIRÉE", 540, 100);
  ctx.fillStyle = "#FFF8EC"; ctx.font = "900 64px Georgia"; ctx.fillText(date, 540, 190);
  ctx.font = "900 180px Georgia"; ctx.fillText(String(stats.totalAlcohol), 540, 400);
  ctx.fillStyle = "#E9D6B5"; ctx.font = "700 34px system-ui"; ctx.fillText("VERRES CETTE NUIT-LÀ", 540, 455);
  stats.participants.filter((item) => item.total > 0).slice(0, 4).forEach((person, index) => {
    const y = 600 + index * 110;
    ctx.textAlign = "left"; ctx.fillStyle = "#FFF8EC"; ctx.font = "800 48px system-ui"; ctx.fillText(person.name, 150, y);
    ctx.textAlign = "right"; ctx.fillStyle = "#E9D6B5"; ctx.fillText(String(person.total), 930, y); ctx.textAlign = "center";
  });
  ctx.fillStyle = "#B5543C"; ctx.fillRect(100, 1080, 880, 130); ctx.fillStyle = "#FFF8EC"; ctx.font = "700 34px system-ui";
  ctx.fillText(`💧 ${stats.totalWater} eaux${stats.peakHour === null ? "" : `  ·  🕒 pic ${stats.peakHour}h`}`, 540, 1160);
  ctx.fillStyle = "#E9D6B5"; ctx.font = "700 28px system-ui"; ctx.fillText("MARRAKECH CREW", 540, 1280);
  return canvas;
}

function renderPersonalCard(name: string, total: number, favorite: string | null, waters: number, bacLine: string | null): HTMLCanvasElement {
  const { canvas, ctx } = baseCard(); if (!ctx) return canvas;
  ctx.fillStyle = "#E9D6B5"; ctx.font = "700 38px system-ui"; ctx.fillText("MON MARRAKECH", 540, 110);
  ctx.fillStyle = "#FFF8EC"; ctx.font = "900 88px Georgia"; ctx.fillText(name, 540, 240);
  ctx.font = "900 200px Georgia"; ctx.fillText(String(total), 540, 480);
  ctx.fillStyle = "#E9D6B5"; ctx.font = "700 34px system-ui"; ctx.fillText("VERRES DU SÉJOUR", 540, 540);
  ctx.fillStyle = "#FFF8EC"; ctx.font = "700 44px system-ui"; ctx.fillText(`🍹 ${favorite ?? "—"}`, 540, 680);
  ctx.fillText(`💧 ${waters} eaux`, 540, 760);
  if (bacLine) {
    ctx.fillStyle = "#B5543C"; ctx.fillRect(100, 860, 880, 190);
    ctx.fillStyle = "#FFF8EC"; ctx.font = "900 52px Georgia"; ctx.fillText(`📈 ${bacLine}`, 540, 950);
    ctx.font = "700 26px system-ui"; ctx.fillText("PIC D’ALCOOLÉMIE — ESTIMATION UNIQUEMENT", 540, 1005);
  }
  ctx.fillStyle = "#E9D6B5"; ctx.font = "700 28px system-ui"; ctx.fillText("MARRAKECH CREW", 540, 1280);
  return canvas;
}
