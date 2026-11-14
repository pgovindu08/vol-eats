"use client";

import { useState } from "react";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shown when a saved draft is found: continue (default) or start over (asks to confirm). */
export function ResumeCard({ step, total, onContinue, onStartOver }: { step: number; total: number; onContinue: () => void; onStartOver: () => void }) {
  const [confirming, setConfirming] = useState(false);

  return (
    <section aria-labelledby="resume-heading" className="mb-6 rounded-lg border bg-surface p-4 shadow-card">
      <h2 id="resume-heading" className="flex items-center gap-2 font-semibold">
        <History aria-hidden className="size-4 text-primary" /> Welcome back
      </h2>
      {confirming ? (
        <>
          <p className="mt-1 text-sm text-muted">Clear your saved answers and start from step 1?</p>
          <div className="mt-3 flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirming(false)}>
              Keep my answers
            </Button>
            <Button size="sm" className="bg-danger text-surface" onClick={onStartOver}>
              Yes, start over
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">
            Pick up where you left off: step {step} of {total}.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={onContinue}>
              Continue
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
              Start over
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
