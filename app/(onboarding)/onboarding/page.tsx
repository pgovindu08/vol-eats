"use client";

import { Suspense, use, useEffect, useRef, useState } from "react";
import { browser } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { ResumeCard } from "@/components/onboarding/resume-card";
import { StepBody } from "@/components/onboarding/step-body";
import { StepDiet } from "@/components/onboarding/step-diet";
import { StepGoal } from "@/components/onboarding/step-goal";
import { StepPlan } from "@/components/onboarding/step-plan";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { findMealPlan } from "@/lib/meal-plans";
import { clearDraft, emptyDraft, hasProgress, loadDraft, saveDraft, type OnboardingDraft } from "@/lib/onboarding-draft";
import { inferLivingSituation } from "@/lib/profile";
import { getSession, signOut } from "@/lib/session";
import type { ProfileInput } from "@/lib/types";
import { SCHOOL } from "@/mock/locations";

const STEPS = 4;

function toProfileInput(d: OnboardingDraft, email: string): ProfileInput {
  const plan = findMealPlan(d.meal_plan_name);
  return {
    email,
    display_name: null,
    school_id: SCHOOL.id, // TODO(schema): single-school for the hackathon
    goal_type: d.goal_type ?? "maintain",
    goal_text: d.goal_text?.trim() || null,
    sex: d.sex ?? "unspecified",
    age: d.age!,
    height_cm: d.height_cm!,
    weight_kg: d.weight_kg!,
    goal_weight_kg: d.goal_weight_kg!,
    activity_level: d.activity_level ?? "light",
    diet_tags: d.diet_tags,
    allergens: d.allergens,
    meal_plan_name: d.meal_plan_name ?? null,
    meal_plan_type: plan?.type ?? "none",
    dining_dollars_balance: d.dining_dollars_balance ?? null,
    swipes_remaining: d.swipes_remaining ?? null,
    weekly_food_budget_usd: d.weekly_food_budget_usd ?? null,
    // Step 4 asks these in phase 2; until then, infer from the meal plan.
    living_situation: d.living_situation ?? inferLivingSituation(plan?.type ?? "none"),
    favorite_location_ids: d.favorite_location_ids ?? [],
    kitchen_access: d.kitchen_access ?? null,
    onboarding_status: "complete",
  };
}

/** Step from `?step=N` (1-based in the URL), limited to steps already reached. */
function stepFromUrl(raw: string | null, furthest: number) {
  const n = Number(raw);
  if (!raw || !Number.isInteger(n) || n < 1) return Math.min(furthest, STEPS - 1);
  return Math.min(n - 1, furthest, STEPS - 1);
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<WizardSkeleton />}>
      <Wizard />
    </Suspense>
  );
}

function WizardSkeleton() {
  return (
    <div className="space-y-4 pt-4" aria-busy="true">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-24" />
      <Skeleton className="h-24" />
    </div>
  );
}

function Wizard() {
  // The draft lives in localStorage and the step in the URL, so render in the browser only.
  use(browser("The onboarding draft is stored in localStorage."));
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email] = useState(() => getSession()?.email ?? null);
  const [draft, setDraft] = useState<OnboardingDraft>(() => (email ? loadDraft(email) : emptyDraft()));
  const [showResume, setShowResume] = useState(() => hasProgress(draft));
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Steps pushed onto history in this visit, so in-app Back can use the real back stack.
  const pushed = useRef(0);

  const step = stepFromUrl(searchParams.get("step"), draft.furthest);
  const urlStep = searchParams.get("step");

  // No session → login. Already finished onboarding → Today (never restart a finished setup).
  // Effects re-run when Next reveals this preserved page, so this also catches a different
  // user having signed in since: reload rather than show the previous person's draft.
  useEffect(() => {
    const current = getSession()?.email ?? null;
    if (current !== email) {
      window.location.reload();
      return;
    }
    if (!email) {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    api
      .getProfile()
      .then((p) => {
        if (!cancelled && p?.onboarding_status === "complete") router.replace("/today");
      })
      .catch(() => {}); // offline is fine: keep onboarding usable
    return () => {
      cancelled = true;
    };
  }, [email, router]);

  // Keep the URL in sync (e.g. resuming lands on the saved step, or ?step=9 is clamped).
  useEffect(() => {
    if (urlStep !== String(step + 1)) router.replace(`/onboarding?step=${step + 1}`, { scroll: false });
  }, [urlStep, step, router]);

  if (!email) return <WizardSkeleton />;

  function update(patch: Partial<OnboardingDraft>) {
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      saveDraft(email!, next);
      return next;
    });
  }

  function goNext(to: number, patch: Partial<OnboardingDraft>) {
    update({ ...patch, furthest: Math.max(draft.furthest, to) });
    setShowResume(false);
    pushed.current += 1;
    router.push(`/onboarding?step=${to + 1}`);
  }

  function goBack(to: number) {
    setShowResume(false);
    // Use real history when we got here by pushing, so the phone's back gesture and this button agree.
    if (pushed.current > 0) {
      pushed.current -= 1;
      router.back();
    } else {
      router.replace(`/onboarding?step=${to + 1}`);
    }
  }

  function startOver() {
    clearDraft(email!);
    setDraft(emptyDraft());
    setShowResume(false);
    pushed.current = 0;
    router.replace("/onboarding?step=1");
  }

  async function finish(patch: Partial<OnboardingDraft>) {
    const full = { ...draft, ...patch };
    update(patch); // saved first, so a failed submit never loses answers
    setBusy(true);
    setSubmitError(null);
    try {
      await api.saveProfile(toProfileInput(full, email!));
      clearDraft(email!);
      router.push("/onboarding/targets");
    } catch {
      setSubmitError("Couldn't save. Your answers are kept, so try again.");
      setBusy(false);
    }
  }

  return (
    <>
      {showResume ? <ResumeCard step={step + 1} total={STEPS} onContinue={() => setShowResume(false)} onStartOver={startOver} /> : null}

      <div className="pb-6">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted">
            Step {step + 1} of {STEPS}
          </p>
          {/* Shared phones: switch accounts mid-setup. Your own draft stays saved for next time. */}
          <button
            type="button"
            onClick={signOut}
            className="-my-3 min-h-11 px-1 text-xs text-muted underline underline-offset-4 hover:text-text"
          >
            Not you? Sign out
          </button>
        </div>
        <div
          role="progressbar"
          aria-label="Onboarding progress"
          aria-valuemin={1}
          aria-valuemax={STEPS}
          aria-valuenow={step + 1}
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2"
        >
          <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${((step + 1) / STEPS) * 100}%` }} />
        </div>
      </div>

      {/* key: remount the step's form when its saved answers change (e.g. after Start over). */}
      {step === 0 && <StepGoal key={`0-${draft.updated_at}`} draft={draft} onNext={(p) => goNext(1, p)} />}
      {step === 1 && <StepBody key={`1-${draft.updated_at}`} draft={draft} onNext={(p) => goNext(2, p)} onBack={() => goBack(0)} />}
      {step === 2 && <StepDiet key={`2-${draft.updated_at}`} draft={draft} onNext={(p) => goNext(3, p)} onBack={() => goBack(1)} />}
      {step === 3 && <StepPlan key={`3-${draft.updated_at}`} draft={draft} onNext={finish} onBack={() => goBack(2)} busy={busy} submitError={submitError} />}
    </>
  );
}
