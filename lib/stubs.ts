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
