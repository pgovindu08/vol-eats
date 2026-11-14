/*
 * TEMPORARY stand-ins for functions Person B is building (see docs/prompts/app-v3-person-a.md).
 * Same names and shapes as the agreed interfaces. When B's branch merges, switch imports to the
 * real ones and delete this file.
 */
import { api } from "./api";
import { addDays } from "./log-days";
import type { FoodLog } from "./types";

/** Stand-in for api.logsRange(from, to): loads each day with the existing GET /api/logs?date= call. */
export async function logsRange(from: string, to: string): Promise<FoodLog[]> {
  const real = (api as unknown as { logsRange?: (f: string, t: string) => Promise<FoodLog[]> }).logsRange;
  if (real) return real(from, to); // B's version, once merged
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return (await Promise.all(days.map((date) => api.logs({ date })))).flat();
}

/* ---------- Food tab stand-ins (Person B owns lib/campus-geo.ts and lib/hours.ts) ---------- */

// TODO(verify): approximate coordinates. Distance is always measured from Min Kao (TODO(location)).
const MIN_KAO = { lat: 35.9575, lng: -83.9262 };
const COORDS: Record<string, { lat: number; lng: number }> = {
  "loc-rockytop": { lat: 35.952, lng: -83.9325 },
  "loc-stokely": { lat: 35.953, lng: -83.93 },
  "loc-chickfila": { lat: 35.9548, lng: -83.9285 },
  "loc-panda": { lat: 35.9548, lng: -83.9286 },
};

/** Stand-in for distanceFromMinKao: haversine miles, walking at ~80 m/min. */
export function distanceFromMinKao(location_id: string): { miles: number; walkMinutes: number } | null {
  const c = COORDS[location_id];
  if (!c) return null;
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const a =
    Math.sin(rad(c.lat - MIN_KAO.lat) / 2) ** 2 +
    Math.cos(rad(MIN_KAO.lat)) * Math.cos(rad(c.lat)) * Math.sin(rad(c.lng - MIN_KAO.lng) / 2) ** 2;
  const meters = 2 * R * Math.asin(Math.sqrt(a));
  return { miles: Math.round((meters / 1609.34) * 10) / 10, walkMinutes: Math.max(1, Math.round(meters / 80)) };
}

// TODO(verify): approximate hours, minutes after midnight in Eastern time. Index 0 = Sunday. null = closed.
type Hours = ([number, number] | null)[];
const HALL: Hours = [[600, 1200], [420, 1260], [420, 1260], [420, 1260], [420, 1260], [420, 1260], [600, 1200]];
const HOURS: Record<string, Hours> = {
  "loc-rockytop": HALL,
  "loc-stokely": HALL,
  "loc-chickfila": [null, [450, 1200], [450, 1200], [450, 1200], [450, 1200], [450, 1200], [630, 1080]], // closed Sundays
  "loc-panda": [[660, 1200], [630, 1260], [630, 1260], [630, 1260], [630, 1260], [630, 1260], [660, 1200]],
};

function easternNow(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { day, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

const clock = (m: number) => {
  const h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

/** Stand-in for openStatus: "Open now" (with closing time), "Opens 5:00 PM", "Opens tomorrow 7:00 AM" or "Closed". */
export function openStatus(location_id: string, now: Date = new Date()): { open: boolean; label: string } {
  const hours = HOURS[location_id];
  if (!hours) return { open: false, label: "Hours unknown" };
  const { day, minutes } = easternNow(now);
  const today = hours[day];
  if (today && minutes >= today[0] && minutes < today[1]) return { open: true, label: `Open until ${clock(today[1])}` };
  if (today && minutes < today[0]) return { open: false, label: `Opens ${clock(today[0])}` };
  for (let i = 1; i <= 7; i++) {
    const next = hours[(day + i) % 7];
    if (next) return { open: false, label: `Opens ${i === 1 ? "tomorrow" : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][(day + i) % 7]} ${clock(next[0])}` };
  }
  return { open: false, label: "Closed" };
}
