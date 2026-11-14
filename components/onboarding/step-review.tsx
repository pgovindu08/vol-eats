"use client";

import type { ReactNode } from "react";
import { Pencil } from "lucide-react";
import { DIET_LABELS } from "@/lib/diet";
import { formatUsd } from "@/lib/budget";
import { useLocations } from "@/lib/hooks/use-locations";
import type { OnboardingDraft } from "@/lib/onboarding-draft";
import { STEP_TITLES, visibleSteps, type StepId } from "@/lib/onboarding-flow";
import { cmToFtIn, kgToLb } from "@/lib/units";
import { StepShell } from "./step-shell";

const GOAL = { lose_fat: "Lose fat", build_muscle: "Build muscle", maintain: "Maintain & eat healthier" };
const SEX = { male: "Male", female: "Female", unspecified: "Rather not say" };
const ACTIVITY = { sedentary: "Sedentary", light: "Light", moderate: "Moderate", very_active: "Very active" };
const LIVING = { on_campus: "On campus", off_campus_plan: "Off campus, with a meal plan", off_campus_cooking: "Off campus, cooking for myself" };
const KITCHEN = { full: "Full kitchen", microwave: "Microwave and fridge", none: "No kitchen" };

export function StepReview({
  draft,
  onEdit,
  onSubmit,
  onBack,
  busy,
  submitError,
}: {
  draft: OnboardingDraft;
  onEdit: (step: StepId) => void;
  onSubmit: () => void;
  onBack: () => void;
  busy: boolean;
  submitError: string | null;
}) {
  const { locations } = useLocations();
  const imperial = draft.units === "imperial";
  const height = draft.height_cm === undefined ? "—" : imperial ? (({ feet, inches }) => `${feet}′${inches}″`)(cmToFtIn(draft.height_cm)) : `${Math.round(draft.height_cm)} cm`;
  const w = (kg?: number) => (kg === undefined ? "—" : imperial ? `${kgToLb(kg)} lb` : `${kg} kg`);
  const halls = (draft.favorite_location_ids ?? []).map((id) => locations?.find((l) => l.id === id)?.name.replace(" Dining Hall", "") ?? id);
  const steps = visibleSteps(draft);

  const sections: { step: StepId; rows: [string, ReactNode][] }[] = [
    { step: "goal", rows: [["Goal", draft.goal_type ? GOAL[draft.goal_type] : "—"], ...(draft.goal_text ? ([["In your words", draft.goal_text]] as [string, ReactNode][]) : [])] },
    {
      step: "body",
      rows: [
        ["Sex", draft.sex ? SEX[draft.sex] : "—"],
        ["Age", draft.age ?? "—"],
        ["Height", height],
        ["Weight", `${w(draft.weight_kg)} → ${w(draft.goal_weight_kg)}`],
        ["Activity", draft.activity_level ? ACTIVITY[draft.activity_level] : "—"],
      ],
    },
    {
      step: "diet",
      rows: [
        ["Diet", draft.no_restrictions || !draft.diet_tags.length ? "No restrictions" : draft.diet_tags.map((t) => DIET_LABELS[t]).join(", ")],
        ["Allergies", draft.allergens.length ? draft.allergens.map((a) => a.replace("_", " ")).join(", ") : "None"],
      ],
    },
    {
      step: "living",
      rows: [
        ["Living", draft.living_situation ? LIVING[draft.living_situation] : "—"],
        ...(draft.living_situation !== "off_campus_cooking" || draft.has_dining_dollars ? ([["Meal plan", draft.meal_plan_name ?? "—"]] as [string, ReactNode][]) : []),
        ...(halls.length ? ([["Favorite hall", halls.join(", ")]] as [string, ReactNode][]) : []),
        ...(draft.kitchen_access ? ([["Kitchen", KITCHEN[draft.kitchen_access]]] as [string, ReactNode][]) : []),
        ...(draft.living_situation === "off_campus_cooking" && draft.weekly_food_budget_usd != null
          ? ([["Grocery budget", `${formatUsd(draft.weekly_food_budget_usd)} / week`]] as [string, ReactNode][])
          : []),
      ],
    },
    {
      step: "money",
      rows: [
        ...(draft.dining_dollars_balance != null ? ([["Dining dollars", formatUsd(draft.dining_dollars_balance)]] as [string, ReactNode][]) : []),
        ...(draft.swipes_remaining != null ? ([["Swipes left", draft.swipes_remaining]] as [string, ReactNode][]) : []),
        ...(draft.living_situation !== "off_campus_cooking"
          ? ([["Off-campus budget", draft.weekly_food_budget_usd != null ? `${formatUsd(draft.weekly_food_budget_usd)} / week` : "Not set"]] as [string, ReactNode][])
          : []),
      ],
    },
  ];

  return (
    <StepShell
      title="Look right?"
      subtitle="Check your answers. You can change any of them later too."
      formId="step-review"
      onBack={onBack}
      nextLabel={busy ? "Calculating…" : "Calculate my targets"}
      busy={busy}
    >
      <form
        id="step-review"
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        {sections
          .filter((s) => steps.includes(s.step) && s.rows.length)
          .map((s) => (
            <section key={s.step} aria-labelledby={`review-${s.step}`} className="rounded-lg border bg-surface p-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 id={`review-${s.step}`} className="text-sm font-semibold">
                  {STEP_TITLES[s.step]}
                </h2>
                <button
                  type="button"
                  onClick={() => onEdit(s.step)}
                  className="-my-2 -mr-2 flex min-h-11 items-center gap-1 px-2 text-sm font-medium text-muted hover:text-text"
                >
                  <Pencil aria-hidden className="size-3.5" /> Edit<span className="sr-only"> {STEP_TITLES[s.step].toLowerCase()}</span>
                </button>
              </div>
              <dl className="space-y-1 text-sm">
                {s.rows.map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4">
                    <dt className="text-muted">{label}</dt>
                    <dd className="text-right font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        {submitError ? (
          <p role="alert" className="text-sm text-danger">
            {submitError}
          </p>
        ) : null}
      </form>
    </StepShell>
  );
}
