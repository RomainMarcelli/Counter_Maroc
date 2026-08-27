"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export function BottomSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Fermeture au clavier, et blocage du scroll de la page derrière la feuille :
  // sur iOS, sans cela, le doigt fait défiler le contenu sous la modale.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  // Rendue dans <body> : une feuille ouverte depuis une autre feuille reste
  // positionnée par rapport à la fenêtre, jamais par rapport à son parent défilant.
  return createPortal(
    <div className="sheet-backdrop fixed inset-0 z-[70] flex items-end justify-center bg-morocco/45" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className="bottom-sheet max-h-[88dvh] w-full max-w-xl overflow-y-auto overscroll-contain rounded-t-[28px] bg-ivory px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-3 shadow-2xl" role="dialog" aria-modal="true" aria-label={title}>
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-sand" />
        <header className="mb-5 flex items-center justify-between gap-4">
          <h2 className="font-display text-2xl font-bold">{title}</h2>
          <button className="flex size-11 shrink-0 items-center justify-center rounded-full bg-sand/40" onClick={onClose} aria-label="Fermer"><X size={20} /></button>
        </header>
        {children}
      </section>
    </div>,
    document.body,
  );
}
