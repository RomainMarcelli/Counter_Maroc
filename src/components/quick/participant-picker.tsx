"use client";

import clsx from "clsx";
import { Users } from "lucide-react";
import { useTrip } from "@/components/providers/trip-provider";
import { ParticipantAvatar } from "@/components/participants/participant-avatar";

export function ParticipantPicker() {
  const { activeParticipants, selectedParticipantIds, setSelectedParticipantIds } = useTrip();
  const allSelected = activeParticipants.length > 0 && selectedParticipantIds.length === activeParticipants.length;
  const toggle = (id: string) => setSelectedParticipantIds((current) => current.includes(id) ? (current.length === 1 ? current : current.filter((item) => item !== id)) : [...current, id]);
  return (
    <section aria-labelledby="participant-title">
      <div className="mb-3 flex items-end justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-terra">Étape 1</p><h2 id="participant-title" className="font-display text-2xl font-bold">Pour qui ?</h2></div><span className="text-xs font-bold text-morocco/50">{selectedParticipantIds.length} sélectionné{selectedParticipantIds.length > 1 ? "s" : ""}</span></div>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
        {activeParticipants.map((participant) => {
          const selected = selectedParticipantIds.includes(participant.id);
          return <button key={participant.id} onClick={() => toggle(participant.id)} aria-pressed={selected} className={clsx("tap-bump flex min-h-14 shrink-0 items-center gap-2 rounded-2xl border-2 px-3.5 text-sm font-extrabold transition", selected ? "border-morocco bg-morocco text-ivory shadow-card" : "border-sand/60 bg-white/65 text-morocco")}><ParticipantAvatar participant={participant} size="sm" className={selected ? "bg-ivory/15" : "bg-sand/45"} />{participant.name}</button>;
        })}
        <button onClick={() => setSelectedParticipantIds(allSelected ? [activeParticipants[0]?.id].filter(Boolean) : activeParticipants.map((item) => item.id))} aria-pressed={allSelected} className={clsx("tap-bump flex min-h-14 shrink-0 items-center gap-2 rounded-2xl border-2 px-4 text-sm font-extrabold transition", allSelected ? "border-terra bg-terra text-ivory" : "border-sand/60 bg-white/65")}><Users size={18} />Tout le monde</button>
      </div>
    </section>
  );
}
