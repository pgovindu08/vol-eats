"use client";

import { Suspense, use, useState, type ReactNode } from "react";
import { browser } from "react-dom";
import Link from "next/link";
import { ChevronRight, LogOut, Monitor, Moon, RotateCcw, Sun, Target, UserRound, Wallet, Settings } from "lucide-react";
import { AmountEditor } from "@/components/budget/amount-editor";
import { PageHeader } from "@/components/layout/page-header";
import { TargetsEditor } from "@/components/profile/targets-editor";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { formatUsd } from "@/lib/budget";
import { USE_MOCKS } from "@/lib/config";
import { allergenList, DIET_LABELS } from "@/lib/diet";
import { errorMessage } from "@/lib/errors";
import { useLocations } from "@/lib/hooks/use-locations";
import { useProfile } from "@/lib/hooks/use-profile";
import { findMealPlan } from "@/lib/meal-plans";
import type { StepId } from "@/lib/onboarding-flow";
import { getTheme, getUnits, resetAppToDemo, setTheme, setUnits, type ThemePref } from "@/lib/preferences";
import { getSession, signOut } from "@/lib/session";
import type { Profile } from "@/lib/types";
import { cmToFtIn, kgToLb } from "@/lib/units";
import { cn } from "@/lib/utils";
import { DEMO_EMAIL } from "@/mock/demo-profile";

const GOAL = { lose_fat: "Lose fat", build_muscle: "Build muscle", maintain: "Maintain & eat healthier" };
const ACTIVITY = { sedentary: "Sedentary", light: "Light", moderate: "Moderate", very_active: "Very active" };
const LIVING = { on_campus: "On campus", off_campus_plan: "Off campus, with a meal plan", off_campus_cooking: "Off campus, cooking for myself" };

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <ProfileScreen />
    </Suspense>
  );
}

function ProfileScreen() {
  // Theme and units live in localStorage, so render in the browser only.
  use(browser("Profile settings are stored in localStorage."));
  const { profile, error, reload } = useProfile();

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!profile) return <ProfileSkeleton />;

  return (
    <div className="space-y-4">
      <PageHeader title="Profile" subtitle={profile.email} profile={false} />
      <Section icon={Target} title="Your targets">
        {/* key: reset the sliders when targets change elsewhere (e.g. after editing details). */}
        <TargetsEditor key={`${profile.target_protein_g}-${profile.target_carbs_g}-${profile.target_fat_g}`} profile={profile} />
      </Section>
      <Details profile={profile} />
      <BudgetSection profile={profile} />
      <SettingsSection />
    </div>
  );
}

function Details({ profile: p }: { profile: Profile }) {
  const { locations } = useLocations();
  const metric = getUnits() === "metric";
  const height = metric ? `${Math.round(p.height_cm)} cm` : (({ feet, inches }) => `${feet}′${inches}″`)(cmToFtIn(p.height_cm));
  const w = (kg: number) => (metric ? `${Math.round(kg)} kg` : `${kgToLb(kg)} lb`);
  const halls = p.favorite_location_ids.map((id) => locations?.find((l) => l.id === id)?.name.replace(" Dining Hall", "") ?? "…");

  const rows: { step: StepId; label: string; value: ReactNode }[] = [
    { step: "goal", label: "Goal", value: GOAL[p.goal_type] },
    { step: "body", label: "Body", value: `${p.age} · ${height} · ${w(p.weight_kg)} → ${w(p.goal_weight_kg)} · ${ACTIVITY[p.activity_level]}` },
    {
      step: "diet",
      label: "Diet & allergies",
      value: [p.diet_tags.length ? p.diet_tags.map((t) => DIET_LABELS[t]).join(", ") : "No restrictions", p.allergens.length ? `Allergic: ${allergenList(p.allergens)}` : null]
        .filter(Boolean)
        .join(" · "),
    },
    {
      step: "living",
      label: "Where you live",
      value: [LIVING[p.living_situation], p.meal_plan_name, halls.length ? `Favorite: ${halls.join(", ")}` : null].filter(Boolean).join(" · "),
    },
  ];

  return (
    <Section icon={UserRound} title="Your details">
      <ul className="-mx-4 divide-y">
        {rows.map((r) => (
          <li key={r.step}>
            <Link
              href={`/onboarding?step=${r.step}&edit=1&return=profile`}
              className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-surface-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{r.label}</span>
                <span className="block text-xs text-muted">{r.value}</span>
              </span>
              <span className="text-sm text-muted">
                Edit<span className="sr-only"> {r.label.toLowerCase()}</span>
              </span>
              <ChevronRight aria-hidden className="size-4 text-muted" />
            </Link>
          </li>
        ))}
      </ul>
      {p.onboarding_status !== "complete" ? (
        <Link href="/onboarding" className="mt-3 inline-block text-sm font-medium underline underline-offset-4">
          Finish setup
        </Link>
      ) : null}
    </Section>
  );
}

function BudgetSection({ profile: p }: { profile: Profile }) {
  const { setProfile } = useProfile();
  const toast = useToast();
  const plan = findMealPlan(p.meal_plan_name);
  const hasDD = p.meal_plan_type === "dining_dollars" || p.meal_plan_type === "both";
  const cooking = p.living_situation === "off_campus_cooking";

  async function save(patch: Parameters<typeof api.updateMoney>[0]) {
    try {
      setProfile(await api.updateMoney(patch));
      toast("Saved");
      return true;
    } catch (e) {
      toast(`Couldn't save. ${errorMessage(e)}`, { tone: "error" });
      return false;
    }
  }

  return (
    <Section icon={Wallet} title="Budget">
      <div className="space-y-4">
        {hasDD ? (
          <AmountEditor id="p-dd" label="Dining dollars balance ($)" value={p.dining_dollars_balance} format={formatUsd} onSave={(n) => save({ dining_dollars_balance: n })}>
            {p.dining_dollars_balance != null ? <Stat value={formatUsd(p.dining_dollars_balance)} label="dining dollars" /> : null}
          </AmountEditor>
        ) : null}
        {plan?.block ? (
          <AmountEditor id="p-swipes" label="Swipes left" value={p.swipes_remaining} format={String} whole onSave={(n) => save({ swipes_remaining: n })}>
            {p.swipes_remaining != null ? <Stat value={String(p.swipes_remaining)} label="swipes left" /> : null}
          </AmountEditor>
        ) : null}
        <AmountEditor
          id="p-weekly"
          label={cooking ? "Weekly grocery budget ($)" : "Weekly off-campus food budget ($)"}
          value={p.weekly_food_budget_usd}
          format={formatUsd}
          onSave={(n) => save({ weekly_food_budget_usd: n })}
        >
          {p.weekly_food_budget_usd != null ? <Stat value={formatUsd(p.weekly_food_budget_usd)} label={cooking ? "per week for groceries" : "per week off campus"} /> : null}
        </AmountEditor>
        <Link href="/budget" className="flex min-h-11 items-center gap-1 text-sm font-medium underline underline-offset-4">
          Full budget: pace, run-out date, best protein per dollar <ChevronRight aria-hidden className="size-4" />
        </Link>
      </div>
    </Section>
  );
}

function SettingsSection() {
  const [theme, setThemeState] = useState<ThemePref>(getTheme);
  const [units, setUnitsState] = useState(getUnits);
  const [confirmReset, setConfirmReset] = useState(false);
  const isMock = USE_MOCKS;

  const segment = "flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-sm text-sm text-muted transition-colors has-checked:bg-surface-2 has-checked:font-semibold has-checked:text-text has-focus-visible:outline-2 has-focus-visible:outline-primary";

  return (
    <Section icon={Settings} title="Settings">
      <div className="space-y-5">
        <fieldset className="min-w-0">
          <legend className="mb-1.5 text-sm font-medium">Appearance</legend>
          <div className="flex rounded-md border bg-surface p-1">
            {(
              [
                ["system", "System", Monitor],
                ["light", "Light", Sun],
                ["dark", "Dark", Moon],
              ] as const
            ).map(([value, label, Icon]) => (
              <label key={value} className={segment}>
                <input
                  type="radio"
                  name="theme"
                  className="sr-only"
                  checked={theme === value}
                  onChange={() => {
                    setTheme(value);
                    setThemeState(value);
                  }}
                />
                <Icon aria-hidden className="size-4" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="min-w-0">
          <legend className="mb-1.5 text-sm font-medium">Units</legend>
          <div className="flex rounded-md border bg-surface p-1">
            {(
              [
                ["imperial", "ft / lb"],
                ["metric", "cm / kg"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className={segment}>
                <input
                  type="radio"
                  name="units"
                  className="sr-only"
                  checked={units === value}
                  onChange={() => {
                    setUnits(value);
                    setUnitsState(value);
                  }}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-2 border-t pt-4">
          <Button variant="secondary" onClick={signOut}>
            <LogOut aria-hidden className="size-4" /> Sign out
          </Button>

          {isMock ? (
            confirmReset ? (
              <div role="alertdialog" aria-labelledby="reset-q" className="rounded-md border border-danger p-3">
                <p id="reset-q" className="text-sm">
                  This clears all accounts and data on this device and starts the demo fresh.
                </p>
                <div className="mt-3 flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setConfirmReset(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" className="bg-danger text-surface" onClick={() => resetAppToDemo(DEMO_EMAIL)}>
                    Reset everything
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="ghost" className="text-danger" onClick={() => setConfirmReset(true)}>
                <RotateCcw aria-hidden className="size-4" /> Reset app (demo)
              </Button>
            )
          ) : null}
          {isMock && getSession()?.isDemo ? <p className="text-center text-xs text-muted">Signed in as the demo account.</p> : null}
        </div>
      </div>
    </Section>
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof Wallet; title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="rounded-lg border bg-surface p-4 shadow-card">
      <h2 className="mb-3 flex items-center gap-2 font-semibold">
        <Icon aria-hidden className="size-4 text-primary" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <p>
      <span className="block font-display text-xl font-bold tabular-nums">{value}</span>
      <span className="text-xs text-muted">{label}</span>
    </p>
  );
}

function ProfileSkeleton() {
  return (
    <div className={cn("space-y-4 pt-6")} aria-busy="true" aria-label="Loading profile">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-56 rounded-lg" />
      <Skeleton className="h-48 rounded-lg" />
      <Skeleton className="h-40 rounded-lg" />
    </div>
  );
}
