"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

interface ToastInput {
  message: string;
  detail?: string;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
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
        <div className="fixed inset-x-4 z-[80] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-morocco px-4 py-3 text-ivory shadow-card" style={{ bottom: "calc(88px + env(safe-area-inset-bottom))" }} role="status" aria-live="polite">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-extrabold">{toast.message}</p>
            {toast.detail ? <p className="mt-0.5 truncate text-xs text-sand">{toast.detail}</p> : null}
          </div>
          {toast.actionLabel ? (
            <button className="min-h-11 rounded-xl px-2 text-xs font-black uppercase tracking-wider text-sand" onClick={() => { void toast.onAction?.(); setToast(null); }}>
              {toast.actionLabel}
            </button>
          ) : null}
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
