"use client";

import { Suspense, use, useEffect, useMemo, useState } from "react";
import { browser } from "react-dom";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Camera, ChevronLeft, ChevronRight, NotebookPen, PenLine, Plus, UtensilsCrossed } from "lucide-react";
import { LoggedMeals } from "@/components/log/logged-meals";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { useLogs } from "@/lib/hooks/use-logs";
import { useProfile } from "@/lib/hooks/use-profile";
import { addDays, dayStatus, logsByDay, shortDay, STATUS_LABEL, weekDays, type DayStatus } from "@/lib/log-days";
import { sumLogs } from "@/lib/macros";
import { schoolDate } from "@/lib/meal-period";
import { logsRange } from "@/lib/stubs"; // TODO: switch to api.logsRange when Person B's branch merges
import type { FoodLog } from "@/lib/types";
import { cn } from "@/lib/utils";

const DOT: Record<DayStatus, string> = { hit: "bg-success", under: "bg-muted", over: "bg-warning", empty: "border border-muted" };

export default function LogPage() {
  return (
    <Suspense fallback={<LogSkeleton />}>
      <LogScreen />
    </Suspense>
  );
}

function LogScreen() {
  // The selected day lives in the URL and depends on "today", so render in the browser only.
  use(browser("The log calendar depends on the current date."));
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { profile } = useProfile();
  const today = schoolDate();
  const requested = searchParams.get("date");
  const selected = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) && requested <= today ? requested : today;
  const isToday = selected === today;
  const week = useMemo(() => weekDays(selected), [selected]);

  // Today's meals come from LogsProvider (so Today's rings stay in sync); other days are fetched per week.
  const todayLogs = useLogs();
  const [weekLogs, setWeekLogs] = useState<{ key: string; byDay: Record<string, FoodLog[]> } | null>(null);
  const [error, setError] = useState<{ key: string; value: unknown } | null>(null);
  const [version, setVersion] = useState(0);
  const weekKey = `${week[0]}|${version}`;

  useEffect(() => {
    let cancelled = false;
    const last = week[6] < today ? week[6] : today;
    logsRange(week[0], last)
      .then((logs) => !cancelled && setWeekLogs({ key: weekKey, byDay: logsByDay(logs) }))
      .catch((e: unknown) => !cancelled && setError({ key: weekKey, value: e }));
    return () => {
      cancelled = true;
    };
    // weekKey covers the week and refreshes after edits to past days.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekKey]);

  const byDay = weekLogs?.key === weekKey ? weekLogs.byDay : null;
  const weekError = error?.key === weekKey ? error.value : null;
  const logsFor = (d: string): FoodLog[] | null => (d === today ? (todayLogs.loading ? null : todayLogs.logs) : byDay ? (byDay[d] ?? []) : null);
  const dayLogs = logsFor(selected);
  const target = profile?.target_calories ?? 0;
  const dayTotal = dayLogs ? sumLogs(dayLogs).calories : 0;
  const thisWeek = week.includes(today);

  const go = (date: string) => router.push(date === today ? "/log" : `/log?date=${date}`, { scroll: false });

  // Past days are edited through the API directly, then the week is refetched.
  const actions = isToday
    ? { onUpdate: (id: string, patch: { servings: number }) => void todayLogs.updateLog(id, patch), onDelete: (id: string) => void todayLogs.deleteLog(id) }
    : {
        onUpdate: (id: string, patch: { servings: number }) =>
          void api
            .updateLog(id, patch)
            .then(() => setVersion((v) => v + 1))
            .catch((e: unknown) => toast(`Couldn't save. ${errorMessage(e)}`, { tone: "error" })),
        onDelete: (id: string) =>
          void api
            .deleteLog(id)
            .then(() => {
              setVersion((v) => v + 1);
              toast("Removed");
            })
            .catch((e: unknown) => toast(`Couldn't remove that. ${errorMessage(e)}`, { tone: "error" })),
      };

  const [adding, setAdding] = useState(false);
  const addHref = (mode: "photo" | "quick") => `/log/add?mode=${mode}${isToday ? "" : `&date=${selected}`}`;

  return (
    <div className="space-y-4">
      <PageHeader title="Log" subtitle="Everything you've eaten, day by day" />

      <section aria-label="Choose a day" className="rounded-lg border bg-surface p-3 shadow-card">
        <div className="mb-2 flex items-center justify-between">
          <button type="button" onClick={() => go(addDays(week[0], -7))} aria-label="Previous week" className="flex size-11 items-center justify-center rounded-full hover:bg-surface-2">
            <ChevronLeft aria-hidden className="size-5" />
          </button>
          <p className="text-sm font-semibold">
            {shortDay(week[0]).slice(5)} – {shortDay(week[6]).slice(5)}
          </p>
          {thisWeek ? (
            <span className="size-11" aria-hidden />
          ) : (
            <button type="button" onClick={() => go(addDays(week[0], 7) > today ? today : addDays(week[0], 7))} aria-label="Next week" className="flex size-11 items-center justify-center rounded-full hover:bg-surface-2">
              <ChevronRight aria-hidden className="size-5" />
            </button>
          )}
        </div>
        <ol className="grid grid-cols-7 gap-1">
          {week.map((d) => {
            const future = d > today;
            const logs = logsFor(d);
            const status = logs ? dayStatus(sumLogs(logs).calories, target) : null;
            const isSel = d === selected;
            return (
              <li key={d}>
                <button
                  type="button"
                  disabled={future}
                  aria-pressed={isSel}
                  onClick={() => go(d)}
                  className={cn(
                    "flex min-h-16 w-full flex-col items-center justify-center gap-1 rounded-md text-xs transition-colors duration-150 disabled:opacity-40",
                    isSel ? "bg-text text-surface" : "hover:bg-surface-2",
                  )}
                >
                  <span className={isSel ? "" : "text-muted"}>{shortDay(d).slice(0, 2)}</span>
                  <span className="text-sm font-bold tabular-nums">{Number(d.slice(8))}</span>
                  {future ? (
                    <span className="size-2" aria-hidden />
                  ) : status ? (
                    <span aria-hidden className={cn("size-2 rounded-full", DOT[status])} />
                  ) : (
                    <span aria-hidden className="size-2 animate-pulse rounded-full bg-surface-2" />
                  )}
                  <span className="sr-only">
                    {shortDay(d)}
                    {status && !future ? `, ${STATUS_LABEL[status]}` : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted" aria-hidden>
          {(["hit", "under", "over"] as const).map((s) => (
            <span key={s} className="flex items-center gap-1">
              <span className={cn("size-2 rounded-full", DOT[s])} />
              {STATUS_LABEL[s]}
            </span>
          ))}
        </div>
        {!thisWeek ? (
          <div className="mt-2 text-center">
            <button type="button" onClick={() => go(today)} className="min-h-11 text-sm font-medium underline underline-offset-4">
              Back to today
            </button>
          </div>
        ) : null}
      </section>

      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-lg font-bold">{isToday ? "Today" : shortDay(selected)}</h2>
        {dayLogs && target ? (
          <p className="text-sm tabular-nums text-muted">
            <span className="font-semibold text-text">{Math.round(dayTotal).toLocaleString()}</span> / {target.toLocaleString()} cal ·{" "}
            {STATUS_LABEL[dayStatus(dayTotal, target)]}
          </p>
        ) : null}
      </div>

      {(isToday ? todayLogs.error : weekError) ? (
        <ErrorState error={isToday ? todayLogs.error : weekError} onRetry={isToday ? todayLogs.reload : () => setVersion((v) => v + 1)} />
      ) : !dayLogs ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading meals">
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-14 rounded-lg" />
        </div>
      ) : dayLogs.length ? (
        <LoggedMeals logs={dayLogs} title={`Meals on ${isToday ? "today" : shortDay(selected)}`} {...actions} />
      ) : (
        <div className="rounded-lg border border-dashed bg-surface p-6 text-center">
          <NotebookPen aria-hidden className="mx-auto size-6 text-muted" />
          <p className="mt-2 text-sm text-muted">Nothing logged {isToday ? "yet today" : `on ${shortDay(selected)}`}. Add a meal.</p>
        </div>
      )}

      {/* Add button, above the tab bar on the right (thumb reach). */}
      <Button
        size="lg"
        onClick={() => setAdding(true)}
        className="fixed bottom-[calc(var(--tab-bar-height)+env(safe-area-inset-bottom)+16px)] right-[max(16px,calc(50%-var(--content-max)/2+16px))] z-30 rounded-full shadow-card"
      >
        <Plus aria-hidden className="size-5" /> Add meal
      </Button>

      <Sheet open={adding} onClose={() => setAdding(false)} title={isToday ? "Add to today" : `Add to ${shortDay(selected)}`}>
        <div className="grid gap-2">
          <Link href={addHref("photo")} className={buttonVariants({ variant: "secondary", size: "lg", className: "justify-start" })}>
            <Camera aria-hidden className="size-5" /> Photo
          </Link>
          <Link href={addHref("quick")} className={buttonVariants({ variant: "secondary", size: "lg", className: "justify-start" })}>
            <PenLine aria-hidden className="size-5" /> Quick add
          </Link>
          {isToday ? (
            <Link href="/menus" className={buttonVariants({ variant: "secondary", size: "lg", className: "justify-start" })}>
              <UtensilsCrossed aria-hidden className="size-5" /> From a menu
            </Link>
          ) : (
            <p className="px-1 text-xs text-muted">Menus show today&apos;s food, so past days use Photo or Quick add.</p>
          )}
        </div>
      </Sheet>
    </div>
  );
}

function LogSkeleton() {
  return (
    <div className="space-y-4 pt-6" aria-busy="true" aria-label="Loading log">
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-36 rounded-lg" />
      <Skeleton className="h-14 rounded-lg" />
      <Skeleton className="h-14 rounded-lg" />
    </div>
  );
}
