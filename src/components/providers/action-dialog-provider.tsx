"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AlertTriangle, ImageOff, PencilLine, RotateCcw, Trash2, X } from "lucide-react";

type DialogTone = "default" | "danger";
type DialogIcon = "warning" | "trash" | "photo" | "edit" | "reset";

interface BaseDialogOptions {
  eyebrow?: string;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: DialogTone;
  icon?: DialogIcon;
}

export type ConfirmDialogOptions = BaseDialogOptions;

export interface PromptDialogOptions extends BaseDialogOptions {
  inputLabel: string;
  initialValue?: string;
  placeholder?: string;
}

interface ActionDialogContextValue {
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
  prompt: (options: PromptDialogOptions) => Promise<string | null>;
}

type DialogState =
  | { kind: "confirm"; options: ConfirmDialogOptions; resolve: (value: boolean) => void }
  | { kind: "prompt"; options: PromptDialogOptions; resolve: (value: string | null) => void };

const ActionDialogContext = createContext<ActionDialogContextValue | null>(null);

export function ActionDialogProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [inputValue, setInputValue] = useState("");
  const inputValueRef = useRef("");
  const activeDialog = useRef<DialogState | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  const closeCurrent = useCallback((confirmed: boolean) => {
    const current = activeDialog.current;
    if (!current) return;
    activeDialog.current = null;
    setDialog(null);
    if (current.kind === "confirm") current.resolve(confirmed);
    else current.resolve(confirmed ? inputValueRef.current.trim() : null);
    window.requestAnimationFrame(() => previousFocus.current?.focus());
  }, []);

  const open = useCallback((nextDialog: DialogState) => {
    const current = activeDialog.current;
    if (current?.kind === "confirm") current.resolve(false);
    if (current?.kind === "prompt") current.resolve(null);
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    activeDialog.current = nextDialog;
    const nextValue = nextDialog.kind === "prompt" ? nextDialog.options.initialValue ?? "" : "";
    inputValueRef.current = nextValue;
    setInputValue(nextValue);
    setDialog(nextDialog);
  }, []);

  const confirm = useCallback((options: ConfirmDialogOptions) => new Promise<boolean>((resolve) => {
    open({ kind: "confirm", options, resolve });
  }), [open]);

  const prompt = useCallback((options: PromptDialogOptions) => new Promise<string | null>((resolve) => {
    open({ kind: "prompt", options, resolve });
  }), [open]);

  useEffect(() => {
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => {
      if (dialog.kind === "prompt") inputRef.current?.focus();
      else panelRef.current?.querySelector<HTMLButtonElement>("[data-primary-action]")?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeCurrent(false);
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const controls = [...panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])')];
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [dialog, closeCurrent]);

  useEffect(() => () => {
    const current = activeDialog.current;
    if (current?.kind === "confirm") current.resolve(false);
    if (current?.kind === "prompt") current.resolve(null);
  }, []);

  const options = dialog?.options;
  const tone = options?.tone ?? "default";
  const canConfirm = dialog?.kind !== "prompt" || inputValue.trim().length > 0;

  return (
    <ActionDialogContext.Provider value={{ confirm, prompt }}>
      {children}
      {dialog && options ? (
        <div className="sheet-backdrop fixed inset-0 z-[110] flex items-center justify-center bg-morocco/60 px-4 py-8 backdrop-blur-[2px]" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) closeCurrent(false); }}>
          <div ref={panelRef} className="dialog-pop zellige-card relative w-full max-w-sm overflow-hidden rounded-[30px] border border-sand/60 bg-ivory p-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="action-dialog-title" aria-describedby="action-dialog-description">
            <div className="absolute -right-12 -top-12 size-36 rotate-45 border border-sand/60" aria-hidden="true" />
            <div className="relative flex items-start justify-between gap-4">
              <span className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${tone === "danger" ? "bg-terra text-ivory" : "bg-morocco text-ivory"}`} aria-hidden="true">
                <DialogIconView icon={options.icon ?? (tone === "danger" ? "warning" : "edit")} />
              </span>
              <button type="button" onClick={() => closeCurrent(false)} className="flex size-11 shrink-0 items-center justify-center rounded-full bg-sand/35 text-morocco transition hover:bg-sand/60" aria-label="Fermer la confirmation"><X size={19} /></button>
            </div>
            <form className="relative mt-5" onSubmit={(event) => { event.preventDefault(); if (canConfirm) closeCurrent(true); }}>
              {options.eyebrow ? <p className="text-[10px] font-black uppercase tracking-[0.2em] text-terra">{options.eyebrow}</p> : null}
              <h2 id="action-dialog-title" className="mt-1 font-display text-3xl font-bold leading-tight text-morocco">{options.title}</h2>
              <p id="action-dialog-description" className="mt-3 text-sm font-semibold leading-relaxed text-morocco/60">{options.description}</p>

              {dialog.kind === "prompt" ? (
                <label className="mt-5 block text-xs font-black uppercase tracking-wider text-morocco/65">
                  {dialog.options.inputLabel}
                  <input ref={inputRef} value={inputValue} onChange={(event) => { inputValueRef.current = event.target.value; setInputValue(event.target.value); }} placeholder={dialog.options.placeholder} className="mt-2 min-h-14 w-full rounded-2xl border-2 border-sand bg-white px-4 text-base font-extrabold normal-case tracking-normal text-morocco outline-none transition focus:border-terra" />
                </label>
              ) : null}

              <div className="mt-6 grid grid-cols-2 gap-3">
                <button type="button" onClick={() => closeCurrent(false)} className="min-h-[52px] rounded-2xl border border-sand bg-white px-3 text-sm font-black text-morocco transition active:scale-[0.98]">{options.cancelLabel ?? "Annuler"}</button>
                <button data-primary-action type="submit" disabled={!canConfirm} className={`min-h-[52px] rounded-2xl px-3 text-sm font-black text-ivory shadow-card transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${tone === "danger" ? "bg-terra" : "bg-morocco"}`}>{options.confirmLabel ?? "Confirmer"}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </ActionDialogContext.Provider>
  );
}

function DialogIconView({ icon }: { icon: DialogIcon }) {
  if (icon === "trash") return <Trash2 size={23} />;
  if (icon === "photo") return <ImageOff size={23} />;
  if (icon === "reset") return <RotateCcw size={23} />;
  if (icon === "edit") return <PencilLine size={23} />;
  return <AlertTriangle size={23} />;
}

export function useActionDialog(): ActionDialogContextValue {
  const value = useContext(ActionDialogContext);
  if (!value) throw new Error("useActionDialog doit être utilisé dans ActionDialogProvider");
  return value;
}
