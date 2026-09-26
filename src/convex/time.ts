// All server-side time logic for HVR PG Laundry.
//
// The PG operates in India (IST, UTC+5:30). Everything is stored either as an
// epoch-ms timestamp (Convex `number`) or as "seconds from midnight" in IST.
// Dates are stored as "YYYY-MM-DD" strings computed in IST — never in the
// viewer's browser timezone — so every client sees the same current week.

/** IST offset from UTC, in seconds (5h30m). */
export const IST_OFFSET_SECONDS = 5.5 * 3600;

/** Format a UTC epoch-ms timestamp as "YYYY-MM-DD" in IST. */
export function epochMsToIstDate(epochMs: number): string {
  const d = new Date(epochMs + IST_OFFSET_SECONDS * 1000);
  return d.toISOString().slice(0, 10);
}

/** Extract seconds-from-midnight (IST) from a UTC epoch-ms timestamp. */
export function epochMsToIstSecondsOfDay(epochMs: number): number {
  const d = new Date(epochMs + IST_OFFSET_SECONDS * 1000);
  return (
    d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds()
  );
}

/**
 * The current IST date ("YYYY-MM-DD") at the given moment.
 * Snapshot Date.now() once at the top of each handler and pass it here.
 */
export function currentIstDate(nowMs: number): string {
  return epochMsToIstDate(nowMs);
}

/**
 * The current time-of-day in seconds (IST) at the given moment.
 */
export function currentIstSecondsOfDay(nowMs: number): number {
  return epochMsToIstSecondsOfDay(nowMs);
}

/**
 * The IST date `offsetDays` days after `dateStr`.
 * Works purely on the civil date, so it handles month and year rollovers.
 */
export function addDays(dateStr: string, offsetDays: number): string {
  const [y, m, d] = dateStr.split("-").map((n) => parseInt(n, 10));
  const ms = Date.UTC(y, m - 1, d) + offsetDays * 86400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * The Monday that starts the week containing `dateStr` (ISO week, weeks start
 * on Monday). HVR PG books Monday → Sunday.
 */
export function weekStart(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map((n) => parseInt(n, 10));
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun
  const back = (day + 6) % 7; // days since Monday
  return addDays(dateStr, -back);
}

/** Monday → Sunday date list ("YYYY-MM-DD") for the week containing `dateStr`. */
export function weekDates(dateStr: string): string[] {
  const monday = weekStart(dateStr);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function dayOfWeekName(dateStr: string): string {
  return [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ][weekStartMondayIndex(dateStr)];
}

/** 0 = Monday … 6 = Sunday for the given date. */
export function weekStartMondayIndex(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map((n) => parseInt(n, 10));
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

/** "HH:MM" 24h label from seconds-from-midnight. */
export function secondsToHHMM(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Parse "HH:MM" (or "HH:MM:SS") to seconds-from-midnight. */
export function hhmmToSeconds(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  return h * 3600 + m * 60;
}

/**
 * Human "5:00 AM" style label. 12-hour, no leading zero on the hour.
 */
export function secondsTo12h(seconds: number): string {
  const h24 = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const suffix = h24 >= 12 ? "PM" : "AM";
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/**
 * Deterministic slot grid for one machine-day.
 *
 * Chops [open, close) into contiguous slots of `durationSeconds`. A final
 * slot that would overhang `close` is dropped entirely (the strict v1 rule —
 * never create a slot ending after closing time).
 */
export function generateSlotGrid(
  openSeconds: number,
  closeSeconds: number,
  durationSeconds: number,
): Array<{ start: number; end: number }> {
  const slots: Array<{ start: number; end: number }> = [];
  let cursor = openSeconds;
  while (cursor + durationSeconds <= closeSeconds) {
    slots.push({ start: cursor, end: cursor + durationSeconds });
    cursor += durationSeconds;
  }
  return slots;
}

/**
 * The live operational status of a machine at `nowMs`.
 *
 * RUNNING / RESERVED / AVAILABLE are *derived* from active bookings so the UI
 * can never go stale: an expired booking stops making the machine look busy.
 * Stored states (MAINTENANCE / OFFLINE / DISABLED) always win when present.
 */
export function deriveMachineStatus(
  stored: "AVAILABLE" | "MAINTENANCE" | "OFFLINE" | "DISABLED",
  activeBookings: Array<{ startSeconds: number; endSeconds: number }>,
  nowMs: number,
): "RUNNING" | "RESERVED" | "AVAILABLE" | "MAINTENANCE" | "OFFLINE" | "DISABLED" {
  if (stored !== "AVAILABLE") return stored;
  const nowSec = currentIstSecondsOfDay(nowMs);
  const running = activeBookings.find(
    (b) => b.startSeconds <= nowSec && nowSec < b.endSeconds,
  );
  if (running) return "RUNNING";
  const upcoming = activeBookings
    .filter((b) => b.endSeconds > nowSec)
    .sort((a, b) => a.startSeconds - b.startSeconds)[0];
  return upcoming ? "RESERVED" : "AVAILABLE";
}
