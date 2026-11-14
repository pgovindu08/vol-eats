"use client";

import { Suspense, use, useEffect, useMemo, useState } from "react";
import { browser } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw, WifiOff } from "lucide-react";
import { LocationPicker, PeriodPicker } from "@/components/menus/pickers";
import { PlateCard, PlateCardSkeleton } from "@/components/plates/plate-card";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { api, withAiFallback, type AiResult } from "@/lib/api";
import { filterForProfile } from "@/lib/diet";
import { useLocations, locationsForPlan } from "@/lib/hooks/use-locations";
import { useLogs } from "@/lib/hooks/use-logs";
import { useProfile } from "@/lib/hooks/use-profile";
import { remaining, targetsOf } from "@/lib/macros";
import { currentMealPeriod } from "@/lib/meal-period";
import { buildPlates } from "@/lib/plate-builder";
import type { Macros, MealPeriod, Plate, PlateRecommendation } from "@/lib/types";

const LOADING_COPY = ["Checking today's {hall} menu…", "Matching it to your macros…", "Building your plates…"];

export default function PlatesPage() {
  return (
    <Suspense fallback={<LoadingPlates hall="dining hall" />}>
      <Plates />
    </Suspense>
  );
}

function Plates() {
  // Defaults depend on the current time and saved session, so render in the browser only.
  use(browser("Plate picks default to the current meal period."));
  const router = useRouter();
  const toast = useToast();
  const { profile } = useProfile();
  const { eaten, loading: logsLoading, addLog } = useLogs();
  const { locations, error: locError, reload: reloadLocations } = useLocations();

  const visible = useMemo(() => (locations && profile ? locationsForPlan(locations, profile.meal_plan_type) : null), [locations, profile]);
  // TODO(nearest): no location data yet, so default to the first dining hall.
  const [picked, setPicked] = useState<string | null>(null);
  const locationId = picked ?? visible?.find((l) => l.kind === "dining_hall")?.id ?? null;
  const location = visible?.find((l) => l.id === locationId) ?? null;
  const isRetail = location?.kind === "retail";

  const [period, setPeriod] = useState<MealPeriod>(() => currentMealPeriod());
  const [variant, setVariant] = useState(0);
  const [result, setResult] = useState<{ key: string; value: AiResult<PlateRecommendation> } | null>(null);
  const [error, setError] = useState<{ key: string; value: unknown } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [loggingId, setLoggingId] = useState<string | null>(null);

  const left = profile ? remaining(targetsOf(profile), eaten) : null;
  const leftKey = left ? JSON.stringify(left) : null;
  // leftKey is part of the key so plates are rebuilt (re-sized) after anything is logged.
  const requestKey = `${locationId}|${isRetail ? "all" : period}|${variant}|${attempt}|${leftKey}`;
  const ready = !!profile && !!locationId && !logsLoading && !!leftKey;

  useEffect(() => {
    if (!ready || !profile || !locationId || !leftKey) return;
    let cancelled = false;
    const rem = JSON.parse(leftKey) as Macros;
    (async () => {
      try {
        const ai = await withAiFallback(api.ai.plates({ location_id: locationId, meal_period: period, remaining: rem, variant }), () => null);
        let value: AiResult<PlateRecommendation>;
        if (ai.data && !ai.offline) {
          value = { data: ai.data, offline: false };
        } else {
          // AI slow or down: build plates locally from the real menu so the user is never stuck.
          const menu = await api.menus({ location_id: locationId, meal_period: isRetail ? undefined : period });
          value = { data: buildPlates(filterForProfile(menu, profile), rem, variant, period), offline: true };
        }
        if (!cancelled) setResult({ key: requestKey, value });
      } catch (e) {
        if (!cancelled) setError({ key: requestKey, value: e });
      }
    })();
    return () => {
      cancelled = true;
    };
    // requestKey covers location, period, variant, retries and what's left today.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, requestKey]);

  async function logPlate(plate: Plate) {
    setLoggingId(plate.id);
    const mealPeriod = isRetail ? currentMealPeriod() : period;
    try {
      const saved = await Promise.all(
        plate.items.map((i) =>
          addLog({
            menu_item_id: i.menu_item_id,
            name: i.name,
            servings: i.servings,
            calories: i.calories,
            protein_g: i.protein_g,
            carbs_g: i.carbs_g,
            fat_g: i.fat_g,
            meal_period: mealPeriod,
            source: "plate",
          }),
        ),
      );
      if (saved.every(Boolean)) {
        toast(`Logged ${plate.title.toLowerCase()}`);
        router.push("/today");
      }
    } finally {
      // Next keeps this page alive in the background after navigating away,
      // so always clear the "Logging…" state or the buttons stay disabled on return.
      setLoggingId(null);
    }
  }

  const current = result?.key === requestKey ? result.value : null;
  const currentError = error?.key === requestKey ? error.value : null;
  const hallName = location?.name ?? "dining hall";

  return (
    <div className="space-y-4 pt-4">
      <header className="flex items-center gap-2">
        <Link href="/today" aria-label="Back to Today" className="-ml-2 flex size-11 items-center justify-center rounded-full hover:bg-surface-2">
          <ArrowLeft aria-hidden className="size-5" />
        </Link>
        <h1 className="font-display text-2xl font-bold">What should I eat?</h1>
      </header>

      {locError ? (
        <ErrorState error={locError} onRetry={reloadLocations} />
      ) : !visible || !locationId ? (
        <Skeleton className="h-11" />
      ) : (
        <div className="space-y-3">
          <LocationPicker locations={visible} value={locationId} onChange={(id) => (setPicked(id), setVariant(0))} />
          <PeriodPicker value={period} onChange={(p) => (setPeriod(p), setVariant(0))} disabled={isRetail} />
        </div>
      )}

      {locError ? null : currentError ? (
        <ErrorState error={currentError} onRetry={() => setAttempt((a) => a + 1)} />
      ) : !current || !left ? (
        <LoadingPlates hall={hallName} />
      ) : current.data.plates.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-surface p-6 text-center text-sm text-muted">
          <p>Menu not posted yet for {hallName}, or nothing on it fits your diet.</p>
          <Link href="/menus" className="mt-2 inline-block font-medium text-text underline underline-offset-4">
            Browse menus
          </Link>
        </div>
      ) : (
        <>
          {current.offline ? (
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <WifiOff aria-hidden className="size-3.5" /> Offline estimate: built from today&apos;s menu without AI.
            </p>
          ) : null}
          <div className="space-y-4">
            {current.data.plates.map((p) => (
              <PlateCard
                key={p.id}
                plate={p}
                locationName={hallName}
                remaining={left}
                onLog={() => logPlate(p)}
                logging={loggingId === p.id}
                disabled={loggingId !== null}
              />
            ))}
          </div>
          <Button variant="secondary" block onClick={() => setVariant((v) => v + 1)} disabled={loggingId !== null}>
            <RefreshCw aria-hidden className="size-4" /> Regenerate
          </Button>
          <p className="text-center text-sm text-muted">
            Not feeling these?{" "}
            <Link href="/menus" className="font-medium text-text underline underline-offset-4">
              Browse the menu
            </Link>
          </p>
        </>
      )}
    </div>
  );
}

function LoadingPlates({ hall }: { hall: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % LOADING_COPY.length), 1400);
    return () => clearInterval(id);
  }, []);
  return (
    <div aria-busy="true" className="space-y-4">
      <p role="status" className="text-sm text-muted">
        {LOADING_COPY[i].replace("{hall}", hall.replace(" Dining Hall", ""))}
      </p>
      <PlateCardSkeleton />
      <PlateCardSkeleton />
    </div>
  );
}
