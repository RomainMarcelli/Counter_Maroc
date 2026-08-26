import { getZonedParts } from "@/lib/timezone";
import type { BacEstimate } from "./types";

/** Deux décimales maximum, virgule française : on n’affiche jamais une fausse précision. */
export function formatBac(gPerL: number): string {
  return (Math.round(Math.max(0, gPerL) * 100) / 100).toFixed(2).replace(".", ",");
}

/** Toujours préfixé par ≈ : c’est une estimation, pas une mesure. */
export function formatBacWithUnit(gPerL: number): string {
  return `≈ ${formatBac(gPerL)} g/L`;
}

export function formatBacRange(estimate: BacEstimate): string {
  return `≈ ${formatBac(estimate.lowEstimateGPerL)} – ${formatBac(estimate.highEstimateGPerL)} g/L`;
}

export function formatTripTime(iso: string, timezone: string): string {
  const parts = getZonedParts(iso, timezone);
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}
