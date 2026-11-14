/*
 * Shared data types.
 *
 * TODO(schema): CONTEXT.md §8 was not in the repo when these were written, so
 * they are inferred from the scraper output (scraper/, su_scrapper/) and the
 * frontend prompt. Field names follow the Student Union data (protein_g,
 * carbs_g, fat_g, tags, allergens). Align with Supul's Supabase tables and
 * update only this file.
 */

export type MealPeriod = "breakfast" | "lunch" | "dinner";
/** Retail items are served all day. */
export type MenuPeriod = MealPeriod | "all_day";

export type Sex = "male" | "female" | "unspecified";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "very_active";
export type GoalType = "lose_fat" | "build_muscle" | "maintain";
export type MealPlanType = "swipes" | "dining_dollars" | "both" | "none";
export type LivingSituation = "on_campus" | "off_campus_plan" | "off_campus_cooking";
export type KitchenAccess = "full" | "microwave" | "none";
/** "partial" = finished goal + body only; "skipped" = chose "Set up later" before that. */
export type OnboardingStatus = "complete" | "partial" | "skipped";

export type DietTag = "vegetarian" | "vegan" | "halal" | "gluten_free" | "dairy_free" | "no_pork";
export type Allergen =
  | "milk"
  | "eggs"
  | "fish"
  | "shellfish"
  | "tree_nuts"
  | "peanut"
  | "wheat"
  | "gluten"
  | "soy"
  | "sesame";

export interface Macros {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface School {
  id: string;
  name: string;
  slug: string;
  timezone: string;
}

export interface Location {
  id: string;
  school_id: string;
  name: string;
  slug: string;
  kind: "dining_hall" | "retail";
  building: string | null;
  accepts_swipes: boolean;
  accepts_dining_dollars: boolean;
}

export interface MenuItem extends Macros {
  id: string;
  location_id: string;
  /** null for retail items that don't change by day. */
  date: string | null;
  meal_period: MenuPeriod;
  station: string | null;
  name: string;
  serving_size: string | null;
  tags: DietTag[];
  allergens: Allergen[];
  /** TODO(schema): ask Supul to add — needed for "protein per dining dollar". */
  price_usd?: number | null;
}

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  school_id: string;
  goal_text: string | null;
  sex: Sex;
  age: number;
  height_cm: number;
  weight_kg: number;
  goal_weight_kg: number;
  activity_level: ActivityLevel;
  diet_tags: DietTag[];
  allergens: Allergen[];
  meal_plan_type: MealPlanType;
  target_calories: number;
  target_protein_g: number;
  target_carbs_g: number;
  target_fat_g: number;
  created_at: string;

  goal_type: GoalType; // TODO(schema): ask Supul to add
  meal_plan_name: string | null; // TODO(schema): ask Supul to add
  dining_dollars_balance: number | null; // TODO(schema): ask Supul to add
  swipes_remaining: number | null; // TODO(schema): ask Supul to add
  weekly_food_budget_usd: number | null; // TODO(schema): ask Supul to add

  // Onboarding v2 (Tier 1). Older profiles get defaults from lib/profile.ts.
  living_situation: LivingSituation; // TODO(schema): ask Supul to add
  favorite_location_ids: string[]; // TODO(schema): ask Supul to add
  kitchen_access: KitchenAccess | null; // TODO(schema): ask Supul to add
  onboarding_status: OnboardingStatus; // TODO(schema): ask Supul to add
}

/** Fields the client sends to POST /api/profile; the server computes targets. */
export type ProfileInput = Omit<
  Profile,
  "id" | "created_at" | "target_calories" | "target_protein_g" | "target_carbs_g" | "target_fat_g"
>;

export type LogSource = "menu" | "plate" | "photo" | "manual";

export interface FoodLog extends Macros {
  id: string;
  profile_id: string;
  menu_item_id: string | null;
  name: string;
  /** Macros above are per serving; totals = macros × servings. */
  servings: number;
  meal_period: MealPeriod;
  source: LogSource;
  logged_at: string;
}

export type FoodLogInput = Omit<FoodLog, "id" | "profile_id" | "logged_at"> & { logged_at?: string };

export interface Event {
  id: string;
  school_id: string;
  title: string;
  location_name: string;
  starts_at: string;
  ends_at: string | null;
  food_description: string;
  est_calories: number | null;
  source_url: string | null;
  // Deliberately no poster/author field: never show who posted.
}

/* ---------- AI responses ---------- */

// PROPOSED — align with Aarohan's lib/ai.ts
export interface TargetsExplanation {
  explanation: string;
  adjustments?: { field: string; from: number; to: number; why: string }[];
}

// PROPOSED — align with Aarohan's lib/ai.ts
export interface PlateItem {
  menu_item_id: string;
  name: string;
  servings: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

// PROPOSED — align with Aarohan's lib/ai.ts
export interface Plate {
  id: string;
  title: string;
  location_id: string;
  items: PlateItem[];
  totals: Macros;
  reason: string;
}

// PROPOSED — align with Aarohan's lib/ai.ts
export interface PlateRecommendation {
  plates: Plate[];
}

// PROPOSED — align with Aarohan's lib/ai.ts
export interface PhotoEstimate {
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: "low" | "medium" | "high";
  notes?: string;
}
