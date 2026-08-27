// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { useTrip } from "@/components/providers/trip-provider";
import { ToastProvider } from "@/components/providers/toast-provider";
import { BacProvider } from "@/components/providers/bac-provider";
import { DRINK_DEFAULTS, ENTRY_DEFAULTS, PARTICIPANT_DEFAULTS } from "@/test/factories";
import { calculatePureAlcoholGrams } from "@/domain/bac";
import type { Drink, DrinkEntry, Participant, Trip } from "@/domain/types";

type TripValue = ReturnType<typeof useTrip>;

const mocks = vi.hoisted(() => ({ trip: { current: null as unknown as TripValue } }));
vi.mock("@/components/providers/trip-provider", () => ({ useTrip: () => mocks.trip.current }));
vi.mock("@/data/repository", () => ({ updateParticipant: vi.fn(), refreshEntrySnapshots: vi.fn() }));

import { SelectionSummary } from "./selection-summary";

// Instant choisi avant minuit dans tous les fuseaux européens utilisés en CI :
// le test porte sur le compteur, pas sur le fuseau de la machine qui l'exécute.
const NOW = Date.parse("2026-09-12T21:30:00.000Z");
const base = { tripId: "trip", createdAt: "2026-09-12T18:00:00.000Z", updatedAt: "2026-09-12T18:00:00.000Z", deletedAt: null };
const trip: Trip = { ...base, id: "trip", name: "Marrakech 2026", shareCode: "CREW-01", startDate: "2026-09-07", endDate: "2026-09-16", timezone: "Africa/Casablanca", createdBy: "device" };
const whisky: Drink = { ...base, ...DRINK_DEFAULTS, id: "whisky", name: "Whisky", category: "spirit", icon: "🥃", isAlcohol: true, isSystem: true, sortOrder: 0, servingVolumeMl: 40, abvPercent: 40 };
const romain: Participant = { ...base, ...PARTICIPANT_DEFAULTS, id: "romain", name: "Romain", avatarUrl: null, colorIndex: 0, sortOrder: 0, bacEnabled: true, weightKg: 70, distributionRatio: 0.68 };
const lucas: Participant = { ...base, ...PARTICIPANT_DEFAULTS, id: "lucas", name: "Lucas", avatarUrl: null, colorIndex: 1, sortOrder: 1 };
let sequence = 0;
const entry = (participantId: string, hour: number): DrinkEntry => ({
  ...base, ...ENTRY_DEFAULTS, id: `e${(sequence += 1)}`, participantId, drinkId: whisky.id,
  consumedAt: `2026-09-12T${String(hour).padStart(2, "0")}:00:00.000Z`, actionBy: "romain", deviceId: "device", roundId: null,
  alcoholGrams: calculatePureAlcoholGrams(40, 40),
});

function setTrip(overrides: Partial<TripValue> = {}): void {
  mocks.trip.current = {
    ready: true, trip, participants: [romain, lucas], activeParticipants: [romain, lucas], drinks: [whisky], activeDrinks: [whisky],
    drinkEntries: [entry("romain", 20), entry("romain", 21)], waterEntries: [], challenges: [], forfeits: [], tripPhotos: [], queue: [], actorId: "romain", authorId: "compte-romain",
    selectedParticipantIds: ["romain"], setSelectedParticipantIds: vi.fn(), refreshActiveTrip: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  setTrip();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const renderSummary = () => render(<BacProvider><ToastProvider><SelectionSummary /></ToastProvider></BacProvider>);

describe("bandeau de l’écran Rapide", () => {
  it("affiche le compteur du jour et l’estimation d’alcoolémie", () => {
    renderSummary();
    expect(screen.getByText(/Romain · 2 verres aujourd’hui/)).toBeInTheDocument();
    expect(screen.getByText(/≈ 0,\d\d/)).toBeInTheDocument();
    expect(screen.getByText("g/L estimés")).toBeInTheDocument();
  });

  it("n’affiche jamais de taux pour une personne qui n’a pas activé l’estimation", () => {
    setTrip({ selectedParticipantIds: ["lucas"], drinkEntries: [entry("lucas", 20), entry("lucas", 21)] });
    renderSummary();
    expect(screen.getByText(/Lucas · 2 verres aujourd’hui/)).toBeInTheDocument();
    expect(screen.queryByText("g/L estimés")).not.toBeInTheDocument();
  });

  it("respecte le réglage « garder mon taux pour moi »", () => {
    setTrip({ participants: [{ ...romain, bacPrivate: true }, lucas], activeParticipants: [{ ...romain, bacPrivate: true }, lucas], actorId: "lucas" });
    renderSummary();
    expect(screen.queryByText("g/L estimés")).not.toBeInTheDocument();

    cleanup();
    setTrip({ participants: [{ ...romain, bacPrivate: true }, lucas], activeParticipants: [{ ...romain, bacPrivate: true }, lucas], actorId: "romain" });
    renderSummary();
    expect(screen.getByText("g/L estimés")).toBeInTheDocument();
  });

  it("n’invente pas de moyenne de groupe quand plusieurs personnes sont sélectionnées", () => {
    setTrip({ selectedParticipantIds: ["romain", "lucas"] });
    renderSummary();
    expect(screen.getByText(/2 personnes sélectionnées/)).toBeInTheDocument();
    expect(screen.queryByText("g/L estimés")).not.toBeInTheDocument();
  });

  it("baisse quand un verre est retiré", () => {
    renderSummary();
    const before = screen.getByText(/≈ \d,\d\d/).textContent ?? "";
    cleanup();

    setTrip({ drinkEntries: [entry("romain", 20)] });
    renderSummary();
    const after = screen.getByText(/≈ \d,\d\d/).textContent ?? "";
    expect(Number(after.replace("≈ ", "").replace(",", "."))).toBeLessThan(Number(before.replace("≈ ", "").replace(",", ".")));
  });

  it("signale une série de verres sans eau", () => {
    setTrip({ drinkEntries: [entry("romain", 18), entry("romain", 19), entry("romain", 20), entry("romain", 21)] });
    renderSummary();
    expect(screen.getByText(/4 verres sans eau/)).toBeInTheDocument();
  });

  it("n’affiche aucune estimation sans poids renseigné", () => {
    const sansPoids = { ...romain, weightKg: null };
    setTrip({ participants: [sansPoids, lucas], activeParticipants: [sansPoids, lucas] });
    renderSummary();
    expect(screen.queryByText("g/L estimés")).not.toBeInTheDocument();
    expect(screen.getByText(/Romain · 2 verres aujourd’hui/)).toBeInTheDocument();
  });
});
