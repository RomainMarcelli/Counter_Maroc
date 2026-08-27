import { deviceTimeZone, getZonedParts, zonedInputToIso } from "./timezone";

export const TRIP_DAY_START_HOUR = 8;
const DAY_MS = 86_400_000;

export function addCalendarDays(dayKey: string, amount: number): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  if (![year, month, day].every(Number.isFinite)) return dayKey;
  return new Date(Date.UTC(year, month - 1, day + amount)).toISOString().slice(0, 10);
}

/**
 * Journée de voyage contenant l'instant : 08:00 locale jusqu'à 07:59:59 le
 * lendemain. La clé est la date locale du début de cette journée.
 */
export function getTripDayKey(timestamp: string | number | Date, timezone: string = deviceTimeZone()): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = getZonedParts(date.toISOString(), timezone);
  const calendarKey = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  return parts.hour < TRIP_DAY_START_HOUR ? addCalendarDays(calendarKey, -1) : calendarKey;
}

export function getTripDayRange(dayKey: string, timezone: string = deviceTimeZone()): { start: string; end: string } {
  return {
    start: zonedInputToIso(`${dayKey}T${String(TRIP_DAY_START_HOUR).padStart(2, "0")}:00`, timezone),
    end: zonedInputToIso(`${addCalendarDays(dayKey, 1)}T${String(TRIP_DAY_START_HOUR).padStart(2, "0")}:00`, timezone),
  };
}

export function tripDayNumber(dayKey: string, tripStartDate: string): number {
  const difference = Date.parse(`${dayKey}T00:00:00.000Z`) - Date.parse(`${tripStartDate}T00:00:00.000Z`);
  return Math.max(1, Math.floor(difference / DAY_MS) + 1);
}

export function isInTripDay(timestamp: string, dayKey: string, timezone: string = deviceTimeZone()): boolean {
  return getTripDayKey(timestamp, timezone) === dayKey;
}

