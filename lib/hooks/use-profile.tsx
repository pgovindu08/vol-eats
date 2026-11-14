"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { getSession, signOut as clearSessionAndReload } from "@/lib/session";
import type { Profile } from "@/lib/types";

interface ProfileState {
  profile: Profile | null;
  loading: boolean;
  error: unknown;
  reload: () => void;
  setProfile: (p: Profile) => void;
  signOut: () => void;
}

const ProfileContext = createContext<ProfileState | null>(null);

/**
 * Loads the signed-in user's profile once for the main app and gates access:
 * no session → /login, no profile yet → /onboarding.
 */
export function ProfileProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!getSession()) {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    api
      .getProfile()
      .then((p) => {
        if (cancelled) return;
        if (!p) router.replace("/onboarding");
        else setProfile(p);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) router.replace("/login");
        else setError(e);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [router, attempt]);

  const reload = useCallback(() => {
    setError(null);
    setLoading(true);
    setAttempt((a) => a + 1);
  }, []);

  const signOut = useCallback(() => clearSessionAndReload(), []);

  return (
    <ProfileContext.Provider value={{ profile, loading, error, reload, setProfile, signOut }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used inside <ProfileProvider>");
  return ctx;
}
