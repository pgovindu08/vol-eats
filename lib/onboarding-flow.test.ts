import { describe, expect, it } from "vitest";
import { emptyDraft, type OnboardingDraft } from "./onboarding-draft";
import { buildProfileInput, DEFAULT_BODY, nextStep, profileToDraft, resolveStep, stepIndex, stepPosition, visibleSteps } from "./onboarding-flow";
import { normalizeProfile } from "./profile";
import { computeTargets } from "./targets";
import { DEMO_PROFILE } from "@/mock/demo-profile";

const NOW = Date.parse("2026-11-14T12:00:00Z");
const body = { sex: "female", age: 20, height_cm: 167.6, weight_kg: 68, goal_weight_kg: 63.5, activity_level: "moderate" } as const;
const draft = (patch: Partial<OnboardingDraft>): OnboardingDraft => ({ ...emptyDraft(NOW), goal_type: "lose_fat", ...body, ...patch });

describe("visible steps per living situation", () => {
  it("on campus and off campus with a plan see all 6 steps", () => {
    expect(visibleSteps(draft({ living_situation: "on_campus" }))).toHaveLength(6);
    expect(visibleSteps(draft({ living_situation: "off_campus_plan" }))).toHaveLength(6);
  });

  it("off-campus cooks skip Money unless they also have dining dollars", () => {
    expect(visibleSteps(draft({ living_situation: "off_campus_cooking" }))).not.toContain("money");
    expect(visibleSteps(draft({ living_situation: "off_campus_cooking", has_dining_dollars: true, meal_plan_name: "Dining Dollar Plan" }))).toContain("money");
  });

  it("goes from living straight to review when Money is skipped, and counts honestly", () => {
    const d = draft({ living_situation: "off_campus_cooking" });
    expect(nextStep("living", d)).toBe("review");
    expect(stepPosition("review", d)).toEqual({ position: 5, total: 5 });
    expect(stepPosition("review", draft({ living_situation: "on_campus" }))).toEqual({ position: 6, total: 6 });
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
  it("never lands on a skipped step", () => {
    const cook = draft({ furthest: stepIndex("review"), living_situation: "off_campus_cooking" });
    expect(resolveStep("money", cook)).toBe("review");
  });
});

describe("buildProfileInput", () => {
  it("on campus keeps meal plan, swipes and favorite halls, and drops kitchen", () => {
    const p = buildProfileInput(
      draft({ living_situation: "on_campus", meal_plan_name: "Vol Block 75", swipes_remaining: 40, dining_dollars_balance: 200, favorite_location_ids: ["loc-stokely"], kitchen_access: "full" }),
      "a@vols.utk.edu",
      "complete",
    );
    expect(p).toMatchObject({ meal_plan_type: "both", swipes_remaining: 40, dining_dollars_balance: 200, favorite_location_ids: ["loc-stokely"], kitchen_access: null });
  });

  it("off-campus cooks without dining dollars have no meal plan, but keep kitchen and grocery budget", () => {
    const p = buildProfileInput(
      draft({ living_situation: "off_campus_cooking", meal_plan_name: "Vol Block 75", swipes_remaining: 40, kitchen_access: "microwave", weekly_food_budget_usd: 60, favorite_location_ids: ["loc-stokely"] }),
      "a@vols.utk.edu",
      "complete",
    );
    expect(p).toMatchObject({ meal_plan_name: null, meal_plan_type: "none", swipes_remaining: null, kitchen_access: "microwave", weekly_food_budget_usd: 60, favorite_location_ids: [] });
  });

  it("off-campus cooks with dining dollars keep the balance", () => {
    const p = buildProfileInput(
      draft({ living_situation: "off_campus_cooking", has_dining_dollars: true, meal_plan_name: "Dining Dollar Plan", dining_dollars_balance: 150 }),
      "a@vols.utk.edu",
      "complete",
    );
    expect(p).toMatchObject({ meal_plan_type: "dining_dollars", dining_dollars_balance: 150 });
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
