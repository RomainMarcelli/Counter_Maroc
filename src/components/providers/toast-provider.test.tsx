// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ToastProvider, TOAST_DURATION_MS, useToast } from "./toast-provider";

const undo = vi.fn();

function Harness() {
  const toast = useToast();
  return (
    <>
      <button onClick={() => toast({ message: "Mojito ajouté à Romain", icon: "🌿", detail: "Enregistré · synchronisation en attente", actionLabel: "Annuler", onAction: undo })}>ajouter</button>
      <button onClick={() => toast({ message: "Mojito ajouté à Romain", detail: "Synchronisé avec le groupe ✓", syncUpdate: true })}>synchroniser</button>
      <button onClick={() => toast({ message: "Boisson modifiée" })}>autre action</button>
    </>
  );
}

const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
const renderHarness = () => render(<ToastProvider><Harness /></ToastProvider>);

beforeEach(() => {
  undo.mockClear();
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("snackbar d’annulation", () => {
  it("garde le bouton Annuler pendant six secondes", () => {
    renderHarness();
    fireEvent.click(screen.getByText("ajouter"));

    expect(screen.getByRole("button", { name: "Annuler" })).toBeInTheDocument();
    advance(TOAST_DURATION_MS - 100);
    expect(screen.getByRole("button", { name: "Annuler" })).toBeInTheDocument();
    advance(200);
    expect(screen.queryByRole("button", { name: "Annuler" })).not.toBeInTheDocument();
    expect(TOAST_DURATION_MS).toBe(6_000);
  });

  it("déclenche l’annulation et referme la snackbar au tap", () => {
    renderHarness();
    fireEvent.click(screen.getByText("ajouter"));
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

    expect(undo).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Mojito ajouté à Romain")).not.toBeInTheDocument();
  });

  it("laisse la synchronisation compléter le message sans relancer le compte à rebours", () => {
    renderHarness();
    fireEvent.click(screen.getByText("ajouter"));
    advance(3_000);
    fireEvent.click(screen.getByText("synchroniser"));

    expect(screen.getByText("Synchronisé avec le groupe ✓")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Annuler" })).toBeInTheDocument();

    advance(TOAST_DURATION_MS - 3_100);
    expect(screen.getByRole("button", { name: "Annuler" })).toBeInTheDocument();
    // Le compte à rebours n’a pas été rallongé : il reste calé sur l’ajout initial.
    advance(200);
    expect(screen.queryByRole("button", { name: "Annuler" })).not.toBeInTheDocument();
  });

  it("ignore un état de synchronisation quand plus aucune snackbar n’est affichée", () => {
    renderHarness();
    fireEvent.click(screen.getByText("synchroniser"));

    expect(screen.queryByText("Synchronisé avec le groupe ✓")).not.toBeInTheDocument();
  });

  it("laisse une vraie nouvelle action remplacer la snackbar", () => {
    renderHarness();
    fireEvent.click(screen.getByText("ajouter"));
    fireEvent.click(screen.getByText("autre action"));

    expect(screen.getByText("Boisson modifiée")).toBeInTheDocument();
    expect(screen.queryByText("Mojito ajouté à Romain")).not.toBeInTheDocument();
  });

  it("affiche une barre de progression calée sur la durée d’annulation", () => {
    const { container } = renderHarness();
    fireEvent.click(screen.getByText("ajouter"));

    const progress = container.querySelector(".toast-progress");
    expect(progress).toHaveStyle({ animationDuration: `${TOAST_DURATION_MS}ms` });
  });
});
