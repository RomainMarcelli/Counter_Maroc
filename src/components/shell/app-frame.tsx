"use client";

import { Settings } from "lucide-react";
import { useState } from "react";
import { useTrip } from "@/components/providers/trip-provider";
import { Onboarding } from "@/components/onboarding/onboarding";
import { BottomNav } from "./bottom-nav";
import { SyncIndicator } from "./sync-indicator";
import { SettingsSheet } from "@/components/settings/settings-sheet";
import { IdentityGate } from "@/components/onboarding/identity-gate";
import { BrandLogo } from "@/components/brand/brand-logo";
import { BrandLoader } from "@/components/brand/brand-loader";

export function AppFrame({ children }: { children: React.ReactNode }) {
  const { ready, trip, actorId, activeParticipants } = useTrip();
  const [settingsOpen, setSettingsOpen] = useState(false);
  if (!ready) return <BrandLoader />;
  if (!trip) return <Onboarding />;
  if (!actorId || !activeParticipants.some((participant) => participant.id === actorId)) return <IdentityGate />;
  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 mx-auto flex h-[calc(var(--header-height)+env(safe-area-inset-top))] max-w-3xl items-end bg-morocco px-4 pb-2 pt-[env(safe-area-inset-top)] text-ivory shadow-lg">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <BrandLogo size={44} className="shrink-0 rounded-2xl" priority />
          <div className="min-w-0"><p className="truncate font-display text-lg font-bold leading-tight">{trip.name}</p><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-sand">Crew connecté</p></div>
        </div>
        <SyncIndicator />
        <button className="flex size-11 shrink-0 items-center justify-center rounded-full" onClick={() => setSettingsOpen(true)} aria-label="Ouvrir les réglages"><Settings size={20} /></button>
      </header>
      <main className="app-container">{children}</main>
      <BottomNav />
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
