"use client";

import Link from "next/link";
import { UserRound } from "lucide-react";
import { useProfile } from "@/lib/hooks/use-profile";

/** Round avatar in the top-right of every main tab; opens Profile. */
export function ProfileButton() {
  const { profile } = useProfile();
  const initial = (profile?.display_name ?? profile?.email ?? "").trim().charAt(0).toUpperCase();
  return (
    <Link
      href="/profile"
      aria-label="Profile and settings"
      title="Profile and settings"
      className="flex size-11 shrink-0 items-center justify-center rounded-full border bg-surface-2 text-sm font-bold text-text hover:border-primary"
    >
      {initial ? <span aria-hidden>{initial}</span> : <UserRound aria-hidden className="size-5" />}
    </Link>
  );
}
