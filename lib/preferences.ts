// Per-device preferences (localStorage): theme and units. Not synced to the profile.
import type { UnitSystem } from "./onboarding-draft";

export type ThemePref = "system" | "light" | "dark";

const THEME_KEY = "cf.theme";
const UNITS_KEY = "cf.units";

function read(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {}
}

export function getTheme(): ThemePref {
  const v = read(THEME_KEY);
  return v === "light" || v === "dark" ? v : "system";
}

/** Saves and applies the theme. "system" removes the attribute so the OS setting decides. */
export function setTheme(pref: ThemePref) {
  write(THEME_KEY, pref);
  if (pref === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", pref);
}

export function getUnits(): UnitSystem {
  return read(UNITS_KEY) === "metric" ? "metric" : "imperial";
}

export function setUnits(units: UnitSystem) {
  write(UNITS_KEY, units);
}

/**
 * Inline script for <head>: applies the saved theme before first paint so dark mode doesn't flash.
 * Kept tiny and dependency-free on purpose.
 */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

/**
 * Demo reset (mocks only): clears every Vol Eats key on this device (accounts, drafts,
 * logs, budget prefs, banner dismissals, theme), signs in as the demo user, and reloads.
 */
export function resetAppToDemo(demoEmail: string) {
  try {
    const keys = Object.keys(window.localStorage).filter((k) => k.startsWith("cf."));
    keys.forEach((k) => window.localStorage.removeItem(k));
    window.localStorage.setItem("cf.session", JSON.stringify({ email: demoEmail, isDemo: true }));
  } catch {}
  // Full page load so every in-memory provider (and Next's preserved pages) starts fresh.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = "/today";
}
