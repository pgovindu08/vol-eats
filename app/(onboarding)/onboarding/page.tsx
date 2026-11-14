"use client";

import { Suspense, use, useEffect, useRef, useState } from "react";
import { browser } from "react-dom";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ResumeCard } from "@/components/onboarding/resume-card";
import { StepBody } from "@/components/onboarding/step-body";
import { StepDiet } from "@/components/onboarding/step-diet";
import { StepGoal } from "@/components/onboarding/step-goal";
import { StepLiving } from "@/components/onboarding/step-living";
import { StepReview } from "@/components/onboarding/step-review";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { clearDraft, emptyDraft, hasProgress, loadDraft, saveDraft, type OnboardingDraft } from "@/lib/onboarding-draft";
import { buildProfileInput, nextStep, profileToDraft, profileToFullDraft, resolveStep, stepIndex, stepPosition, visibleSteps, type MoneyFields, type StepId } from "@/lib/onboarding-flow";
import { getSession, signOut } from "@/lib/session";
import { getUnits } from "@/lib/preferences";
import { NextLabelContext } from "@/components/onboarding/step-shell";
import type { OnboardingStatus } from "@/lib/types";

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
  const [draft, setDraft] = useState<OnboardingDraft>(() => {
    const d = email ? loadDraft(email) : emptyDraft();
    // New drafts start in the units chosen in Profile → Settings.
    return hasProgress(d) ? d : { ...d, units: getUnits() };
  });
  const [showResume, setShowResume] = useState(() => hasProgress(draft));
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Steps pushed onto history in this visit, so in-app Back can use the real back stack.
  const pushed = useRef(0);
  // Balances the student already entered on Budget (partial/skipped profiles), kept when onboarding saves.
  const [savedMoney, setSavedMoney] = useState<MoneyFields | null>(null);

  // Editing one section from Profile: load the saved answers, save straight back, return to Profile.
  const fromProfile = searchParams.get("return") === "profile";
  const [profileLoaded, setProfileLoaded] = useState(!fromProfile);

  const step = resolveStep(searchParams.get("step"), draft);
  const editing = searchParams.get("edit") === "1";
  const { position, total } = stepPosition(step, draft);
  const query = searchParams.toString();

  useEffect(() => {
    // Effects re-run when Next reveals this preserved page, so this also catches a different
    // user having signed in since: reload rather than show the previous person's draft.
    if ((getSession()?.email ?? null) !== email) {
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
        if (cancelled || !p) return;
        if (fromProfile) {
          setSavedMoney({ dining_dollars_balance: p.dining_dollars_balance, swipes_remaining: p.swipes_remaining, weekly_food_budget_usd: p.weekly_food_budget_usd });
          setDraft(profileToFullDraft(p, getUnits()));
          setShowResume(false);
          setProfileLoaded(true);
          return;
        }
        // Finished onboarding → never restart it.
        if (p.onboarding_status === "complete") return router.replace("/today");
        setSavedMoney({ dining_dollars_balance: p.dining_dollars_balance, swipes_remaining: p.swipes_remaining, weekly_food_budget_usd: p.weekly_food_budget_usd });
        // "Continue setup" with no local draft (cleared storage, other device): rebuild from the saved
        // profile and jump to its first unfinished step. Storage is the source of truth here because
        // every change is saved there immediately.
        if (hasProgress(loadDraft(email))) return;
        const rebuilt = profileToDraft(p);
        saveDraft(email, rebuilt);
        setDraft(rebuilt);
        setShowResume(true);
        router.replace(`/onboarding?step=${resolveStep(null, rebuilt)}`, { scroll: false });
      })
      .catch(() => {}); // offline is fine: keep onboarding usable
    return () => {
      cancelled = true;
    };
    // fromProfile is read once from the URL when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, router]);

  // Keep the URL in sync (resuming lands on the saved step; unknown or future steps are corrected).
  useEffect(() => {
    if (!profileLoaded) return; // wait for the saved answers, or the requested step would be "corrected" away
    const params = new URLSearchParams(query);
    if (params.get("step") === step) return;
    params.set("step", step);
    router.replace(`/onboarding?${params}`, { scroll: false });
  }, [query, step, router, profileLoaded]);

  if (!email || !profileLoaded) return <WizardSkeleton />;

  function save(next: OnboardingDraft) {
    setDraft(next);
    saveDraft(email!, next);
  }

  function push(to: StepId, edit = false) {
    setShowResume(false);
    setSubmitError(null);
    pushed.current += 1;
    router.push(`/onboarding?step=${to}${edit ? "&edit=1" : ""}`);
  }

  function goNext(current: StepId, patch: Partial<OnboardingDraft>) {
    if (fromProfile) return void submit("complete", patch, "/profile");
    const merged = { ...draft, ...patch };
    // Editing from Review returns to Review.
    const to = editing ? "review" : (nextStep(current, merged) ?? "review");
    save({ ...merged, furthest: Math.max(merged.furthest, stepIndex(to)) });
    push(to);
  }

  function goBack() {
    if (fromProfile) return router.push("/profile");
    setShowResume(false);
    if (editing) return push("review");
    const visible = visibleSteps(draft);
    const prev = visible[visible.indexOf(step) - 1] ?? "goal";
    // Use real history when we got here by pushing, so the phone's back gesture and this button agree.
    if (pushed.current > 0) {
      pushed.current -= 1;
      router.back();
    } else {
      router.replace(`/onboarding?step=${prev}`);
    }
  }

  function startOver() {
    clearDraft(email!);
    setDraft(emptyDraft());
    setShowResume(false);
    pushed.current = 0;
    router.replace("/onboarding?step=goal");
  }

  /** Saves the profile. "complete" clears the draft; partial/skipped keep it so Continue setup resumes. */
  async function submit(status: OnboardingStatus, patch: Partial<OnboardingDraft>, then: string) {
    const full = { ...draft, ...patch };
    // "Finish later" after the body step: Continue setup should reopen at the first unanswered step.
    if (status === "partial") full.furthest = Math.max(full.furthest, stepIndex("diet"));
    save(full); // saved first, so a failed submit never loses answers
    setBusy(true);
    setSubmitError(null);
    try {
      await api.saveProfile(buildProfileInput(full, email!, status, savedMoney));
      if (status === "complete") clearDraft(email!);
      router.push(then);
      // Next keeps this page in memory after navigating away; don't leave it stuck on "saving".
      setBusy(false);
    } catch {
      setSubmitError("Couldn't save. Your answers are kept, so try again.");
      setBusy(false);
    }
  }

  return (
    <NextLabelContext.Provider value={fromProfile ? (busy ? "Saving…" : "Save") : null}>
      {fromProfile ? (
        <div className="flex items-center justify-between pb-4">
          <Link href="/profile" className="-ml-2 flex min-h-11 items-center gap-1 px-2 text-sm font-medium text-muted hover:text-text">
            <ArrowLeft aria-hidden className="size-4" /> Profile
          </Link>
          <p className="text-xs font-medium text-muted">Editing your profile</p>
        </div>
      ) : (
        <>
          {showResume ? <ResumeCard step={position} total={total} onContinue={() => setShowResume(false)} onStartOver={startOver} /> : null}

          <div className="pb-6">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted">
              Step {position} of {total}
            </p>
            {/* Shared phones: switch accounts mid-setup. Your own draft stays saved for next time. */}
            <button type="button" onClick={signOut} className="-my-3 min-h-11 px-1 text-xs text-muted underline underline-offset-4 hover:text-text">
              Not you? Sign out
            </button>
          </div>
          <div
            role="progressbar"
            aria-label="Onboarding progress"
            aria-valuemin={1}
            aria-valuemax={total}
            aria-valuenow={position}
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2"
          >
            <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${(position / total) * 100}%` }} />
          </div>
        </div>
        </>
      )}

      {submitError && step !== "review" ? (
        <p role="alert" className="mb-4 rounded-md bg-surface-2 px-3 py-2 text-sm text-danger">
          {submitError}
        </p>
      ) : null}

      {/* key: remount a step's form when its saved answers are replaced (Start over, Continue setup). */}
      {step === "goal" && (
        <StepGoal key={`goal-${draft.updated_at}`} draft={draft} onNext={(p) => goNext("goal", p)} onSkip={editing ? undefined : (p) => submit("skipped", p, "/today")} />
      )}
      {step === "body" && (
        <StepBody
          key={`body-${draft.updated_at}`}
          draft={draft}
          onNext={(p) => goNext("body", p)}
          onBack={goBack}
          onFinishEarly={editing ? undefined : (p) => submit("partial", p, "/onboarding/targets")}
        />
      )}
      {step === "diet" && <StepDiet key={`diet-${draft.updated_at}`} draft={draft} onNext={(p) => goNext("diet", p)} onBack={goBack} />}
      {step === "living" && (
        <StepLiving key={`living-${draft.updated_at}`} draft={draft} onNext={(p) => goNext("living", p)} onBack={goBack} />
      )}
      {step === "review" && (
        <StepReview
          draft={draft}
          onEdit={(id) => push(id, true)}
          onSubmit={() => submit("complete", {}, "/onboarding/targets")}
          onBack={goBack}
          busy={busy}
          submitError={submitError}
        />
      )}
    </NextLabelContext.Provider>
  );
}
