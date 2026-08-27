"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import type { Participant } from "@/domain/types";
import { getSignedPhotoUrl, parsePhotoReference } from "@/data/profile-photos";

const sizes = {
  sm: "size-8 text-[10px]",
  md: "size-10 text-xs",
  lg: "size-14 text-sm",
  xl: "size-20 text-xl",
} as const;

export function ParticipantAvatar({ participant, size = "md", className }: { participant: Pick<Participant, "name" | "avatarUrl">; size?: keyof typeof sizes; className?: string }) {
  const [failed, setFailed] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setFailed(false);
    const reference = parsePhotoReference(participant.avatarUrl);
    if (!reference) {
      setResolvedUrl(participant.avatarUrl);
      return () => { active = false; };
    }
    setResolvedUrl(null);
    void getSignedPhotoUrl(reference.bucket, reference.path).then((value) => { if (active) setResolvedUrl(value); });
    return () => { active = false; };
  }, [participant.avatarUrl]);

  return (
    <span className={clsx("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-sand/50 font-black uppercase", sizes[size], className)} role="img" aria-label={`Photo de ${participant.name}`}>
      {resolvedUrl && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={resolvedUrl} alt="" className="absolute inset-0 size-full object-cover" onError={() => setFailed(true)} />
      ) : participant.name.slice(0, 2).toUpperCase()}
    </span>
  );
}
