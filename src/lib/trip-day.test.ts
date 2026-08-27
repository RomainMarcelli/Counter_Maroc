import { describe, expect, it } from "vitest";
import { getTripDayKey, getTripDayRange, tripDayNumber } from "./trip-day";
import { zonedInputToIso } from "./timezone";

const ZONE = "Europe/Paris";
const instant = (local: string) => zonedInputToIso(local, ZONE);

describe("journée de voyage 08:00 → 08:00", () => {
  it.each([
    ["2026-08-28T07:59", "2026-08-27"],
    ["2026-08-28T08:00", "2026-08-28"],
    ["2026-08-28T23:59", "2026-08-28"],
    ["2026-08-29T00:01", "2026-08-28"],
    ["2026-08-29T04:00", "2026-08-28"],
    ["2026-08-29T07:59", "2026-08-28"],
    ["2026-08-29T08:00", "2026-08-29"],
  ])("classe %s dans %s", (local, expected) => {
    expect(getTripDayKey(instant(local), ZONE)).toBe(expected);
  });

  it("produit des bornes locales exactes même lorsque les instants restent en UTC", () => {
    const range = getTripDayRange("2026-08-28", ZONE);
    expect(range.start).toBe(instant("2026-08-28T08:00"));
    expect(range.end).toBe(instant("2026-08-29T08:00"));
  });

  it("numérote les jours depuis le début du séjour", () => {
    expect(tripDayNumber("2026-08-27", "2026-08-27")).toBe(1);
    expect(tripDayNumber("2026-08-30", "2026-08-27")).toBe(4);
  });
});

