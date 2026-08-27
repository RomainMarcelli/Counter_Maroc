"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Plus, Trash2 } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { CATEGORY_DEFAULTS, CATEGORY_LABELS } from "@/domain/constants";
import { DRINK_ICON_KEYS, DRINK_ICON_LABELS, defaultIconKeyForCategory, resolveDrinkIconKey, tintForIconKey } from "@/domain/drink-icons";
import { DrinkIconGlyph } from "@/components/drinks/drink-icon";
import type { AlcoholComponent, Drink, DrinkCategory } from "@/domain/types";
import { addDrink, updateDrink } from "@/data/repository";
import { useTrip } from "@/components/providers/trip-provider";
import { useToast } from "@/components/providers/toast-provider";
import { calculateDrinkAlcoholGrams, formatAlcoholGrams } from "@/domain/bac";
import { CURRENCY_LABEL } from "@/domain/expenses";

interface DrinkFormSheetProps {
  open: boolean;
  onClose: () => void;
  drink?: Drink | null;
  /** Catégorie pré-sélectionnée : le filtre actif de l’écran Rapide, pour que la boisson créée y apparaisse aussitôt. */
  defaultCategory?: DrinkCategory;
  onCreated?: (drink: Drink) => void;
}

interface ComponentDraft {
  name: string;
  cl: string;
  abv: string;
}

const mlToCl = (ml: number | null) => (ml === null ? "" : String(Math.round(ml) / 10).replace(".", ","));
const clToMl = (value: string) => {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 10) : null;
};
const toNumber = (value: string) => {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export function DrinkFormSheet({ open, onClose, drink = null, defaultCategory = "cocktail", onCreated }: DrinkFormSheetProps) {
  const { trip, activeDrinks } = useTrip();
  const toast = useToast();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<DrinkCategory>(defaultCategory);
  const [icon, setIcon] = useState<string>("cocktail");
  const [volumeCl, setVolumeCl] = useState("");
  const [abv, setAbv] = useState("");
  const [recipe, setRecipe] = useState(false);
  const [components, setComponents] = useState<ComponentDraft[]>([]);
  const [price, setPrice] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    const nextCategory = drink?.category ?? defaultCategory;
    setName(drink?.name ?? "");
    setCategory(nextCategory);
    // Une ancienne boisson porte encore un emoji : on la relit en pictogramme.
    setIcon(drink ? resolveDrinkIconKey(drink) : defaultIconKeyForCategory(nextCategory));
    setVolumeCl(mlToCl(drink?.servingVolumeMl ?? CATEGORY_DEFAULTS[nextCategory].servingVolumeMl));
    setAbv(drink?.abvPercent ? String(drink.abvPercent) : drink ? "" : String(CATEGORY_DEFAULTS[nextCategory].abvPercent));
    setRecipe(Boolean(drink?.alcoholComponents?.length));
    setComponents(drink?.alcoholComponents?.map((component) => ({ name: component.name, cl: mlToCl(component.volumeMl), abv: String(component.abvPercent) })) ?? []);
    setPrice(drink?.priceCents ? String(drink.priceCents / 100).replace(".", ",") : "");
    setConfirmed(drink?.compositionConfirmed ?? false);
  }, [drink, defaultCategory, open]);

  const draft = useMemo(() => {
    const alcoholComponents: AlcoholComponent[] = recipe
      ? components
          .map((component) => ({ name: component.name.trim() || "Alcool", volumeMl: clToMl(component.cl) ?? 0, abvPercent: toNumber(component.abv) ?? 0 }))
          .filter((component) => component.volumeMl > 0 && component.abvPercent > 0)
      : [];
    return {
      servingVolumeMl: clToMl(volumeCl),
      abvPercent: recipe ? null : toNumber(abv),
      alcoholComponents: alcoholComponents.length ? alcoholComponents : null,
      compositionConfirmed: confirmed,
      priceCents: toNumber(price) === null ? null : Math.round((toNumber(price) ?? 0) * 100),
    };
  }, [recipe, components, volumeCl, abv, confirmed, price]);

  const grams = useMemo(() => calculateDrinkAlcoholGrams({ isAlcohol: true, ...draft }), [draft]);

  const setComponent = (index: number, changes: Partial<ComponentDraft>) => setComponents((current) => current.map((component, position) => (position === index ? { ...component, ...changes } : component)));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!trip) return;
    if (drink) await updateDrink(drink, { name, category, icon, ...draft });
    else onCreated?.(await addDrink(trip.id, { name, category, icon, ...draft }, activeDrinks.length));
    toast({ message: drink ? "Boisson modifiée" : `${name} ajoutée`, detail: navigator.onLine ? "Synchronisation en cours" : "Enregistrée sur ce téléphone" });
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={drink ? "Modifier la boisson" : "Nouvelle boisson"}>
      <form className="space-y-5" onSubmit={submit}>
        <label className="block text-sm font-extrabold">Nom<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Gin Tonic" className="mt-2 min-h-14 w-full rounded-2xl border border-sand bg-white px-4 outline-none" required /></label>
        <fieldset>
          <legend className="mb-2 text-sm font-extrabold">Catégorie</legend>
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(CATEGORY_LABELS) as [DrinkCategory, string][]).map(([value, label]) => (
              <button type="button" key={value} onClick={() => { setCategory(value); setIcon(defaultIconKeyForCategory(value)); }} aria-pressed={category === value} className={clsx("tap-bump min-h-14 rounded-xl border-2 text-sm font-bold", category === value ? "border-morocco bg-morocco text-ivory" : "border-sand bg-white")}>{label}</button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-extrabold">Pictogramme</legend>
          <div className="grid grid-cols-4 gap-2">
            {DRINK_ICON_KEYS.map((value) => (
              <button type="button" key={value} onClick={() => setIcon(value)} aria-label={`Pictogramme ${DRINK_ICON_LABELS[value]}`} aria-pressed={icon === value} className={clsx("tap-bump flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border-2 transition", icon === value ? "border-terra bg-terra/10 text-terra" : "border-sand bg-white text-morocco/70")}>
                <DrinkIconGlyph iconKey={value} tint={tintForIconKey(value)} size={22} />
                <span className="text-[10px] font-black">{DRINK_ICON_LABELS[value]}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="rounded-2xl border border-sand bg-white/60 p-4">
          <legend className="px-1 text-sm font-extrabold">Estimation alcool</legend>
          <p className="text-xs text-morocco/55">Ces valeurs servent uniquement à estimer l’alcoolémie et l’addition. Elles n’ajoutent aucune étape au moment d’ajouter un verre.</p>

          <label className="mt-3 block text-xs font-black uppercase tracking-wider text-morocco/60">
            Volume du verre
            <span className="mt-1.5 flex min-h-12 items-center rounded-xl border border-sand bg-white px-3"><input inputMode="decimal" value={volumeCl} onChange={(event) => setVolumeCl(event.target.value)} placeholder="25" className="min-w-0 flex-1 bg-transparent text-sm font-bold normal-case tracking-normal outline-none" /><span className="text-xs font-bold text-morocco/50">cl</span></span>
          </label>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setRecipe(false)} aria-pressed={!recipe} className={clsx("min-h-12 rounded-xl border-2 text-xs font-black", !recipe ? "border-morocco bg-morocco text-ivory" : "border-sand bg-white")}>Verre entier</button>
            <button type="button" onClick={() => { setRecipe(true); if (!components.length) setComponents([{ name: "Rhum", cl: "4", abv: "40" }]); }} aria-pressed={recipe} className={clsx("min-h-12 rounded-xl border-2 text-xs font-black", recipe ? "border-morocco bg-morocco text-ivory" : "border-sand bg-white")}>Recette (cocktail)</button>
          </div>

          {recipe ? (
            <div className="mt-3 space-y-2">
              {components.map((component, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input value={component.name} onChange={(event) => setComponent(index, { name: event.target.value })} placeholder="Vodka" aria-label={`Alcool ${index + 1}`} className="min-h-12 min-w-0 flex-1 rounded-xl border border-sand bg-white px-3 text-sm font-bold outline-none" />
                  <span className="flex min-h-12 w-[74px] shrink-0 items-center rounded-xl border border-sand bg-white px-2"><input inputMode="decimal" value={component.cl} onChange={(event) => setComponent(index, { cl: event.target.value })} aria-label={`Volume de l’alcool ${index + 1}`} className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none" /><span className="text-[10px] font-bold text-morocco/50">cl</span></span>
                  <span className="flex min-h-12 w-[70px] shrink-0 items-center rounded-xl border border-sand bg-white px-2"><input inputMode="decimal" value={component.abv} onChange={(event) => setComponent(index, { abv: event.target.value })} aria-label={`Degré de l’alcool ${index + 1}`} className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none" /><span className="text-[10px] font-bold text-morocco/50">%</span></span>
                  <button type="button" onClick={() => setComponents((current) => current.filter((_, position) => position !== index))} className="flex size-11 shrink-0 items-center justify-center text-terra" aria-label={`Retirer l’alcool ${index + 1}`}><Trash2 size={16} /></button>
                </div>
              ))}
              <button type="button" onClick={() => setComponents((current) => [...current, { name: "", cl: "", abv: "" }])} className="flex min-h-11 items-center gap-1.5 text-xs font-black text-terra"><Plus size={15} />Ajouter un alcool</button>
            </div>
          ) : (
            <label className="mt-3 block text-xs font-black uppercase tracking-wider text-morocco/60">
              Degré du verre
              <span className="mt-1.5 flex min-h-12 items-center rounded-xl border border-sand bg-white px-3"><input inputMode="decimal" value={abv} onChange={(event) => setAbv(event.target.value)} placeholder="5" className="min-w-0 flex-1 bg-transparent text-sm font-bold normal-case tracking-normal outline-none" /><span className="text-xs font-bold text-morocco/50">%</span></span>
            </label>
          )}

          <p className="mt-3 rounded-xl bg-sand/35 px-3 py-2 text-sm font-black text-morocco">{grams === null ? "Composition à confirmer" : `≈ ${formatAlcoholGrams(grams)} d’alcool pur`}</p>

          <label className="mt-3 flex min-h-11 items-center gap-3"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="size-5 accent-[#B5543C]" /><span className="text-xs font-bold text-morocco/70">Dose vérifiée au bar</span></label>

          <label className="mt-3 block text-xs font-black uppercase tracking-wider text-morocco/60">
            Prix (facultatif)
            <span className="mt-1.5 flex min-h-12 items-center rounded-xl border border-sand bg-white px-3"><input inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="45" className="min-w-0 flex-1 bg-transparent text-sm font-bold normal-case tracking-normal outline-none" /><span className="text-xs font-bold text-morocco/50">{CURRENCY_LABEL}</span></span>
          </label>
        </fieldset>

        <button className="min-h-14 w-full rounded-2xl bg-terra text-base font-black text-ivory">{drink ? "Enregistrer" : "Ajouter la boisson"}</button>
      </form>
    </BottomSheet>
  );
}
