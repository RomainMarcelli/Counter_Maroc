"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Clock3, Martini, UserRound } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { SelectField } from "@/components/ui/select-sheet";
import { calculateStats, type DayStat } from "@/domain/stats";
import type { Drink, DrinkEntry, Participant, Trip, WaterEntry } from "@/domain/types";
import { formatDateKey, zonedDayKey } from "@/lib/timezone";

type PeriodFilter = "all" | `week:${number}` | `day:${string}`;

export function TemporalAnalysis({ trip, participants, drinks, drinkEntries, waterEntries }: {
  trip: Trip;
  participants: Participant[];
  drinks: Drink[];
  drinkEntries: DrinkEntry[];
  waterEntries: WaterEntry[];
}) {
  const [participantId, setParticipantId] = useState("all");
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [selectedDay, setSelectedDay] = useState<DayStat | null>(null);
  const activeParticipants = participants.filter((participant) => !participant.deletedAt);
  const personEntries = useMemo(() => participantId === "all" ? drinkEntries : drinkEntries.filter((entry) => entry.participantId === participantId), [drinkEntries, participantId]);
  const personWater = useMemo(() => participantId === "all" ? waterEntries : waterEntries.filter((entry) => entry.participantId === participantId), [waterEntries, participantId]);
  const personStats = useMemo(() => calculateStats(trip, participants, drinks, personEntries, personWater), [trip, participants, drinks, personEntries, personWater]);
  const filterPeriod = <T extends { consumedAt: string }>(entries: T[]) => entries.filter((entry) => {
    if (period === "all") return true;
    const dayKey = zonedDayKey(entry.consumedAt);
    if (period.startsWith("day:")) return dayKey === period.slice(4);
    const weekIndex = Number(period.slice(5));
    return Math.floor((Date.parse(dayKey) - Date.parse(trip.startDate)) / (7 * 86_400_000)) === weekIndex;
  });
  const periodStats = calculateStats(trip, participants, drinks, filterPeriod(personEntries), filterPeriod(personWater));
  const visibleDays = personStats.days.filter((day) => {
    if (period === "all") return true;
    if (period.startsWith("day:")) return day.date === period.slice(4);
    return Math.floor((Date.parse(day.date) - Date.parse(trip.startDate)) / (7 * 86_400_000)) === Number(period.slice(5));
  });
  const maxHourly = Math.max(...periodStats.hourly, 1);
  const weekCount = Math.max(1, Math.ceil((Date.parse(trip.endDate) - Date.parse(trip.startDate) + 86_400_000) / (7 * 86_400_000)));

  return (
    <section className="space-y-5">
      <header className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-terra/10 text-terra"><Clock3 /></span>
        <div><h2 className="font-display text-xl font-bold">Analyse temporelle</h2><p className="text-xs font-bold text-morocco/45">Rythme et timeline filtrables</p></div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label="Participant"
          value={participantId}
          onChange={setParticipantId}
          options={[{ value: "all", label: "Tout le monde", icon: <UserRound size={18} /> }, ...activeParticipants.map((participant) => ({ value: participant.id, label: participant.name }))]}
        />
        <SelectField
          label="Période"
          value={period}
          onChange={(value) => setPeriod(value as PeriodFilter)}
          options={[
            { value: "all", label: "Tout le séjour", icon: <CalendarDays size={18} /> },
            ...Array.from({ length: weekCount }, (_, index) => ({ value: `week:${index}`, label: `Semaine ${index + 1}` })),
            ...personStats.days.map((day) => ({ value: `day:${day.date}`, label: `Journée du ${formatDateKey(day.date)}` })),
          ]}
        />
      </div>

      <div className="rounded-3xl bg-white/75 p-5 shadow-card">
        <div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-wider text-terra">Rythme du crew</p><h3 className="font-display text-xl font-bold">Par heure</h3></div><p className="text-right text-xs font-bold text-morocco/50">{periodStats.peakHour === null ? "Pas encore de pic" : `Pic · ${periodStats.peakHour}h–${(periodStats.peakHour + 1) % 24}h`}</p></div>
        <div className="mt-5 flex h-32 items-end gap-1">{periodStats.hourly.map((value, hour) => <div key={hour} className="flex h-full flex-1 flex-col justify-end"><div className={`min-h-[2px] rounded-t-sm ${hour === periodStats.peakHour ? "bg-terra" : "bg-sand"}`} style={{ height: `${Math.max(2, (value / maxHourly) * 100)}%` }} title={`${hour}h–${(hour + 1) % 24}h : ${value}`} />{hour % 4 === 0 ? <span className="mt-1 text-[8px] font-bold text-morocco/45">{hour}h</span> : null}</div>)}</div>
      </div>

      <div>
        <p className="text-[10px] font-black uppercase tracking-wider text-terra">Timeline</p>
        <div className="no-scrollbar -mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-2">{visibleDays.length ? visibleDays.map((day) => <button key={day.date} onClick={() => setSelectedDay(day)} className="min-w-[158px] rounded-2xl bg-morocco p-4 text-left text-ivory shadow-card"><span className="text-[10px] font-black uppercase tracking-wider text-sand">Jour {Math.max(1, Math.round((Date.parse(day.date) - Date.parse(trip.startDate)) / 86_400_000) + 1)}</span><h3 className="mt-1 font-display text-lg font-bold">{formatDateKey(day.date)}</h3><p className="mt-5 text-3xl font-black">{day.total}</p><p className="text-xs text-sand">verres · {day.water} eaux</p>{day.favoriteDrink ? <p className="mt-3 flex items-center gap-1 truncate text-xs font-bold"><Martini size={14} />{day.favoriteDrink}</p> : null}</button>) : <p className="min-w-full rounded-2xl border border-dashed border-sand p-5 text-sm font-bold text-morocco/50">Aucune donnée pour ce filtre.</p>}</div>
      </div>

      <BottomSheet open={Boolean(selectedDay)} onClose={() => setSelectedDay(null)} title={selectedDay ? `Journée du ${formatDateKey(selectedDay.date)}` : "Détail de la journée"}>{selectedDay ? <div className="grid grid-cols-2 gap-3"><DayMetric icon={<Clock3 />} value={selectedDay.total} label={`${selectedDay.percentage}% du filtre`} featured /><DayMetric icon={<CalendarDays />} value={selectedDay.water} label="eaux" /><DayMetric icon={<Clock3 />} value={selectedDay.peakHour === null ? "—" : `${selectedDay.peakHour}h`} label="heure de pointe" /><article className="rounded-3xl bg-white p-4"><Martini className="text-terra" /><strong className="mt-4 block text-lg">{selectedDay.favoriteDrink ?? "—"}</strong><span className="text-xs font-bold text-morocco/50">boisson favorite</span></article></div> : null}</BottomSheet>
    </section>
  );
}

function DayMetric({ icon, value, label, featured = false }: { icon: React.ReactNode; value: number | string; label: string; featured?: boolean }) {
  return <article className={`min-h-32 rounded-3xl p-4 ${featured ? "bg-morocco text-ivory" : "bg-white"}`}><span className={featured ? "text-sand" : "text-terra"}>{icon}</span><strong className="mt-4 block font-display text-3xl">{value}</strong><span className={`text-xs font-bold ${featured ? "text-sand" : "text-morocco/50"}`}>{label}</span></article>;
}
