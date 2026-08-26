"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

interface ToastInput {
  message: string;
  detail?: string;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
  tone?: "success" | "error" | "info";
}

interface ToastState extends ToastInput { id: number }
const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((input: ToastInput) => {
    if (timeout.current) clearTimeout(timeout.current);
    setToast({ ...input, id: Date.now() });
    timeout.current = setTimeout(() => setToast(null), 5_000);
  }, []);

  useEffect(() => () => { if (timeout.current) clearTimeout(timeout.current); }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? (
        <div key={toast.id} className={`card-enter zellige-card fixed inset-x-4 z-[90] mx-auto flex max-w-md items-center gap-3 overflow-hidden rounded-[22px] border px-3 py-3 text-ivory shadow-2xl ${toast.tone === "error" ? "border-terra/30 bg-terra" : "border-sand/20 bg-morocco"}`} style={{ bottom: "calc(88px + env(safe-area-inset-bottom))" }} role="status" aria-live={toast.tone === "error" ? "assertive" : "polite"}>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-sand" aria-hidden="true">{toast.tone === "error" ? <AlertCircle size={21} /> : toast.tone === "info" ? <Info size={21} /> : <CheckCircle2 size={21} />}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold leading-snug">{toast.message}</p>
            {toast.detail ? <p className="mt-0.5 text-xs leading-snug text-sand">{toast.detail}</p> : null}
          </div>
          {toast.actionLabel ? (
            <button className="min-h-11 rounded-xl px-2 text-xs font-black uppercase tracking-wider text-sand" onClick={() => { void toast.onAction?.(); setToast(null); }}>
              {toast.actionLabel}
            </button>
          ) : null}
          <button type="button" onClick={() => setToast(null)} className="flex size-10 shrink-0 items-center justify-center rounded-xl text-sand/75 transition hover:bg-white/10" aria-label="Fermer le message"><X size={17} /></button>
          <span className="toast-progress absolute inset-x-0 bottom-0 h-1 origin-left bg-sand/60" aria-hidden="true" />
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
