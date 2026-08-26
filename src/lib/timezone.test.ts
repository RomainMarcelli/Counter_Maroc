import { describe, expect, it } from "vitest";
import { formatDateKey, formatTripDateTime } from "./timezone";

describe("formatage des dates du séjour", () => {
  it("affiche les dates en JJ-MM-AAAA", () => {
    expect(formatDateKey("2026-09-07")).toBe("07-09-2026");
  });

  it("conserve l’heure du fuseau de Marrakech", () => {
    expect(formatTripDateTime("2026-09-07T21:30:00.000Z", "Africa/Casablanca")).toBe("07-09-2026 · 22:30");
  });
});
