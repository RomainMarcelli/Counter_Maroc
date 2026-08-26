"use client";

import { useMemo } from "react";
import { Award, BarChart3, CalendarDays, Crown, Droplets, GlassWater, Medal, Sparkles } from "lucide-react";
import { useTrip } from "@/components/providers/trip-provider";
import { calculateStats } from "@/domain/stats";
import { EmptyState } from "@/components/ui/empty-state";
import { TemporalAnalysis } from "./temporal-analysis";

export function StatsDashboard() {
  const { trip, participants, drinks, drinkEntries, waterEntries } = useTrip();
  const stats = useMemo(() => trip ? calculateStats(trip, participants, drinks, drinkEntries, waterEntries) : null, [trip, participants, drinks, drinkEntries, waterEntries]);
  if (!trip || !stats) return null;
  if (!stats.totalAlcohol && !stats.totalWater) return <><PageHeader /><EmptyState icon="📊" title="Les stats arrivent" detail="Il faut quelques consommations avant de révéler les tendances du crew." /></>;
  const weeks = stats.days.reduce<Array<{ total: number; water: number }>>((result, day) => {
    const index = Math.max(0, Math.floor((Date.parse(day.date) - Date.parse(trip.startDate)) / (7 * 86_400_000)));
    result[index] ??= { total: 0, water: 0 };
    result[index].total += day.total;
    result[index].water += day.water;
    return result;
  }, []);

  return (
    <div className="space-y-7">
      <PageHeader />
      <section className="grid grid-cols-2 gap-3">
        <Metric icon={<GlassWater />} value={stats.totalAlcohol} label="verres" featured />
        <Metric icon={<Droplets />} value={stats.totalWater} label="eaux" />
        <Metric icon={<CalendarDays />} value={stats.averagePerDay} label="par jour actif" />
        <Metric icon={<Sparkles />} value={stats.distinctDrinks} label="boissons testées" />
      </section>

      <TemporalAnalysis trip={trip} participants={participants} drinks={drinks} drinkEntries={drinkEntries} waterEntries={waterEntries} />

      <section>
        <SectionTitle icon={<BarChart3 />} title="Classement" subtitle={`${stats.totalAlcohol} verres au total`} />
        <div className="mt-3 space-y-3">{stats.participants.filter((item) => item.total > 0).map((participant) => <div key={participant.id} className="rounded-2xl border border-sand/50 bg-white/75 p-4"><div className="flex items-center gap-3"><RankIcon rank={participant.rank} /><strong className="flex-1">{participant.name}</strong><span className="font-black">{participant.total} <small className="text-morocco/45">· {participant.percentage}%</small></span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-sand/35"><div className="h-full rounded-full bg-morocco" style={{ width: `${participant.percentage}%` }} /></div><p className="mt-2 text-right text-[10px] font-bold text-morocco/45">{participant.averagePerDay}/jour</p></div>)}</div>
      </section>

      <section>
        <SectionTitle icon={<GlassWater />} title="Qui a bu quoi" subtitle="Détail et part personnelle" />
        <div className="mt-3 space-y-3">{stats.participants.filter((item) => item.total > 0).map((participant) => <details key={participant.id} className="rounded-2xl border border-sand/50 bg-white/75 p-4"><summary className="cursor-pointer list-none font-display text-lg font-bold">{participant.name}<span className="float-right font-sans text-sm">{participant.total} verres</span></summary><div className="mt-3 space-y-2">{stats.personalBreakdown[participant.id]?.map((drink) => <div key={drink.id} className="flex items-center gap-2 text-sm"><span>{drink.icon}</span><span className="flex-1 font-bold">{drink.name}</span><strong>×{drink.total}</strong><span className="w-9 text-right text-xs text-morocco/45">{drink.percentage}%</span></div>)}</div></details>)}</div>
      </section>

      {weeks.length > 1 ? <section><SectionTitle icon={<CalendarDays />} title="Semaine 1 vs 2" subtitle="Évolution pendant le séjour" /><div className="mt-3 grid grid-cols-2 gap-3">{weeks.slice(0, 2).map((week, index) => { const change = index === 1 && weeks[0].total ? Math.round(((week.total - weeks[0].total) / weeks[0].total) * 100) : null; return <article key={index} className={`rounded-3xl p-5 ${index === 0 ? "bg-white/75" : "bg-terra text-ivory"}`}><p className="text-xs font-black uppercase tracking-wider">Semaine {index + 1}</p><strong className="mt-3 block font-display text-4xl">{week.total}</strong><p className={`text-xs font-bold ${index === 0 ? "text-morocco/50" : "text-sand"}`}>{week.water} eaux{change !== null ? ` · ${change >= 0 ? "+" : ""}${change}%` : ""}</p></article>; })}</div></section> : null}

      <section><SectionTitle icon={<Sparkles />} title="Par boisson" subtitle="Les favoris du séjour" /><div className="mt-3 rounded-3xl bg-white/75 p-4 shadow-card">{stats.drinks.filter((item) => item.total > 0).map((drink) => <div key={drink.id} className="flex min-h-12 items-center gap-3 border-b border-sand/35 last:border-none"><span className="text-xl">{drink.icon}</span><span className="flex-1 text-sm font-extrabold">{drink.name}</span><strong>{drink.total}</strong><span className="w-10 text-right text-xs text-morocco/45">{drink.percentage}%</span></div>)}</div></section>
    </div>
  );
}

function RankIcon({ rank }: { rank: number }) {
  const Icon = rank === 1 ? Crown : rank === 2 ? Medal : rank === 3 ? Award : null;
  return <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${rank <= 3 ? "bg-terra/10 text-terra" : "bg-sand/40 text-morocco"}`} aria-label={`Rang ${rank}`}>{Icon ? <Icon size={21} strokeWidth={2.4} /> : <strong>{rank}</strong>}</span>;
}

function PageHeader() { return <header><p className="text-[10px] font-black uppercase tracking-[0.2em] text-terra">Les chiffres du séjour</p><h1 className="font-display text-4xl font-bold">Stats</h1></header>; }
function Metric({ icon, value, label, featured = false }: { icon: React.ReactNode; value: number; label: string; featured?: boolean }) { return <article className={`zellige-card min-h-32 rounded-3xl p-4 shadow-card ${featured ? "bg-morocco text-ivory" : "bg-white/75"}`}><span className={featured ? "text-sand" : "text-terra"}>{icon}</span><strong className="mt-4 block font-display text-4xl">{value}</strong><span className={`text-xs font-bold ${featured ? "text-sand" : "text-morocco/50"}`}>{label}</span></article>; }
function SectionTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) { return <header className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-terra/10 text-terra">{icon}</span><div><h2 className="font-display text-xl font-bold">{title}</h2><p className="text-xs font-bold text-morocco/45">{subtitle}</p></div></header>; }
