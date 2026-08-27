"use client";

import { useEffect, useState } from "react";
import { Activity, Camera, Check, Copy, ImageOff, LoaderCircle, LogOut, Pencil, Plus, QrCode, Share2, Trash2, UserRound } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ParticipantAvatar } from "@/components/participants/participant-avatar";
import { useTrip } from "@/components/providers/trip-provider";
import { useToast } from "@/components/providers/toast-provider";
import { useActionDialog } from "@/components/providers/action-dialog-provider";
import { addParticipant, deleteDrink, deleteParticipant, resetLocalData, updateParticipant } from "@/data/repository";
import { useAuth } from "@/components/providers/auth-provider";
import type { Drink, Participant } from "@/domain/types";
import { DrinkFormSheet } from "@/components/quick/drink-form-sheet";
import { DrinkIcon } from "@/components/drinks/drink-icon";
import { InviteSheet } from "./invite-sheet";
import { formatTripRange } from "@/lib/timezone";
import { removeParticipantPhoto, uploadParticipantPhoto } from "@/data/profile-photos";
import { BacProfileSheet } from "@/components/bac/bac-profile-sheet";
import { TrashSection } from "./trash-section";
import { calculateDrinkAlcoholGrams, canSeeBac, formatAlcoholGrams } from "@/domain/bac";
import { formatCents } from "@/domain/expenses";

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { trip, activeParticipants, activeDrinks, actorId } = useTrip();
  const { account, accountRequired, signOut } = useAuth();
  const toast = useToast();
  const { confirm: confirmAction, prompt: promptAction } = useActionDialog();
  const [newName, setNewName] = useState("");
  const [editingDrink, setEditingDrink] = useState<Drink | null>(null);
  const [partyMode, setPartyMode] = useState(false);
  const [uploadingParticipantId, setUploadingParticipantId] = useState<string | null>(null);
  const [bacParticipant, setBacParticipant] = useState<Participant | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  useEffect(() => {
    setPartyMode(localStorage.getItem("partyMode") === "true");
  }, [open]);
  if (!trip) return null;
  const myParticipant = activeParticipants.find((participant) => participant.id === actorId) ?? null;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(trip.shareCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 1800);
      toast({ message: "Code copié" });
    } catch {
      toast({ message: "Copie impossible", detail: "Ouvre le QR Code pour partager autrement.", tone: "error" });
    }
  };

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
  const setPhoto = async (participantId: string, file: File | undefined) => {
    if (!file) return;
    const participant = activeParticipants.find((item) => item.id === participantId);
    if (!participant) return;
    setUploadingParticipantId(participantId);
    try {
      await uploadParticipantPhoto(participant, file);
      toast({ message: `Photo de ${participant.name} enregistrée`, detail: "Elle sera visible par tout le crew." });
    } catch (error) {
      toast({ message: "Photo non enregistrée", detail: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setUploadingParticipantId(null);
    }
  };
  const removePhoto = async (participant: Participant) => {
    const confirmed = await confirmAction({
      eyebrow: "Photo de profil",
      title: "Retirer cette photo ?",
      description: `${participant.name} retrouvera ses initiales comme avatar. Vous pourrez ajouter une nouvelle photo à tout moment.`,
      confirmLabel: "Retirer la photo",
      cancelLabel: "Garder la photo",
      tone: "danger",
      icon: "photo",
    });
    if (!confirmed) return;
    await removeParticipantPhoto(participant);
    toast({ message: `Photo de ${participant.name} retirée`, detail: "Les initiales sont de nouveau affichées." });
  };
  const renameParticipant = async (participant: Participant) => {
    const name = await promptAction({
      eyebrow: "Profil du joueur",
      title: `Renommer ${participant.name}`,
      description: "Le nouveau prénom sera utilisé partout dans le séjour et synchronisé avec le crew.",
      inputLabel: "Nouveau prénom",
      initialValue: participant.name,
      confirmLabel: "Enregistrer",
      icon: "edit",
    });
    if (!name || name === participant.name) return;
    await updateParticipant(participant, { name });
    toast({ message: `${participant.name} devient ${name}`, detail: "Le profil a bien été mis à jour." });
  };
  const removeParticipant = async (participant: Participant) => {
    const confirmed = await confirmAction({
      eyebrow: "Gestion du crew",
      title: `${participant.name} quitte le crew ?`,
      description: "Le joueur ne sera plus sélectionnable dans Rapide. Son historique et ses statistiques passées seront conservés.",
      confirmLabel: "Retirer du crew",
      cancelLabel: "Garder le joueur",
      tone: "danger",
      icon: "trash",
    });
    if (!confirmed) return;
    await deleteParticipant(participant);
    toast({ message: `${participant.name} a été retiré`, detail: "Son historique reste conservé dans le séjour." });
  };
  const removeDrink = async (drink: Drink) => {
    const confirmed = await confirmAction({
      eyebrow: "Carte des boissons",
      title: `Supprimer ${drink.name} ?`,
      description: "La boisson disparaîtra de l’écran Rapide. Les consommations déjà enregistrées resteront visibles dans le Journal.",
      confirmLabel: "Supprimer la boisson",
      cancelLabel: "Garder la boisson",
      tone: "danger",
      icon: "trash",
    });
    if (!confirmed) return;
    await deleteDrink(drink);
    toast({ message: `${drink.name} supprimé`, detail: "Les anciennes consommations sont conservées." });
  };
  const leave = async () => {
    const confirmed = await confirmAction({
      eyebrow: "Mon compte",
      title: "Se déconnecter ?",
      description: "Le séjour reste enregistré sur ce téléphone. Il faudra une connexion internet pour te reconnecter et retrouver le crew.",
      confirmLabel: "Se déconnecter",
      cancelLabel: "Rester connecté",
      icon: "reset",
    });
    if (!confirmed) return;
    await signOut();
  };
  const resetDevice = async () => {
    const confirmed = await confirmAction({
      eyebrow: "Zone développeur",
      title: "Réinitialiser les données locales ?",
      description: "Tous les séjours et réglages stockés dans ce navigateur seront effacés, ainsi que les actions encore en attente de synchronisation. Les données déjà envoyées à Supabase sont conservées et reviendront à la prochaine connexion.",
      confirmLabel: "Réinitialiser",
      cancelLabel: "Ne rien effacer",
      tone: "danger",
      icon: "reset",
    });
    if (!confirmed) return;
    await resetLocalData();
    localStorage.removeItem("partyMode");
    window.location.replace("/");
  };
  return (
    <>
      <BottomSheet open={open} onClose={onClose} title="Le séjour">
        <div className="space-y-7">
          {accountRequired ? (
            <section>
              <h3 className="font-display text-xl font-bold">Compte</h3>
              <div className="mt-2 flex min-h-14 items-center gap-3 rounded-2xl border border-sand bg-white px-3">
                {myParticipant ? <ParticipantAvatar participant={myParticipant} /> : <span className="flex size-11 items-center justify-center rounded-xl bg-sand/35"><UserRound size={18} /></span>}
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-sm">{account?.displayName ?? "Compte"}</strong>
                  <span className="block truncate text-[11px] font-bold text-morocco/50">{account?.email ?? ""}{myParticipant ? ` · ${myParticipant.name}` : ""}</span>
                </span>
              </div>
            </section>
          ) : null}

          <section>
            <h3 className="font-display text-xl font-bold">Séjour</h3>
            <div className="mt-2 rounded-2xl border border-sand bg-white px-4 py-3">
              <strong className="block truncate text-sm">{trip.name}</strong>
              <span className="block text-[11px] font-bold text-morocco/50">{formatTripRange(trip.startDate, trip.endDate)}</span>
            </div>
          </section>

          <section>
            <h3 className="font-display text-xl font-bold">Inviter des amis</h3>
            <div className="mt-2 flex min-h-14 items-center gap-3 rounded-2xl border border-sand bg-white px-4">
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-black uppercase tracking-wider text-morocco/50">Code du séjour</span>
                <strong className="block truncate font-display text-lg tracking-wider">{trip.shareCode}</strong>
              </span>
              <button onClick={() => void copyCode()} className="tap-bump flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-sand px-3 text-xs font-black" aria-label="Copier le code du séjour">
                {codeCopied ? <Check size={15} /> : <Copy size={15} />}Copier
              </button>
            </div>
            <button onClick={() => setInviteOpen(true)} className="tap-bump mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-morocco text-sm font-black text-ivory">
              <QrCode size={17} />Afficher le QR Code
            </button>
            <button onClick={() => setInviteOpen(true)} className="tap-bump mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-sand bg-white text-sm font-black">
              <Share2 size={17} />Partager l’invitation
            </button>
          </section>

          <section>
            <h3 className="font-display text-xl font-bold">Participants</h3>
            <p className="mt-1 text-xs text-morocco/55">Touchez l’appareil photo pour choisir une image. Elle est recadrée et compressée automatiquement.</p>
            <div className="mt-3 space-y-2">{activeParticipants.map((participant) => {
              const uploading = uploadingParticipantId === participant.id;
              return <div key={participant.id} className="flex min-h-14 items-center gap-2 rounded-xl bg-white px-3">
                <ParticipantAvatar participant={participant} />
                <span className="min-w-0 flex-1 truncate text-sm font-extrabold">{participant.name}</span>
                <input id={`photo-${participant.id}`} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={Boolean(uploadingParticipantId)} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void setPhoto(participant.id, file); }} />
                <label htmlFor={`photo-${participant.id}`} className={`flex size-11 cursor-pointer items-center justify-center rounded-xl ${uploadingParticipantId ? "pointer-events-none opacity-50" : "hover:bg-sand/30"}`} aria-label={`${participant.avatarUrl ? "Changer" : "Ajouter"} la photo de ${participant.name}`}>{uploading ? <LoaderCircle size={17} className="animate-spin" /> : <Camera size={17} />}</label>
                {participant.avatarUrl ? <button onClick={() => void removePhoto(participant)} className="flex size-11 items-center justify-center text-terra" aria-label={`Retirer la photo de ${participant.name}`}><ImageOff size={17} /></button> : null}
                <button onClick={() => setBacParticipant(participant)} className={`flex size-11 items-center justify-center ${canSeeBac(participant, actorId) ? "text-terra" : "text-morocco/40"}`} aria-label={`Estimation d’alcoolémie de ${participant.name}`} title={participant.bacEnabled ? "Estimation activée" : "Estimation désactivée"}><Activity size={17} /></button>
                <button onClick={() => void renameParticipant(participant)} className="flex size-11 items-center justify-center" aria-label={`Renommer ${participant.name}`}><Pencil size={17} /></button>
                <button onClick={() => void removeParticipant(participant)} className="flex size-11 items-center justify-center text-terra" aria-label={`Supprimer ${participant.name}`}><Trash2 size={17} /></button>
              </div>;
            })}</div>
            <form onSubmit={addPerson} className="mt-3 flex gap-2"><input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Prénom" className="min-h-12 min-w-0 flex-1 rounded-xl border border-sand bg-white px-3 outline-none" /><button className="flex min-h-12 items-center gap-2 rounded-xl bg-morocco px-4 text-sm font-black text-ivory"><Plus size={17} />Ajouter</button></form>
          </section>

          <section>
            <h3 className="font-display text-xl font-bold">Boissons</h3>
            <p className="mt-1 text-xs text-morocco/55">Les doses livrées sont des ordres de grandeur. Ajustez-les d’après les verres réellement servis : elles servent à l’estimation d’alcoolémie et à l’addition.</p>
            <div className="mt-3 space-y-2">{activeDrinks.map((drink) => {
              const grams = calculateDrinkAlcoholGrams(drink);
              return <div key={drink.id} className="flex min-h-12 items-center gap-2 rounded-xl bg-white px-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sand/35 text-morocco/75"><DrinkIcon drink={drink} size={18} /></span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-sm">{drink.name}</strong>
                  <span className={`block truncate text-[11px] font-bold ${drink.compositionConfirmed ? "text-morocco/50" : "text-terra"}`}>
                    {grams === null ? "Composition à confirmer" : `${drink.compositionConfirmed ? "" : "À confirmer · "}≈ ${formatAlcoholGrams(grams)}${drink.priceCents ? ` · ${formatCents(drink.priceCents)}` : ""}`}
                  </span>
                </span>
                <button onClick={() => setEditingDrink(drink)} className="flex size-11 shrink-0 items-center justify-center" aria-label={`Modifier ${drink.name}`}><Pencil size={17} /></button>
                <button onClick={() => void removeDrink(drink)} className="flex size-11 shrink-0 items-center justify-center text-terra" aria-label={`Supprimer ${drink.name}`}><Trash2 size={17} /></button>
              </div>;
            })}</div>
          </section>

          <TrashSection open={open} />

          <section>
            <h3 className="font-display text-xl font-bold">Application</h3>
            <label className="mt-2 flex min-h-14 items-center gap-3 rounded-2xl border border-sand bg-white px-4"><input type="checkbox" checked={partyMode} onChange={(event) => setParty(event.target.checked)} className="size-5 accent-[#B5543C]" /><span><strong className="block text-sm">Mode soirée</strong><span className="text-xs text-morocco/55">Navigation réduite à l’ajout, au journal et à l’alcoolémie.</span></span></label>
            {accountRequired ? (
              <button onClick={() => void leave()} className="tap-bump mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-sand bg-white text-sm font-black">
                <LogOut size={16} />Se déconnecter
              </button>
            ) : null}
            <button onClick={() => void resetDevice()} className="tap-bump mt-2 min-h-12 w-full rounded-xl border border-terra text-sm font-black text-terra">Réinitialiser les données locales</button>
          </section>
        </div>
      </BottomSheet>
      <DrinkFormSheet open={Boolean(editingDrink)} onClose={() => setEditingDrink(null)} drink={editingDrink} />
      <BacProfileSheet participant={bacParticipant} onClose={() => setBacParticipant(null)} />
      <InviteSheet trip={trip} open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </>
  );
}
