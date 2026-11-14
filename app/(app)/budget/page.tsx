"use client";

import { Suspense, use, useEffect, useState, type ReactNode } from "react";
import { browser } from "react-dom";
import { CalendarDays, CreditCard, Dumbbell, ShoppingBasket, Ticket, TriangleAlert, Wallet } from "lucide-react";
import { AmountEditor } from "@/components/budget/amount-editor";
import { PageHeader } from "@/components/layout/page-header";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";
import { ErrorState } from "@/components/ui/error-state";
import { Field, Input } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { formatShortDate, formatUsd, perWeek, proteinPerDollar, runOutDate, weeksLeft } from "@/lib/budget";
import { DEFAULT_SEMESTER_END } from "@/lib/config";
import { filterForProfile } from "@/lib/diet";
import { useLocations } from "@/lib/hooks/use-locations";
import { useProfile } from "@/lib/hooks/use-profile";
import { findMealPlan } from "@/lib/meal-plans";
import { schoolDate } from "@/lib/meal-period";
import type { MenuItem, Profile } from "@/lib/types";
import { cn, toNumber } from "@/lib/utils";

// Per-viewer conveniences only (not synced): semester end and this week's spending.
const PREFS_KEY = "cf.budget-prefs";
interface Prefs {
  semesterEnd: string;
  spentThisWeek: string;
}
function loadPrefs(): Prefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (raw) return { semesterEnd: DEFAULT_SEMESTER_END, spentThisWeek: "", ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {}
  return { semesterEnd: DEFAULT_SEMESTER_END, spentThisWeek: "" };
}
function savePrefs(p: Prefs) {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {}
}

export default function BudgetPage() {
  return (
    <Suspense fallback={<BudgetSkeleton />}>
      <Budget />
    </Suspense>
  );
}

function Budget() {
  use(browser("Budget settings are stored in localStorage."));
  const { profile, error, reload, setProfile } = useProfile();
  const toast = useToast();
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const update = (patch: Partial<Prefs>) =>
    setPrefs((p) => {
      const next = { ...p, ...patch };
      savePrefs(next);
      return next;
    });

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!profile) return <BudgetSkeleton />;

  const today = schoolDate();
  const weeks = weeksLeft(today, prefs.semesterEnd);
  const plan = findMealPlan(profile.meal_plan_name);
  const hasSwipes = profile.meal_plan_type === "swipes" || profile.meal_plan_type === "both";
  const hasDD = profile.meal_plan_type === "dining_dollars" || profile.meal_plan_type === "both";
  const cooking = profile.living_situation === "off_campus_cooking";

  // Onboarding doesn't ask about money, so students add these numbers here.
  async function saveMoney(patch: Parameters<typeof api.updateMoney>[0]) {
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
    <div className="space-y-4">
      <PageHeader title="Budget" subtitle={profile.meal_plan_name ?? "No meal plan"} />

      <Card icon={CalendarDays} title="Semester">
        <div className="flex items-end justify-between gap-4">
          <Field id="semester-end" label="Last day of the semester" className="flex-1">
            <Input id="semester-end" type="date" value={prefs.semesterEnd} min={today} onChange={(e) => e.target.value && update({ semesterEnd: e.target.value })} />
          </Field>
          <p className="pb-2 text-right">
            <span className="block text-2xl font-bold tabular-nums">{weeks === 0 ? "0" : weeks.toFixed(1)}</span>
            <span className="text-xs text-muted">weeks left</span>
          </p>
        </div>
      </Card>

      {hasSwipes ? (
        <Card icon={Ticket} title="Meal swipes">
          {plan?.unlimited ? (
            <Stat value="Unlimited" label="swipes at the dining halls. Go as often as you like." />
          ) : plan?.block ? (
            <AmountEditor
              id="swipes-left"
              label="How many swipes do you have left?"
              value={profile.swipes_remaining}
              format={String}
              whole
              onSave={(n) => saveMoney({ swipes_remaining: n })}
            >
              {profile.swipes_remaining != null ? (
                <div className="grid grid-cols-2 gap-3">
                  <Stat value={String(profile.swipes_remaining)} label="swipes left" />
                  <Stat value={weeks > 0 ? (profile.swipes_remaining / weeks).toFixed(1) : String(profile.swipes_remaining)} label="per week to last the semester" />
                </div>
              ) : null}
            </AmountEditor>
          ) : (
            <Stat value={plan?.name.match(/\d+$/)?.[0] ?? "—"} label="swipes per week, reset every week" />
          )}
        </Card>
      ) : null}

      {hasDD ? (
        profile.dining_dollars_balance == null ? (
          <Card icon={CreditCard} title="Dining dollars">
            <AmountEditor
              id="dd-balance"
              label="Your dining dollars balance ($)"
              hint="Check the VolCard app. A rough number is fine."
              value={null}
              format={formatUsd}
              onSave={(n) => saveMoney({ dining_dollars_balance: n })}
            />
          </Card>
        ) : (
          <DiningDollars
            profile={profile}
            weeks={weeks}
            today={today}
            semesterEnd={prefs.semesterEnd}
            spent={prefs.spentThisWeek}
            onSpent={(v) => update({ spentThisWeek: v })}
            onSaveBalance={(n) => saveMoney({ dining_dollars_balance: n })}
          />
        )
      ) : null}

      <Card icon={Wallet} title={cooking ? "Grocery budget" : "Off-campus food"}>
        <AmountEditor
          id="weekly-budget"
          label={cooking ? "Weekly grocery budget ($)" : "Weekly off-campus food budget ($)"}
          hint={cooking ? undefined : "Groceries, takeout, anything not on your plan. Optional."}
          value={profile.weekly_food_budget_usd}
          format={formatUsd}
          onSave={(n) => saveMoney({ weekly_food_budget_usd: n })}
        >
          {profile.weekly_food_budget_usd != null ? (
            <Stat value={formatUsd(profile.weekly_food_budget_usd)} label={cooking ? "per week for groceries" : "per week for groceries and takeout"} />
          ) : null}
        </AmountEditor>
      </Card>

      {profile.meal_plan_type !== "swipes" ? <ProteinPerDollar profile={profile} /> : null}

      <Card icon={ShoppingBasket} title="Grocery list" badge="Coming soon">
        <p className="text-sm text-muted">A cheap, high-protein grocery list built around your budget and macros.</p>
      </Card>
    </div>
  );
}

function DiningDollars({
  profile,
  weeks,
  today,
  semesterEnd,
  spent,
  onSpent,
  onSaveBalance,
}: {
  profile: Profile;
  weeks: number;
  today: string;
  semesterEnd: string;
  spent: string;
  onSpent: (v: string) => void;
  onSaveBalance: (n: number) => Promise<boolean>;
}) {
  const balance = profile.dining_dollars_balance ?? 0;
  const allowance = perWeek(balance, weeks);
  const spentNum = toNumber(spent) ?? 0;
  const runOut = runOutDate(balance, spentNum, today);
  const runsOutEarly = runOut !== null && runOut < semesterEnd;

  return (
    <Card icon={CreditCard} title="Dining dollars">
      <AmountEditor id="dd-balance" label="Your dining dollars balance ($)" value={balance} format={formatUsd} onSave={onSaveBalance}>
        <div className="grid grid-cols-2 gap-3">
          <Stat value={formatUsd(balance)} label="balance" />
          <Stat value={formatUsd(allowance)} label={`per week until ${formatShortDate(semesterEnd)}`} />
        </div>
      </AmountEditor>
      <Field id="spent-week" label="Spent this week ($)" hint="No transaction data yet, so enter a rough number." className="mt-4">
        <Input id="spent-week" aria-describedby="spent-week-hint" type="number" inputMode="decimal" min={0} placeholder="0" value={spent} onChange={(e) => onSpent(e.target.value)} />
      </Field>
      {spentNum > 0 ? (
        <p role="status" className={cn("mt-3 flex items-start gap-1.5 text-sm", runsOutEarly ? "text-warning" : "text-success")}>
          {runsOutEarly ? <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" /> : null}
          {runsOutEarly
            ? `At this pace you'll run out around ${formatShortDate(runOut!)}, before the semester ends. Try to stay near ${formatUsd(allowance)} a week.`
            : `You're on pace. At ${formatUsd(spentNum)} a week, your balance lasts past ${formatShortDate(semesterEnd)}.`}
        </p>
      ) : null}
    </Card>
  );
}

function ProteinPerDollar({ profile }: { profile: Profile }) {
  const { locations, error: locError } = useLocations();
  const [items, setItems] = useState<MenuItem[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const retailIds = locations?.filter((l) => l.kind === "retail").map((l) => l.id).join(",");

  useEffect(() => {
    if (!retailIds) return;
    let cancelled = false;
    Promise.all(retailIds.split(",").map((id) => api.menus({ location_id: id })))
      .then((lists) => !cancelled && setItems(lists.flat()))
      .catch((e: unknown) => !cancelled && setError(e));
    return () => {
      cancelled = true;
    };
  }, [retailIds, attempt]);

  const names = new Map(locations?.map((l) => [l.id, l.name]));
  const top = items ? proteinPerDollar(filterForProfile(items, profile)) : null;

  return (
    <Card icon={Dumbbell} title="Best protein per dining dollar">
      {error || locError ? (
        <ErrorState
          error={error ?? locError}
          onRetry={() => {
            setError(null);
            setAttempt((a) => a + 1);
          }}
        />
      ) : !top ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : top.length === 0 ? (
        <p className="text-sm text-muted">No priced retail items fit your diet yet.</p>
      ) : (
        <ol className="divide-y">
          {top.map(({ item, gramsPerDollar }, i) => (
            <li key={item.id} className="flex items-center gap-3 py-2.5">
              <span className="w-5 text-sm font-bold text-muted">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{item.name}</span>
                <span className="block text-xs text-muted">
                  {names.get(item.location_id)} · {item.protein_g} g protein · {formatUsd(item.price_usd!)}
                </span>
              </span>
              <span className="text-right">
                <span className="block text-sm font-bold tabular-nums">{gramsPerDollar.toFixed(1)}</span>
                <span className="block text-xs text-muted">g / $</span>
              </span>
            </li>
          ))}
        </ol>
      )}
      {/* TODO(schema): prices are placeholders until price_usd is in the data. */}
      <p className="mt-2 text-xs text-muted">Prices are estimates.</p>
    </Card>
  );
}

function Card({ icon: Icon, title, badge, children }: { icon: typeof Wallet; title: string; badge?: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="rounded-lg border bg-surface p-4 shadow-card">
      <h2 className="mb-3 flex items-center gap-2 font-semibold">
        <Icon aria-hidden className="size-4 text-primary" />
        {title}
        {badge ? <span className="ml-auto rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted">{badge}</span> : null}
      </h2>
      {children}
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <p>
      <span className="block font-display text-2xl font-bold tabular-nums">{value}</span>
      <span className="text-xs text-muted">{label}</span>
    </p>
  );
}

function BudgetSkeleton() {
  return (
    <div className="space-y-4 pt-6" aria-busy="true" aria-label="Loading budget">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-24 rounded-lg" />
      <Skeleton className="h-28 rounded-lg" />
      <Skeleton className="h-40 rounded-lg" />
    </div>
  );
}
