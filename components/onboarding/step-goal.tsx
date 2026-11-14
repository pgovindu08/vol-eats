"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChoiceCards } from "@/components/ui/choice";
import { Field, Textarea } from "@/components/ui/field";
import { goalTypeSchema } from "@/lib/schemas";
import type { OnboardingDraft } from "@/lib/onboarding-draft";
import type { GoalType } from "@/lib/types";
import { StepShell } from "./step-shell";

const schema = z.object({
  goal_type: goalTypeSchema.optional().refine((v) => v !== undefined, "Pick a goal"),
  goal_text: z.string().trim().max(280, "Keep it under 280 characters"),
});

const GOALS: { value: GoalType; label: string; description: string }[] = [
  { value: "lose_fat", label: "Lose fat", description: "Eat a little less, keep protein high." },
  { value: "build_muscle", label: "Build muscle", description: "Eat a little more to fuel your lifts." },
  { value: "maintain", label: "Maintain & eat healthier", description: "Same weight, better choices." },
];

export function StepGoal({
  draft,
  onNext,
  onSkip,
}: {
  draft: OnboardingDraft;
  onNext: (patch: Partial<OnboardingDraft>) => void;
  /** "Set up later": go straight into the app with rough targets. */
  onSkip?: (patch: Partial<OnboardingDraft>) => void;
}) {
  const { control, register, handleSubmit, formState, getValues } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { goal_type: draft.goal_type, goal_text: draft.goal_text ?? "" },
  });

  return (
    <StepShell
      title="What's your goal?"
      subtitle="We'll set your daily calories and macros around it."
      formId="step-goal"
      // No validation: skipping should always work. Keep whatever they already picked.
      secondary={onSkip ? { label: "Set up later", onClick: () => onSkip({ goal_type: getValues("goal_type"), goal_text: getValues("goal_text") }) } : undefined}
    >
      <form id="step-goal" noValidate className="space-y-6" onSubmit={handleSubmit((v) => onNext({ goal_type: v.goal_type, goal_text: v.goal_text }))}>
        <Controller
          control={control}
          name="goal_type"
          render={({ field }) => (
            <ChoiceCards
              name="goal_type"
              legend="Goal"
              options={GOALS}
              value={field.value}
              onChange={field.onChange}
              error={formState.errors.goal_type?.message}
            />
          )}
        />
        <Field id="goal_text" label="Describe it in your own words (optional)" hint="Helps the AI fine-tune your plan." error={formState.errors.goal_text?.message}>
          <Textarea id="goal_text" rows={3} placeholder="170 lbs, lift 4x/week, bulking, vegetarian" {...register("goal_text")} />
        </Field>
      </form>
    </StepShell>
  );
}
