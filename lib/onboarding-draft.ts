/*
 * Onboarding answers autosaved to localStorage, one draft per user (keyed by email),
 * so leaving mid-setup and coming back resumes where you stopped, and another
 * person signing in on the same phone never sees your answers.
 */
import type { ActivityLevel, Allergen, DietTag, GoalType, KitchenAccess, LivingSituation, Sex } from "./types";

const PREFIX = "cf.onboarding-draft:";
/** v1 stored one shared draft under this key. */
export const LEGACY_DRAFT_KEY = "cf.onboarding-draft";
/** Drafts untouched this long are dropped quietly. */
export const DRAFT_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export type UnitSystem = "imperial" | "metric";

export interface OnboardingDraft {
  /** Furthest step reached (0-based). Steps up to here can be revisited via the URL. */
  furthest: number;
  updated_at: string;
  goal_type?: GoalType;
  goal_text?: string;

  sex?: Sex;
  age?: number;
  units: UnitSystem;
  height_ft?: number;
  height_in?: number;
  height_cm?: number;
  /** In the chosen units (lb or kg). */
  weight?: number;
  goal_weight?: number;
  activity_level?: ActivityLevel;
  /** Metric values, filled in when the body step passes validation. */
  weight_kg?: number;
  goal_weight_kg?: number;

  diet_tags: DietTag[];
  no_restrictions: boolean;
  allergens: Allergen[];

  living_situation?: LivingSituation;
  favorite_location_ids?: string[];
  kitchen_access?: KitchenAccess | null;

  meal_plan_name?: string;
  // Money isn't asked in onboarding anymore (it's on the Budget screen). Older drafts may still
  // contain these; they're ignored.
  dining_dollars_balance?: number | null;
  swipes_remaining?: number | null;
  weekly_food_budget_usd?: number | null;
}

type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const browserStorage = (): DraftStorage | null => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null; // storage blocked (private mode): drafts just won't persist
  }
};

export const draftKey = (email: string) => PREFIX + email.trim().toLowerCase();

export function emptyDraft(now = Date.now()): OnboardingDraft {
  return { furthest: 0, updated_at: new Date(now).toISOString(), units: "imperial", diet_tags: [], no_restrictions: false, allergens: [] };
}

/** True when the draft holds real answers worth resuming. */
export function hasProgress(d: OnboardingDraft) {
  return d.furthest > 0 || d.goal_type !== undefined;
}

/**
 * Loads this user's draft. Expired drafts are removed. The v1 shared draft is
 * deleted rather than migrated: there's no way to know who it belonged to.
 */
export function loadDraft(email: string, storage: DraftStorage | null = browserStorage(), now = Date.now()): OnboardingDraft {
  if (!storage) return emptyDraft(now);
  try {
    storage.removeItem(LEGACY_DRAFT_KEY);
    const raw = storage.getItem(draftKey(email));
    if (!raw) return emptyDraft(now);
    const parsed = JSON.parse(raw) as Partial<OnboardingDraft> & { step?: number };
    const updated = Date.parse(parsed.updated_at ?? "");
    if (!Number.isFinite(updated) || now - updated > DRAFT_MAX_AGE_MS) {
      storage.removeItem(draftKey(email));
      return emptyDraft(now);
    }
    const { step, ...rest } = parsed;
    return { ...emptyDraft(now), ...rest, furthest: parsed.furthest ?? step ?? 0, updated_at: parsed.updated_at! };
  } catch {
    return emptyDraft(now);
  }
}

export function saveDraft(email: string, draft: OnboardingDraft, storage: DraftStorage | null = browserStorage(), now = Date.now()) {
  try {
    storage?.setItem(draftKey(email), JSON.stringify({ ...draft, updated_at: new Date(now).toISOString() }));
  } catch {}
}

export function clearDraft(email: string, storage: DraftStorage | null = browserStorage()) {
  try {
    storage?.removeItem(draftKey(email));
  } catch {}
}
