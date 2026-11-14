// App-wide constants. Change the product name here only.
export const APP_NAME = "Vol Eats";
export const APP_TAGLINE = "Hit your macros with what UTK is serving today.";

/** When true, lib/api.ts talks to lib/mock-api.ts instead of the real routes. */
export const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

/** UTK is on Eastern time; meal periods and "today" are computed in this zone. */
export const SCHOOL_TIMEZONE = "America/New_York";

/** Meal period cutoffs in local school time (CONTEXT §4). Minutes after midnight. */
export const MEAL_PERIOD_CUTOFFS = {
  breakfastEnds: 10 * 60 + 30, // 10:30 AM
  lunchEnds: 16 * 60 + 30, // 4:30 PM
} as const;

/** Default last day of the semester for budget math (user can change it). */
export const DEFAULT_SEMESTER_END = "2026-12-12";

/** Client-side timeout for AI routes before falling back to an offline estimate. */
export const AI_TIMEOUT_MS = 5000;

export const ALLOWED_EMAIL_DOMAINS = ["vols.utk.edu", "utk.edu"] as const;
