// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { useTrip } from "@/components/providers/trip-provider";
import { ToastProvider } from "@/components/providers/toast-provider";
import { ActionDialogProvider } from "@/components/providers/action-dialog-provider";
import { DRINK_DEFAULTS, ENTRY_DEFAULTS, PARTICIPANT_DEFAULTS } from "@/test/factories";
import type { Drink, DrinkEntry, Participant, Trip, WaterEntry } from "@/domain/types";

type TripValue = ReturnType<typeof useTrip>;

const mocks = vi.hoisted(() => ({
  deleteEntries: vi.fn(),
  restoreEntries: vi.fn(),
  deleteDrinkEntry: vi.fn(),
  deleteWaterEntry: vi.fn(),
  updateDrinkEntry: vi.fn(),
  updateWaterEntry: vi.fn(),
  trip: { current: null as unknown as TripValue },
}));

vi.mock("@/data/repository", () => ({
  deleteEntries: mocks.deleteEntries,
  restoreEntries: mocks.restoreEntries,
  deleteDrinkEntry: mocks.deleteDrinkEntry,
  deleteWaterEntry: mocks.deleteWaterEntry,
  updateDrinkEntry: mocks.updateDrinkEntry,
  updateWaterEntry: mocks.updateWaterEntry,
}));
vi.mock("@/components/providers/trip-provider", () => ({ useTrip: () => mocks.trip.current }));

import { JournalList } from "./journal-list";

const base = { tripId: "trip", createdAt: "2026-09-07T10:00:00Z", updatedAt: "2026-09-07T10:00:00Z", deletedAt: null };
const trip: Trip = { ...base, id: "trip", name: "Marrakech 2026", shareCode: "CREW-01", startDate: "2026-09-07", endDate: "2026-09-16", timezone: "Africa/Casablanca", createdBy: "device" };
const participants: Participant[] = [
  { ...base, ...PARTICIPANT_DEFAULTS, id: "romain", name: "Romain", avatarUrl: null, colorIndex: 0, sortOrder: 0 },
  { ...base, ...PARTICIPANT_DEFAULTS, id: "lucas", name: "Lucas", avatarUrl: null, colorIndex: 1, sortOrder: 1 },
];
const drinks: Drink[] = [
  { ...base, ...DRINK_DEFAULTS, id: "mojito", name: "Mojito", category: "cocktail", icon: "🌿", isAlcohol: true, isSystem: true, sortOrder: 0 },
  { ...base, ...DRINK_DEFAULTS, id: "beer", name: "Bière locale", category: "beer", icon: "🍺", isAlcohol: true, isSystem: true, sortOrder: 1 },
];
const entry = (id: string, participantId: string, drinkId: string, hour: number): DrinkEntry => ({ ...base, ...ENTRY_DEFAULTS, id, participantId, drinkId, consumedAt: `2026-09-07T${String(hour).padStart(2, "0")}:00:00Z`, actionBy: "romain", deviceId: "device", roundId: null });
const water: WaterEntry = { ...base, id: "w1", participantId: "romain", consumedAt: "2026-09-07T13:00:00Z", actionBy: "romain", deviceId: "device", roundId: null };
const drinkEntries = [entry("d1", "romain", "mojito", 20), entry("d2", "lucas", "beer", 21), entry("d3", "romain", "beer", 22)];

function setTrip(overrides: Partial<TripValue> = {}): void {
  mocks.trip.current = {
    ready: true,
    trip,
    participants,
    activeParticipants: participants,
    drinks,
    activeDrinks: drinks,
    drinkEntries,
    waterEntries: [water],
    queue: [],
    actorId: "romain", authorId: "compte-romain",
    selectedParticipantIds: ["romain"],
    setSelectedParticipantIds: vi.fn(),
    refreshActiveTrip: vi.fn(),
    ...overrides,
  };
}

const renderJournal = () => render(<ToastProvider><ActionDialogProvider><JournalList /></ActionDialogProvider></ToastProvider>);
const row = (label: string) => screen.getByText(label).closest("button") as HTMLButtonElement;
const startPicking = () => fireEvent.click(screen.getByRole("button", { name: "Sélectionner" }));
const confirmDelete = async (name: RegExp) => {
  const dialog = await screen.findByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name }));
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.deleteEntries.mockResolvedValue(undefined);
  mocks.restoreEntries.mockResolvedValue(undefined);
  setTrip();
});

afterEach(cleanup);

describe("sélection multiple du Journal", () => {
  it("ouvre l’éditeur au tap tant que le mode sélection est inactif", () => {
    renderJournal();
    fireEvent.click(row("Romain · Mojito"));
    expect(screen.getByRole("dialog", { name: "Modifier la consommation" })).toBeInTheDocument();
  });

  it("transforme les lignes en cases à cocher une fois le mode activé", () => {
    renderJournal();
    startPicking();

    expect(screen.getAllByRole("checkbox")).toHaveLength(4);
    fireEvent.click(row("Romain · Mojito"));
    expect(row("Romain · Mojito")).toHaveAttribute("aria-checked", "true");
    expect(row("Lucas · Bière locale")).toHaveAttribute("aria-checked", "false");
    // Toucher une ligne sélectionne au lieu d’ouvrir l’éditeur.
    expect(screen.queryByRole("dialog", { name: "Modifier la consommation" })).not.toBeInTheDocument();
  });

  it("supprime en une fois les verres et les eaux sélectionnés", async () => {
    renderJournal();
    startPicking();
    fireEvent.click(row("Romain · Mojito"));
    fireEvent.click(row("Romain · Bière locale"));
    fireEvent.click(row("Romain · Eau"));

    expect(screen.getByText("3 sélectionnés")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
    await confirmDelete(/Supprimer les 3/);

    await waitFor(() => expect(mocks.deleteEntries).toHaveBeenCalledWith({ drinkEntryIds: ["d3", "d1"], waterEntryIds: ["w1"] }));
    expect(await screen.findByText("3 consommations supprimées")).toBeInTheDocument();
  });

  it("ne supprime rien si la confirmation est refusée", async () => {
    renderJournal();
    startPicking();
    fireEvent.click(row("Romain · Mojito"));
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
    await confirmDelete(/Tout garder/);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mocks.deleteEntries).not.toHaveBeenCalled();
  });

  it("restaure toute la sélection depuis le bouton Annuler", async () => {
    renderJournal();
    startPicking();
    fireEvent.click(screen.getByRole("button", { name: "Tout sélectionner" }));

    expect(screen.getByText("4 sélectionnés")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
    await confirmDelete(/Supprimer les 4/);

    fireEvent.click(await screen.findByRole("button", { name: "Annuler" }));
    expect(mocks.restoreEntries).toHaveBeenCalledWith({ drinkEntryIds: ["d3", "d2", "d1"], waterEntryIds: ["w1"] });
  });

  it("sort du mode sélection après la suppression", async () => {
    renderJournal();
    startPicking();
    fireEvent.click(row("Romain · Mojito"));
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
    await confirmDelete(/Supprimer l’entrée/);

    await waitFor(() => expect(screen.getByRole("button", { name: "Sélectionner" })).toBeInTheDocument());
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("oublie les lignes masquées par un changement de filtre", () => {
    renderJournal();
    startPicking();
    fireEvent.click(screen.getByRole("button", { name: "Tout sélectionner" }));
    expect(screen.getByText("4 sélectionnés")).toBeInTheDocument();

    setTrip({ drinkEntries: [drinkEntries[0]], waterEntries: [] });
    fireEvent.click(screen.getByRole("button", { name: "Terminer" }));
    startPicking();

    expect(screen.getByText("0 sélectionné")).toBeInTheDocument();
    expect(mocks.deleteEntries).not.toHaveBeenCalled();
  });
});
