import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** Heading, body and the Back/Next bar shared by every onboarding step. */
export function StepShell({
  title,
  subtitle,
  formId,
  onBack,
  nextLabel = "Next",
  busy,
  secondary,
  children,
}: {
  title: string;
  subtitle?: string;
  formId: string;
  onBack?: () => void;
  nextLabel?: string;
  busy?: boolean;
  /** A quieter way out, e.g. "Set up later" or "finish the rest later". */
  secondary?: { label: string; onClick: () => void };
  children: ReactNode;
}) {
  return (
    <>
      <div className={secondary ? "flex-1 space-y-6 pb-40" : "flex-1 space-y-6 pb-28"}>
        <div>
          <h1 className="font-display text-2xl font-bold">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
        </div>
        {children}
      </div>
      <div className="fixed inset-x-0 bottom-0 border-t bg-surface pb-[env(safe-area-inset-bottom)]">
        {secondary ? (
          <div className="mx-auto flex max-w-(--content-max) justify-center px-4 pt-1">
            <button
              type="button"
              onClick={secondary.onClick}
              disabled={busy}
              className="min-h-11 px-2 text-sm font-medium text-muted underline underline-offset-4 hover:text-text disabled:opacity-50"
            >
              {secondary.label}
            </button>
          </div>
        ) : null}
        <div className="mx-auto flex max-w-(--content-max) gap-3 px-4 py-3">
          {onBack ? (
            <Button variant="secondary" size="lg" onClick={onBack} disabled={busy}>
              Back
            </Button>
          ) : null}
          <Button type="submit" form={formId} size="lg" block disabled={busy}>
            {nextLabel}
          </Button>
        </div>
      </div>
    </>
  );
}
