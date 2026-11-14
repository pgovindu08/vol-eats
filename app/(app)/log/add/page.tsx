"use client";

import { Suspense, use, useState } from "react";
import { browser } from "react-dom";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { FoodForm } from "@/components/log/food-form";
import { PhotoLog } from "@/components/log/photo-log";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useLogs } from "@/lib/hooks/use-logs";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { atMealTime, shortDay } from "@/lib/log-days";
import { currentMealPeriod, schoolDate } from "@/lib/meal-period";
import type { FoodLogInput } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "photo" | "quick";

export default function AddLogPage() {
  return (
    <Suspense fallback={<Skeleton className="mt-20 h-56 rounded-lg" />}>
      <LogScreen />
    </Suspense>
  );
}

function LogScreen() {
  use(browser("The log form defaults to the current meal period."));
  const router = useRouter();
  const toast = useToast();
  const { addLog } = useLogs();
  const searchParams = useSearchParams();
  const today = schoolDate();
  // ?date= lets students log a day they missed; never in the future.
  const requested = searchParams.get("date");
  const date = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) && requested <= today ? requested : today;
  const isToday = date === today;
  const [tab, setTab] = useState<Tab>(searchParams.get("mode") === "quick" ? "quick" : "photo");
  const [busy, setBusy] = useState(false);
  const mealPeriod = currentMealPeriod();

  async function save(input: FoodLogInput) {
    setBusy(true);
    let savedName: string | null = null;
    if (isToday) {
      // Today goes through LogsProvider so Today's rings update immediately.
      savedName = (await addLog(input))?.name ?? null;
    } else {
      try {
        savedName = (await api.addLog({ ...input, logged_at: atMealTime(date, input.meal_period) })).name;
      } catch (e) {
        toast(`Couldn't log that. ${errorMessage(e)}`, { tone: "error" });
      }
    }
    if (savedName) {
      toast(`Logged ${savedName}${isToday ? "" : ` on ${shortDay(date)}`}`);
      router.push(isToday ? "/log" : `/log?date=${date}`);
    } else {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Log a meal"
        subtitle={isToday ? "Today" : shortDay(date)}
        action={
          <Link href={isToday ? "/log" : `/log?date=${date}`} className="flex min-h-11 items-center gap-1 px-2 text-sm font-medium text-muted hover:text-text">
            <ArrowLeft aria-hidden className="size-4" /> Log
          </Link>
        }
      />
      <div role="tablist" aria-label="How to log" className="grid grid-cols-2 rounded-md border bg-surface p-1">
        {(
          [
            ["photo", "Photo"],
            ["quick", "Quick add"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            id={`tab-${value}`}
            aria-selected={tab === value}
            aria-controls={`panel-${value}`}
            onClick={() => setTab(value)}
            className={cn("min-h-10 rounded-sm text-sm transition-colors duration-150", tab === value ? "bg-surface-2 font-semibold" : "text-muted")}
          >
            {label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "photo" ? (
          <PhotoLog mealPeriod={mealPeriod} busy={busy} onSave={save} saveLabel={isToday ? "Save to today" : `Save to ${shortDay(date)}`} />
        ) : (
          <FoodForm idPrefix="quick" mealPeriod={mealPeriod} source="manual" submitLabel={isToday ? "Add to today" : `Add to ${shortDay(date)}`} busy={busy} onSubmit={save} />
        )}
      </div>
    </div>
  );
}
