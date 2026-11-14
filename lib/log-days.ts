// Calendar helpers for the Log tab. Dates are YYYY-MM-DD in school (Eastern) time.
import type { FoodLog, MealPeriod } from "./types";
import { schoolDate } from "./meal-period";

const DAY = 24 * 60 * 60 * 1000;
const utc = (ymd: string) => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10));
const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function addDays(date: string, n: number) {
  return ymd(utc(date) + n * DAY);
}

/** Monday through Sunday of the week containing `date`. */
export function weekDays(date: string): string[] {
  const dow = (new Date(utc(date)).getUTCDay() + 6) % 7; // Monday = 0
  const monday = addDays(date, -dow);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export type DayStatus = "hit" | "under" | "over" | "empty";

/** Within ±10% of the calorie target is a hit. */
export function dayStatus(calories: number, target: number): DayStatus {
  if (calories <= 0) return "empty";
  if (calories < target * 0.9) return "under";
  if (calories > target * 1.1) return "over";
  return "hit";
}

export const STATUS_LABEL: Record<DayStatus, string> = { hit: "On target", under: "Under", over: "Over", empty: "No logs" };

/** Groups logs by school-time date. */
export function logsByDay(logs: FoodLog[]): Record<string, FoodLog[]> {
  const out: Record<string, FoodLog[]> = {};
  for (const l of logs) (out[schoolDate(new Date(l.logged_at))] ??= []).push(l);
  return out;
}

const MEAL_TIME: Record<MealPeriod, string> = { breakfast: "08:00", lunch: "12:30", dinner: "18:30" };

/**
 * ISO timestamp for a meal on a given date in Eastern time, used when logging to a past day.
 * EST (-05:00) Nov to mid-March, EDT (-04:00) otherwise. Close enough for a meal log.
 */
export function atMealTime(date: string, period: MealPeriod) {
  const month = +date.slice(5, 7);
  const offset = month >= 11 || month <= 3 ? "-05:00" : "-04:00";
  return new Date(`${date}T${MEAL_TIME[period]}:00${offset}`).toISOString();
}

/** "Tue, Nov 11" */
export function shortDay(date: string) {
  return new Date(utc(date)).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}
