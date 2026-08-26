"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

/** Durée pendant laquelle le bouton Annuler reste disponible. */
export const TOAST_DURATION_MS = 6_000;

interface ToastInput {
  message: string;
  detail?: string;
  icon?: string;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
  tone?: "success" | "error" | "info";
  /** État de synchronisation : complète le message en cours au lieu de le remplacer. */
  syncUpdate?: boolean;
}

interface ToastState extends ToastInput { id: number }
const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const current = useRef<ToastState | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counter = useRef(0);

  const dismiss = useCallback(() => {
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = null;
    current.current = null;
    setToast(null);
  }, []);

  const show = useCallback((input: ToastInput) => {
    const active = current.current;
    // Une information de synchronisation ne vole jamais ses secondes au bouton Annuler : elle se glisse
    // en seconde ligne du snackbar en cours sans relancer le compte à rebours, et disparaît s’il n’y en a plus
    // (l’indicateur de synchronisation de l’en-tête prend alors le relais).
    if (input.syncUpdate) {
      if (!active) return;
      const merged: ToastState = { ...active, detail: input.detail ?? input.message };
      current.current = merged;
      setToast(merged);
      return;
    }
    if (timeout.current) clearTimeout(timeout.current);
    counter.current += 1;
    const next: ToastState = { ...input, id: counter.current };
    current.current = next;
    setToast(next);
    timeout.current = setTimeout(dismiss, TOAST_DURATION_MS);
  }, [dismiss]);

  useEffect(() => () => { if (timeout.current) clearTimeout(timeout.current); }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? (
        <div key={toast.id} className={`card-enter zellige-card fixed inset-x-4 z-[90] mx-auto flex max-w-md items-center gap-2.5 overflow-hidden rounded-[22px] border px-3 py-3 text-ivory shadow-2xl ${toast.tone === "error" ? "border-terra/30 bg-terra" : "border-sand/20 bg-morocco"}`} style={{ bottom: "calc(88px + env(safe-area-inset-bottom))" }} role="status" aria-live={toast.tone === "error" ? "assertive" : "polite"}>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-xl text-sand" aria-hidden="true">{toast.icon ?? (toast.tone === "error" ? <AlertCircle size={21} /> : toast.tone === "info" ? <Info size={21} /> : <CheckCircle2 size={21} />)}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold leading-snug">{toast.message}</p>
            {toast.detail ? <p className="mt-0.5 line-clamp-2 text-[11px] font-bold leading-snug text-sand">{toast.detail}</p> : null}
          </div>
          {toast.actionLabel ? (
            <button type="button" className="tap-bump min-h-11 min-w-[44px] shrink-0 rounded-xl bg-sand px-3.5 text-xs font-black uppercase tracking-wider text-morocco shadow-sm" onClick={() => { const action = toast.onAction; dismiss(); void action?.(); }}>
              {toast.actionLabel}
            </button>
          ) : null}
          <button type="button" onClick={dismiss} className="flex size-9 shrink-0 items-center justify-center rounded-xl text-sand/75 transition hover:bg-white/10" aria-label="Fermer le message"><X size={17} /></button>
          <span className="toast-progress absolute inset-x-0 bottom-0 h-1 origin-left bg-sand/60" style={{ animationDuration: `${TOAST_DURATION_MS}ms` }} aria-hidden="true" />
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast doit être utilisé dans ToastProvider");
  return value;
}
