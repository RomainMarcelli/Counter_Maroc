"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";

/** Largeur du tiroir une fois le bouton révélé. */
const ACTION_WIDTH = 96;
/** Déplacement horizontal à partir duquel on considère que le geste n’est pas un scroll. */
const CAPTURE_THRESHOLD = 12;
/** En deçà, la carte revient en place : un frôlement ne révèle rien. */
const OPEN_THRESHOLD = 30;
/** Fraction de la largeur au-delà de laquelle le geste vaut suppression directe. */
const DELETE_RATIO = 0.45;

interface Gesture {
  pointerId: number;
  startX: number;
  startY: number;
  base: number;
  captured: boolean;
  width: number;
}

/**
 * Ligne balayable façon iOS : glisser vers la gauche révèle « Supprimer », et un
 * geste franc supprime directement.
 *
 * Le scroll vertical reste prioritaire : `touch-action: pan-y` laisse le
 * navigateur gérer le défilement, et on ne capture le pointeur qu’une fois le
 * déplacement horizontal clairement supérieur au vertical. Tant que ce n’est pas
 * le cas, le geste est abandonné au profit du scroll.
 */
export function SwipeRow({ open, onOpenChange, onDelete, deleteLabel, disabled = false, children }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
  deleteLabel: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const gesture = useRef<Gesture | null>(null);

  // Hors geste, la position suit l’état porté par la liste : ouvrir une ligne referme l’autre.
  useEffect(() => {
    if (!gesture.current) setOffset(open ? -ACTION_WIDTH : 0);
  }, [open]);

  const finish = (settled: number) => {
    gesture.current = null;
    setDragging(false);
    setOffset(settled);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || event.pointerType === "mouse" && event.button !== 0) return;
    gesture.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      base: open ? -ACTION_WIDTH : 0,
      captured: false,
      width: event.currentTarget.getBoundingClientRect().width || 320,
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;

    if (!current.captured) {
      // Le doigt part vers le haut ou le bas : on rend la main au scroll, définitivement.
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > CAPTURE_THRESHOLD) {
        gesture.current = null;
        return;
      }
      if (Math.abs(dx) < CAPTURE_THRESHOLD || Math.abs(dx) <= Math.abs(dy)) return;
      current.captured = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    }

    // Vers la gauche uniquement ; au-delà de la largeur on ne suit plus.
    const next = Math.max(-current.width, Math.min(0, current.base + dx));
    setOffset(next);
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (!current.captured) {
      gesture.current = null;
      return;
    }
    const travelled = -offset;
    if (travelled >= current.width * DELETE_RATIO) {
      finish(0);
      onOpenChange(false);
      onDelete();
      return;
    }
    if (travelled >= OPEN_THRESHOLD) {
      finish(-ACTION_WIDTH);
      onOpenChange(true);
      return;
    }
    finish(0);
    onOpenChange(false);
  };

  const onPointerCancel = (event: React.PointerEvent<HTMLDivElement>) => {
    if (gesture.current?.pointerId !== event.pointerId) return;
    finish(open ? -ACTION_WIDTH : 0);
  };

  // Les cartes du Journal sont volontairement translucides : tant que la ligne est
  // au repos, le tiroir doit être totalement invisible, sinon il transparaît dessous.
  const revealed = offset < -1;

  return (
    <div className="relative overflow-hidden rounded-2xl" style={{ touchAction: "pan-y" }}>
      <div
        className="absolute inset-y-0 right-0 flex w-[96px] items-stretch transition-opacity"
        style={{ opacity: revealed ? 1 : 0, pointerEvents: revealed ? "auto" : "none" }}
      >
        <button
          type="button"
          onClick={() => { onOpenChange(false); onDelete(); }}
          tabIndex={open ? 0 : -1}
          aria-hidden={open ? undefined : true}
          className="flex w-full flex-col items-center justify-center gap-1 rounded-2xl bg-terra text-[11px] font-black text-ivory"
          aria-label={deleteLabel}
        >
          <Trash2 size={19} />Supprimer
        </button>
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        style={{ transform: `translate3d(${offset}px, 0, 0)`, transition: dragging ? "none" : "transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1)" }}
      >
        {children}
      </div>
    </div>
  );
}

export const SWIPE_ACTION_WIDTH = ACTION_WIDTH;
export const SWIPE_OPEN_THRESHOLD = OPEN_THRESHOLD;
export const SWIPE_DELETE_RATIO = DELETE_RATIO;
