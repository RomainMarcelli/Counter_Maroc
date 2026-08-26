"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { CATEGORY_LABELS, DRINK_ICONS } from "@/domain/constants";
import type { Drink, DrinkCategory } from "@/domain/types";
import { addDrink, updateDrink } from "@/data/repository";
import { useTrip } from "@/components/providers/trip-provider";
import { useToast } from "@/components/providers/toast-provider";

export function DrinkFormSheet({ open, onClose, drink = null }: { open: boolean; onClose: () => void; drink?: Drink | null }) {
  const { trip, activeDrinks } = useTrip();
  const toast = useToast();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<DrinkCategory>("cocktail");
  const [icon, setIcon] = useState("🍹");
  useEffect(() => { setName(drink?.name ?? ""); setCategory(drink?.category ?? "cocktail"); setIcon(drink?.icon ?? "🍹"); }, [drink, open]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!trip) return;
    if (drink) await updateDrink(drink, { name, category, icon });
    else await addDrink(trip.id, { name, category, icon }, activeDrinks.length);
    toast({ message: drink ? "Boisson modifiée" : `${name} ajoutée`, detail: navigator.onLine ? "Synchronisation en cours" : "Enregistrée sur ce téléphone" });
    onClose();
  };
  return (
    <BottomSheet open={open} onClose={onClose} title={drink ? "Modifier la boisson" : "Nouvelle boisson"}>
      <form className="space-y-5" onSubmit={submit}>
        <label className="block text-sm font-extrabold">Nom<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Gin Tonic" className="mt-2 min-h-14 w-full rounded-2xl border border-sand bg-white px-4 outline-none" required /></label>
        <fieldset><legend className="mb-2 text-sm font-extrabold">Catégorie</legend><div className="grid grid-cols-2 gap-2">{(Object.entries(CATEGORY_LABELS) as [DrinkCategory, string][]).map(([value, label]) => <button type="button" key={value} onClick={() => setCategory(value)} className={clsx("min-h-12 rounded-xl border-2 text-sm font-bold", category === value ? "border-morocco bg-morocco text-ivory" : "border-sand bg-white")}>{label}</button>)}</div></fieldset>
        <fieldset><legend className="mb-2 text-sm font-extrabold">Icône</legend><div className="grid grid-cols-5 gap-2">{DRINK_ICONS.map((value) => <button type="button" key={value} onClick={() => setIcon(value)} aria-label={`Choisir ${value}`} aria-pressed={icon === value} className={clsx("min-h-12 rounded-xl border-2 text-xl", icon === value ? "border-terra bg-terra/10" : "border-sand bg-white")}>{value}</button>)}</div></fieldset>
        <button className="min-h-14 w-full rounded-2xl bg-terra text-base font-black text-ivory">{drink ? "Enregistrer" : "Ajouter la boisson"}</button>
      </form>
    </BottomSheet>
  );
}
