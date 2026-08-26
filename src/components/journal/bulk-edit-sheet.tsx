"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Clock3, UserRound, Wallet } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ParticipantAvatar } from "@/components/participants/participant-avatar";
import { useTrip } from "@/components/providers/trip-provider";
import { useToast } from "@/components/providers/toast-provider";
import { updateEntries } from "@/data/repository";
import type { UndoBatch } from "@/domain/types";

const SHIFTS = [-60, -30, 30, 60];

/** Correction groupée : « ces 3 bières c’était Lucas », « on a tout saisi une heure trop tard ». */
export function BulkEditSheet({ batch, onClose, onDone }: { batch: UndoBatch | null; onClose: () => void; onDone: () => void }) {
  const { activeParticipants } = useTrip();
  const toast = useToast();
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [paidBy, setPaidBy] = useState<string | null>(null);
  const [shift, setShift] = useState(0);

  useEffect(() => {
    if (!batch) return;
    setParticipantId(null);
    setPaidBy(null);
    setShift(0);
  }, [batch]);

  if (!batch) return null;
  const total = batch.drinkEntryIds.length + batch.waterEntryIds.length;
  const changed = Boolean(participantId) || Boolean(paidBy) || shift !== 0;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!changed) return;
    await updateEntries(batch, {
      participantId: participantId ?? undefined,
      paidBy: paidBy ?? undefined,
      shiftMinutes: shift || undefined,
    });
    toast({ message: total === 1 ? "1 consommation modifiée" : `${total} consommations modifiées`, detail: "Compteurs, alcoolémie estimée et statistiques suivent immédiatement." });
    onDone();
    onClose();
  };

  return (
    <BottomSheet open onClose={onClose} title={total === 1 ? "Corriger la consommation" : `Corriger ${total} consommations`}>
      <form className="space-y-5" onSubmit={submit}>
        <fieldset>
          <legend className="mb-2 flex items-center gap-1.5 text-sm font-extrabold"><UserRound size={15} className="text-terra" />Réattribuer à</legend>
          <div className="flex flex-wrap gap-2">
            {activeParticipants.map((participant) => (
              <button type="button" key={participant.id} onClick={() => setParticipantId((current) => (current === participant.id ? null : participant.id))} aria-pressed={participantId === participant.id} className={clsx("flex min-h-12 items-center gap-2 rounded-xl border px-3 text-sm font-bold", participantId === participant.id ? "border-morocco bg-morocco text-ivory" : "border-sand bg-white")}>
                <ParticipantAvatar participant={participant} size="sm" />{participant.name}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-morocco/50">Laisse vide pour ne pas changer le buveur.</p>
        </fieldset>

        {batch.drinkEntryIds.length ? (
          <fieldset>
            <legend className="mb-2 flex items-center gap-1.5 text-sm font-extrabold"><Wallet size={15} className="text-terra" />Payé par</legend>
            <div className="flex flex-wrap gap-2">
              {activeParticipants.map((participant) => (
                <button type="button" key={participant.id} onClick={() => setPaidBy((current) => (current === participant.id ? null : participant.id))} aria-pressed={paidBy === participant.id} className={clsx("min-h-12 rounded-xl border px-3 text-sm font-bold", paidBy === participant.id ? "border-terra bg-terra text-ivory" : "border-sand bg-white")}>
                  {participant.name}
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}

        <fieldset>
          <legend className="mb-2 flex items-center gap-1.5 text-sm font-extrabold"><Clock3 size={15} className="text-terra" />Décaler l’heure</legend>
          <div className="grid grid-cols-4 gap-2">
            {SHIFTS.map((minutes) => (
              <button type="button" key={minutes} onClick={() => setShift((current) => (current === minutes ? 0 : minutes))} aria-pressed={shift === minutes} className={clsx("min-h-12 rounded-xl border text-xs font-black", shift === minutes ? "border-morocco bg-morocco text-ivory" : "border-sand bg-white")}>
                {minutes > 0 ? "+" : "−"}{Math.abs(minutes)} min
              </button>
            ))}
          </div>
        </fieldset>

        <button disabled={!changed} className="min-h-14 w-full rounded-2xl bg-terra text-base font-black text-ivory disabled:opacity-40">Appliquer</button>
      </form>
    </BottomSheet>
  );
}
