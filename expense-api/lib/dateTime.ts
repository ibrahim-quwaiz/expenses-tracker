const TIME_RE = /^\d{2}:\d{2}$/;

/** Current wall-clock time-of-day in Asia/Riyadh (UTC+3), as HH:MM:SS. */
function riyadhNowTime(): string {
  const shifted = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const hh = String(shifted.getUTCHours()).padStart(2, "0");
  const mm = String(shifted.getUTCMinutes()).padStart(2, "0");
  const ss = String(shifted.getUTCSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

/**
 * Combines a plain "YYYY-MM-DD" date with an optional "HH:MM" time-of-day (both treated as
 * Asia/Riyadh wall-clock values, no timezone conversion) into a literal timestamp string.
 * If `dateStr` already carries a time component, it's returned unchanged. Falls back to the
 * current Riyadh time-of-day when `timeStr` is missing/invalid.
 */
export function combineDateTime(dateStr: string, timeStr?: string | null): string {
  if (dateStr.includes("T") || dateStr.includes(" ")) return dateStr;
  const time = timeStr && TIME_RE.test(timeStr) ? `${timeStr}:00` : riyadhNowTime();
  return `${dateStr}T${time}`;
}

/** Extracts the "HH:MM" wall-clock time-of-day from a stored timestamp value. */
export function timeOfDay(value: string | Date): string {
  const d = new Date(value);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}
