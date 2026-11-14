import { describe, expect, it } from "vitest";
import { emptyDraft, type OnboardingDraft } from "./onboarding-draft";
import { buildProfileInput, DEFAULT_BODY, nextStep, profileToDraft, resolveStep, stepIndex, stepPosition, visibleSteps } from "./onboarding-flow";
import { normalizeProfile } from "./profile";
import { computeTargets } from "./targets";
import { DEMO_PROFILE } from "@/mock/demo-profile";

const NOW = Date.parse("2026-11-14T12:00:00Z");
const body = { sex: "female", age: 20, height_cm: 167.6, weight_kg: 68, goal_weight_kg: 63.5, activity_level: "moderate" } as const;
const draft = (patch: Partial<OnboardingDraft>): OnboardingDraft => ({ ...emptyDraft(NOW), goal_type: "lose_fat", ...body, ...patch });

describe("steps (no money questions in onboarding)", () => {
  it("every student sees the same 5 steps", () => {
    for (const living of ["on_campus", "off_campus_plan", "off_campus_cooking"] as const) {
      expect(visibleSteps(draft({ living_situation: living }))).toEqual(["goal", "body", "diet", "living", "review"]);
    }
  });

  it("goes from living straight to review and counts 5", () => {
    const d = draft({ living_situation: "on_campus" });
    expect(nextStep("living", d)).toBe("review");
    expect(stepPosition("review", d)).toEqual({ position: 5, total: 5 });
  });

  it("drafts saved when Money was a step still land on review", () => {
    const old = draft({ furthest: 5, living_situation: "on_campus" });
    expect(resolveStep(null, old)).toBe("review");
    expect(resolveStep("money", old)).toBe("review");
  });
});

describe("resolveStep (?step= in the URL)", () => {
  const d = draft({ furthest: stepIndex("diet"), living_situation: "on_campus" });
  it("allows steps already reached", () => {
    expect(resolveStep("body", d)).toBe("body");
  });
  it("falls back to the furthest step for missing, unknown or future steps", () => {
    expect(resolveStep(null, d)).toBe("diet");
    expect(resolveStep("banana", d)).toBe("diet");
    expect(resolveStep("review", d)).toBe("diet");
  });
});

describe("buildProfileInput", () => {
  // Entered on the Budget screen before finishing setup.
  const money = { dining_dollars_balance: 200, swipes_remaining: 40, weekly_food_budget_usd: 50 };

  it("a brand-new student has no balances (onboarding doesn't ask)", () => {
    const p = buildProfileInput(draft({ living_situation: "on_campus", meal_plan_name: "Vol Block 75" }), "a@vols.utk.edu", "complete");
    expect(p).toMatchObject({ meal_plan_type: "both", dining_dollars_balance: null, swipes_remaining: null, weekly_food_budget_usd: null });
  });

  it("on campus keeps favorite halls, drops kitchen, and keeps balances entered on Budget", () => {
    const p = buildProfileInput(
      draft({ living_situation: "on_campus", meal_plan_name: "Vol Block 75", favorite_location_ids: ["loc-stokely"], kitchen_access: "full" }),
      "a@vols.utk.edu",
      "complete",
      money,
    );
    expect(p).toMatchObject({ swipes_remaining: 40, dining_dollars_balance: 200, weekly_food_budget_usd: 50, favorite_location_ids: ["loc-stokely"], kitchen_access: null });
  });

  it("drops balances the new plan doesn't use", () => {
    const p = buildProfileInput(draft({ living_situation: "on_campus", meal_plan_name: "Tennessee Unlimited 7" }), "a@vols.utk.edu", "complete", money);
    expect(p.swipes_remaining).toBeNull(); // unlimited plan: no swipe count
    expect(p.dining_dollars_balance).toBe(200);
  });

  it("off-campus cooks have no meal plan but keep kitchen and their weekly budget", () => {
    const p = buildProfileInput(
      draft({ living_situation: "off_campus_cooking", meal_plan_name: "Vol Block 75", kitchen_access: "microwave", favorite_location_ids: ["loc-stokely"] }),
      "a@vols.utk.edu",
      "complete",
      money,
    );
    expect(p).toMatchObject({
      meal_plan_name: null,
      meal_plan_type: "none",
      swipes_remaining: null,
      dining_dollars_balance: null,
      kitchen_access: "microwave",
      weekly_food_budget_usd: 50,
      favorite_location_ids: [],
    });
  });

  it("'Set up later' with no body details uses safe defaults", () => {
    const p = buildProfileInput({ ...emptyDraft(NOW) }, "a@vols.utk.edu", "skipped");
    expect(p).toMatchObject({ ...DEFAULT_BODY, goal_type: "maintain", onboarding_status: "skipped", meal_plan_type: "none" });
    expect(computeTargets(p).calories).toBeGreaterThan(1500);
  });

  it("'Finish later' after the body step keeps real body details", () => {
    const p = buildProfileInput(draft({}), "a@vols.utk.edu", "partial");
    expect(p).toMatchObject({ age: 20, weight_kg: 68, goal_type: "lose_fat", onboarding_status: "partial" });
  });
});

describe("profileToDraft (continue setup without a local draft)", () => {
  it("partial profiles resume at the diet step with body filled in", () => {
    const d = profileToDraft(normalizeProfile({ ...DEMO_PROFILE, onboarding_status: "partial" }), NOW);
    expect(d.furthest).toBe(stepIndex("diet"));
    expect(d.weight_kg).toBe(DEMO_PROFILE.weight_kg);
    expect(resolveStep(null, d)).toBe("diet");
  });

  it("skipped profiles start at the goal step", () => {
    const d = profileToDraft(normalizeProfile({ ...DEMO_PROFILE, onboarding_status: "skipped" }), NOW);
    expect(resolveStep(null, d)).toBe("goal");
  });
});
