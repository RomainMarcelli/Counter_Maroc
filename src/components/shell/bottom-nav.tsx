"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, BookOpen, Crown, Zap } from "lucide-react";
import clsx from "clsx";

const items = [
  { href: "/", label: "Rapide", icon: Zap },
  { href: "/journal", label: "Journal", icon: BookOpen },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/hall-of-fame", label: "Bilan", icon: Crown },
];

export function BottomNav() {
  const pathname = usePathname();
  const [partyMode, setPartyMode] = useState(false);
  useEffect(() => {
    setPartyMode(localStorage.getItem("partyMode") === "true");
    const update = (event: Event) => setPartyMode(Boolean((event as CustomEvent<boolean>).detail));
    window.addEventListener("marrakech-party-mode", update);
    return () => window.removeEventListener("marrakech-party-mode", update);
  }, []);
  const visibleItems = partyMode ? items.slice(0, 2) : items;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-xl border-t border-sand/50 bg-ivory/95 px-3 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl" aria-label="Navigation principale">
      <div className="grid h-[74px]" style={{ gridTemplateColumns: `repeat(${visibleItems.length}, minmax(0, 1fr))` }}>
        {visibleItems.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={clsx("relative flex min-h-11 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-extrabold transition", active ? "text-terra" : "text-morocco/55")} aria-current={active ? "page" : undefined}>
              {active ? <span className="absolute top-1 h-1 w-7 rounded-full bg-terra" /> : null}
              <Icon size={22} strokeWidth={active ? 2.8 : 2} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
