"use client";

import { useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Info } from "lucide-react";
import { ChoiceCards } from "@/components/ui/choice";
import { Field, Input, a11y } from "@/components/ui/field";
import { activitySchema, bodyStepSchema, sexSchema } from "@/lib/schemas";
import { ftInToCm, kgToLb, lbToKg, minHealthyWeightKg } from "@/lib/units";
import type { OnboardingDraft, UnitSystem } from "@/lib/onboarding-draft";
import type { ActivityLevel, GoalType, Sex } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toNumber } from "@/lib/utils";
import { StepShell } from "./step-shell";

const num = z.preprocess(toNumber, z.number().optional());

/** Form values are in the user's units; we convert to metric and reuse bodyStepSchema's rules. */
function makeSchema(goal_type: GoalType) {
  return z
    .object({
      units: z.enum(["imperial", "metric"]),
      sex: sexSchema.optional().refine((v) => v !== undefined, "Pick one"),
      age: num,
      height_ft: num,
      height_in: num,
      height_cm: num,
      weight: num,
      goal_weight: num,
      activity_level: activitySchema.optional().refine((v) => v !== undefined, "Pick your activity level"),
    })
    .superRefine((v, ctx) => {
      const imperial = v.units === "imperial";
      const heightField = imperial ? "height_ft" : "height_cm";
      const required: [keyof typeof v, number | undefined, string][] = [
        ["age", v.age, "Enter your age"],
        [heightField, imperial ? v.height_ft : v.height_cm, "Enter your height"],
        ["weight", v.weight, "Enter your weight"],
        ["goal_weight", v.goal_weight, "Enter a goal weight"],
      ];
      let missing = false;
      for (const [path, value, message] of required) {
        if (value === undefined) {
          ctx.addIssue({ code: "custom", path: [path], message });
          missing = true;
        }
      }
      if (missing || !v.sex || !v.activity_level) return;

      const metric = toMetric(v);
      const result = bodyStepSchema.safeParse({ ...metric, goal_type, sex: v.sex, age: v.age, activity_level: v.activity_level });
      if (result.success) return;
      const pathMap: Record<string, string> = { height_cm: heightField, weight_kg: "weight", goal_weight_kg: "goal_weight" };
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? "");
        ctx.addIssue({ code: "custom", path: [pathMap[key] ?? key], message: issue.message });
      }
    });
}

function toMetric(v: { units: UnitSystem; height_ft?: number; height_in?: number; height_cm?: number; weight?: number; goal_weight?: number }) {
  const imperial = v.units === "imperial";
  return {
    height_cm: imperial ? ftInToCm(v.height_ft ?? 0, v.height_in ?? 0) : (v.height_cm ?? 0),
    weight_kg: imperial ? lbToKg(v.weight ?? 0) : (v.weight ?? 0),
    goal_weight_kg: imperial ? lbToKg(v.goal_weight ?? 0) : (v.goal_weight ?? 0),
  };
}

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "unspecified", label: "Rather not say" },
];

const ACTIVITY: { value: ActivityLevel; label: string; description: string }[] = [
  { value: "sedentary", label: "Sedentary", description: "Mostly sitting" },
  { value: "light", label: "Light", description: "Walk to class, 1–2 workouts a week" },
  { value: "moderate", label: "Moderate", description: "3–5 workouts a week" },
  { value: "very_active", label: "Very active", description: "Daily training or a student athlete" },
];

export function StepBody({
  draft,
  onNext,
  onBack,
  onFinishEarly,
}: {
  draft: OnboardingDraft;
  onNext: (patch: Partial<OnboardingDraft>) => void;
  onBack: () => void;
  /** "Calculate now, finish the rest later": validates this step, then saves a partial profile. */
  onFinishEarly?: (patch: Partial<OnboardingDraft>) => void;
}) {
  const goalType = draft.goal_type ?? "maintain";
  const schema = useMemo(() => makeSchema(goalType), [goalType]);
  const { control, register, handleSubmit, formState, setValue, getValues } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      units: draft.units,
      sex: draft.sex,
      age: draft.age,
      height_ft: draft.height_ft,
      height_in: draft.height_in,
      height_cm: draft.height_cm,
      weight: draft.weight,
      goal_weight: draft.goal_weight,
      activity_level: draft.activity_level,
    },
  });
  const v = useWatch({ control });
  const units = v.units ?? "imperial";
  const imperial = units === "imperial";
  const e = formState.errors;
  const err = (k: keyof typeof e) => e[k]?.message as string | undefined;
  const toPatch = (vals: Parameters<Parameters<typeof handleSubmit>[0]>[0]): Partial<OnboardingDraft> => ({
    ...vals,
    ...toMetric(vals),
    units: vals.units as UnitSystem,
  });

  /** Switching units converts what's already typed. */
  function switchUnits(next: UnitSystem) {
    if (next === units) return;
    const v = getValues() as { height_ft?: number; height_in?: number; height_cm?: number; weight?: number; goal_weight?: number };
    const n = (x: unknown) => toNumber(x);
    if (next === "metric") {
      const ft = n(v.height_ft);
      if (ft !== undefined) setValue("height_cm", Math.round(ftInToCm(ft, n(v.height_in) ?? 0)));
      if (n(v.weight) !== undefined) setValue("weight", lbToKg(n(v.weight)!));
      if (n(v.goal_weight) !== undefined) setValue("goal_weight", lbToKg(n(v.goal_weight)!));
    } else {
      const cm = n(v.height_cm);
      if (cm !== undefined) {
        const totalIn = Math.round(cm / 2.54);
        setValue("height_ft", Math.floor(totalIn / 12));
        setValue("height_in", totalIn % 12);
      }
      if (n(v.weight) !== undefined) setValue("weight", kgToLb(n(v.weight)!));
      if (n(v.goal_weight) !== undefined) setValue("goal_weight", kgToLb(n(v.goal_weight)!));
    }
    setValue("units", next);
  }

  // Live hint: the lowest goal weight we'll accept for this height.
  const heightCm = toMetric({ units, height_ft: toNumber(v.height_ft), height_in: toNumber(v.height_in), height_cm: toNumber(v.height_cm) }).height_cm;
  const minGoal = heightCm > 100 ? minHealthyWeightKg(heightCm) : null;
  const minGoalLabel = minGoal ? (imperial ? `${Math.ceil(minGoal * 2.20462)} lb` : `${Math.ceil(minGoal)} kg`) : null;

  return (
    <StepShell
      title="About you"
      subtitle="Used only to estimate how much you burn each day."
      formId="step-body"
      onBack={onBack}
      // Runs the same validation as Next, then saves a partial profile instead of moving on.
      secondary={onFinishEarly ? { label: "Calculate now, finish the rest later", onClick: () => void handleSubmit((vals) => onFinishEarly(toPatch(vals)))() } : undefined}
    >
      <form id="step-body" noValidate className="space-y-6" onSubmit={handleSubmit((vals) => onNext(toPatch(vals)))}>
        <div role="group" aria-label="Units" className="inline-flex rounded-md border bg-surface p-1">
          {(["imperial", "metric"] as const).map((u) => (
            <button
              key={u}
              type="button"
              aria-pressed={units === u}
              onClick={() => switchUnits(u)}
              className={cn("min-h-9 rounded-sm px-4 text-sm", units === u ? "bg-surface-2 font-semibold" : "text-muted")}
            >
              {u === "imperial" ? "ft / lb" : "cm / kg"}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <Controller
            control={control}
            name="sex"
            render={({ field }) => (
              <ChoiceCards name="sex" legend="Sex (for the calorie formula)" columns={3} options={SEX_OPTIONS} value={field.value} onChange={field.onChange} error={err("sex")} />
            )}
          />
          <details className="text-xs text-muted">
            <summary className="inline-flex min-h-11 cursor-pointer items-center gap-1">
              <Info aria-hidden className="size-3.5" /> Why we ask
            </summary>
            <p className="pb-2">
              The standard calorie formula (Mifflin-St Jeor) has a different constant for male and female bodies. If you&apos;d rather not say, we use the
              average of the two.
            </p>
          </details>
        </div>

        <Field id="age" label="Age" error={err("age")}>
          <Input {...a11y("age", err("age"))} type="number" inputMode="numeric" min={16} max={80} {...register("age")} />
        </Field>

        {imperial ? (
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">Height</legend>
            <div className="grid grid-cols-2 gap-3">
              <Field id="height_ft" label={<span className="sr-only">Feet</span>} error={err("height_ft")}>
                <div className="relative">
                  <Input {...a11y("height_ft", err("height_ft"))} type="number" inputMode="numeric" className="pr-10" {...register("height_ft")} />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">ft</span>
                </div>
              </Field>
              <Field id="height_in" label={<span className="sr-only">Inches</span>}>
                <div className="relative">
                  <Input id="height_in" type="number" inputMode="numeric" min={0} max={11} className="pr-10" {...register("height_in")} />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">in</span>
                </div>
              </Field>
            </div>
          </fieldset>
        ) : (
          <Field id="height_cm" label="Height (cm)" error={err("height_cm")}>
            <Input {...a11y("height_cm", err("height_cm"))} type="number" inputMode="numeric" {...register("height_cm")} />
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field id="weight" label={`Current weight (${imperial ? "lb" : "kg"})`} error={err("weight")}>
            <Input {...a11y("weight", err("weight"))} type="number" inputMode="decimal" {...register("weight")} />
          </Field>
          <Field
            id="goal_weight"
            label={`Goal weight (${imperial ? "lb" : "kg"})`}
            error={err("goal_weight")}
            hint={minGoalLabel ? `At least ${minGoalLabel} for your height` : undefined}
          >
            <Input {...a11y("goal_weight", err("goal_weight"), !!minGoalLabel)} type="number" inputMode="decimal" {...register("goal_weight")} />
          </Field>
        </div>

        <Controller
          control={control}
          name="activity_level"
          render={({ field }) => (
            <ChoiceCards name="activity_level" legend="How active are you?" options={ACTIVITY} value={field.value} onChange={field.onChange} error={err("activity_level")} />
          )}
        />
      </form>
    </StepShell>
  );
}
