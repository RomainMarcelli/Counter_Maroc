"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Horloge partagée des écrans qui affichent une estimation : elle redescend toute seule
 * avec le temps. On rafraîchit à l’ouverture et à intervalle lent, jamais à la seconde,
 * et on suspend le rythme quand l’application n’est pas au premier plan.
 *
 * `refresh` recale l’horloge à la demande. C’est indispensable dès qu’une donnée
 * change entre deux tics : une estimation évaluée à un instant antérieur au verre
 * qu’on vient d’ajouter le compterait pour zéro.
 */
export function useClock(intervalMs = 60_000): { now: number; refresh: () => void } {
  const [now, setNow] = useState(() => Date.now());
  const refresh = useCallback(() => setNow(Date.now()), []);
  useEffect(() => {
    refresh();
    const timer = setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState === "visible") refresh();
    }, intervalMs);
    const onVisibility = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs, refresh]);
  return { now, refresh };
}

export function useNow(intervalMs = 60_000): number {
  return useClock(intervalMs).now;
}
