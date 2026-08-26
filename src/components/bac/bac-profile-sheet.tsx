"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Info, Lock } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useToast } from "@/components/providers/toast-provider";
import { updateParticipant } from "@/data/repository";
import { BAC_DISCLAIMER, DEFAULT_DISTRIBUTION_RATIO, DISTRIBUTION_PRESETS, MAX_WEIGHT_KG, MIN_WEIGHT_KG, isValidWeight } from "@/domain/bac";
import type { Participant } from "@/domain/types";

/** Réglages personnels de l’estimation. Tout est facultatif et désactivable à tout moment. */
export function BacProfileSheet({ participant, onClose }: { participant: Participant | null; onClose: () => void }) {
  const toast = useToast();
  const [enabled, setEnabled] = useState(false);
  const [weight, setWeight] = useState("");
  const [ratio, setRatio] = useState(DEFAULT_DISTRIBUTION_RATIO);
  const [custom, setCustom] = useState(false);
  const [privateOnly, setPrivateOnly] = useState(false);

  useEffect(() => {
    if (!participant) return;
    setEnabled(participant.bacEnabled);
    setWeight(participant.weightKg ? String(participant.weightKg) : "");
    setRatio(participant.distributionRatio ?? DEFAULT_DISTRIBUTION_RATIO);
    setCustom(Boolean(participant.distributionRatio) && !DISTRIBUTION_PRESETS.some((preset) => preset.value === participant.distributionRatio));
    setPrivateOnly(participant.bacPrivate);
  }, [participant]);

  if (!participant) return null;
  const weightValue = weight.trim() ? Number(weight.replace(",", ".")) : null;
  const weightError = enabled && weight.trim() !== "" && !isValidWeight(weightValue) ? `Indique un poids entre ${MIN_WEIGHT_KG} et ${MAX_WEIGHT_KG} kg.` : null;
  const ready = !enabled || isValidWeight(weightValue);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ready) return;
    await updateParticipant(participant, {
      bacEnabled: enabled,
      weightKg: isValidWeight(weightValue) ? weightValue : null,
      distributionRatio: ratio,
      bacPrivate: privateOnly,
    });
    toast({ message: enabled ? `Estimation activée pour ${participant.name}` : `Estimation désactivée pour ${participant.name}`, detail: enabled ? "Le taux estimé apparaît sur l’écran Rapide et dans les Stats." : "Seul le compteur de verres reste affiché." });
    onClose();
  };

  const forget = async () => {
    await updateParticipant(participant, { bacEnabled: false, weightKg: null, distributionRatio: null, bacPrivate: false });
    toast({ message: "Données d’estimation effacées", detail: `${participant.name} n’a plus de poids enregistré dans le séjour.` });
    onClose();
  };

  return (
    <BottomSheet open onClose={onClose} title={`Estimation d’alcoolémie · ${participant.name}`}>
      <form className="space-y-5" onSubmit={submit}>
        <label className="flex min-h-14 items-center gap-3 rounded-2xl border border-sand bg-white px-4">
          <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="size-5 accent-[#B5543C]" />
          <span><strong className="block text-sm">Estimer mon alcoolémie</strong><span className="text-xs text-morocco/55">Facultatif. Le compteur de verres fonctionne sans.</span></span>
        </label>

        <label className="block text-sm font-extrabold">
          Poids
          <span className="mt-2 flex min-h-14 items-center rounded-2xl border border-sand bg-white px-4">
            <input inputMode="decimal" value={weight} onChange={(event) => setWeight(event.target.value)} placeholder="70" className="min-w-0 flex-1 bg-transparent outline-none" aria-describedby="bac-weight-help" />
            <span className="text-sm font-bold text-morocco/50">kg</span>
          </span>
          <span id="bac-weight-help" className={clsx("mt-1.5 block text-xs font-bold", weightError ? "text-terra" : "text-morocco/55")}>{weightError ?? "Sert uniquement au calcul, reste dans ce séjour."}</span>
        </label>

        <fieldset>
          <legend className="text-sm font-extrabold">Répartition dans le corps</legend>
          <p className="mt-1 text-xs text-morocco/55">L’alcool se dilue dans l’eau du corps. Garde la valeur moyenne si tu préfères ne rien préciser.</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {DISTRIBUTION_PRESETS.map((preset) => (
              <button type="button" key={preset.value} onClick={() => { setRatio(preset.value); setCustom(false); }} aria-pressed={!custom && ratio === preset.value} className={clsx("min-h-14 rounded-xl border-2 px-1 text-xs font-black leading-tight", !custom && ratio === preset.value ? "border-morocco bg-morocco text-ivory" : "border-sand bg-white")}>
                {preset.label}
                <span className={clsx("mt-0.5 block text-[9px] font-bold", !custom && ratio === preset.value ? "text-sand" : "text-morocco/50")}>{preset.detail}</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setCustom((value) => !value)} className="mt-2 min-h-11 text-xs font-black text-terra">{custom ? "Utiliser une valeur proposée" : "Réglage avancé : coefficient personnalisé"}</button>
          {custom ? <input inputMode="decimal" value={String(ratio)} onChange={(event) => setRatio(Number(event.target.value.replace(",", ".")) || DEFAULT_DISTRIBUTION_RATIO)} className="min-h-12 w-full rounded-xl border border-sand bg-white px-3 text-sm font-bold outline-none" aria-label="Coefficient de répartition personnalisé" /> : null}
        </fieldset>

        <label className="flex min-h-14 items-center gap-3 rounded-2xl border border-sand bg-white px-4">
          <input type="checkbox" checked={privateOnly} onChange={(event) => setPrivateOnly(event.target.checked)} className="size-5 accent-[#B5543C]" />
          <span className="flex-1"><strong className="flex items-center gap-1.5 text-sm"><Lock size={14} />Garder mon taux pour moi</strong><span className="text-xs text-morocco/55">Il ne s’affiche que sur le téléphone réglé sur ton identité.</span></span>
        </label>

        <p className="flex gap-2 rounded-2xl border border-sand bg-sand/25 p-3 text-xs font-bold leading-relaxed text-morocco/70"><Info size={16} className="mt-0.5 shrink-0 text-terra" />{BAC_DISCLAIMER}</p>

        <button disabled={!ready} className="min-h-14 w-full rounded-2xl bg-terra text-base font-black text-ivory disabled:opacity-40">Enregistrer</button>
        {participant.weightKg ? <button type="button" onClick={() => void forget()} className="min-h-12 w-full rounded-2xl border border-terra text-sm font-black text-terra">Effacer mes données d’estimation</button> : null}
      </form>
    </BottomSheet>
  );
}
