import { describe, expect, it } from "vitest";
import { isRemoteNewer, queueOperation, retryDelayMs } from "./queue";

const entity = { id: "entry", tripId: "trip", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T01:00:00Z", deletedAt: null };

describe("offline sync helpers", () => {
  it("utilise une clé stable pour rendre les rejeux idempotents", () => {
    expect(queueOperation("drinkEntry", entity).id).toBe("drinkEntry:entry");
    expect(queueOperation("drinkEntry", { ...entity, updatedAt: "2026-01-01T02:00:00Z" }).id).toBe("drinkEntry:entry");
  });

  it("fusionne seulement une version distante plus récente", () => {
    expect(isRemoteNewer("2026-01-01T01:00:00Z", "2026-01-01T02:00:00Z")).toBe(true);
    expect(isRemoteNewer("2026-01-01T02:00:00Z", "2026-01-01T01:00:00Z")).toBe(false);
    expect(isRemoteNewer("2026-01-01T02:00:00Z", "2026-01-01T02:00:00Z")).toBe(true);
  });

  it("plafonne le backoff à une minute", () => {
    expect(retryDelayMs(1)).toBe(2_000);
    expect(retryDelayMs(99)).toBe(60_000);
  });
});
