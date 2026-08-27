import { Clock3, Compass, Droplets, Flame, Heart, Moon, TimerReset, UsersRound, Wine } from "lucide-react";
import type { TripStats } from "@/domain/stats";
import { formatPause } from "@/domain/unusual-stats";
import type { Trip } from "@/domain/types";
import { formatTripTime } from "@/domain/bac";
import { tripDayNumber } from "@/lib/trip-day";

export function UnusualRecords({ stats, trip }: { stats: TripStats; trip: Trip }) {
  const value = stats.unusual;
  const records = [
    value.explorer ? { key: "explorer", icon: <Compass />, label: "Explorateur", winner: value.explorer.name, detail: `${value.explorer.distinctDrinks} boissons différentes` } : null,
    value.loyalty ? { key: "loyalty", icon: <Heart />, label: "Fidèle jusqu’au bout", winner: value.loyalty.name, detail: `${value.loyalty.count} ${value.loyalty.drinkName} · ${value.loyalty.percentage} % de ses verres` } : null,
    value.duo ? { key: "duo", icon: <UsersRound />, label: "Duo inséparable", winner: value.duo.names.join(" + "), detail: `${value.duo.sharedRounds} tournée${value.duo.sharedRounds > 1 ? "s" : ""} partagée${value.duo.sharedRounds > 1 ? "s" : ""}` } : null,
    value.preferredHour ? { key: "hour", icon: <Clock3 />, label: "Heure préférée", winner: `${value.preferredHour.hour}h – ${(value.preferredHour.hour + 1) % 24}h`, detail: `${value.preferredHour.count} verres enregistrés` } : null,
    value.hydration ? { key: "water", icon: <Droplets />, label: "Hydratation MVP", winner: value.hydration.name, detail: `${value.hydration.waters} eaux · 1 eau pour ${(value.hydration.alcohols / value.hydration.waters).toFixed(1).replace(".", ",")} alcool` } : null,
    value.longestPause ? { key: "pause", icon: <TimerReset />, label: "Pause champion", winner: value.longestPause.name, detail: `${formatPause(value.longestPause.minutes)} sans verre · Jour ${tripDayNumber(value.longestPause.dayKey, trip.startDate)}` } : null,
    value.largestRound ? { key: "round", icon: <Wine />, label: "Plus grosse tournée", winner: value.largestRound.actorName, detail: `${value.largestRound.participantCount} personnes · ${value.largestRound.drinks.map((drink) => `${drink.count} ${drink.name}`).join(" · ")} · ${formatTripTime(value.largestRound.consumedAt)}` } : null,
    value.activeDay ? { key: "active", icon: <Flame />, label: "Journée la plus active", winner: `Jour ${tripDayNumber(value.activeDay.dayKey, trip.startDate)}`, detail: `${value.activeDay.count} consommations` } : null,
    value.calmDay ? { key: "calm", icon: <Moon />, label: "Journée la plus calme", winner: `Jour ${tripDayNumber(value.calmDay.dayKey, trip.startDate)}`, detail: `${value.calmDay.count} consommations` } : null,
  ].filter((record): record is NonNullable<typeof record> => Boolean(record));

  if (!records.length) return null;
  return (
    <section aria-labelledby="unusual-title">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-terra">Statistiques insolites</p>
      <h2 id="unusual-title" className="font-display text-3xl font-bold">Les records du séjour</h2>
      <p className="mt-1 text-xs font-bold text-morocco/50">Les duos sont calculés uniquement à partir des tournées partageant le même identifiant.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {records.map((record, index) => (
          <article key={record.key} className="trophy-enter relative overflow-hidden rounded-[26px] border border-sand/55 bg-white/80 p-4 shadow-sm" style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}>
            <span className="flex size-11 items-center justify-center rounded-2xl bg-terra/10 text-terra">{record.icon}</span>
            <p className="mt-3 text-[9px] font-black uppercase tracking-[0.16em] text-terra">{record.label}</p>
            <h3 className="mt-1 font-display text-xl font-bold">{record.winner}</h3>
            <p className="mt-1 text-xs font-bold leading-relaxed text-morocco/55">{record.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

