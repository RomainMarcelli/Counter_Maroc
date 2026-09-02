"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Activity, BarChart3, BookOpen, Crown, Zap } from "lucide-react";
import clsx from "clsx";
import { OfflineLink } from "@/components/pwa/offline-link";

/**
 * Cinq onglets tiennent sur un iPhone à condition de ne pas gaspiller : icône
 * compacte, libellé sur une ligne, et toute la hauteur de la cellule cliquable.
 * Les réglages restent volontairement dans l’en-tête — ce n’est pas une
 * destination, c’est un panneau.
 */
const items = [
  { href: "/", label: "Rapide", icon: Zap },
  { href: "/journal", label: "Journal", icon: BookOpen },
  { href: "/alcoolemie", label: "Alcoolémie", icon: Activity },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/hall-of-fame", label: "Bilan", icon: Crown },
];

/** Mode soirée : on ne garde que l’ajout, le journal et le taux estimé. */
const PARTY_HREFS = new Set(["/", "/journal", "/alcoolemie"]);

export function BottomNav() {
  const pathname = usePathname();
  const [partyMode, setPartyMode] = useState(false);
  useEffect(() => {
    setPartyMode(localStorage.getItem("partyMode") === "true");
    const update = (event: Event) => setPartyMode(Boolean((event as CustomEvent<boolean>).detail));
    window.addEventListener("marrakech-party-mode", update);
    return () => window.removeEventListener("marrakech-party-mode", update);
  }, []);
  const visibleItems = partyMode ? items.filter((item) => PARTY_HREFS.has(item.href)) : items;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-xl border-t border-sand/50 bg-ivory/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
      aria-label="Navigation principale"
    >
      <div className="grid h-[var(--bottom-nav-height)]" style={{ gridTemplateColumns: `repeat(${visibleItems.length}, minmax(0, 1fr))` }}>
        {visibleItems.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <OfflineLink
              key={item.href}
              href={item.href}
              className={clsx(
                "relative flex min-h-11 flex-col items-center justify-center gap-1 rounded-2xl px-0.5 transition",
                active ? "text-terra" : "text-morocco/55",
              )}
              aria-current={active ? "page" : undefined}
            >
              {active ? <span className="absolute top-1.5 h-1 w-7 rounded-full bg-terra" /> : null}
              <Icon size={21} strokeWidth={active ? 2.8 : 2} />
              <span className="w-full truncate text-center text-[10px] font-extrabold leading-none">{item.label}</span>
            </OfflineLink>
          );
        })}
      </div>
    </nav>
  );
}
