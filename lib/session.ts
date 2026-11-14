// Mock session (localStorage). Real auth replaces this file only.
const KEY = "cf.session";

export interface Session {
  email: string;
  isDemo: boolean;
}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

/**
 * Sign out with a full page load, not router navigation. Next keeps visited pages alive
 * in memory (<Activity>), so a soft navigation would carry one user's in-memory state
 * (onboarding answers, profile, logs) over to whoever signs in next on the same device.
 */
export function signOut() {
  setSession(null);
  // A full reload is intentional here (Next's "State and authentication" guide recommends it for logout).
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = "/login";
}

export function setSession(session: Session | null) {
  try {
    if (session) window.localStorage.setItem(KEY, JSON.stringify(session));
    else window.localStorage.removeItem(KEY);
  } catch {
    // Storage blocked (private mode): the session just won't persist.
  }
}
