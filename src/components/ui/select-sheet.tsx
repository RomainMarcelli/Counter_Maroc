"use client";

import { useId, useState } from "react";
import clsx from "clsx";
import { Check, ChevronDown } from "lucide-react";
import { BottomSheet } from "./bottom-sheet";

export interface SelectOption {
  value: string;
  label: string;
  /** Pictogramme optionnel affiché à gauche, dans le champ comme dans la liste. */
  icon?: React.ReactNode;
  detail?: string;
}

/**
 * Remplace un `<select>` natif : sur iOS il ouvre une roulette minuscule dont on
 * ne maîtrise ni la typographie ni la hauteur des lignes. Ici le champ ouvre une
 * bottom sheet aux lignes larges, cohérente avec le reste de l’application.
 *
 * Pour deux à quatre choix courts, préférer `SegmentedField` : un tap suffit.
 */
export function SelectField({ label, value, options, onChange, placeholder = "Choisir", disabled = false }: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const labelId = useId();
  const selected = options.find((option) => option.value === value) ?? null;

  return (
    <div>
      <span id={labelId} className="block text-sm font-extrabold">{label}</span>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-labelledby={labelId}
        className="tap-bump mt-2 flex min-h-14 w-full items-center gap-2.5 rounded-2xl border border-sand bg-white px-4 text-left disabled:opacity-50"
      >
        {selected?.icon ? <span className="shrink-0 text-morocco/75">{selected.icon}</span> : null}
        <span className={clsx("min-w-0 flex-1 truncate text-base font-bold", selected ? "text-morocco" : "text-morocco/45")}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown size={18} className="shrink-0 text-morocco/40" />
      </button>

      {open ? (
        <BottomSheet open onClose={() => setOpen(false)} title={label}>
          <div className="space-y-1.5 pb-2" role="listbox" aria-labelledby={labelId}>
            {options.map((option) => {
              const active = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => { onChange(option.value); setOpen(false); }}
                  className={clsx(
                    "tap-bump flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 text-left transition",
                    active ? "tint-neutral border-morocco bg-morocco text-ivory" : "border-sand/60 bg-white text-morocco",
                  )}
                >
                  {option.icon ? <span className={clsx("shrink-0", active ? "text-sand" : "text-morocco/70")}>{option.icon}</span> : null}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-extrabold">{option.label}</span>
                    {option.detail ? <span className={clsx("block truncate text-xs font-bold", active ? "text-sand" : "text-morocco/50")}>{option.detail}</span> : null}
                  </span>
                  {active ? <Check size={18} strokeWidth={3} className="shrink-0" /> : null}
                </button>
              );
            })}
          </div>
        </BottomSheet>
      ) : null}
    </div>
  );
}

/** Choix court : tout est visible d’un coup d’œil et tenable au pouce. */
export function SegmentedField({ label, value, options, onChange, columns = 2 }: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  columns?: 2 | 3 | 4;
}) {
  const gridClass = columns === 4 ? "grid-cols-4" : columns === 3 ? "grid-cols-3" : "grid-cols-2";
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-extrabold">{label}</legend>
      <div className={clsx("grid gap-2", gridClass)}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={active}
              className={clsx(
                "tap-bump flex min-h-14 items-center justify-center gap-1.5 rounded-xl border-2 px-2 text-sm font-bold transition",
                active ? "tint-neutral border-morocco bg-morocco text-ivory" : "border-sand bg-white text-morocco",
              )}
            >
              {option.icon}
              <span className="truncate">{option.label}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
