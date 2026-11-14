"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Field, Input, a11y } from "@/components/ui/field";
import { findMealPlan } from "@/lib/meal-plans";
import type { OnboardingDraft } from "@/lib/onboarding-draft";
import { planHasDiningDollars } from "@/lib/onboarding-flow";
import { toNumber } from "@/lib/utils";
import { StepShell } from "./step-shell";

const money = z.preprocess(toNumber, z.number().min(0, "Can't be negative").max(10000, "That seems too high").optional());

/** Only the balances that apply to this student's plan. The meal plan itself is picked in the previous step. */
export function StepMoney({ draft, onNext, onBack }: { draft: OnboardingDraft; onNext: (patch: Partial<OnboardingDraft>) => void; onBack: () => void }) {
  const hasDD = planHasDiningDollars(draft.meal_plan_name);
  const isBlock = !!findMealPlan(draft.meal_plan_name)?.block;
  const asksBudget = draft.living_situation !== "off_campus_cooking"; // cooks gave it already

  const schema = z
    .object({ dining_dollars_balance: money, swipes_remaining: z.preprocess(toNumber, z.number().int("Whole number").min(0, "Can't be negative").max(500).optional()), weekly_food_budget_usd: money })
    .superRefine((v, ctx) => {
      if (isBlock && v.swipes_remaining === undefined) ctx.addIssue({ code: "custom", path: ["swipes_remaining"], message: "How many swipes do you have left?" });
    });

  const { register, handleSubmit, formState } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      dining_dollars_balance: draft.dining_dollars_balance ?? undefined,
      swipes_remaining: draft.swipes_remaining ?? undefined,
      weekly_food_budget_usd: draft.weekly_food_budget_usd ?? undefined,
    },
  });
  const e = formState.errors;

  return (
    <StepShell title="Money" subtitle="So budget tips match what you actually have." formId="step-money" onBack={onBack}>
      <form
        id="step-money"
        noValidate
        className="space-y-6"
        onSubmit={handleSubmit((v) =>
          onNext({
            dining_dollars_balance: hasDD ? (v.dining_dollars_balance ?? null) : null,
            swipes_remaining: isBlock ? (v.swipes_remaining ?? null) : null,
            weekly_food_budget_usd: asksBudget ? (v.weekly_food_budget_usd ?? null) : draft.weekly_food_budget_usd,
          }),
        )}
      >
        {hasDD ? (
          <Field id="dining_dollars_balance" label="Dining dollars balance right now ($)" hint="Check the VolCard app. A rough number is fine." error={e.dining_dollars_balance?.message}>
            <Input {...a11y("dining_dollars_balance", e.dining_dollars_balance?.message, true)} type="number" inputMode="decimal" step="0.01" placeholder="0.00" {...register("dining_dollars_balance")} />
          </Field>
        ) : null}

        {isBlock ? (
          <Field id="swipes_remaining" label="Swipes remaining" error={e.swipes_remaining?.message}>
            <Input {...a11y("swipes_remaining", e.swipes_remaining?.message)} type="number" inputMode="numeric" {...register("swipes_remaining")} />
          </Field>
        ) : null}

        {asksBudget ? (
          <Field id="weekly_food_budget_usd" label="Weekly off-campus food budget ($, optional)" hint="Groceries, takeout, anything not on your plan." error={e.weekly_food_budget_usd?.message}>
            <Input {...a11y("weekly_food_budget_usd", e.weekly_food_budget_usd?.message, true)} type="number" inputMode="decimal" placeholder="0" {...register("weekly_food_budget_usd")} />
          </Field>
        ) : null}
      </form>
    </StepShell>
  );
}
