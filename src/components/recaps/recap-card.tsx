"use client";

import { Award, Clock3, Droplets, Flame, GlassWater, Images, Users } from "lucide-react";
import { ParticipantAvatar } from "@/components/participants/participant-avatar";
import type { DailyRecap } from "@/domain/daily-recap";
import type { Participant } from "@/domain/types";
import { formatDateKey } from "@/lib/timezone";
import { PrivatePhoto } from "@/components/photos/private-photo";

export function RecapCard({ recap, participants, compact = false }: { recap: DailyRecap; participants: Participant[]; compact?: boolean }) {
  const topDrink = recap.stats.drinks.find((item) => item.total > 0);
  const hydration = recap.stats.unusual.hydration;
  const round = recap.stats.unusual.largestRound;
  const trophy = recap.stats.trophies[0];
  if (compact) return <div className="flex items-center gap-3"><span className="flex size-12 items-center justify-center rounded-2xl bg-terra text-ivory"><Flame size={20} /></span><div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-wider text-terra">Jour {recap.dayNumber}</p><h3 className="font-display text-xl font-bold">{recap.stats.totalAlcohol} consommations</h3><p className="truncate text-[11px] font-bold text-morocco/50">{topDrink?.name ?? "Une journée tranquille"}</p></div></div>;
  return (
    <article className="overflow-hidden rounded-[32px] border border-sand/60 bg-white/85 shadow-card">
      <div className="zellige-card bg-morocco p-5 text-ivory"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-sand">Marrakech Crew</p><h2 className="mt-1 font-display text-4xl font-bold">Jour {recap.dayNumber}</h2><p className="mt-1 text-xs font-bold text-sand">{formatDateKey(recap.dayKey)} · 08h → 08h</p><div className="mt-5 flex gap-6"><div><strong className="font-display text-5xl">{recap.stats.totalAlcohol}</strong><span className="ml-2 text-xs font-black uppercase text-sand">consommations</span></div><div className="border-l border-sand/20 pl-5"><strong className="block text-2xl">{recap.stats.totalWater}</strong><span className="text-[9px] font-black uppercase text-sand">eaux</span></div></div></div>
      <div className="space-y-6 p-5">
        <section><Title icon={<Users size={16} />}>Classement</Title><div className="mt-3 space-y-2">{recap.stats.participants.map((person, index) => <div key={person.id} className="flex items-center gap-3 rounded-2xl bg-sand/25 px-3 py-2"><span className="w-5 text-center text-xs font-black text-terra">{index + 1}</span><ParticipantAvatar participant={participants.find((item) => item.id === person.id) ?? { name: person.name, avatarUrl: null }} size="sm" /><span className="min-w-0 flex-1 truncate text-sm font-black">{person.name}</span><strong className="font-display text-xl">{person.total}</strong></div>)}</div></section>
        <div className="grid grid-cols-2 gap-3"><Metric icon={<Award size={18} />} label="Boisson du jour" value={topDrink?.name ?? "—"} detail={topDrink ? `${topDrink.total} consommations` : "Aucune"} /><Metric icon={<Clock3 size={18} />} label="Heure de pointe" value={recap.stats.peakHour === null ? "—" : `${recap.stats.peakHour}h – ${(recap.stats.peakHour + 1) % 24}h`} detail={recap.stats.peakHour === null ? "Aucune" : "Tranche la plus active"} /><Metric icon={<Droplets size={18} />} label="Hydratation MVP" value={hydration?.name ?? "—"} detail={hydration ? `${hydration.waters} eaux` : "Aucune eau"} /><Metric icon={<GlassWater size={18} />} label="Plus grosse tournée" value={round?.actorName ?? "—"} detail={round ? `${round.participantCount} personnes servies` : "Pas de tournée"} /></div>
        {recap.quirkyLine ? <div className="rounded-2xl bg-terra/10 p-4"><Title icon={<Flame size={16} />}>Stat insolite</Title><p className="mt-2 text-sm font-black">{recap.quirkyLine}</p></div> : null}
        {trophy ? <div className="rounded-2xl border border-sand/60 p-4"><Title icon={<Award size={16} />}>Trophée du jour</Title><p className="mt-2 font-display text-xl font-bold">{trophy.label}</p><p className="text-xs font-bold text-morocco/55">{trophy.winner} · {trophy.detail}</p></div> : null}
        {recap.photos.length ? <section><Title icon={<Images size={16} />}>Souvenirs</Title><div className="mt-3 grid grid-cols-3 gap-2">{recap.photos.slice(0, 3).map((photo) => <PrivatePhoto key={photo.id} bucket="trip-photos" path={photo.storagePath} alt={photo.caption ?? `Souvenir du jour ${recap.dayNumber}`} className="aspect-square w-full rounded-2xl object-cover" />)}</div></section> : null}
      </div>
    </article>
  );
}

function Title({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) { return <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-terra">{icon}{children}</h3>; }
function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) { return <div className="min-h-32 rounded-2xl bg-sand/25 p-3"><span className="text-terra">{icon}</span><p className="mt-3 text-[9px] font-black uppercase tracking-wider text-morocco/45">{label}</p><strong className="mt-1 block font-display text-lg leading-tight">{value}</strong><span className="mt-1 block text-[10px] font-bold text-morocco/45">{detail}</span></div>; }
