import type { FoodLog, Profile } from "@/lib/types";
import { computeTargets } from "@/lib/targets";
import { SCHOOL } from "./locations";

const body = {
  sex: "male",
  age: 20,
  height_cm: 177.8, // 5'10"
  weight_kg: 77.1, // 170 lb
  activity_level: "moderate",
  goal_type: "build_muscle",
} as const;

const targets = computeTargets(body);

export const DEMO_EMAIL = "demo@vols.utk.edu";

export const DEMO_PROFILE: Profile = {
  id: "profile-demo",
  email: DEMO_EMAIL,
  display_name: "Smokey",
  school_id: SCHOOL.id,
  goal_text: "170 lbs, lift 4x/week, lean bulk",
  ...body,
  goal_weight_kg: 81.6, // 180 lb
  diet_tags: [],
  allergens: [],
  meal_plan_type: "both",
  meal_plan_name: "Vol Block 100",
  dining_dollars_balance: 312.5,
  swipes_remaining: 41,
  weekly_food_budget_usd: 40,
  living_situation: "on_campus",
  favorite_location_ids: ["loc-rockytop"],
  kitchen_access: null,
  onboarding_status: "complete",
  target_calories: targets.calories,
  target_protein_g: targets.protein_g,
  target_carbs_g: targets.carbs_g,
  target_fat_g: targets.fat_g,
  created_at: "2026-11-10T14:00:00.000Z",
};

/** Breakfast already logged for the demo user (today). */
export function demoLogs(dateIso: string): FoodLog[] {
  const at = `${dateIso}T13:15:00.000Z`; // ~8:15 AM Eastern
  return [
    { id: "log-demo-1", profile_id: DEMO_PROFILE.id, menu_item_id: null, name: "Scrambled Eggs", servings: 2, calories: 130, protein_g: 12, carbs_g: 1, fat_g: 9, meal_period: "breakfast", source: "menu", logged_at: at },
    { id: "log-demo-2", profile_id: DEMO_PROFILE.id, menu_item_id: null, name: "Overnight Oats", servings: 1, calories: 180, protein_g: 8, carbs_g: 25, fat_g: 6, meal_period: "breakfast", source: "menu", logged_at: at },
    { id: "log-demo-3", profile_id: DEMO_PROFILE.id, menu_item_id: null, name: "Turkey Sausage Link", servings: 2, calories: 100, protein_g: 9, carbs_g: 1, fat_g: 7, meal_period: "breakfast", source: "menu", logged_at: at },
  ];
}
