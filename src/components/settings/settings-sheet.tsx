"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useTrip } from "@/components/providers/trip-provider";
import { useToast } from "@/components/providers/toast-provider";
import { addParticipant, deleteDrink, deleteParticipant, resetLocalData, setActorId, updateParticipant } from "@/data/repository";
import type { Drink } from "@/domain/types";
import { DrinkFormSheet } from "@/components/quick/drink-form-sheet";

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { trip, activeParticipants, activeDrinks, actorId } = useTrip();
  const toast = useToast();
  const [qr, setQr] = useState("");
  const [newName, setNewName] = useState("");
  const [editingDrink, setEditingDrink] = useState<Drink | null>(null);
  const [partyMode, setPartyMode] = useState(false);

  useEffect(() => {
    setPartyMode(localStorage.getItem("partyMode") === "true");
  }, [open]);
  useEffect(() => {
    if (!trip) return;
    const url = `${window.location.origin}/?join=${encodeURIComponent(trip.shareCode)}`;
    void QRCode.toDataURL(url, { width: 320, margin: 1, color: { dark: "#1E4A3A", light: "#FFF8EC" } }).then(setQr);
  }, [trip]);
  if (!trip) return null;

  const addPerson = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newName.trim()) return;
    await addParticipant(trip.id, newName, activeParticipants.length);
    setNewName("");
    toast({ message: "Participant ajouté" });
  };
  const setParty = (enabled: boolean) => {
    setPartyMode(enabled);
    localStorage.setItem("partyMode", String(enabled));
    window.dispatchEvent(new CustomEvent("marrakech-party-mode", { detail: enabled }));
  };
  return (
    <>
      <BottomSheet open={open} onClose={onClose} title="Le séjour">
        <div className="space-y-7">
          <section className="rounded-3xl bg-morocco p-5 text-ivory">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-sand">Code du crew</p>
            <div className="mt-3 flex items-center gap-3"><strong className="flex-1 font-display text-2xl tracking-wider">{trip.shareCode}</strong><button onClick={async () => { await navigator.clipboard.writeText(trip.shareCode); toast({ message: "Code copié" }); }} className="flex size-11 items-center justify-center rounded-xl bg-white/10" aria-label="Copier le code"><Copy size={18} /></button></div>
            {qr ? <div className="mx-auto mt-4 w-fit rounded-2xl bg-ivory p-2"><Image src={qr} alt={`QR Code pour rejoindre ${trip.name}`} width={164} height={164} unoptimized /></div> : null}
          </section>

          <section>
            <h3 className="font-display text-xl font-bold">Qui utilise ce téléphone ?</h3>
            <p className="mt-1 text-xs text-morocco/55">Ce nom sera conservé comme auteur des actions locales.</p>
            <div className="mt-3 flex flex-wrap gap-2">{activeParticipants.map((participant) => <button key={participant.id} onClick={async () => { await setActorId(participant.id); toast({ message: `Identité : ${participant.name}` }); }} className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-bold ${actorId === participant.id ? "border-morocco bg-morocco text-ivory" : "border-sand bg-white"}`}><Check size={14} />{participant.name}</button>)}</div>
          </section>

          <section>
            <h3 className="font-display text-xl font-bold">Participants</h3>
            <div className="mt-3 space-y-2">{activeParticipants.map((participant) => <div key={participant.id} className="flex min-h-12 items-center gap-2 rounded-xl bg-white px-3"><span className="flex size-8 items-center justify-center rounded-full bg-sand/50 text-xs font-black">{participant.name.slice(0, 2).toUpperCase()}</span><span className="flex-1 text-sm font-extrabold">{participant.name}</span><button onClick={async () => { const name = window.prompt("Nouveau prénom", participant.name); if (name?.trim()) await updateParticipant(participant, { name }); }} className="flex size-11 items-center justify-center" aria-label={`Renommer ${participant.name}`}><Pencil size={17} /></button><button onClick={async () => { if (window.confirm(`Supprimer ${participant.name} ? Son historique sera conservé.`)) await deleteParticipant(participant); }} className="flex size-11 items-center justify-center text-terra" aria-label={`Supprimer ${participant.name}`}><Trash2 size={17} /></button></div>)}</div>
            <form onSubmit={addPerson} className="mt-3 flex gap-2"><input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Prénom" className="min-h-12 min-w-0 flex-1 rounded-xl border border-sand bg-white px-3 outline-none" /><button className="flex min-h-12 items-center gap-2 rounded-xl bg-morocco px-4 text-sm font-black text-ivory"><Plus size={17} />Ajouter</button></form>
          </section>

          <section>
            <h3 className="font-display text-xl font-bold">Boissons</h3>
            <div className="mt-3 space-y-2">{activeDrinks.map((drink) => <div key={drink.id} className="flex min-h-12 items-center gap-2 rounded-xl bg-white px-3"><span className="text-xl">{drink.icon}</span><span className="flex-1 text-sm font-extrabold">{drink.name}</span><button onClick={() => setEditingDrink(drink)} className="flex size-11 items-center justify-center" aria-label={`Modifier ${drink.name}`}><Pencil size={17} /></button><button onClick={async () => { if (window.confirm(`Supprimer ${drink.name} ? Les anciennes consommations resteront dans le journal.`)) await deleteDrink(drink); }} className="flex size-11 items-center justify-center text-terra" aria-label={`Supprimer ${drink.name}`}><Trash2 size={17} /></button></div>)}</div>
          </section>

          <section className="rounded-2xl border border-sand bg-white p-4">
            <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={partyMode} onChange={(event) => setParty(event.target.checked)} className="size-5 accent-[#B5543C]" /><span><strong className="block text-sm">Mode soirée</strong><span className="text-xs text-morocco/55">Navigation réduite à l’ajout et au journal.</span></span></label>
          </section>

          {process.env.NODE_ENV === "development" ? <button onClick={async () => { if (window.confirm("Effacer toutes les données locales de développement ?")) { await resetLocalData(); window.location.reload(); } }} className="min-h-12 w-full rounded-xl border border-terra text-sm font-black text-terra">Reset DEV · base locale vide</button> : null}
        </div>
      </BottomSheet>
      <DrinkFormSheet open={Boolean(editingDrink)} onClose={() => setEditingDrink(null)} drink={editingDrink} />
    </>
  );
}
