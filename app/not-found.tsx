import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-(--content-max) flex-col items-center justify-center gap-4 px-4 text-center">
      <LogoMark size={56} />
      <h1 className="font-display text-2xl font-bold">Page not found</h1>
      <p className="text-sm text-muted">That page doesn&apos;t exist.</p>
      <Link href="/today" className={buttonVariants()}>
        Go to Today
      </Link>
    </main>
  );
}
