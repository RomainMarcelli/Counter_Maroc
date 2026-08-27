"use client";

import { useState } from "react";
import { Camera, ImagePlus, LoaderCircle, WifiOff } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useTrip } from "@/components/providers/trip-provider";
import { useToast } from "@/components/providers/toast-provider";
import { queueMemoryPhoto, retryPhotoUploads, type PhotoStage } from "@/data/profile-photos";

const labels: Record<PhotoStage, string> = { preparing: "Préparation de la photo…", uploading: "Envoi…", queued: "En attente de synchronisation", done: "Photo ajoutée" };

export function MemoryPhotoPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { trip } = useTrip(); const toast = useToast(); const [stage, setStage] = useState<PhotoStage | null>(null);
  const choose = async (file: File | undefined) => {
    if (!file || !trip) return;
    try {
      const result = await queueMemoryPhoto(trip.id, file, new Date(file.lastModified || Date.now()).toISOString(), setStage);
      if (result.status === "queued") toast({ message: "Photo enregistrée sur l’iPhone", detail: "En attente de synchronisation.", icon: <WifiOff size={20} /> });
      else toast({ message: "Photo ajoutée", detail: "Elle apparaîtra dans le récap de cette journée." });
      onClose();
    } catch (error) {
      toast({ message: "Impossible d’envoyer la photo", detail: error instanceof Error ? error.message : undefined, tone: "error", actionLabel: "Réessayer", onAction: retryPhotoUploads });
    } finally { setStage(null); }
  };
  return <BottomSheet open={open} onClose={onClose} title="Ajouter un souvenir"><div className="rounded-[24px] bg-sand/30 p-5 text-center"><span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-terra text-ivory"><Camera size={24} /></span><h3 className="mt-4 font-display text-2xl font-bold">Photo du voyage</h3><p className="mt-2 text-xs font-bold leading-relaxed text-morocco/55">Photothèque ou appareil photo selon le choix proposé par iOS. L’image est redimensionnée à 1800 px maximum et son orientation est normalisée.</p></div><input id="memory-photo" type="file" accept="image/*,.heic,.heif" className="sr-only" disabled={Boolean(stage)} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void choose(file); }} /><label htmlFor="memory-photo" className={`mt-5 flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-terra font-black text-ivory ${stage ? "pointer-events-none opacity-60" : ""}`}>{stage ? <><LoaderCircle size={19} className="animate-spin" />{labels[stage]}</> : <><ImagePlus size={19} />Choisir une photo</>}</label></BottomSheet>;
}
