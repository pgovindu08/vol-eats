import type { ReactNode } from "react";
import { ProfileButton } from "./profile-button";

/** Tab page header. Shows the Profile avatar unless `action` replaces it (or `profile={false}`). */
export function PageHeader({ title, subtitle, action, profile = true }: { title: string; subtitle?: ReactNode; action?: ReactNode; profile?: boolean }) {
  return (
    <header className="flex items-start justify-between gap-3 pb-4 pt-6">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {action ?? (profile ? <ProfileButton /> : null)}
    </header>
  );
}
