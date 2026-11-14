"use client";

import { Suspense, use, useEffect, useMemo, useState } from "react";
import { browser } from "react-dom";
import { ChevronRight, Search, TriangleAlert } from "lucide-react";
import { MenuItemSheet } from "@/components/menus/menu-item-sheet";
import { LocationPicker, PeriodPicker } from "@/components/menus/pickers";
import { PageHeader } from "@/components/layout/page-header";
import { ChipGroup } from "@/components/ui/choice";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { DIET_BADGES } from "@/lib/diet";
import { defaultLocationId, useLocations } from "@/lib/hooks/use-locations";
import { useLogs } from "@/lib/hooks/use-logs";
import { useProfile } from "@/lib/hooks/use-profile";
import { currentMealPeriod } from "@/lib/meal-period";
import type { DietTag, MealPeriod, MenuItem } from "@/lib/types";

const FILTERS: { value: DietTag; label: string }[] = [
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "gluten_free", label: "Gluten-free" },
  { value: "dairy_free", label: "Dairy-free" },
];

// Menus for a hall + period don't change during a session.
const menuCache = new Map<string, MenuItem[]>();

export default function MenusPage() {
  return (
    <Suspense fallback={<MenuSkeleton />}>
      <Menus />
    </Suspense>
  );
}

function Menus() {
  use(browser("Menus default to the current meal period."));
  const toast = useToast();
  const { profile } = useProfile();
  const { addLog } = useLogs();
  const { locations, error: locError, reload: reloadLocations } = useLocations();

  const [picked, setPicked] = useState<string | null>(null);
  const locationId = picked ?? (locations ? defaultLocationId(locations, profile?.favorite_location_ids) : null);
  const location = locations?.find((l) => l.id === locationId) ?? null;
  const isRetail = location?.kind === "retail";
  const [period, setPeriod] = useState<MealPeriod>(() => currentMealPeriod());
  const [query, setQuery] = useState("");
  // Start with the user's own diet filters switched on.
  const [filters, setFilters] = useState<DietTag[] | null>(null);
  const profileTags = profile?.diet_tags;
  const activeFilters = useMemo(
    () => filters ?? (profileTags?.filter((t) => FILTERS.some((f) => f.value === t)) ?? []),
    [filters, profileTags],
  );
  const [selected, setSelected] = useState<MenuItem | null>(null);

  const key = locationId ? `${locationId}|${isRetail ? "all" : period}` : null;
  const [items, setItems] = useState<{ key: string; value: MenuItem[] } | null>(null);
  const [error, setError] = useState<{ key: string; value: unknown } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!key || !locationId) return;
    const cached = menuCache.get(key);
    let cancelled = false;
    (cached ? Promise.resolve(cached) : api.menus({ location_id: locationId, meal_period: isRetail ? undefined : period }))
      .then((m) => {
        menuCache.set(key, m);
        if (!cancelled) setItems({ key, value: m });
      })
      .catch((e: unknown) => !cancelled && setError({ key, value: e }));
    return () => {
      cancelled = true;
    };
    // key covers location + period.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  const current = items?.key === key ? items.value : null;
  const currentError = error?.key === key ? error.value : null;

  const grouped = useMemo(() => {
    if (!current) return [];
    const q = query.trim().toLowerCase();
    const shown = current.filter((i) => (!q || i.name.toLowerCase().includes(q)) && activeFilters.every((f) => i.tags.includes(f)));
    const byStation = new Map<string, MenuItem[]>();
    for (const i of shown) {
      const s = i.station ?? "Other";
      byStation.set(s, [...(byStation.get(s) ?? []), i]);
    }
    return [...byStation.entries()];
  }, [current, query, activeFilters]);

  function logItem(item: MenuItem, servings: number) {
    setSelected(null);
    void addLog({
      menu_item_id: item.id,
      name: item.name,
      servings,
      calories: item.calories,
      protein_g: item.protein_g,
      carbs_g: item.carbs_g,
      fat_g: item.fat_g,
      meal_period: item.meal_period === "all_day" ? currentMealPeriod() : item.meal_period,
      source: "menu",
    }).then((saved) => saved && toast(`Logged ${item.name}`));
  }

  const userAllergens = profile?.allergens ?? [];

  return (
    <div className="space-y-4">
      <PageHeader title="Menus" subtitle={location ? location.name : undefined} />

      {locError ? (
        <ErrorState error={locError} onRetry={reloadLocations} />
      ) : !locations || !locationId ? (
        <Skeleton className="h-11" />
      ) : (
        <div className="space-y-3">
          <LocationPicker locations={locations} value={locationId} onChange={(id) => (setPicked(id), setQuery(""))} />
          <PeriodPicker value={period} onChange={setPeriod} disabled={isRetail} />
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <label htmlFor="menu-search" className="sr-only">
              Search this menu
            </label>
            <Input id="menu-search" type="search" placeholder="Search this menu" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <ChipGroup legend={<span className="sr-only">Diet filters</span>} options={FILTERS} value={activeFilters} onChange={setFilters} />
        </div>
      )}

      {locError ? null : currentError ? (
        <ErrorState error={currentError} onRetry={() => setAttempt((a) => a + 1)} />
      ) : !current ? (
        <MenuSkeleton />
      ) : current.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-surface p-6 text-center text-sm text-muted">Menu not posted yet. Check back closer to mealtime.</p>
      ) : grouped.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-surface p-6 text-center text-sm text-muted">Nothing matches your search or filters.</p>
      ) : (
        <div className="space-y-5">
          {grouped.map(([station, list]) => (
            <section key={station} aria-labelledby={`st-${station}`}>
              <h2 id={`st-${station}`} className="mb-2 text-sm font-semibold">
                {station}
              </h2>
              <ul className="divide-y overflow-hidden rounded-lg border bg-surface">
                {list.map((i) => {
                  const flagged = i.allergens.some((a) => userAllergens.includes(a));
                  return (
                    <li key={i.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(i)}
                        className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-surface-2"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 text-sm font-medium">
                            <span className="truncate">{i.name}</span>
                            {flagged ? <TriangleAlert aria-label="Contains one of your allergens" className="size-3.5 shrink-0 text-warning" /> : null}
                          </span>
                          <span className="flex flex-wrap items-center gap-x-2 text-xs tabular-nums text-muted">
                            <span>
                              P {i.protein_g} · C {i.carbs_g} · F {i.fat_g} g
                            </span>
                            {i.tags.map((t) =>
                              DIET_BADGES[t] ? (
                                <abbr key={t} title={t.replace("_", "-")} className="rounded-sm bg-surface-2 px-1 font-semibold no-underline">
                                  {DIET_BADGES[t]}
                                </abbr>
                              ) : null,
                            )}
                            {i.price_usd != null ? <span>${i.price_usd.toFixed(2)}</span> : null}
                          </span>
                        </span>
                        <span className="text-right">
                          <span className="block text-sm font-semibold tabular-nums">{i.calories}</span>
                          <span className="block text-xs text-muted">cal</span>
                        </span>
                        <ChevronRight aria-hidden className="size-4 text-muted" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <MenuItemSheet item={selected} userAllergens={userAllergens} onClose={() => setSelected(null)} onLog={logItem} />
    </div>
  );
}

function MenuSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading menu">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-14 rounded-lg" />
      <Skeleton className="h-14 rounded-lg" />
      <Skeleton className="h-14 rounded-lg" />
    </div>
  );
}
