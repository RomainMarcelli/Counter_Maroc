"use client";

import { useCallback, useEffect, useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import { forgetSignedPhotoUrl, getSignedPhotoUrl } from "@/data/profile-photos";

/**
 * Photo d’un bucket privé, affichée via une URL signée.
 *
 * Une signature vit une heure ; une PWA rouverte le lendemain repart donc d’une
 * URL périmée. Plutôt que de laisser une image cassée, on redemande UNE
 * signature pour cette photo seulement — la galerie autour continue de
 * s’afficher — et on retombe sur un repère discret si le réseau ne répond pas.
 */
export function PrivatePhoto({ bucket, path, alt, className }: { bucket: "profile-photos" | "trip-photos"; path: string; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [retried, setRetried] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => getSignedPhotoUrl(bucket, path), [bucket, path]);

  useEffect(() => {
    let active = true;
    setRetried(false);
    setFailed(false);
    void load().then((value) => { if (active) setUrl(value); });
    return () => { active = false; };
  }, [load]);

  const onError = () => {
    if (retried) { setFailed(true); return; }
    setRetried(true);
    forgetSignedPhotoUrl(bucket, path);
    void load().then(setUrl);
  };

  if (!url || failed) {
    return <span className={`flex items-center justify-center bg-sand/30 text-terra ${className ?? ""}`} aria-label={alt}><ImageIcon size={22} /></span>;
  }
  // eslint-disable-next-line @next/next/no-img-element -- URL signée Supabase : `next/image` la ré-optimiserait derrière son propre cache, qui survivrait à l’expiration de la signature.
  return <img src={url} alt={alt} className={className} onError={onError} />;
}
