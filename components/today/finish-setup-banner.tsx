"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardList, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { OnboardingStatus } from "@/lib/types";

const DAY = 24 * 60 * 60 * 1000;
const key = (email: string) => `cf.setup-banner-dismissed:${email.toLowerCase()}`;

function dismissedRecently(email: string) {
  try {
    const at = Number(window.localStorage.getItem(key(email)));
    return Number.isFinite(at) && Date.now() - at < DAY;
  } catch {
    return false;
  }
}

/** Shown on Today until onboarding is complete. Dismissing hides it for 24 hours. */
export function FinishSetupBanner({ email, status }: { email: string; status: OnboardingStatus }) {
  const [hidden, setHidden] = useState(() => dismissedRecently(email));
  if (status === "complete" || hidden) return null;

  const copy =
    status === "skipped"
      ? "Your targets are a rough estimate for now. Finish setup (about 1 min) to make them yours."
      : "Finish setup (about 1 min) so plate picks fit your diet and meal plan.";

  return (
    <section aria-labelledby="finish-setup-heading" className="relative rounded-lg border border-primary bg-surface p-4 pr-12 shadow-card">
      <h2 id="finish-setup-heading" className="flex items-center gap-2 font-semibold">
        <ClipboardList aria-hidden className="size-4 text-primary" /> Finish setting up
      </h2>
      <p className="mt-1 text-sm text-muted">{copy}</p>
      <Link href="/onboarding" className={buttonVariants({ size: "sm", className: "mt-3" })}>
        Continue setup
      </Link>
      <button
        type="button"
        aria-label="Hide for today"
        title="Hide for today"
        onClick={() => {
          try {
            window.localStorage.setItem(key(email), String(Date.now()));
          } catch {}
          setHidden(true);
        }}
        className="absolute right-1 top-1 flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-text"
      >
        <X aria-hidden className="size-4" />
      </button>
    </section>
  );
}
