"use client";

import { useMemo, useRef } from "react";
import { Award, Crown, Download, Medal, Share2 } from "lucide-react";
import { useTrip } from "@/components/providers/trip-provider";
import { useToast } from "@/components/providers/toast-provider";
import { calculateStats } from "@/domain/stats";
import { EmptyState } from "@/components/ui/empty-state";
import { ParticipantAvatar } from "@/components/participants/participant-avatar";

export function HallOfFame() {
  const { trip, participants, drinks, drinkEntries, waterEntries } = useTrip();
  const toast = useToast();
  const cardRef = useRef<HTMLDivElement>(null);
  const stats = useMemo(() => trip ? calculateStats(trip, participants, drinks, drinkEntries, waterEntries) : null, [trip, participants, drinks, drinkEntries, waterEntries]);
  if (!trip || !stats) return null;
  if (stats.totalAlcohol < 3) return <><Header /><EmptyState icon="🏆" title="Le Hall of Fame se prépare" detail="Ajoutez au moins trois verres pour débloquer le podium et les premiers trophées." /></>;
  const podium = stats.participants.filter((item) => item.total > 0).slice(0, 3);
  const participantById = new Map(participants.map((participant) => [participant.id, participant]));
  const share = async () => {
    const canvas = renderShareCard(trip.name, stats);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;
    const file = new File([blob], "marrakech-crew-bilan.png", { type: "image/png" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: `${trip.name} · Hall of Fame`, text: `Le bilan du crew : ${stats.totalAlcohol} verres !`, files: [file] });
    } else {
      const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = file.name; link.click(); URL.revokeObjectURL(link.href);
      toast({ message: "Carte enregistrée", detail: "Elle est prête à être partagée sur WhatsApp." });
    }
  };
  return (
    <div className="space-y-7">
      <Header />
      <section ref={cardRef} className="zellige-card rounded-[32px] bg-morocco px-5 pb-6 pt-7 text-ivory shadow-card">
        <p className="text-center text-[10px] font-black uppercase tracking-[0.28em] text-sand">Marrakech Crew · Hall of Fame</p>
        <p className="mt-4 text-center font-display text-5xl font-bold">{stats.totalAlcohol}</p><p className="text-center text-sm font-bold text-sand">verres partagés</p>
        <div className="mt-8 grid grid-cols-3 items-end gap-2">{[podium[1], podium[0], podium[2]].map((person, index) => person ? <div key={person.id} className={`relative rounded-t-2xl bg-ivory/10 p-3 text-center ${index === 1 ? "min-h-44 pt-5" : "min-h-36 pt-4"}`}><ParticipantAvatar participant={participantById.get(person.id) ?? { name: person.name, avatarUrl: null }} size="lg" className="mx-auto mb-2 ring-2 ring-sand/30" /><PodiumIcon rank={index === 1 ? 1 : index === 0 ? 2 : 3} /><strong className="mt-2 block truncate text-sm">{person.name}</strong><span className="mt-1 block font-display text-2xl font-bold text-sand">{person.total}</span></div> : <div key={index} />)}</div>
      </section>
      <section><h2 className="font-display text-2xl font-bold">Les trophées</h2><div className="mt-3 grid gap-3 sm:grid-cols-2">{stats.trophies.map((trophy) => <article key={trophy.key} className="card-enter rounded-3xl border border-sand/55 bg-white/75 p-5 shadow-sm"><span className="text-3xl">{trophy.icon}</span><p className="mt-3 text-[10px] font-black uppercase tracking-wider text-terra">{trophy.label}</p><h3 className="mt-1 font-display text-xl font-bold">{trophy.winner}</h3><p className="text-xs font-bold text-morocco/50">{trophy.detail}</p></article>)}</div></section>
      <section><h2 className="font-display text-2xl font-bold">Mon Marrakech</h2><div className="no-scrollbar -mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-2">{stats.participants.filter((item) => item.total > 0).map((person) => { const favorite = stats.personalBreakdown[person.id]?.[0]; const waters = waterEntries.filter((entry) => !entry.deletedAt && entry.participantId === person.id).length; return <article key={person.id} className="min-w-[230px] rounded-3xl border border-sand/50 bg-white/75 p-5 shadow-card"><div className="flex items-center gap-3"><ParticipantAvatar participant={participantById.get(person.id) ?? { name: person.name, avatarUrl: null }} size="lg" /><div><p className="text-[10px] font-black uppercase tracking-wider text-terra">#{person.rank} du crew</p><h3 className="font-display text-2xl font-bold">{person.name}</h3></div></div><p className="mt-5 font-display text-4xl font-bold">{person.total}<span className="ml-1 text-sm font-sans text-morocco/45">verres</span></p><div className="mt-4 space-y-2 text-sm font-bold"><p>{favorite?.icon} {favorite?.name ?? "—"} · favori</p><p>💧 {waters} eaux</p><p>🌈 {stats.personalBreakdown[person.id]?.length ?? 0} boissons testées</p></div></article>; })}</div></section>
      <button onClick={() => void share()} className="flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-terra font-black text-ivory shadow-card"><Share2 size={20} />Partager la carte <Download size={17} className="opacity-65" /></button>
    </div>
  );
}

function Header() { return <header><p className="text-[10px] font-black uppercase tracking-[0.2em] text-terra">Le bilan qui reste</p><h1 className="font-display text-4xl font-bold">Hall of Fame</h1></header>; }

function PodiumIcon({ rank }: { rank: 1 | 2 | 3 }) {
  const Icon = rank === 1 ? Crown : rank === 2 ? Medal : Award;
  return <span className="mx-auto flex size-10 items-center justify-center rounded-xl bg-sand/15 text-sand" aria-label={`Rang ${rank}`}><Icon size={23} /></span>;
}

function renderShareCard(name: string, stats: ReturnType<typeof calculateStats>): HTMLCanvasElement {
  const canvas = document.createElement("canvas"); canvas.width = 1080; canvas.height = 1350;
  const ctx = canvas.getContext("2d"); if (!ctx) return canvas;
  ctx.fillStyle = "#1E4A3A"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#E9D6B5"; ctx.font = "700 38px system-ui"; ctx.textAlign = "center"; ctx.fillText(name.toUpperCase(), 540, 100);
  ctx.fillStyle = "#FFF8EC"; ctx.font = "900 180px Georgia"; ctx.fillText(String(stats.totalAlcohol), 540, 300);
  ctx.fillStyle = "#E9D6B5"; ctx.font = "700 34px system-ui"; ctx.fillText("VERRES PARTAGÉS", 540, 355);
  const medals = ["1", "2", "3"];
  stats.participants.filter((item) => item.total > 0).slice(0, 3).forEach((person, index) => { const y = 500 + index * 120; ctx.fillStyle = index === 0 ? "#B5543C" : "#E9D6B5"; ctx.beginPath(); ctx.arc(180, y - 12, 42, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = index === 0 ? "#FFF8EC" : "#1E4A3A"; ctx.font = "900 34px system-ui"; ctx.fillText(medals[index], 180, y); ctx.textAlign = "left"; ctx.fillStyle = "#FFF8EC"; ctx.font = "800 48px system-ui"; ctx.fillText(person.name, 250, y); ctx.textAlign = "right"; ctx.fillStyle = "#E9D6B5"; ctx.fillText(String(person.total), 900, y); ctx.textAlign = "center"; });
  const topDrink = stats.drinks.find((item) => item.total > 0); ctx.fillStyle = "#B5543C"; ctx.fillRect(100, 880, 880, 250); ctx.fillStyle = "#FFF8EC"; ctx.font = "900 58px Georgia"; ctx.fillText(`${topDrink?.icon ?? ""} ${topDrink?.name ?? "Le Crew"}`, 540, 970); ctx.font = "700 30px system-ui"; ctx.fillText("BOISSON DU SÉJOUR", 540, 1025); ctx.fillStyle = "#E9D6B5"; ctx.fillText(`💧 ${stats.totalWater} eaux  ·  🌈 ${stats.distinctDrinks} boissons`, 540, 1095);
  ctx.fillStyle = "#E9D6B5"; ctx.font = "700 28px system-ui"; ctx.fillText("MARRAKECH CREW · OFFLINE, ENSEMBLE", 540, 1260);
  return canvas;
}
