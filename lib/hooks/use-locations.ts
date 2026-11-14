"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Location, MealPlanType } from "@/lib/types";

// Locations rarely change, so keep them for the whole session.
let cache: Location[] | null = null;

export function useLocations() {
  const [locations, setLocations] = useState<Location[] | null>(cache);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (cache) return;
    let cancelled = false;
    api
      .locations()
      .then((l) => {
        cache = l;
        if (!cancelled) setLocations(l);
      })
      .catch((e: unknown) => !cancelled && setError(e));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const reload = useCallback(() => {
    setError(null);
    setAttempt((a) => a + 1);
  }, []);

  return { locations, error, reload };
}

/** The student's first favorite hall that's in the list, else the first dining hall. */
export function defaultLocationId(locations: Location[], favorites: string[] = []) {
  return favorites.find((id) => locations.some((l) => l.id === id)) ?? locations.find((l) => l.kind === "dining_hall")?.id ?? locations[0]?.id ?? null;
}

/** Swipe-only plans can't pay at retail, so they only see dining halls. */
export function locationsForPlan(locations: Location[], plan: MealPlanType) {
  return plan === "swipes" ? locations.filter((l) => l.kind === "dining_hall") : locations;
}
