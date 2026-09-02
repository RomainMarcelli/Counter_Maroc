"use client";

import { useEffect, useMemo, useState } from "react";
import { OfflineLink as Link } from "@/components/pwa/offline-link";
import { CalendarDays, ChevronLeft, ChevronRight, ImagePlus, Trash2 } from "lucide-react";
import { useTrip } from "@/components/providers/trip-provider";
import { listDailyRecaps } from "@/domain/daily-recap";
import { RecapCard } from "./recap-card";
import { MemoryPhotoPicker } from "@/components/photos/memory-photo-picker";
import { PrivatePhoto } from "@/components/photos/private-photo";
import { useActionDialog } from "@/components/providers/action-dialog-provider";
import { useToast } from "@/components/providers/toast-provider";
import { removeTripPhoto } from "@/data/profile-photos";

export function RecapsPage() {
  const { trip, participants, drinks, drinkEntries, waterEntries, tripPhotos } = useTrip();
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [photoOpen, setPhotoOpen] = useState(false);
  const { confirm } = useActionDialog();
  const toast = useToast();
  const recaps = useMemo(() => trip ? listDailyRecaps(trip, participants, drinks, drinkEntries, waterEntries, tripPhotos) : [], [trip, participants, drinks, drinkEntries, waterEntries, tripPhotos]);
  useEffect(() => { const requested = new URLSearchParams(window.location.search).get("day"); setSelectedDay(requested); }, []);
  if (!trip) return null;
  const selected = recaps.find((recap) => recap.dayKey === selectedDay) ?? null;
  const remove = async (photo: (typeof tripPhotos)[number]) => {
    const approved = await confirm({ eyebrow: "Souvenir du voyage", title: "Supprimer cette photo ?", description: "Elle disparaîtra des récaps du crew et sera supprimée du stockage Supabase.", confirmLabel: "Supprimer", cancelLabel: "Garder", tone: "danger", icon: "photo" });
    if (!approved) return;
    await removeTripPhoto(photo); toast({ message: "Photo supprimée", detail: navigator.onLine ? "Le stockage a été nettoyé." : "Le nettoyage se terminera au retour du réseau." });
  };
  if (selected) return <div className="space-y-5"><button onClick={() => setSelectedDay(null)} className="inline-flex min-h-11 items-center gap-2 text-xs font-black uppercase tracking-wider text-terra"><ChevronLeft size={17} />Tous les récaps</button><RecapCard recap={selected} participants={participants} />{selected.photos.length ? <section><h2 className="font-display text-2xl font-bold">Toutes les photos</h2><div className="mt-3 grid grid-cols-2 gap-3">{selected.photos.map((photo) => <div key={photo.id} className="relative"><PrivatePhoto bucket="trip-photos" path={photo.storagePath} alt={photo.caption ?? "Souvenir du voyage"} className="aspect-square w-full rounded-2xl object-cover" /><button onClick={() => void remove(photo)} className="absolute right-2 top-2 flex size-11 items-center justify-center rounded-xl bg-morocco/85 text-ivory shadow-lg" aria-label="Supprimer cette photo"><Trash2 size={17} /></button></div>)}</div></section> : null}</div>;
  return <div className="space-y-6"><header><Link href="/hall-of-fame" className="mb-3 inline-flex min-h-11 items-center gap-2 text-xs font-black uppercase tracking-wider text-terra"><ChevronLeft size={17} />Retour au Bilan</Link><div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-terra">08h → 08h</p><h1 className="font-display text-4xl font-bold">Récaps</h1></div><button onClick={() => setPhotoOpen(true)} className="tap-bump flex min-h-12 items-center gap-2 rounded-2xl bg-terra px-4 text-xs font-black text-ivory"><ImagePlus size={18} />Photo</button></div></header>{recaps.length ? <div className="space-y-3">{recaps.map((recap) => <button key={recap.dayKey} onClick={() => setSelectedDay(recap.dayKey)} className="card-enter flex min-h-24 w-full items-center gap-3 rounded-[24px] border border-sand/60 bg-white/85 p-4 text-left shadow-sm"><CalendarDays size={21} className="shrink-0 text-terra" /><span className="min-w-0 flex-1"><RecapCard recap={recap} participants={participants} compact /></span><ChevronRight size={18} /></button>)}</div> : <p className="rounded-[28px] border border-dashed border-sand p-8 text-center text-sm font-bold text-morocco/45">Le premier récap apparaîtra après les premières consommations, eaux ou photos.</p>}<MemoryPhotoPicker open={photoOpen} onClose={() => setPhotoOpen(false)} /></div>;
}
