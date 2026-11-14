"use client";

import { useState } from "react";
import { ChipGroup } from "@/components/ui/choice";
import { ALLERGEN_LABELS } from "@/lib/diet";
import type { OnboardingDraft } from "@/lib/onboarding-draft";
import type { Allergen, DietTag } from "@/lib/types";
import { StepShell } from "./step-shell";

type DietChip = DietTag | "none";

const DIETS: { value: DietChip; label: string }[] = [
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "halal", label: "Halal" },
  { value: "gluten_free", label: "Gluten-free" },
  { value: "dairy_free", label: "Dairy-free" },
  { value: "no_pork", label: "No pork" },
  { value: "none", label: "No restrictions" },
];

// Same names everywhere (chips, Review, Menus) via ALLERGEN_LABELS.
const ALLERGEN_CHOICES: Allergen[] = ["milk", "eggs", "fish", "shellfish", "soy", "wheat", "sesame", "peanut", "tree_nuts"];
const ALLERGENS = ALLERGEN_CHOICES.map((value) => ({ value, label: ALLERGEN_LABELS[value] }));

// No validation needed (everything is optional), so this step uses plain state.
export function StepDiet({
  draft,
  onNext,
  onBack,
}: {
  draft: OnboardingDraft;
  onNext: (patch: Partial<OnboardingDraft>) => void;
  onBack: () => void;
}) {
  const [diets, setDiets] = useState<DietChip[]>(draft.no_restrictions ? ["none"] : draft.diet_tags);
  const [allergens, setAllergens] = useState<Allergen[]>(draft.allergens);

  // "No restrictions" is exclusive with the other diet chips.
  function changeDiets(next: DietChip[]) {
    const added = next.find((d) => !diets.includes(d));
    if (added === "none") setDiets(["none"]);
    else setDiets(next.filter((d) => d !== "none"));
  }

  return (
    <StepShell title="How do you eat?" subtitle="We'll only suggest food that fits." formId="step-diet" onBack={onBack}>
      <form
        id="step-diet"
        className="space-y-8"
        onSubmit={(e) => {
          e.preventDefault();
          onNext({
            diet_tags: diets.filter((d): d is DietTag => d !== "none"),
            no_restrictions: diets.includes("none"),
            allergens,
          });
        }}
      >
        <ChipGroup legend="Diet" options={DIETS} value={diets} onChange={changeDiets} />
        <ChipGroup
          legend="Allergies"
          hint="UTK dining halls are nut-free, but retail spots may not be."
          options={ALLERGENS}
          value={allergens}
          onChange={setAllergens}
        />
      </form>
    </StepShell>
  );
}
