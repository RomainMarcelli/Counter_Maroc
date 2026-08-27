/**
 * Fuseau d’AFFICHAGE : celui de l’appareil, relu à chaque appel.
 *
 * Les instants sont stockés en UTC ISO et ne sont jamais décalés à l’écriture ;
 * seul le rendu dépend du fuseau. Un iPhone qui bascule à l’heure marocaine en
 * arrivant affiche donc l’heure marocaine, sans réécrire une seule consommation.
 *
 * Les écarts de temps du calcul d’alcoolémie, eux, se font sur l’epoch et ne
 * passent jamais par ici.
 */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function getZonedParts(iso: string, timezone: string = deviceTimeZone()): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}

export function zonedDayKey(iso: string, timezone: string = deviceTimeZone()): string {
  const { year, month, day } = getZonedParts(iso, timezone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function formatDateKey(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}-${month}-${year}`;
}

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** « 7 → 16 septembre », ou « 28 août → 3 septembre » à cheval sur deux mois. */
export function formatTripRange(startDate: string, endDate: string): string {
  const [, startMonth, startDay] = startDate.split("-").map(Number);
  const [, endMonth, endDay] = endDate.split("-").map(Number);
  const end = `${endDay} ${MONTHS[endMonth - 1] ?? ""}`.trim();
  return startMonth === endMonth ? `${startDay} → ${end}` : `${startDay} ${MONTHS[startMonth - 1] ?? ""} → ${end}`;
}

export function formatTripDateTime(iso: string, timezone: string = deviceTimeZone()): string {
  const parts = getZonedParts(iso, timezone);
  return `${String(parts.day).padStart(2, "0")}-${String(parts.month).padStart(2, "0")}-${parts.year} · ${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

function timezoneOffset(date: Date, timezone: string): number {
  const parts = getZonedParts(date.toISOString(), timezone);
  const representedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return representedAsUtc - date.getTime();
}

export function zonedInputToIso(value: string, timezone: string = deviceTimeZone()): string {
  const [datePart, timePart = "00:00"] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  let result = new Date(utcGuess - timezoneOffset(new Date(utcGuess), timezone));
  result = new Date(utcGuess - timezoneOffset(result, timezone));
  return result.toISOString();
}

export function isoToZonedInput(iso: string, timezone: string = deviceTimeZone()): string {
  const parts = getZonedParts(iso, timezone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}T${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}
