"use client";

import { useCallback, useEffect } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { flushPhotoUploads, retryPhotoUploads } from "@/data/profile-photos";
import { db } from "@/data/database";
import { useAuth } from "@/components/providers/auth-provider";

export function PhotoQueueProcessor() {
  const toast = useToast();
  const { status } = useAuth();
  const flush = useCallback(() => { void flushPhotoUploads().then(async () => {
    const failed = await db.photoUploads.where("status").equals("failed").first();
    if (failed) toast({ message: "Impossible d’envoyer une photo", detail: failed.lastError ?? undefined, tone: "error", actionLabel: "Réessayer", onAction: retryPhotoUploads });
  }); }, [toast]);
  useEffect(() => {
    const resume = () => { if (typeof document === "undefined" || document.visibilityState === "visible") flush(); };
    const uploaded = () => toast({ message: "Photo ajoutée", detail: "Elle est maintenant visible par le crew." });
    if (status === "authenticated") flush();
    window.addEventListener("online", flush); window.addEventListener("pageshow", resume); window.addEventListener("marrakech-photo-queue", flush); window.addEventListener("marrakech-photo-uploaded", uploaded); window.addEventListener("marrakech-sync", flush); document.addEventListener("visibilitychange", resume);
    return () => { window.removeEventListener("online", flush); window.removeEventListener("pageshow", resume); window.removeEventListener("marrakech-photo-queue", flush); window.removeEventListener("marrakech-photo-uploaded", uploaded); window.removeEventListener("marrakech-sync", flush); document.removeEventListener("visibilitychange", resume); };
  }, [flush, toast, status]);
  return null;
}
