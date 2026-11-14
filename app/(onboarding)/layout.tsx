import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-(--content-max) flex-col px-4 pt-4">
      <div className="pb-4">
        <Logo size={28} />
      </div>
      {children}
    </main>
  );
}
