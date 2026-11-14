"use client";

import { useEffect } from "react";
import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { Button, buttonVariants } from "@/components/ui/button";

// Last-resort screen for unexpected crashes: friendly copy, never a raw error.
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-(--content-max) flex-col items-center justify-center gap-4 px-4 text-center">
      <LogoMark size={56} />
      <h1 className="font-display text-2xl font-bold">Something went wrong</h1>
      <p className="text-sm text-muted">That screen hit a snag. Your logged meals are safe.</p>
      <div className="flex gap-3">
        <Button onClick={retry}>Try again</Button>
        <Link href="/today" className={buttonVariants({ variant: "secondary" })}>
          Go to Today
        </Link>
      </div>
    </main>
  );
}
