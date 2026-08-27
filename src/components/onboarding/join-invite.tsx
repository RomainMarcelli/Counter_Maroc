"use client";

import { useState } from "react";
import { LoaderCircle, Ticket } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { useTrip } from "@/components/providers/trip-provider";
import { useToast } from "@/components/providers/toast-provider";
import { syncEngine } from "@/data/sync-engine";
import { authErrorMessage } from "@/data/auth";
import { clearPendingInvite, takePendingInvite } from "@/lib/invite";

/**
 * Proposition de rejoindre un séjour reçue par lien. Le compte est déjà connecté :
 * il ne reste qu’à confirmer. `join_trip_by_code` est idempotent côté serveur,
 * donc accepter deux fois ne crée jamais un second membership.
 */
export function JoinInvite({ code }: { code: string }) {
  const { refreshActiveTrip, trip } = useTrip();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const accept = async () => {
    setBusy(true);
    try {
      const joined = await syncEngine.joinTrip(code);
      takePendingInvite();
      await refreshActiveTrip();
      toast({ message: `Bienvenue dans ${joined.name}`, detail: "Choisis ton participant pour commencer." });
    } catch (error) {
      const unknown = error instanceof Error && error.message.includes("trip not found");
      toast({
        message: unknown ? "Séjour introuvable" : "Impossible de rejoindre",
        detail: unknown ? "Ce code d’invitation ne correspond à aucun séjour." : authErrorMessage(error),
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-10">
      <div className="rounded-[32px] bg-white/80 p-6 shadow-card">
        <BrandLogo size={56} className="rounded-2xl" priority />
        <p className="mt-6 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-terra"><Ticket size={13} />Invitation reçue</p>
        <h1 className="mt-1 font-display text-4xl font-bold">Rejoindre le séjour ?</h1>
        <p className="mt-3 text-sm leading-relaxed text-morocco/60">Quelqu’un du crew t’a partagé ce code. Tu pourras ensuite choisir quel participant tu es.</p>

        <p className="mt-5 rounded-2xl border border-sand bg-ivory px-4 py-3 text-center font-display text-2xl tracking-wider">{code}</p>

        <button onClick={() => void accept()} disabled={busy} className="tap-bump mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-terra text-base font-extrabold text-ivory disabled:opacity-50">
          {busy ? <LoaderCircle size={18} className="animate-spin" /> : null}Rejoindre le Crew
        </button>
        <button onClick={() => clearPendingInvite()} className="mt-2 min-h-12 w-full text-sm font-bold text-morocco/60">
          {trip ? "Plus tard, revenir à mon séjour" : "Plus tard"}
        </button>
      </div>
    </main>
  );
}
