// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { useTrip } from "@/components/providers/trip-provider";
import { ToastProvider } from "@/components/providers/toast-provider";
import { BacProvider } from "@/components/providers/bac-provider";
import { DRINK_DEFAULTS, ENTRY_DEFAULTS, PARTICIPANT_DEFAULTS } from "@/test/factories";
import type { Drink, DrinkEntry, Participant, SyncOperation, Trip, UndoBatch } from "@/domain/types";

type TripValue = ReturnType<typeof useTrip>;

const mocks = vi.hoisted(() => ({
  addDrinkRound: vi.fn(),
  addWaterRound: vi.fn(),
  undoBatch: vi.fn(),
  addDrink: vi.fn(),
  updateDrink: vi.fn(),
  trip: { current: null as unknown as TripValue },
}));

vi.mock("@/data/repository", () => ({
  addDrinkRound: mocks.addDrinkRound,
  addWaterRound: mocks.addWaterRound,
  undoBatch: mocks.undoBatch,
  addDrink: mocks.addDrink,
  updateDrink: mocks.updateDrink,
}));
vi.mock("@/components/providers/trip-provider", () => ({ useTrip: () => mocks.trip.current }));

import { QuickAdd } from "./quick-add";

const base = { tripId: "trip", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", deletedAt: null };
const trip: Trip = { ...base, id: "trip", name: "Marrakech 2026", shareCode: "CREW-01", startDate: "2026-09-07", endDate: "2026-09-16", timezone: "Africa/Casablanca", createdBy: "device" };
const participants: Participant[] = [
  { ...base, ...PARTICIPANT_DEFAULTS, id: "romain", name: "Romain", avatarUrl: null, colorIndex: 0, sortOrder: 0 },
  { ...base, ...PARTICIPANT_DEFAULTS, id: "lucas", name: "Lucas", avatarUrl: null, colorIndex: 1, sortOrder: 1 },
  { ...base, ...PARTICIPANT_DEFAULTS, id: "theo", name: "Théo", avatarUrl: null, colorIndex: 2, sortOrder: 2 },
];
const drinks: Drink[] = [
  { ...base, ...DRINK_DEFAULTS, id: "beer", name: "Bière locale", category: "beer", icon: "🍺", isAlcohol: true, isSystem: true, sortOrder: 0 },
  { ...base, ...DRINK_DEFAULTS, id: "casa", name: "Casablanca", category: "beer", icon: "🍺", isAlcohol: true, isSystem: true, sortOrder: 1 },
  { ...base, ...DRINK_DEFAULTS, id: "wine", name: "Vin rouge", category: "wine", icon: "🍷", isAlcohol: true, isSystem: true, sortOrder: 2 },
  { ...base, ...DRINK_DEFAULTS, id: "rhum", name: "Rhum blanc", category: "spirit", icon: "🥃", isAlcohol: true, isSystem: true, sortOrder: 3 },
  { ...base, ...DRINK_DEFAULTS, id: "mojito", name: "Mojito", category: "cocktail", icon: "🌿", isAlcohol: true, isSystem: true, sortOrder: 4 },
  { ...base, ...DRINK_DEFAULTS, id: "colada", name: "Piña Colada", category: "cocktail", icon: "🍍", isAlcohol: true, isSystem: true, sortOrder: 5 },
];
let sequence = 0;
const makeEntry = (participantId: string, drinkId: string): DrinkEntry => ({ ...base, ...ENTRY_DEFAULTS, id: `entry-${(sequence += 1)}`, participantId, drinkId, consumedAt: base.createdAt, actionBy: "romain", deviceId: "device", roundId: null });
const queueOp = (entryId: string): SyncOperation => ({ id: `drinkEntry:${entryId}`, tripId: "trip", entityType: "drinkEntry", entityId: entryId, action: "upsert", payload: { ...base, id: entryId }, createdAt: base.createdAt, updatedAt: base.updatedAt, status: "pending", attempts: 0, nextAttemptAt: null, lastError: null });

function setTrip(overrides: Partial<TripValue> = {}): void {
  mocks.trip.current = {
    ready: true,
    trip,
    participants,
    activeParticipants: participants,
    drinks,
    activeDrinks: drinks,
    drinkEntries: [],
    waterEntries: [],
    queue: [],
    actorId: "romain", authorId: "compte-romain",
    selectedParticipantIds: ["romain"],
    setSelectedParticipantIds: vi.fn(),
    refreshActiveTrip: vi.fn(),
    ...overrides,
  };
}

const QuickAddTree = () => <BacProvider><ToastProvider><QuickAdd /></ToastProvider></BacProvider>;
const renderQuickAdd = () => render(<QuickAddTree />);
const drinkCards = () => screen.queryAllByRole("button", { name: /^Ajouter un .+ aux participants sélectionnés$/ });
const cardNames = () => drinkCards().map((button) => button.getAttribute("aria-label")?.replace("Ajouter un ", "").replace(" aux participants sélectionnés", ""));
const favoriteNames = () => drinkCards().filter((button) => button.dataset.favorite === "true").map((button) => button.getAttribute("aria-label"));

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  mocks.addDrinkRound.mockResolvedValue({ drinkEntryIds: ["e1"], waterEntryIds: [] } satisfies UndoBatch);
  mocks.addWaterRound.mockResolvedValue({ drinkEntryIds: [], waterEntryIds: ["w1"] } satisfies UndoBatch);
  mocks.undoBatch.mockResolvedValue(undefined);
  setTrip();
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(navigator, "onLine");
});

describe("favoris de l’écran Rapide", () => {
  it("ne marque aucune carte comme favorite sans historique", () => {
    renderQuickAdd();
    expect(drinkCards()).toHaveLength(drinks.length);
    expect(favoriteNames()).toEqual([]);
    expect(cardNames()[0]).toBe("Bière locale");
  });

  it("place le Mojito en tête des favoris de Romain après 3 mojitos et 1 bière", () => {
    setTrip({ drinkEntries: [makeEntry("romain", "mojito"), makeEntry("romain", "mojito"), makeEntry("romain", "mojito"), makeEntry("romain", "beer")] });
    renderQuickAdd();
    expect(cardNames().slice(0, 2)).toEqual(["Mojito", "Bière locale"]);
    expect(favoriteNames()).toHaveLength(2);
    expect(drinkCards()[0]).toHaveAttribute("data-favorite", "true");
    expect(drinkCards()[0]).toHaveAttribute("title", "Favori · 3 verres");
  });

  it("calcule les favoris sur le groupe quand plusieurs personnes sont sélectionnées", () => {
    setTrip({
      selectedParticipantIds: ["romain", "lucas", "theo"],
      drinkEntries: [makeEntry("romain", "mojito"), makeEntry("lucas", "beer"), makeEntry("lucas", "beer"), makeEntry("theo", "beer")],
    });
    renderQuickAdd();
    expect(cardNames().slice(0, 2)).toEqual(["Bière locale", "Mojito"]);
    expect(drinkCards()[0]).toHaveAttribute("title", "Favori · 3 verres");
  });
});

describe("filtres de catégories", () => {
  it("n’affiche que des cocktails avec le filtre Cocktails", () => {
    renderQuickAdd();
    fireEvent.click(screen.getByRole("button", { name: "Cocktails" }));
    expect(cardNames()).toEqual(["Mojito", "Piña Colada"]);
    expect(screen.getByRole("button", { name: "Cocktails" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: /Bière locale/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Vin rouge/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Rhum blanc/ })).not.toBeInTheDocument();
  });

  it("n’affiche que des bières avec le filtre Bières", () => {
    renderQuickAdd();
    fireEvent.click(screen.getByRole("button", { name: "Bières" }));
    expect(cardNames()).toEqual(["Bière locale", "Casablanca"]);
  });

  it("classe les bières les plus bues en premier à l’intérieur du filtre", () => {
    setTrip({ drinkEntries: [makeEntry("romain", "casa"), makeEntry("romain", "casa"), makeEntry("romain", "beer")] });
    renderQuickAdd();
    fireEvent.click(screen.getByRole("button", { name: "Bières" }));
    expect(cardNames()).toEqual(["Casablanca", "Bière locale"]);
  });

  it("affiche un empty state quand le filtre Favoris n’a aucun historique", () => {
    renderQuickAdd();
    fireEvent.click(screen.getByRole("button", { name: "Favoris" }));
    expect(screen.getByText("Tes boissons favorites apparaîtront ici après quelques verres.")).toBeInTheDocument();
    expect(drinkCards()).toHaveLength(0);
    // Le bouton de création reste accessible même sur un filtre vide.
    expect(screen.getByRole("button", { name: "Ajouter une boisson" })).toBeInTheDocument();
  });

  it("liste uniquement les boissons réellement bues avec le filtre Favoris", () => {
    setTrip({ drinkEntries: [makeEntry("romain", "mojito"), makeEntry("romain", "mojito"), makeEntry("romain", "beer")] });
    renderQuickAdd();
    fireEvent.click(screen.getByRole("button", { name: "Favoris" }));
    expect(cardNames()).toEqual(["Mojito", "Bière locale"]);
    expect(screen.queryByText("Tes boissons favorites apparaîtront ici après quelques verres.")).not.toBeInTheDocument();
  });

  it("ne touche jamais aux données en changeant de filtre", () => {
    const entries = [makeEntry("romain", "mojito"), makeEntry("romain", "beer")];
    const snapshot = structuredClone(entries);
    setTrip({ drinkEntries: entries });
    renderQuickAdd();
    for (const label of ["Favoris", "Cocktails", "Bières", "Vins", "Spiritueux", "Tous"]) {
      fireEvent.click(screen.getByRole("button", { name: label }));
    }
    expect(entries).toEqual(snapshot);
    expect(mocks.addDrinkRound).not.toHaveBeenCalled();
    expect(mocks.addWaterRound).not.toHaveBeenCalled();
    expect(mocks.undoBatch).not.toHaveBeenCalled();
  });

  it("pré-sélectionne la catégorie du filtre actif dans le formulaire de nouvelle boisson", () => {
    renderQuickAdd();
    fireEvent.click(screen.getByRole("button", { name: "Bières" }));
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une boisson" }));

    const sheet = screen.getByRole("dialog", { name: "Nouvelle boisson" });
    expect(within(sheet).getByRole("button", { name: "Bières" })).toHaveAttribute("aria-pressed", "true");
    expect(within(sheet).getByRole("button", { name: "Cocktails" })).toHaveAttribute("aria-pressed", "false");
  });

  it("retrouve le dernier filtre choisi au retour sur l’écran", () => {
    const first = renderQuickAdd();
    fireEvent.click(screen.getByRole("button", { name: "Cocktails" }));
    first.unmount();

    renderQuickAdd();
    expect(screen.getByRole("button", { name: "Cocktails" })).toHaveAttribute("aria-pressed", "true");
    expect(cardNames()).toEqual(["Mojito", "Piña Colada"]);
  });
});

describe("ajout et annulation", () => {
  it("ajoute le verre en un tap et propose Annuler dans la snackbar", async () => {
    renderQuickAdd();
    fireEvent.click(screen.getByRole("button", { name: "Ajouter un Mojito aux participants sélectionnés" }));

    // Le 4e argument est l’heure de consommation : `undefined` = maintenant.
    expect(mocks.addDrinkRound).toHaveBeenCalledWith("trip", ["romain"], "mojito", undefined);
    expect(await screen.findByText("Mojito ajouté à Romain")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Annuler" })).toBeInTheDocument();
  });

  it("annule l’ajout d’un seul verre", async () => {
    renderQuickAdd();
    fireEvent.click(screen.getByRole("button", { name: "Ajouter un Mojito aux participants sélectionnés" }));
    fireEvent.click(await screen.findByRole("button", { name: "Annuler" }));

    expect(mocks.undoBatch).toHaveBeenCalledWith({ drinkEntryIds: ["e1"], waterEntryIds: [] });
    await waitFor(() => expect(screen.queryByText("Mojito ajouté à Romain")).not.toBeInTheDocument());
  });

  it("annule la tournée entière et pas seulement le premier verre", async () => {
    mocks.addDrinkRound.mockResolvedValue({ drinkEntryIds: ["e1", "e2", "e3"], waterEntryIds: [] } satisfies UndoBatch);
    setTrip({ selectedParticipantIds: ["romain", "lucas", "theo"] });
    renderQuickAdd();
    fireEvent.click(screen.getByRole("button", { name: "Ajouter un Bière locale aux participants sélectionnés" }));

    expect(await screen.findByText("Tournée ajoutée · 3 × Bière locale")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(mocks.undoBatch).toHaveBeenCalledWith({ drinkEntryIds: ["e1", "e2", "e3"], waterEntryIds: [] });
  });

  it("signale une écriture hors ligne sans perdre le bouton Annuler", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
    renderQuickAdd();
    fireEvent.click(screen.getByRole("button", { name: "Ajouter un Mojito aux participants sélectionnés" }));

    expect(await screen.findByText(/Enregistré sur ce téléphone/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Annuler" })).toBeInTheDocument();
  });

  it("laisse la synchronisation compléter la snackbar sans effacer Annuler", async () => {
    const view = renderQuickAdd();
    fireEvent.click(screen.getByRole("button", { name: "Ajouter un Mojito aux participants sélectionnés" }));
    expect(await screen.findByRole("button", { name: "Annuler" })).toBeInTheDocument();

    setTrip({ queue: [queueOp("e1")] });
    view.rerender(<QuickAddTree />);
    expect(screen.getByText(/synchronisation en attente/)).toBeInTheDocument();

    setTrip({ queue: [] });
    view.rerender(<QuickAddTree />);

    expect(await screen.findByText("Synchronisé avec le groupe ✓")).toBeInTheDocument();
    expect(screen.getByText("Mojito ajouté à Romain")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Annuler" })).toBeInTheDocument();
  });
});
