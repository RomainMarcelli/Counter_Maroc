"use client";

import { useState } from "react";
import { LoaderCircle, Lock, Plus } from "lucide-react";
import { useTrip } from "@/components/providers/trip-provider";
import { useAuth } from "@/components/providers/auth-provider";
import { useToast } from "@/components/providers/toast-provider";
import { addParticipant, linkParticipantToAccount } from "@/data/repository";
import { syncEngine } from "@/data/sync-engine";
import { authErrorMessage } from "@/data/auth";
import { isSupabaseConfigured } from "@/data/supabase";
import { BrandLogo } from "@/components/brand/brand-logo";
import { ParticipantAvatar } from "@/components/participants/participant-avatar";
import type { Participant } from "@/domain/types";

/**
 * Un compte et un participant sont deux choses distinctes : quelqu’un a pu ajouter
 * « Lucas » bien avant que Lucas installe l’application. Cet écran rattache le
 * compte connecté au bon participant — ou en crée un.
 */
export function IdentityGate() {
  const { trip, activeParticipants } = useTrip();
  const { account } = useAuth();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newName, setNewName] = useState(account?.displayName ?? "");

  if (!trip || !account) return null;

  const claim = async (participant: Participant) => {
    setBusyId(participant.id);
    try {
      // Le serveur arbitre : une identité déjà prise par un autre compte est refusée.
      if (isSupabaseConfigured()) await syncEngine.claimParticipant(participant.id);
      await linkParticipantToAccount(participant, account.id);
    } catch (error) {
      const taken = error instanceof Error && error.message.includes("already claimed");
      toast({
        message: taken ? `${participant.name} est déjà pris` : "Impossible de choisir ce participant",
        detail: taken ? "Un autre compte utilise déjà cette identité. Choisis-en une autre ou crée la tienne." : authErrorMessage(error),
        tone: "error",
      });
    } finally {
      setBusyId(null);
    }
  };

  const createMine = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newName.trim()) return;
    setBusyId("new");
    try {
      const participant = await addParticipant(trip.id, newName, activeParticipants.length);
      // Le participant doit exister côté serveur avant d’être revendiqué.
      if (isSupabaseConfigured()) {
        await syncEngine.flush({ immediate: true });
        await syncEngine.claimParticipant(participant.id);
      }
      await linkParticipantToAccount(participant, account.id);
    } catch (error) {
      toast({ message: "Participant non créé", detail: authErrorMessage(error), tone: "error" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-10">
      <div className="rounded-[32px] bg-white/80 p-6 shadow-card">
        <BrandLogo size={56} className="rounded-2xl" priority />
        <p className="mt-6 text-[10px] font-black uppercase tracking-[0.2em] text-terra">{trip.name}</p>
        <h1 className="mt-1 font-display text-4xl font-bold">Quel participant êtes-vous ?</h1>
        <p className="mt-3 text-sm leading-relaxed text-morocco/60">Le compte <strong>{account.displayName}</strong> sera rattaché à cette personne. Tout le crew pourra toujours ajouter des verres à tout le monde.</p>

        <div className="mt-6 space-y-2">
          {activeParticipants.map((participant) => {
            const takenByOther = Boolean(participant.userId) && participant.userId !== account.id;
            return (
              <button
                key={participant.id}
                onClick={() => void claim(participant)}
                disabled={takenByOther || Boolean(busyId)}
                className="tap-bump flex min-h-16 w-full items-center gap-3 rounded-2xl border border-sand bg-ivory px-4 text-left font-extrabold disabled:opacity-45"
              >
                <ParticipantAvatar participant={participant} />
                <span className="flex-1 truncate">{participant.name}</span>
                {busyId === participant.id ? <LoaderCircle size={17} className="animate-spin text-terra" />
                  : takenByOther ? <span className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-morocco/45"><Lock size={13} />Pris</span>
                  : <span className="text-terra">→</span>}
              </button>
            );
          })}
        </div>

        <form onSubmit={createMine} className="mt-5 border-t border-sand/70 pt-5">
          <label className="block text-xs font-extrabold uppercase tracking-wider">Ou crée ton participant
            <input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Prénom" className="mt-2 min-h-12 w-full rounded-xl border border-sand bg-ivory px-3 text-sm font-bold outline-none" />
          </label>
          <button disabled={Boolean(busyId) || !newName.trim()} className="tap-bump mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-morocco text-sm font-black text-ivory disabled:opacity-50">
            {busyId === "new" ? <LoaderCircle size={16} className="animate-spin" /> : <Plus size={16} />}Créer mon participant
          </button>
        </form>
      </div>
    </main>
  );
}
