"use client";

import { useTrip } from "@/components/providers/trip-provider";
import { setActorId } from "@/data/repository";
import { BrandLogo } from "@/components/brand/brand-logo";
import { ParticipantAvatar } from "@/components/participants/participant-avatar";

export function IdentityGate() {
  const { trip, activeParticipants } = useTrip();
  if (!trip) return null;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-10">
      <div className="rounded-[32px] bg-white/80 p-6 shadow-card">
        <BrandLogo size={56} className="rounded-2xl" priority />
        <p className="mt-6 text-[10px] font-black uppercase tracking-[0.2em] text-terra">{trip.name}</p>
        <h1 className="mt-1 font-display text-4xl font-bold">Qui êtes-vous ?</h1>
        <p className="mt-3 text-sm leading-relaxed text-morocco/60">Choisissez votre identité sur ce téléphone. Vous pourrez la changer dans les réglages.</p>
        <div className="mt-6 space-y-2">{activeParticipants.map((participant) => <button key={participant.id} onClick={() => void setActorId(participant.id)} className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-sand bg-ivory px-4 text-left font-extrabold"><ParticipantAvatar participant={participant} /><span className="flex-1">{participant.name}</span><span className="text-terra">→</span></button>)}</div>
      </div>
    </main>
  );
}
