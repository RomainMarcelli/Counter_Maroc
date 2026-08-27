"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useTrip } from "@/components/providers/trip-provider";
import { buildDailyRecap, recapPromptDay, shouldShowRecapPrompt } from "@/domain/daily-recap";
import { db } from "@/data/database";
import { RecapCard } from "./recap-card";

export function DailyRecapPrompt() {
  const router = useRouter();
  const { trip, participants, drinks, drinkEntries, waterEntries, tripPhotos } = useTrip();
  const [candidate, setCandidate] = useState<string | null>(null);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const check = useCallback(async () => {
    const nextCandidate = recapPromptDay();
    const stored = trip ? await db.settings.get(`dailyRecapLastSeen:${trip.id}`) : null;
    setLastSeen(stored?.value ?? null);
    setCandidate(nextCandidate);
  }, [trip]);
  useEffect(() => { const resume = () => { if (document.visibilityState === "visible") void check(); }; void check(); window.addEventListener("pageshow", resume); document.addEventListener("visibilitychange", resume); return () => { window.removeEventListener("pageshow", resume); document.removeEventListener("visibilitychange", resume); }; }, [check]);
  const recap = useMemo(() => candidate && trip ? buildDailyRecap(candidate, trip, participants, drinks, drinkEntries, waterEntries, tripPhotos) : null, [candidate, trip, participants, drinks, drinkEntries, waterEntries, tripPhotos]);
  const hasData = Boolean(recap && (recap.stats.totalAlcohol || recap.stats.totalWater || recap.photos.length));
  const open = shouldShowRecapPrompt({ candidateDay: candidate, lastSeenDay: lastSeen, dismissedDay: dismissed, hasData });
  const view = async () => { if (!trip || !candidate) return; await db.settings.put({ key: `dailyRecapLastSeen:${trip.id}`, value: candidate }); setLastSeen(candidate); router.push(`/recaps?day=${candidate}`); };
  return <BottomSheet open={open} onClose={() => setDismissed(candidate)} title="Le récap d’hier est prêt">{recap ? <div><div className="mb-4 flex items-center gap-3 rounded-2xl bg-sand/30 p-3"><span className="flex size-11 items-center justify-center rounded-xl bg-terra text-ivory"><CalendarCheck size={20} /></span><div><p className="text-[10px] font-black uppercase tracking-wider text-terra">Jour {recap.dayNumber}</p><p className="font-display text-xl font-bold">{recap.stats.totalAlcohol} consommations</p></div></div><RecapCard recap={recap} participants={participants} compact /><button onClick={() => void view()} className="mt-5 min-h-14 w-full rounded-2xl bg-terra font-black text-ivory">Voir le récap</button><button onClick={() => setDismissed(candidate)} className="mt-2 min-h-12 w-full rounded-2xl font-black text-morocco/55">Plus tard</button></div> : null}</BottomSheet>;
}
