"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { useProfile } from "@/lib/hooks/use-profile";
import { KCAL_PER_G } from "@/lib/targets";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

const MACROS = [
  { key: "target_protein_g", label: "Protein", color: "bg-protein", min: 30, max: 300 },
  { key: "target_carbs_g", label: "Carbs", color: "bg-carbs", min: 30, max: 600 },
  { key: "target_fat_g", label: "Fat", color: "bg-fat", min: 20, max: 200 },
] as const;

type Key = (typeof MACROS)[number]["key"];

/** Targets with sliders. Calories follow the macros (4/4/9 kcal per gram). */
export function TargetsEditor({ profile }: { profile: Profile }) {
  const { setProfile } = useProfile();
  const toast = useToast();
  const initial = { target_protein_g: profile.target_protein_g, target_carbs_g: profile.target_carbs_g, target_fat_g: profile.target_fat_g };
  const [draft, setDraft] = useState<Record<Key, number>>(initial);
  const [saving, setSaving] = useState(false);
  const changed = MACROS.some((m) => draft[m.key] !== initial[m.key]);
  // Show the saved target until a slider moves (macro rounding can be off by a few calories).
  const calories = changed
    ? Math.round(draft.target_protein_g * KCAL_PER_G.protein + draft.target_carbs_g * KCAL_PER_G.carbs + draft.target_fat_g * KCAL_PER_G.fat)
    : profile.target_calories;

  async function save() {
    setSaving(true);
    try {
      setProfile(await api.updateTargets({ target_calories: calories, ...draft }));
      toast(`Targets updated: ${calories.toLocaleString()} cal`);
    } catch (e) {
      toast(`Couldn't save. ${errorMessage(e)}`, { tone: "error" });
    }
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      <p>
        <span className="font-display text-3xl font-bold tabular-nums">{calories.toLocaleString()}</span>{" "}
        <span className="text-sm text-muted">calories a day</span>
      </p>
      {MACROS.map((m) => (
        <div key={m.key}>
          <div className="flex justify-between text-sm">
            <label htmlFor={`t-${m.key}`} className="flex items-center gap-1.5 font-medium">
              <span aria-hidden className={cn("size-2 rounded-full", m.color)} />
              {m.label}
            </label>
            <span className="tabular-nums text-muted">{draft[m.key]} g</span>
          </div>
          <input
            id={`t-${m.key}`}
            type="range"
            min={m.min}
            max={m.max}
            step={5}
            value={draft[m.key]}
            onChange={(e) => setDraft({ ...draft, [m.key]: Number(e.target.value) })}
            className="mt-2 w-full accent-primary"
          />
        </div>
      ))}
      <div className="flex gap-2">
        <Button onClick={save} disabled={!changed || saving}>
          {saving ? "Saving…" : "Save targets"}
        </Button>
        {changed ? (
          <Button variant="ghost" onClick={() => setDraft(initial)} disabled={saving}>
            Undo changes
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted">Estimates, not medical advice. Editing your details below recalculates these.</p>
    </div>
  );
}
