import { Beer, Clock3, Crown, Droplets, Flame, GlassWater, Martini, Shapes, Sparkles, Wine, type LucideIcon } from "lucide-react";
import type { TrophyIconKey } from "@/domain/stats";

const ICONS: Record<TrophyIconKey, LucideIcon> = {
  "top-drinker": Crown,
  "favorite-drink": Sparkles,
  "biggest-day": Flame,
  hydration: Droplets,
  variety: Shapes,
  "cocktail-king": Martini,
  "beer-king": Beer,
  "wine-king": Wine,
  "spirit-king": GlassWater,
  "peak-hour": Clock3,
};

/** Insigne 100 % vectoriel et embarqué, donc disponible hors ligne. */
export function TrophyBadge({ iconKey, size = "md" }: { iconKey: TrophyIconKey; size?: "sm" | "md" | "lg" }) {
  const Icon = ICONS[iconKey];
  const dimensions = size === "lg" ? "size-16" : size === "sm" ? "size-10" : "size-14";
  const iconSize = size === "lg" ? 27 : size === "sm" ? 18 : 23;
  return (
    <span className={`relative inline-flex ${dimensions} shrink-0 items-center justify-center text-ivory`} aria-hidden="true">
      <svg viewBox="0 0 64 64" className="absolute inset-0 size-full drop-shadow-sm">
        <path d="M32 3 43 10l13 1 1 13 7 8-7 8-1 13-13 1-11 7-11-7-13-1-1-13-7-8 7-8 1-13 13-1Z" fill="#B5543C" />
        <path d="M32 8 41.5 14 52 15l1 10.5 6 6.5-6 6.5L52 49l-10.5 1L32 56l-9.5-6L12 49l-1-10.5L5 32l6-6.5L12 15l10.5-1Z" fill="none" stroke="#E9D6B5" strokeWidth="1.5" opacity=".8" />
        <circle cx="32" cy="32" r="17" fill="#1E4A3A" />
      </svg>
      <Icon size={iconSize} strokeWidth={2.2} className="relative z-10" />
    </span>
  );
}

