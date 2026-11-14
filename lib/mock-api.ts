/*
 * In-browser fake backend used when NEXT_PUBLIC_USE_MOCKS=true.
 * Mirrors the routes in lib/api.ts. Adds 300–900 ms latency, and every call
 * fails with a 500 when the page URL has ?fail=1 (for testing error states).
 *
 * Data written here (profile, logs) is kept in localStorage under "cf.mockdb"
 * so the demo survives a refresh. That stands in for the real database.
 *
 * Dining hall menus are NOT fake: they come from the scraper output via
 * lib/scraper-menus.ts, the same source the real /api/menus route uses.
 */
import type { HttpMethod, PlatesBody } from "./api";
import type { FoodLog, FoodLogInput, MealPeriod, MenuItem, Profile, ProfileInput } from "./types";
import { ApiError } from "./errors";
import { computeTargets } from "./targets";
import { schoolDate } from "./meal-period";
import { getSession } from "./session";
import { LOCATIONS } from "@/mock/locations";
import { RETAIL_ITEMS } from "@/mock/retail-items";
import { mockEvents } from "@/mock/events";
import { DEMO_EMAIL, DEMO_PROFILE, demoHistory, demoLogs } from "@/mock/demo-profile";
import { mockTargetsExplanation, MOCK_PHOTO_ESTIMATE } from "@/mock/ai";
import { filterForProfile } from "./diet";
import { buildPlates } from "./plate-builder";
import { hallMenuItems } from "./scraper-menus";

const DB_KEY = "cf.mockdb";

interface MockDb {
  profiles: Record<string, Profile>; // by email
  logs: FoodLog[];
  /** Date the demo user's breakfast was last seeded, so it reappears each day. */
  demoSeededFor: string | null;
}

function loadDb(): MockDb {
  try {
    const raw = window.localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw) as MockDb;
  } catch {
    // fall through to a fresh db
  }
  return { profiles: { [DEMO_EMAIL]: DEMO_PROFILE }, logs: [], demoSeededFor: null };
}

function saveDb(db: MockDb) {
  try {
    window.localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    // storage full or blocked: keep working in memory for this call
  }
}

/** Wipes mock data (used by "reset demo" during practice runs). */
export function resetMockDb() {
  try {
    window.localStorage.removeItem(DB_KEY);
  } catch {}
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function fail(status: number, message: string): never {
  throw new ApiError(status, message);
}

/** Scraped dining hall items (carry the scraped menu's date) plus static retail items. */
function allMenuItems(): MenuItem[] {
  return [...hallMenuItems(), ...RETAIL_ITEMS];
}

const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export async function mockRequest<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
  await sleep(300 + Math.random() * 600);
  if (new URLSearchParams(window.location.search).has("fail")) fail(500, "Simulated failure (?fail=1)");

  const url = new URL(path, "http://mock");
  const q = url.searchParams;
  const route = `${method} ${/^\/api\/logs\/[^/]+$/.test(url.pathname) ? "/api/logs/:id" : url.pathname}`;
  const today = schoolDate();
  const db = loadDb();
  const email = getSession()?.email;
  const profile = email ? db.profiles[email] ?? null : null;

  // Seed the demo user's breakfast once per day.
  if (email === DEMO_EMAIL && db.demoSeededFor !== today) {
    db.logs = [...db.logs.filter((l) => l.profile_id !== DEMO_PROFILE.id), ...demoLogs(today), ...demoHistory(today)];
    db.demoSeededFor = today;
    saveDb(db);
  }

  const requireProfile = (): Profile => profile ?? fail(401, "Not signed in");

  switch (route) {
    case "GET /api/locations":
      return LOCATIONS as T;

    case "GET /api/menus": {
      const period = q.get("meal_period") as MealPeriod | null;
      const items = allMenuItems().filter(
        (i) =>
          (!q.get("location_id") || i.location_id === q.get("location_id")) &&
          (!period || i.meal_period === period || i.meal_period === "all_day"),
      );
      return items as T;
    }

    case "GET /api/profile":
      return profile as T;

    case "POST /api/profile": {
      if (!email) return fail(401, "Not signed in");
      const input = body as ProfileInput;
      const t = computeTargets(input);
      const saved: Profile = {
        ...input,
        id: profile?.id ?? newId("profile"),
        created_at: profile?.created_at ?? new Date().toISOString(),
        target_calories: t.calories,
        target_protein_g: t.protein_g,
        target_carbs_g: t.carbs_g,
        target_fat_g: t.fat_g,
      };
      db.profiles[email] = saved;
      saveDb(db);
      return saved as T;
    }

    case "PATCH /api/profile": {
      const p = requireProfile();
      const updated = { ...p, ...(body as Partial<Profile>) };
      db.profiles[p.email] = updated;
      saveDb(db);
      return updated as T;
    }

    case "GET /api/logs": {
      const p = requireProfile();
      const date = q.get("date") ?? today;
      return db.logs.filter((l) => l.profile_id === p.id && schoolDate(new Date(l.logged_at)) === date) as T;
    }

    case "POST /api/logs": {
      const p = requireProfile();
      const input = body as FoodLogInput;
      const log: FoodLog = { ...input, id: newId("log"), profile_id: p.id, logged_at: input.logged_at ?? new Date().toISOString() };
      db.logs.push(log);
      saveDb(db);
      return log as T;
    }

    case "PATCH /api/logs/:id":
    case "DELETE /api/logs/:id": {
      const p = requireProfile();
      const id = decodeURIComponent(url.pathname.split("/").pop() ?? "");
      const idx = db.logs.findIndex((l) => l.id === id && l.profile_id === p.id);
      if (idx === -1) return fail(404, "Log not found");
      if (method === "DELETE") {
        db.logs.splice(idx, 1);
        saveDb(db);
        return undefined as T;
      }
      db.logs[idx] = { ...db.logs[idx], ...(body as Partial<FoodLog>), id, profile_id: p.id };
      saveDb(db);
      return db.logs[idx] as T;
    }

    case "GET /api/events":
      return mockEvents(q.get("date") ?? today) as T;

    case "POST /api/ai/targets": {
      return mockTargetsExplanation(requireProfile()) as T;
    }

    case "POST /api/ai/plates": {
      const { location_id, meal_period, remaining, variant } = body as PlatesBody;
      const menu = allMenuItems().filter(
        (i) => i.location_id === location_id && (i.meal_period === meal_period || i.meal_period === "all_day"),
      );
      return buildPlates(profile ? filterForProfile(menu, profile) : menu, remaining, variant) as T;
    }

    case "POST /api/ai/photo":
      await sleep(800); // photo analysis feels slower
      return MOCK_PHOTO_ESTIMATE as T;

    default:
      return fail(404, `No mock for ${method} ${url.pathname}`);
  }
}
