"use client";

import Link from "next/link";
import { ChevronRight, Sparkles, UtensilsCrossed } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ProfileButton } from "@/components/layout/profile-button";
import { FinishSetupBanner } from "@/components/today/finish-setup-banner";
import { FreeFoodCard } from "@/components/today/free-food-card";
import { MacroSummary } from "@/components/today/macro-summary";
import { buttonVariants } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatLongDate, greeting } from "@/lib/format";
import { useLogs } from "@/lib/hooks/use-logs";
import { useProfile } from "@/lib/hooks/use-profile";
import { remaining, targetsOf } from "@/lib/macros";

export default function TodayPage() {
  const { profile, loading: profileLoading, error: profileError, reload: reloadProfile } = useProfile();
  const { logs, eaten, loading: logsLoading, error: logsError, reload: reloadLogs } = useLogs();

  if (profileError) {
    return (
      <div className="pt-10">
        <ErrorState error={profileError} onRetry={reloadProfile} />
      </div>
    );
  }
  if (profileLoading || !profile) return <TodaySkeleton />;

  const targets = targetsOf(profile);
  const left = remaining(targets, eaten);
  const firstName = profile.display_name?.split(" ")[0];

  return (
    <div className="space-y-5 pt-4">
      <div className="flex items-center justify-between gap-3">
        <Logo size={30} />
        <ProfileButton />
      </div>
      <header>
        <div>
          <p className="text-sm text-muted">{formatLongDate()}</p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">
            {greeting()}
            {firstName ? `, ${firstName}` : ""}
          </h1>
        </div>
      </header>

      <FinishSetupBanner email={profile.email} status={profile.onboarding_status} />

      {logsError ? (
        <ErrorState error={logsError} onRetry={reloadLogs} />
      ) : logsLoading ? (
        <Skeleton className="h-64 rounded-lg" />
      ) : (
        <MacroSummary eaten={eaten} targets={targets} />
      )}

      {/* Small shortcut; the Food tab is the main place for "what should I eat". */}
      <Link href="/food" className="flex min-h-11 items-center gap-2 rounded-md border bg-surface px-4 py-2 text-sm hover:bg-surface-2">
        <Sparkles aria-hidden className="size-4 text-primary" />
        <span className="flex-1">Not sure what to eat? <span className="font-semibold">See picks near you</span></span>
        <ChevronRight aria-hidden className="size-4 text-muted" />
      </Link>

      <FreeFoodCard remainingCalories={left.calories} />

      {logsError || logsLoading ? null : logs.length ? (
        <Link href="/log" className="flex min-h-11 items-center gap-2 rounded-md border bg-surface px-4 py-3 text-sm hover:bg-surface-2">
          <span className="flex-1">
            Logged <span className="font-semibold">{logs.length} {logs.length === 1 ? "meal" : "meals"}</span> · {Math.round(eaten.calories).toLocaleString()} cal
          </span>
          <span className="font-medium text-muted">View in Log</span>
          <ChevronRight aria-hidden className="size-4 text-muted" />
        </Link>
      ) : (
        <section className="rounded-lg border border-dashed bg-surface p-6 text-center">
          <UtensilsCrossed aria-hidden className="mx-auto size-6 text-muted" />
          <p className="mt-2 text-sm text-muted">Nothing logged yet today.</p>
          <Link href="/log" className={buttonVariants({ variant: "secondary", size: "sm", className: "mt-3" })}>
            Log a meal
          </Link>
        </section>
      )}
    </div>
  );
}

function TodaySkeleton() {
  return (
    <div className="space-y-5 pt-6" aria-busy="true" aria-label="Loading today">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-64 rounded-lg" />
      <Skeleton className="h-12" />
      <Skeleton className="h-32 rounded-lg" />
    </div>
  );
}
