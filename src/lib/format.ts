/** "5:30 PM" from seconds-from-midnight. */
export function secondsTo12h(seconds: number): string {
  const h24 = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const suffix = h24 >= 12 ? "PM" : "AM";
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** "17:30" from seconds-from-midnight. */
export function secondsToHHMM(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** MM:SS countdown from seconds. */
export function mmss(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/** "1 hr 30 min" from seconds. */
export function durationLabel(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

/** Friendly date label: Today / Tomorrow / "Fri, 3 Oct". */
export function friendlyDate(date: string): string {
  const today = new Date();
  const utcToday = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
  );
  const [y, m, d] = date.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1, d));
  const diffDays = Math.round(
    (target.getTime() - utcToday.getTime()) / 86_400_000,
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return target.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** Short weekday name from YYYY-MM-DD. */
export function weekdayShort(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", {
    weekday: "short",
    timeZone: "UTC",
  });
}

/** Day-of-month from YYYY-MM-DD. */
export function dayOfMonth(date: string): string {
  return date.slice(8, 10);
}

/** IST "now" helpers mirrored from the backend for local optimistic checks. */
export function istNowParts(now = new Date()) {
  const ist = new Date(now.getTime() + 5.5 * 3600_000);
  return {
    date: ist.toISOString().slice(0, 10),
    seconds: ist.getUTCHours() * 3600 + ist.getUTCMinutes() * 60 + ist.getUTCSeconds(),
  };
}
