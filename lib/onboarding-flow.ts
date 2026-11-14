/*
 * Onboarding v2 step flow, kept as pure functions so every branch is unit-tested.
 * The URL carries a step id (?step=living); `draft.furthest` is an index into STEP_IDS.
 */
import { findMealPlan } from "./meal-plans";
import { emptyDraft, type OnboardingDraft } from "./onboarding-draft";
import { inferLivingSituation } from "./profile";
import type { OnboardingStatus, Profile, ProfileInput } from "./types";
import { SCHOOL } from "@/mock/locations";

// Onboarding asks no money questions. Dining dollars, swipes left and food budgets
// are entered on the Budget screen instead.
export const STEP_IDS = ["goal", "body", "diet", "living", "review"] as const;
export type StepId = (typeof STEP_IDS)[number];

export const STEP_TITLES: Record<StepId, string> = {
  goal: "Your goal",
  body: "About you",
  diet: "How you eat",
  living: "Where you live and eat",
  review: "Review",
};

export const stepIndex = (id: StepId) => STEP_IDS.indexOf(id);
const isStepId = (v: string | null): v is StepId => !!v && (STEP_IDS as readonly string[]).includes(v);

export function planHasDiningDollars(planName: string | null | undefined) {
  const t = findMealPlan(planName)?.type;
  return t === "both" || t === "dining_dollars";
}

/** Every student sees the same steps now. Kept as a function so callers don't care. */
export function visibleSteps(d: OnboardingDraft): StepId[] {
  void d;
  return [...STEP_IDS];
}

/**
 * The step to show for a requested `?step=` value: must be visible and already reached.
 * Anything else (missing, unknown, ahead of progress, skipped) falls back to the furthest reached visible step.
 */
export function resolveStep(requested: string | null, d: OnboardingDraft): StepId {
  const visible = visibleSteps(d);
  if (isStepId(requested) && visible.includes(requested) && stepIndex(requested) <= d.furthest) return requested;
  const reached = visible.filter((id) => stepIndex(id) <= d.furthest);
  return reached[reached.length - 1] ?? "goal";
}

export function nextStep(current: StepId, d: OnboardingDraft): StepId | null {
  const visible = visibleSteps(d);
  return visible[visible.indexOf(current) + 1] ?? null;
}

/** 1-based position and total among the steps this student actually sees. */
export function stepPosition(current: StepId, d: OnboardingDraft) {
  const visible = visibleSteps(d);
  return { position: visible.indexOf(current) + 1, total: visible.length };
}

/** Used when someone chooses "Set up later" before giving body details. Targets are a rough estimate. */
export const DEFAULT_BODY = { sex: "unspecified", age: 20, height_cm: 170, weight_kg: 70, activity_level: "light" } as const;

/** Money fields entered on the Budget screen, kept when onboarding saves over a partial/skipped profile. */
export type MoneyFields = Pick<Profile, "dining_dollars_balance" | "swipes_remaining" | "weekly_food_budget_usd">;

/**
 * Turns the draft into the profile we save. Fields that don't apply to the chosen branch are dropped.
 * Onboarding doesn't ask about money, so balances come from `previous` (what the student already
 * entered on Budget), and are dropped if the new meal plan doesn't use them.
 */
export function buildProfileInput(d: OnboardingDraft, email: string, status: OnboardingStatus, previous?: MoneyFields | null): ProfileInput {
  const hasBody = d.age !== undefined && d.height_cm !== undefined && d.weight_kg !== undefined;
  const living = d.living_situation;
  const cooking = living === "off_campus_cooking";
  const planName = cooking ? null : (d.meal_plan_name ?? null);
  const plan = findMealPlan(planName);
  const planType = plan?.type ?? "none";
  const weight_kg = hasBody ? d.weight_kg! : DEFAULT_BODY.weight_kg;

  return {
    email,
    display_name: null,
    school_id: SCHOOL.id, // TODO(schema): single school for the hackathon
    goal_type: d.goal_type ?? "maintain",
    goal_text: d.goal_text?.trim() || null,
    sex: hasBody ? (d.sex ?? "unspecified") : DEFAULT_BODY.sex,
    age: hasBody ? d.age! : DEFAULT_BODY.age,
    height_cm: hasBody ? d.height_cm! : DEFAULT_BODY.height_cm,
    weight_kg,
    goal_weight_kg: hasBody ? (d.goal_weight_kg ?? weight_kg) : weight_kg,
    activity_level: hasBody ? (d.activity_level ?? "light") : DEFAULT_BODY.activity_level,
    diet_tags: d.diet_tags,
    allergens: d.allergens,
    meal_plan_name: plan && plan.type !== "none" ? plan.name : null,
    meal_plan_type: planType,
    dining_dollars_balance: planHasDiningDollars(planName) ? (previous?.dining_dollars_balance ?? null) : null,
    swipes_remaining: plan?.block ? (previous?.swipes_remaining ?? null) : null,
    weekly_food_budget_usd: previous?.weekly_food_budget_usd ?? null,
    living_situation: living ?? (status === "complete" ? inferLivingSituation(planType) : "on_campus"),
    favorite_location_ids: cooking ? [] : (d.favorite_location_ids ?? []),
    kitchen_access: living === "off_campus_plan" || cooking ? (d.kitchen_access ?? null) : null,
    onboarding_status: status,
  };
}

/**
 * Rebuilds a draft from a saved partial/skipped profile, for "Continue setup" when the
 * local draft is gone (cleared storage or another device). Resumes at the first unfinished step.
 */
export function profileToDraft(p: Profile, now = Date.now()): OnboardingDraft {
  const base = emptyDraft(now);
  if (p.onboarding_status === "skipped") return { ...base, goal_type: p.goal_type };
  return {
    ...base,
    furthest: stepIndex("diet"),
    goal_type: p.goal_type,
    goal_text: p.goal_text ?? undefined,
    sex: p.sex,
    age: p.age,
    units: "metric",
    height_cm: p.height_cm,
    weight: p.weight_kg,
    goal_weight: p.goal_weight_kg,
    weight_kg: p.weight_kg,
    goal_weight_kg: p.goal_weight_kg,
    activity_level: p.activity_level,
    diet_tags: p.diet_tags,
    allergens: p.allergens,
  };
}
