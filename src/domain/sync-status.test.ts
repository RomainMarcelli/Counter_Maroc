import { describe, expect, it } from "vitest";
import { resolveSyncStatus, type SyncStatusInput } from "./sync-status";

const remote: SyncStatusInput = {
  backendConfigured: true,
  localMode: false,
  authStatus: "authenticated",
  online: true,
  pending: 0,
  syncing: false,
  errorKind: "",
};

describe("resolveSyncStatus", () => {
  it("n’affiche jamais Mode local quand Supabase, la session et le réseau sont disponibles", () => {
    expect(resolveSyncStatus(remote)).toEqual({ kind: "synced", label: "Tout est synchronisé", healthy: true, tone: "green" });
  });

  it("réserve Mode local à un backend absent ou au mode local explicite", () => {
    expect(resolveSyncStatus({ ...remote, backendConfigured: false }).kind).toBe("local");
    expect(resolveSyncStatus({ ...remote, localMode: true }).kind).toBe("local");
    expect(resolveSyncStatus({ ...remote, errorKind: "network" }).kind).toBe("error");
    expect(resolveSyncStatus({ ...remote, pending: 2 }).kind).toBe("pending");
  });

  it("distingue hors ligne, attente, synchronisation et erreur", () => {
    expect(resolveSyncStatus({ ...remote, online: false, pending: 2 }).label).toBe("Hors ligne · 2 actions locales");
    expect(resolveSyncStatus({ ...remote, pending: 1 }).label).toBe("Synchronisation en attente");
    expect(resolveSyncStatus({ ...remote, syncing: true }).label).toBe("Synchronisation en cours");
    expect(resolveSyncStatus({ ...remote, errorKind: "membership" }).label).toBe("Erreur de synchronisation");
  });

  it("mappe les états vers vert, orange et rouge", () => {
    expect(resolveSyncStatus(remote).tone).toBe("green");
    expect(resolveSyncStatus({ ...remote, syncing: true }).tone).toBe("orange");
    expect(resolveSyncStatus({ ...remote, pending: 1 }).tone).toBe("orange");
    expect(resolveSyncStatus({ ...remote, online: false }).tone).toBe("red");
    expect(resolveSyncStatus({ ...remote, errorKind: "network" }).tone).toBe("red");
  });
});
