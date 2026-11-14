"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChipGroup, ChoiceCards } from "@/components/ui/choice";
import { Field, Select, a11y } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocations } from "@/lib/hooks/use-locations";
import { MEAL_PLANS } from "@/lib/meal-plans";
import type { OnboardingDraft } from "@/lib/onboarding-draft";
import type { KitchenAccess, LivingSituation } from "@/lib/types";
import { StepShell } from "./step-shell";

const NO_PLAN = "No meal plan";

const schema = z
  .object({
    living_situation: z.enum(["on_campus", "off_campus_plan", "off_campus_cooking"]).optional(),
    meal_plan_name: z.string(),
    favorite_location_ids: z.array(z.string()),
    kitchen_access: z.enum(["full", "microwave", "none"]).optional(),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (!v.living_situation) return issue("living_situation", "Pick where you live");
    if (v.living_situation === "on_campus" && !v.meal_plan_name) issue("meal_plan_name", "Pick your meal plan");
    if (v.living_situation === "off_campus_plan" && (!v.meal_plan_name || v.meal_plan_name === NO_PLAN)) issue("meal_plan_name", "Pick your meal plan");
    if (v.living_situation !== "on_campus" && !v.kitchen_access) issue("kitchen_access", "Pick your kitchen setup");
  });

const LIVING: { value: LivingSituation; label: string; description: string }[] = [
  { value: "on_campus", label: "On campus", description: "Dorm with a meal plan" },
  { value: "off_campus_plan", label: "Off campus, with a meal plan", description: "Apartment, but you still eat on campus" },
  { value: "off_campus_cooking", label: "Off campus, cooking for myself", description: "You buy your own groceries" },
];

const KITCHEN: { value: KitchenAccess; label: string; description: string }[] = [
  { value: "full", label: "Full kitchen", description: "Stove, oven, fridge" },
  { value: "microwave", label: "Microwave and fridge", description: "No stove" },
  { value: "none", label: "No kitchen", description: "Mostly eat out" },
];

const PLAN_GROUPS = ["Freshman", "Upperclass", "Dining dollars only"] as const;

export function StepLiving({
  draft,
  onNext,
  onBack,
}: {
  draft: OnboardingDraft;
  onNext: (patch: Partial<OnboardingDraft>) => void;
  onBack: () => void;
}) {
  const { control, register, handleSubmit, formState, setValue } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      living_situation: draft.living_situation,
      meal_plan_name: draft.meal_plan_name ?? "",
      favorite_location_ids: draft.favorite_location_ids ?? [],
      kitchen_access: draft.kitchen_access ?? undefined,
    },
  });
  const living = useWatch({ control, name: "living_situation" });
  const planName = useWatch({ control, name: "meal_plan_name" });
  // "No meal plan" is rare on campus, so it hides behind a link.
  const [showNoPlan, setShowNoPlan] = useState(planName === NO_PLAN);
  const e = formState.errors;
  const err = (k: keyof typeof e) => e[k]?.message as string | undefined;

  return (
    <StepShell title="Where do you live and eat?" subtitle="So we only ask what matters to you." formId="step-living" onBack={onBack}>
      <form
        id="step-living"
        noValidate
        className="space-y-6"
        onSubmit={handleSubmit((v) => {
          const cooking = v.living_situation === "off_campus_cooking";
          onNext({
            living_situation: v.living_situation,
            meal_plan_name: cooking ? undefined : v.meal_plan_name || undefined,
            favorite_location_ids: cooking ? [] : v.favorite_location_ids,
            kitchen_access: v.living_situation === "on_campus" ? null : (v.kitchen_access ?? null),
          });
        })}
      >
        <Controller
          control={control}
          name="living_situation"
          render={({ field }) => (
            <ChoiceCards name="living_situation" legend="Where do you live?" options={LIVING} value={field.value} onChange={field.onChange} error={err("living_situation")} />
          )}
        />

        {living === "on_campus" || living === "off_campus_plan" ? (
          <>
            <Field id="meal_plan_name" label="Meal plan" error={err("meal_plan_name")}>
              <Select {...a11y("meal_plan_name", err("meal_plan_name"))} {...register("meal_plan_name")}>
                <option value="" disabled>
                  Choose your plan
                </option>
                {PLAN_GROUPS.map((g) => (
                  <optgroup key={g} label={g}>
                    {MEAL_PLANS.filter((p) => p.group === g).map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
                {living === "on_campus" && showNoPlan ? <option value={NO_PLAN}>{NO_PLAN}</option> : null}
              </Select>
            </Field>
            {living === "on_campus" && !showNoPlan ? (
              <button
                type="button"
                className="-mt-4 min-h-11 text-sm text-muted underline underline-offset-4"
                onClick={() => {
                  setShowNoPlan(true);
                  setValue("meal_plan_name", NO_PLAN);
                }}
              >
                I don&apos;t have a meal plan
              </button>
            ) : null}
            <FavoriteHalls control={control} />
          </>
        ) : null}

        {living ? (
          <p className="-mt-2 text-sm text-muted">Dining dollars, swipes and budgets can be added on the Budget tab anytime.</p>
        ) : null}

        {living === "off_campus_plan" || living === "off_campus_cooking" ? (
          <Controller
            control={control}
            name="kitchen_access"
            render={({ field }) => (
              <ChoiceCards name="kitchen_access" legend="Your kitchen" options={KITCHEN} value={field.value} onChange={field.onChange} error={err("kitchen_access")} />
            )}
          />
        ) : null}
      </form>
    </StepShell>
  );
}

/** Dining hall chips. The first one picked becomes the default on Plates and Menus. Optional. */
function FavoriteHalls({ control }: { control: ReturnType<typeof useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>>["control"] }) {
  const { locations, error, reload } = useLocations();
  const halls = locations?.filter((l) => l.kind === "dining_hall") ?? null;

  if (error) {
    return (
      <p className="text-sm text-muted">
        Couldn&apos;t load dining halls.{" "}
        <button type="button" onClick={reload} className="min-h-11 font-medium text-text underline underline-offset-4">
          Try again
        </button>
      </p>
    );
  }
  if (!halls) return <Skeleton className="h-20" />;

  return (
    <Controller
      control={control}
      name="favorite_location_ids"
      render={({ field }) => (
        <ChipGroup
          legend="Favorite dining hall (optional)"
          hint="Plate picks will open here first."
          options={halls.map((h) => ({ value: h.id, label: h.name.replace(" Dining Hall", "") }))}
          value={field.value}
          onChange={field.onChange}
        />
      )}
    />
  );
}
