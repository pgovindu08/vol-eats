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

/**
 * The demo user's last 6 days, so the Log calendar shows a realistic week (a mix of on target,
 * under and over). Deterministic: the same days every time, relative to `today` (YYYY-MM-DD).
 */
export function demoHistory(today: string): FoodLog[] {
  const plan: [number, string, number, number, number, number][][] = [
    // [servings, name, cal, protein, carbs, fat] per meal: breakfast, lunch, dinner
    [[2, "Scrambled Eggs", 130, 12, 1, 9], [1, "Grilled Chicken Bowl", 980, 70, 110, 22], [1, "Pasta & Meatballs", 1450, 62, 175, 45], [1, "Protein Shake", 300, 40, 10, 5]], // ~3,040 on target
    [[1, "Overnight Oats", 180, 8, 25, 6], [1, "Turkey Sandwich", 650, 38, 70, 18], [1, "Chicken Stir Fry", 900, 50, 95, 28]], // ~1,730 under
    [[1, "Belgian Waffle", 260, 5, 52, 3], [2, "Pepperoni Pizza", 300, 14, 36, 13], [1, "Burger & Fries", 1450, 48, 120, 70], [1, "Milkshake", 1300, 24, 170, 55]], // ~3,710 over
    [[2, "Scrambled Eggs", 130, 12, 1, 9], [1, "Chicken Tinga Bowl", 1000, 65, 115, 25], [1, "Grilled Salmon Plate", 1250, 72, 120, 40], [1, "Greek Yogurt", 450, 30, 50, 10]], // ~2,960 on target
    [[1, "Bagel & Cream Cheese", 400, 12, 60, 12], [1, "Caesar Salad", 700, 35, 30, 45], [1, "Vegetable Curry", 1100, 30, 140, 35]], // ~2,200 under
    [[2, "Turkey Sausage Link", 100, 9, 1, 7], [1, "Rotisserie Chicken Plate", 1050, 80, 90, 30], [1, "Beef Burrito", 1300, 60, 140, 45], [1, "Protein Bar", 350, 20, 40, 10]], // ~2,900 on target
  ];
  const meals = ["breakfast", "lunch", "dinner", "dinner"] as const;
  const times = ["13:15", "17:30", "23:30", "01:30"]; // UTC ≈ 8:15 AM, 12:30, 6:30, 8:30 PM Eastern
  const base = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10));
  const out: FoodLog[] = [];
  plan.forEach((day, i) => {
    const date = new Date(base - (i + 1) * 86400000).toISOString().slice(0, 10);
    day.forEach(([servings, name, calories, protein_g, carbs_g, fat_g], m) => {
      // The late snack is stored early the next UTC day so it still falls on `date` in Eastern time.
      const stamp = m === 3 ? new Date(Date.parse(`${date}T${times[m]}:00.000Z`) + 86400000).toISOString() : `${date}T${times[m]}:00.000Z`;
      out.push({ id: `demo-hist-${date}-${m}`, profile_id: DEMO_PROFILE.id, menu_item_id: null, name, servings, calories, protein_g, carbs_g, fat_g, meal_period: meals[m], source: "menu", logged_at: stamp });
    });
  });
  return out;
}
