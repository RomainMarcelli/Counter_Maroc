"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, CalendarDays, Clock3, Download, Droplets, Flame, Moon, Share2, Shapes, Target, Trophy } from "lucide-react";
import { useTrip } from "@/components/providers/trip-provider";
import { useBac } from "@/components/providers/bac-provider";
import { useToast } from "@/components/providers/toast-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { ParticipantAvatar } from "@/components/participants/participant-avatar";
import { DrinkIcon, DrinkIconGlyph } from "@/components/drinks/drink-icon";
import { HallPodium } from "./hall-podium";
import { TrophyBadge } from "./trophy-badge";
import { UnusualRecords } from "./unusual-records";
import { calculateStats } from "@/domain/stats";
import { formatDateKey, getZonedParts } from "@/lib/timezone";
import { getTripDayKey } from "@/lib/trip-day";
import { BAC_SHORT_DISCLAIMER, formatBac, formatTripTime } from "@/domain/bac";

export function HallOfFame() {
  const { trip, participants, drinks, drinkEntries, waterEntries } = useTrip();
  const { rowFor } = useBac();
  const toast = useToast();
  const [shareBac, setShareBac] = useState<Record<string, boolean>>({});
  const stats = useMemo(() => trip ? calculateStats(trip, participants, drinks, drinkEntries, waterEntries) : null, [trip, participants, drinks, drinkEntries, waterEntries]);
  const drinkById = useMemo(() => new Map(drinks.map((drink) => [drink.id, drink])), [drinks]);

  const personal = useMemo(() => {
    if (!trip) return {};
    const result: Record<string, { bestDay: string | null; peakHour: number | null; bac: { gPerL: number; at: string } | null }> = {};
    for (const participant of participants) {
      const mine = drinkEntries.filter((entry) => !entry.deletedAt && entry.participantId === participant.id);
      const byDay = new Map<string, number>();
      const byHour = new Map<number, number>();
      for (const entry of mine) {
        const day = getTripDayKey(entry.consumedAt);
        byDay.set(day, (byDay.get(day) ?? 0) + 1);
        const hour = getZonedParts(entry.consumedAt).hour;
        byHour.set(hour, (byHour.get(hour) ?? 0) + 1);
      }
      const bestDay = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      const peakHour = [...byHour.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      result[participant.id] = { bestDay, peakHour, bac: rowFor(participant.id)?.stats?.tripPeak ?? null };
    }
    return result;
  }, [trip, participants, drinkEntries, rowFor]);

  const evening = useMemo(() => {
    if (!trip || !stats) return null;
    const lastDay = [...stats.days].reverse().find((day) => day.total > 0);
    if (!lastDay) return null;
    const isSameDay = <T extends { consumedAt: string }>(entry: T) => getTripDayKey(entry.consumedAt) === lastDay.date;
    return { date: lastDay.date, stats: calculateStats(trip, participants, drinks, drinkEntries.filter(isSameDay), waterEntries.filter(isSameDay)) };
  }, [trip, stats, participants, drinks, drinkEntries, waterEntries]);

  if (!trip || !stats) return null;
  if (stats.totalAlcohol < 3) {
    return <><Header /><HallLinks /><EmptyState icon={<Trophy size={34} />} title="Le Hall of Fame se prépare" detail="Ajoutez au moins trois verres pour débloquer le podium et les premiers trophées." /></>;
  }

  const podium = stats.participants.filter((item) => item.total > 0).slice(0, 3);
  const participantById = new Map(participants.map((participant) => [participant.id, participant]));

  const shareCanvas = async (canvas: HTMLCanvasElement, fileName: string, title: string, text: string) => {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;
    const file = new File([blob], fileName, { type: "image/png" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title, text, files: [file] });
    } else {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(url);
      toast({ message: "Carte enregistrée", detail: "Elle est prête à être partagée sur WhatsApp." });
    }
  };

  const share = () => shareCanvas(renderShareCard(trip.name, stats), "marrakech-crew-bilan.png", `${trip.name} · Hall of Fame`, `Le bilan du crew : ${stats.totalAlcohol} verres.`);
  const shareEvening = () => evening
    ? shareCanvas(renderEveningCard(formatDateKey(evening.date), evening.stats), "marrakech-crew-soiree.png", `${trip.name} · Récap de la soirée`, `Récap du ${formatDateKey(evening.date)} : ${evening.stats.totalAlcohol} verres.`)
    : undefined;

  return (
    <div className="space-y-8">
      <Header />

      <HallLinks />

      <section className="hall-hero zellige-card rounded-[36px] bg-morocco px-4 pb-5 pt-7 text-ivory shadow-card sm:px-6">
        <div className="relative z-10 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-sand">Marrakech Crew · Le palmarès</p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <span className="h-px w-9 bg-sand/35" />
            <p className="font-display text-6xl font-bold leading-none">{stats.totalAlcohol}</p>
            <span className="h-px w-9 bg-sand/35" />
          </div>
          <p className="mt-1 text-xs font-black uppercase tracking-[0.2em] text-sand">verres partagés</p>
          <div className="mx-auto mt-5 grid max-w-sm grid-cols-3 divide-x divide-ivory/15 rounded-2xl border border-ivory/10 bg-ivory/5 py-2.5">
            <HeroMetric value={stats.activeDays} label="jours actifs" />
            <HeroMetric value={stats.distinctDrinks} label="boissons" />
            <HeroMetric value={stats.totalWater} label="eaux" />
          </div>
        </div>
        <HallPodium podium={podium} participants={participants} drinks={drinks} favorites={stats.personalBreakdown} />
      </section>

      {evening ? (
        <section className="card-enter rounded-[28px] border border-sand/55 bg-white/80 p-5 shadow-sm" style={{ animationDelay: "300ms" }}>
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-terra/10 text-terra"><Moon size={20} /></span>
            <div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-wider text-terra">Récap de la soirée</p><h2 className="font-display text-xl font-bold">{formatDateKey(evening.date)}</h2></div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <EveningMetric icon={<BarChart3 size={16} />} value={evening.stats.totalAlcohol} label="verres" />
            <EveningMetric icon={<Droplets size={16} />} value={evening.stats.totalWater} label="eaux" />
            <EveningMetric icon={<Clock3 size={16} />} value={evening.stats.peakHour === null ? "—" : `${evening.stats.peakHour}h`} label="pic" />
          </div>
          <p className="mt-3 text-xs font-bold text-morocco/55">{evening.stats.participants.filter((item) => item.total > 0).slice(0, 3).map((item) => `${item.name} ${item.total}`).join(" · ")}</p>
          <button onClick={() => void shareEvening()} className="tap-bump mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-morocco text-sm font-black text-morocco"><Share2 size={17} />Partager le récap</button>
        </section>
      ) : null}

      <section aria-labelledby="trophies-title">
        <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-terra">Les distinctions du crew</p><h2 id="trophies-title" className="font-display text-3xl font-bold">Mur des trophées</h2></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {stats.trophies.map((trophy, index) => (
            <article key={trophy.key} className="trophy-enter group relative overflow-hidden rounded-[28px] border border-sand/55 bg-white/80 p-4 shadow-sm" style={{ animationDelay: `${Math.min(index, 8) * 55 + 100}ms` }}>
              <span className="absolute -right-8 -top-8 size-28 rounded-full bg-sand/20 transition-transform duration-500 group-hover:scale-110" aria-hidden="true" />
              <div className="relative flex items-center gap-4">
                <TrophyBadge iconKey={trophy.iconKey} />
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-black uppercase tracking-[0.16em] text-terra">{trophy.label}</p>
                  <h3 className="mt-1 truncate font-display text-xl font-bold">{trophy.winner}</h3>
                  <p className="text-xs font-bold text-morocco/50">{trophy.detail}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="personal-title">
        <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-terra">Souvenirs individuels</p><h2 id="personal-title" className="font-display text-3xl font-bold">Mon Marrakech</h2></div>
        <div className="no-scrollbar -mx-4 mt-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
          {stats.participants.filter((item) => item.total > 0).map((person) => {
            const favorite = stats.personalBreakdown[person.id]?.[0];
            const waters = waterEntries.filter((entry) => !entry.deletedAt && entry.participantId === person.id).length;
            const extra = personal[person.id];
            return (
              <article key={person.id} className="min-w-[282px] snap-center rounded-[30px] border border-sand/55 bg-white/80 p-5 shadow-card">
                <div className="flex items-center gap-3">
                  <ParticipantAvatar participant={participantById.get(person.id) ?? { name: person.name, avatarUrl: null }} size="lg" className="ring-2 ring-terra/15" />
                  <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-wider text-terra">Rang {person.rank} du crew</p><h3 className="truncate font-display text-2xl font-bold">{person.name}</h3></div>
                </div>
                <p className="mt-5 font-display text-5xl font-bold leading-none text-morocco">{person.total}<span className="ml-1 font-sans text-xs font-black uppercase tracking-wider text-morocco/40">verres</span></p>
                <div className="mt-5 space-y-2.5 text-xs font-bold">
                  <PersonalLine icon={(() => { const full = favorite ? drinkById.get(favorite.id) : undefined; return full ? <DrinkIcon drink={full} size={17} /> : <DrinkIconGlyph iconKey="generic" size={17} />; })()}>{favorite?.name ?? "—"} · favori</PersonalLine>
                  {extra?.bestDay ? <PersonalLine icon={<Flame size={17} />}>{formatDateKey(extra.bestDay)} · jour le plus actif</PersonalLine> : null}
                  {extra?.peakHour !== null && extra?.peakHour !== undefined ? <PersonalLine icon={<Clock3 size={17} />}>{extra.peakHour}h–{(extra.peakHour + 1) % 24}h · heure préférée</PersonalLine> : null}
                  <PersonalLine icon={<Droplets size={17} />}>{waters} eaux</PersonalLine>
                  <PersonalLine icon={<Shapes size={17} />}>{stats.personalBreakdown[person.id]?.length ?? 0} boissons testées</PersonalLine>
                  {extra?.bac ? (
                    <div className="rounded-2xl bg-sand/30 px-3 py-2.5 leading-snug">
                      <p className="flex items-center gap-2"><BarChart3 size={17} className="text-terra" />Pic estimé ≈ {formatBac(extra.bac.gPerL)} g/L · {formatTripTime(extra.bac.at)}</p>
                      <span className="mt-1 block text-[9px] font-black uppercase tracking-wider text-terra">{BAC_SHORT_DISCLAIMER}</span>
                    </div>
                  ) : null}
                </div>
                {extra?.bac ? (
                  <label className="mt-3 flex min-h-11 items-center gap-2 text-[11px] font-bold text-morocco/60">
                    <input type="checkbox" checked={Boolean(shareBac[person.id])} onChange={(event) => setShareBac((current) => ({ ...current, [person.id]: event.target.checked }))} className="size-4 accent-[#B5543C]" />
                    Inclure mon pic estimé dans le partage
                  </label>
                ) : null}
                <button onClick={() => void shareCanvas(renderPersonalCard(person.name, person.total, favorite?.name ?? null, waters, shareBac[person.id] && extra?.bac ? `≈ ${formatBac(extra.bac.gPerL)} g/L estimés` : null), `marrakech-${person.name.toLowerCase()}.png`, `${trip.name} · ${person.name}`, `${person.total} verres pour ${person.name}.`)} className="tap-bump mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-morocco text-xs font-black text-morocco"><Share2 size={15} />Partager ma carte</button>
              </article>
            );
          })}
        </div>
      </section>

      <UnusualRecords stats={stats} trip={trip} />

      <button onClick={() => void share()} className="tap-bump flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-terra font-black text-ivory shadow-card"><Share2 size={20} />Partager le palmarès <Download size={17} className="opacity-65" /></button>
    </div>
  );
}

function Header() {
  return <header><p className="text-[10px] font-black uppercase tracking-[0.2em] text-terra">Le bilan qui reste</p><h1 className="font-display text-4xl font-bold">Hall of Fame</h1><p className="mt-2 text-sm font-bold text-morocco/50">Le palmarès final du séjour, calculé depuis le Journal.</p></header>;
}

function HallLinks() {
  return <div className="my-5 grid grid-cols-2 gap-3"><Link href="/challenges" className="tap-bump flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-terra font-black text-ivory shadow-sm"><Target size={19} />Challenges</Link><Link href="/recaps" className="tap-bump flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 border-morocco font-black text-morocco"><CalendarDays size={19} />Récaps</Link></div>;
}

function HeroMetric({ value, label }: { value: number; label: string }) {
  return <div><strong className="block font-display text-xl text-ivory">{value}</strong><span className="text-[8px] font-black uppercase tracking-wider text-sand/70">{label}</span></div>;
}

function EveningMetric({ icon, value, label }: { icon: React.ReactNode; value: number | string; label: string }) {
  return <div className="rounded-2xl bg-sand/25 px-2 py-3 text-center"><span className="mx-auto flex justify-center text-terra">{icon}</span><strong className="mt-1 block text-lg">{value}</strong><span className="text-[9px] font-black uppercase tracking-wider text-morocco/45">{label}</span></div>;
}

function PersonalLine({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return <p className="flex items-center gap-2"><span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-sand/30 text-terra">{icon}</span><span className="min-w-0 truncate">{children}</span></p>;
}

function baseCard(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D | null } {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#1E4A3A";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = "center";
  }
  return { canvas, ctx };
}

function renderShareCard(name: string, stats: ReturnType<typeof calculateStats>): HTMLCanvasElement {
  const { canvas, ctx } = baseCard();
  if (!ctx) return canvas;
  ctx.fillStyle = "#E9D6B5"; ctx.font = "700 38px system-ui"; ctx.fillText(name.toUpperCase(), 540, 100);
  ctx.fillStyle = "#FFF8EC"; ctx.font = "900 180px Georgia"; ctx.fillText(String(stats.totalAlcohol), 540, 300);
  ctx.fillStyle = "#E9D6B5"; ctx.font = "700 34px system-ui"; ctx.fillText("VERRES PARTAGÉS", 540, 355);
  stats.participants.filter((item) => item.total > 0).slice(0, 3).forEach((person, index) => {
    const y = 500 + index * 120;
    ctx.fillStyle = index === 0 ? "#B5543C" : "#E9D6B5"; ctx.beginPath(); ctx.arc(180, y - 12, 42, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = index === 0 ? "#FFF8EC" : "#1E4A3A"; ctx.font = "900 34px system-ui"; ctx.fillText(String(index + 1), 180, y);
    ctx.textAlign = "left"; ctx.fillStyle = "#FFF8EC"; ctx.font = "800 48px system-ui"; ctx.fillText(person.name, 250, y);
    ctx.textAlign = "right"; ctx.fillStyle = "#E9D6B5"; ctx.fillText(String(person.total), 900, y); ctx.textAlign = "center";
  });
  const topDrink = stats.drinks.find((item) => item.total > 0);
  ctx.fillStyle = "#B5543C"; ctx.fillRect(100, 880, 880, 250);
  ctx.fillStyle = "#FFF8EC"; ctx.font = "900 58px Georgia"; ctx.fillText(topDrink?.name ?? "Le Crew", 540, 970);
  ctx.font = "700 30px system-ui"; ctx.fillText("BOISSON DU SÉJOUR", 540, 1025);
  ctx.fillStyle = "#E9D6B5"; ctx.fillText(`${stats.totalWater} EAUX  ·  ${stats.distinctDrinks} BOISSONS`, 540, 1095);
  ctx.font = "700 28px system-ui"; ctx.fillText("MARRAKECH CREW · OFFLINE, ENSEMBLE", 540, 1260);
  return canvas;
}

function renderEveningCard(date: string, stats: ReturnType<typeof calculateStats>): HTMLCanvasElement {
  const { canvas, ctx } = baseCard();
  if (!ctx) return canvas;
  ctx.fillStyle = "#E9D6B5"; ctx.font = "700 38px system-ui"; ctx.fillText("RÉCAP DE LA SOIRÉE", 540, 100);
  ctx.fillStyle = "#FFF8EC"; ctx.font = "900 64px Georgia"; ctx.fillText(date, 540, 190);
  ctx.font = "900 180px Georgia"; ctx.fillText(String(stats.totalAlcohol), 540, 400);
  ctx.fillStyle = "#E9D6B5"; ctx.font = "700 34px system-ui"; ctx.fillText("VERRES CETTE NUIT-LÀ", 540, 455);
  stats.participants.filter((item) => item.total > 0).slice(0, 4).forEach((person, index) => {
    const y = 600 + index * 110;
    ctx.textAlign = "left"; ctx.fillStyle = "#FFF8EC"; ctx.font = "800 48px system-ui"; ctx.fillText(person.name, 150, y);
    ctx.textAlign = "right"; ctx.fillStyle = "#E9D6B5"; ctx.fillText(String(person.total), 930, y); ctx.textAlign = "center";
  });
  ctx.fillStyle = "#B5543C"; ctx.fillRect(100, 1080, 880, 130);
  ctx.fillStyle = "#FFF8EC"; ctx.font = "700 34px system-ui"; ctx.fillText(`${stats.totalWater} EAUX${stats.peakHour === null ? "" : `  ·  PIC ${stats.peakHour}H`}`, 540, 1160);
  ctx.fillStyle = "#E9D6B5"; ctx.font = "700 28px system-ui"; ctx.fillText("MARRAKECH CREW", 540, 1280);
  return canvas;
}

function renderPersonalCard(name: string, total: number, favorite: string | null, waters: number, bacLine: string | null): HTMLCanvasElement {
  const { canvas, ctx } = baseCard();
  if (!ctx) return canvas;
  ctx.fillStyle = "#E9D6B5"; ctx.font = "700 38px system-ui"; ctx.fillText("MON MARRAKECH", 540, 110);
  ctx.fillStyle = "#FFF8EC"; ctx.font = "900 88px Georgia"; ctx.fillText(name, 540, 240);
  ctx.font = "900 200px Georgia"; ctx.fillText(String(total), 540, 480);
  ctx.fillStyle = "#E9D6B5"; ctx.font = "700 34px system-ui"; ctx.fillText("VERRES DU SÉJOUR", 540, 540);
  ctx.fillStyle = "#FFF8EC"; ctx.font = "700 44px system-ui"; ctx.fillText(`FAVORI · ${favorite ?? "—"}`, 540, 680);
  ctx.fillText(`${waters} EAUX`, 540, 760);
  if (bacLine) {
    ctx.fillStyle = "#B5543C"; ctx.fillRect(100, 860, 880, 190);
    ctx.fillStyle = "#FFF8EC"; ctx.font = "900 52px Georgia"; ctx.fillText(bacLine, 540, 950);
    ctx.font = "700 26px system-ui"; ctx.fillText("PIC D’ALCOOLÉMIE · ESTIMATION UNIQUEMENT", 540, 1005);
  }
  ctx.fillStyle = "#E9D6B5"; ctx.font = "700 28px system-ui"; ctx.fillText("MARRAKECH CREW", 540, 1280);
  return canvas;
}
