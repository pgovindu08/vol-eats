// Profile helpers shared by the client and the mock backend.
import type { LivingSituation, MealPlanType, Profile } from "./types";

/** Best guess for profiles saved before onboarding v2 asked where the student lives. */
export function inferLivingSituation(plan: MealPlanType): LivingSituation {
  if (plan === "swipes" || plan === "both") return "on_campus";
  if (plan === "dining_dollars") return "off_campus_plan";
  return "off_campus_cooking";
}

type StoredProfile = Omit<Profile, "living_situation" | "favorite_location_ids" | "kitchen_access" | "onboarding_status"> &
  Partial<Pick<Profile, "living_situation" | "favorite_location_ids" | "kitchen_access" | "onboarding_status">>;

/**
 * Fills fields added in onboarding v2 so older profiles (v1 mock data, or a backend
 * that hasn't added the columns yet) never crash the app. A v1 profile finished onboarding,
 * so it counts as "complete".
 */
export function normalizeProfile(p: StoredProfile): Profile {
  return {
    ...p,
    living_situation: p.living_situation ?? inferLivingSituation(p.meal_plan_type),
    favorite_location_ids: p.favorite_location_ids ?? [],
    kitchen_access: p.kitchen_access ?? null,
    onboarding_status: p.onboarding_status ?? "complete",
  };
}
