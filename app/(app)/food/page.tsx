"use client";

import { Suspense, use, useEffect, useMemo, useState } from "react";
import { browser } from "react-dom";
import Link from "next/link";
import { ChevronRight, Clock, Footprints, Sparkles, Store, UtensilsCrossed } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PeriodPicker } from "@/components/menus/pickers";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { filterForProfile } from "@/lib/diet";
import { useLocations } from "@/lib/hooks/use-locations";
import { useLogs } from "@/lib/hooks/use-logs";
import { useProfile } from "@/lib/hooks/use-profile";
import { remaining, targetsOf } from "@/lib/macros";
import { currentMealPeriod } from "@/lib/meal-period";
import { buildPlates } from "@/lib/plate-builder";
// TODO: switch to lib/campus-geo.ts and lib/hours.ts when Person B's branch merges.
import { distanceFromMinKao, openStatus } from "@/lib/stubs";
import type { Location, MealPeriod, MealPlanType, MenuItem, Plate } from "@/lib/types";
import { cn } from "@/lib/utils";

/** What this student can pay with at a location, or null if their plan doesn't work there. */
function payLabel(loc: Location, plan: MealPlanType): string | null {
  if (plan === "none") return "Card or cash";
  const swipes = (plan === "swipes" || plan === "both") && loc.accepts_swipes;
  const dd = (plan === "dining_dollars" || plan === "both") && loc.accepts_dining_dollars;
  if (swipes && dd) return "Swipe or dining dollars";
  if (swipes) return "Meal swipe";
  if (dd) return "Dining dollars";
  return null;
}

export default function FoodPage() {
  return (
    <Suspense fallback={<FoodSkeleton />}>
      <Food />
    </Suspense>
  );
}

function Food() {
  // Open/closed and the default meal depend on the current time, so render in the browser only.
  use(browser("The Food tab depends on the current time."));
  const { profile } = useProfile();
  const { eaten, loading: logsLoading } = useLogs();
  const { locations, error, reload } = useLocations();
  const [period, setPeriod] = useState<MealPeriod>(() => currentMealPeriod());
  const [openOnly, setOpenOnly] = useState(false);
  const [planOnly, setPlanOnly] = useState(false);
  const [now] = useState(() => new Date());

  const rows = useMemo(() => {
    if (!locations || !profile) return null;
    return locations
      .map((loc) => ({ loc, dist: distanceFromMinKao(loc.id), status: openStatus(loc.id, now), pay: payLabel(loc, profile.meal_plan_type) }))
      .sort((a, b) => (a.dist?.miles ?? 99) - (b.dist?.miles ?? 99));
  }, [locations, profile, now]);

  const shown = rows?.filter((r) => (!openOnly || r.status.open) && (!planOnly || r.pay));
  const left = profile && !logsLoading ? remaining(targetsOf(profile), eaten) : null;

  const chip =
    "flex min-h-11 cursor-pointer items-center rounded-full border bg-surface px-4 text-sm transition-colors duration-150 has-checked:border-text has-checked:bg-text has-checked:text-surface has-focus-visible:outline-2 has-focus-visible:outline-primary";

  return (
    <div className="space-y-4">
      <PageHeader title="Food" subtitle="Places near Min Kao, with picks for what you have left today" />

      <div className="space-y-3">
        <PeriodPicker value={period} onChange={setPeriod} />
        <fieldset className="min-w-0">
          <legend className="sr-only">Filters</legend>
          <div className="flex flex-wrap gap-2">
            <label className={chip}>
              <input type="checkbox" className="sr-only" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} />
              Open now
            </label>
            <label className={chip}>
              <input type="checkbox" className="sr-only" checked={planOnly} onChange={(e) => setPlanOnly(e.target.checked)} />
              On my plan
            </label>
          </div>
        </fieldset>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !shown ? (
        <FoodSkeleton bare />
      ) : shown.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-surface p-6 text-center">
          <Store aria-hidden className="mx-auto size-6 text-muted" />
          <p className="mt-2 text-sm text-muted">Nothing matches those filters right now.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {shown.map(({ loc, dist, status, pay }) => (
            <li key={loc.id}>
              <LocationCard loc={loc} period={period} dist={dist} status={status} pay={pay} remainingKey={left ? JSON.stringify(left) : null} />
            </li>
          ))}
        </ul>
      )}
      <p className="text-center text-xs text-muted">Distances are walking estimates from Min Kao Engineering.</p>
    </div>
  );
}

function LocationCard({
  loc,
  period,
  dist,
  status,
  pay,
  remainingKey,
}: {
  loc: Location;
  period: MealPeriod;
  dist: { miles: number; walkMinutes: number } | null;
  status: { open: boolean; label: string };
  pay: string | null;
  remainingKey: string | null;
}) {
  const { profile } = useProfile();
  const isRetail = loc.kind === "retail";
  const menuKey = `${loc.id}|${isRetail ? "all" : period}`;
  const [menu, setMenu] = useState<{ key: string; items: MenuItem[] } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .menus({ location_id: loc.id, meal_period: isRetail ? undefined : period })
      .then((items) => !cancelled && setMenu({ key: menuKey, items }))
      .catch(() => !cancelled && setFailed(menuKey));
    return () => {
      cancelled = true;
    };
    // menuKey covers the location and meal period.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuKey]);

  const items = menu?.key === menuKey ? menu.items : null;
  // Top pick: the first plate from the same builder Plate picks uses, for what's left today.
  const pick: Plate | null = useMemo(() => {
    if (!items || !profile || !remainingKey) return null;
    return buildPlates(filterForProfile(items, profile), JSON.parse(remainingKey), 0, period).plates[0] ?? null;
  }, [items, profile, remainingKey, period]);

  const usable = pay !== null;
  const href = `/plates?location=${loc.id}${isRetail ? "" : `&period=${period}`}`;

  return (
    <Link
      href={href}
      className={cn("block rounded-lg border bg-surface p-4 shadow-card transition-colors duration-150 hover:border-primary", !usable && "opacity-70")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            {isRetail ? <Store aria-hidden className="size-4 shrink-0 text-muted" /> : <UtensilsCrossed aria-hidden className="size-4 shrink-0 text-muted" />}
            <span className="truncate">{loc.name}</span>
          </h2>
          <p className="text-xs text-muted">{loc.building ?? (isRetail ? "Retail" : "Dining hall")}</p>
        </div>
        <ChevronRight aria-hidden className="mt-1 size-5 shrink-0 text-muted" />
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {dist ? (
          <span className="flex items-center gap-1">
            <Footprints aria-hidden className="size-4 text-muted" />
            {dist.miles} mi · {dist.walkMinutes} min walk
          </span>
        ) : null}
        <span className={cn("flex items-center gap-1", status.open ? "font-medium text-success" : "text-muted")}>
          <Clock aria-hidden className="size-4" />
          {status.label}
        </span>
      </div>

      <p className={cn("mt-1 text-xs", usable ? "text-muted" : "font-medium text-warning")}>{usable ? pay : "Not on your plan"}</p>

      <div className="mt-3 rounded-md bg-surface-2 px-3 py-2 text-sm">
        {failed === menuKey ? (
          <span className="text-muted">Menu didn&apos;t load. Tap to try again.</span>
        ) : !items || (!pick && !remainingKey) ? (
          <span className="block h-5 w-3/4 animate-pulse rounded-sm bg-border" aria-label="Loading top pick" />
        ) : pick ? (
          <span className="flex items-start gap-1.5">
            <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
            <span className="min-w-0">
              <span className="font-medium">Top pick: </span>
              {pick.items.map((i) => i.name).join(", ")}
              <span className="text-muted">
                {" "}
                · {Math.round(pick.totals.calories)} cal · {Math.round(pick.totals.protein_g)} g protein
              </span>
            </span>
          </span>
        ) : (
          <span className="text-muted">{items.length ? "Nothing here fits your diet for this meal." : "Menu not posted for this meal."}</span>
        )}
      </div>
    </Link>
  );
}

function FoodSkeleton({ bare }: { bare?: boolean }) {
  return (
    <div className={cn("space-y-3", !bare && "pt-6")} aria-busy="true" aria-label="Loading places">
      {bare ? null : <Skeleton className="h-8 w-28" />}
      <Skeleton className="h-36 rounded-lg" />
      <Skeleton className="h-36 rounded-lg" />
      <Skeleton className="h-36 rounded-lg" />
    </div>
  );
}
