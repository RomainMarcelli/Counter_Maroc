"use client";

import { useEffect, useState } from "react";

/**
 * Horloge partagée des écrans qui affichent une estimation : elle redescend toute seule
 * avec le temps. On rafraîchit à l’ouverture et à intervalle lent, jamais à la seconde,
 * et on suspend le rythme quand l’application n’est pas au premier plan.
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState === "visible") tick();
    }, intervalMs);
    const onVisibility = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs]);
  return now;
}
