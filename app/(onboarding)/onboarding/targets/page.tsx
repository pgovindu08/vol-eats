"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { api, withAiFallback, type AiResult } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { genericTargetsExplanation } from "@/lib/fallbacks";
import { useCountUp } from "@/lib/hooks/use-count-up";
import { targetsOf } from "@/lib/macros";
import { getSession } from "@/lib/session";
import { KCAL_PER_G } from "@/lib/targets";
import type { Macros, Profile, TargetsExplanation } from "@/lib/types";
import { cn } from "@/lib/utils";

const MACROS = [
  { key: "protein_g", label: "Protein", color: "bg-protein", text: "text-protein", kcal: KCAL_PER_G.protein, max: 300 },
  { key: "carbs_g", label: "Carbs", color: "bg-carbs", text: "text-carbs", kcal: KCAL_PER_G.carbs, max: 600 },
  { key: "fat_g", label: "Fat", color: "bg-fat", text: "text-fat", kcal: KCAL_PER_G.fat, max: 200 },
] as const;

type MacroKey = (typeof MACROS)[number]["key"];

const caloriesFrom = (m: Pick<Macros, MacroKey>) => m.protein_g * KCAL_PER_G.protein + m.carbs_g * KCAL_PER_G.carbs + m.fat_g * KCAL_PER_G.fat;

export default function TargetsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const [ai, setAi] = useState<AiResult<TargetsExplanation> | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [draft, setDraft] = useState<Pick<Macros, MacroKey> | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!getSession()) {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    api
      .getProfile()
      .then((p) => {
        if (cancelled) return;
        if (!p) return router.replace("/onboarding");
        setProfile(p);
        // Never block on the AI: after 5 s (or an error) we show the formula numbers with a generic note.
        withAiFallback(api.ai.targets(p), () => genericTargetsExplanation(targetsOf(p))).then((r) => !cancelled && setAi(r));
      })
      .catch((e: unknown) => !cancelled && setLoadError(e));
    return () => {
      cancelled = true;
    };
  }, [router, attempt]);

  const targets = profile ? targetsOf(profile) : null;
  const shown = adjusting && draft ? { ...draft, calories: caloriesFrom(draft) } : targets;
  const calories = useCountUp(targets?.calories ?? 0);

  async function saveAdjusted() {
    if (!draft) return;
    setSaving(true);
    setSaveError(null);
    try {
      await api.updateTargets({
        target_calories: Math.round(caloriesFrom(draft)),
        target_protein_g: draft.protein_g,
        target_carbs_g: draft.carbs_g,
        target_fat_g: draft.fat_g,
      });
      router.push("/today");
      // Next keeps this page in memory; don't leave it stuck on "Saving…".
      setSaving(false);
      setAdjusting(false);
    } catch (e) {
      setSaveError(errorMessage(e));
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <div className="pt-10">
        <ErrorState
          error={loadError}
          onRetry={() => {
            setLoadError(null);
            setAttempt((a) => a + 1);
          }}
        />
      </div>
    );
  }

  if (!shown || !targets) {
    return (
      <div className="space-y-4 pt-10" aria-busy="true">
        <Skeleton className="mx-auto h-16 w-40" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-20" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col pb-6">
      <div className="flex-1 space-y-6">
        <section aria-labelledby="cal-heading" className="pt-6 text-center">
          <h1 id="cal-heading" className="text-sm font-medium text-muted">
            Your daily target
          </h1>
          <p className="mt-1 font-display text-6xl font-bold tabular-nums text-text">
            {(adjusting ? Math.round(shown.calories) : calories).toLocaleString()}
          </p>
          <p className="text-sm text-muted">calories a day</p>
        </section>

        <ul className="grid grid-cols-3 gap-3">
          {MACROS.map((m) => (
            <li key={m.key} className="rounded-lg border bg-surface p-3 text-center shadow-card">
              <span aria-hidden className={cn("mx-auto block h-1 w-8 rounded-full", m.color)} />
              <p className="mt-2 text-2xl font-bold tabular-nums">
                {Math.round(shown[m.key])}
                <span className="text-sm font-medium text-muted">g</span>
              </p>
              <p className="text-xs text-muted">{m.label}</p>
            </li>
          ))}
        </ul>

        {adjusting && draft ? (
          <section aria-label="Adjust your macros" className="space-y-5 rounded-lg border bg-surface p-4">
            {MACROS.map((m) => (
              <div key={m.key}>
                <div className="flex justify-between text-sm">
                  <label htmlFor={`adj-${m.key}`} className="font-medium">
                    {m.label}
                  </label>
                  <span className="tabular-nums text-muted">{draft[m.key]} g</span>
                </div>
                <input
                  id={`adj-${m.key}`}
                  type="range"
                  min={m.key === "fat_g" ? 20 : 30}
                  max={m.max}
                  step={5}
                  value={draft[m.key]}
                  onChange={(e) => setDraft({ ...draft, [m.key]: Number(e.target.value) })}
                  className="mt-2 w-full accent-primary"
                />
              </div>
            ))}
            <p className="text-xs text-muted">Calories update from your macros (4 per gram of protein or carbs, 9 per gram of fat).</p>
          </section>
        ) : (
          <section aria-labelledby="why-heading" className="rounded-lg border bg-surface p-4">
            <h2 id="why-heading" className="flex items-center gap-1.5 text-sm font-semibold">
              <Sparkles aria-hidden className="size-4 text-primary" /> Why these numbers
            </h2>
            {ai ? (
              <>
                <p className="mt-2 text-sm leading-relaxed">{ai.data.explanation}</p>
                {ai.data.adjustments?.length ? (
                  <ul className="mt-3 space-y-1 text-sm">
                    {ai.data.adjustments.map((a) => (
                      <li key={a.field} className="text-muted">
                        <span className="font-medium text-text">{a.field.replace(/_g$/, "").replace("_", " ")}</span>: {a.from} → {a.to}. {a.why}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {ai.offline ? (
                  <p className="mt-3 flex items-center gap-1 text-xs text-muted">
                    <WifiOff aria-hidden className="size-3.5" /> Offline estimate
                  </p>
                ) : null}
              </>
            ) : (
              <div className="mt-3 space-y-2" aria-busy="true" aria-label="Loading explanation">
                <Skeleton className="h-3.5" />
                <Skeleton className="h-3.5" />
                <Skeleton className="h-3.5 w-2/3" />
              </div>
            )}
          </section>
        )}
      </div>

      <div className="mt-8 space-y-3">
        {saveError ? (
          <p role="alert" className="text-center text-sm text-danger">
            {saveError}
          </p>
        ) : null}
        {adjusting ? (
          <>
            <Button size="lg" block onClick={saveAdjusted} disabled={saving}>
              {saving ? "Saving…" : "Save my targets"}
            </Button>
            <Button variant="ghost" block onClick={() => setAdjusting(false)} disabled={saving}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button size="lg" block onClick={() => router.push("/today")}>
              Looks good
            </Button>
            <Button
              variant="secondary"
              block
              onClick={() => {
                setDraft({ protein_g: targets.protein_g, carbs_g: targets.carbs_g, fat_g: targets.fat_g });
                setAdjusting(true);
              }}
            >
              Adjust
            </Button>
          </>
        )}
        <p className="pt-2 text-center text-xs text-muted">Estimates, not medical advice.</p>
      </div>
    </div>
  );
}
