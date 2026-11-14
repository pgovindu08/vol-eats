import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FoodLog, Location, MenuItem, PlateRecommendation, Profile, ProfileInput } from "./types";
import { ApiError } from "./errors";
import { setSession } from "./session";
import { DEMO_EMAIL } from "@/mock/demo-profile";

// Minimal browser globals for the mock backend.
const store = new Map<string, string>();
const fakeWindow = {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
  location: { search: "" },
};
vi.stubGlobal("window", fakeWindow);
// Skip the fake latency.
vi.stubGlobal("setTimeout", ((fn: () => void) => (fn(), 0)) as unknown as typeof setTimeout);

const { mockRequest } = await import("./mock-api");

beforeEach(() => {
  store.clear();
  fakeWindow.location.search = "";
});

describe("mock API", () => {
  it("serves locations and filters menus by hall and period", async () => {
    const locs = await mockRequest<Location[]>("GET", "/api/locations");
    expect(locs.map((l) => l.slug)).toContain("rockytop");
    const lunch = await mockRequest<MenuItem[]>("GET", "/api/menus?location_id=loc-rockytop&meal_period=lunch");
    expect(lunch.length).toBeGreaterThan(5);
    expect(lunch.every((i) => i.location_id === "loc-rockytop" && i.meal_period === "lunch" && i.date)).toBe(true);
  });

  it("runs the demo flow: profile, seeded breakfast, add/edit/delete a log", async () => {
    setSession({ email: DEMO_EMAIL, isDemo: true });
    const profile = await mockRequest<Profile>("GET", "/api/profile");
    expect(profile.email).toBe(DEMO_EMAIL);

    const seeded = await mockRequest<FoodLog[]>("GET", "/api/logs");
    expect(seeded).toHaveLength(3);

    const added = await mockRequest<FoodLog>("POST", "/api/logs", {
      menu_item_id: null, name: "Grilled Chicken", servings: 2, calories: 120, protein_g: 17, carbs_g: 0, fat_g: 5, meal_period: "lunch", source: "menu",
    });
    await mockRequest<FoodLog>("PATCH", `/api/logs/${added.id}`, { servings: 1.5 });
    let logs = await mockRequest<FoodLog[]>("GET", "/api/logs");
    expect(logs.find((l) => l.id === added.id)?.servings).toBe(1.5);

    await mockRequest("DELETE", `/api/logs/${added.id}`);
    logs = await mockRequest<FoodLog[]>("GET", "/api/logs");
    expect(logs).toHaveLength(3);
  });

  it("computes targets when a new user saves a profile", async () => {
    setSession({ email: "new@vols.utk.edu", isDemo: false });
    expect(await mockRequest("GET", "/api/profile")).toBeNull();
    const input = {
      email: "new@vols.utk.edu", display_name: null, school_id: "school-utk", goal_text: null, sex: "female", age: 19,
      height_cm: 165, weight_kg: 60, goal_weight_kg: 57, activity_level: "light", diet_tags: ["vegetarian"], allergens: [],
      meal_plan_type: "dining_dollars", goal_type: "lose_fat", meal_plan_name: "Dining Dollar Plan",
      dining_dollars_balance: 400, swipes_remaining: null, weekly_food_budget_usd: null,
      living_situation: "off_campus_plan", favorite_location_ids: [], kitchen_access: "full", onboarding_status: "complete",
    } satisfies ProfileInput;
    const saved = await mockRequest<Profile>("POST", "/api/profile", input);
    expect(saved.target_calories).toBeGreaterThan(1200);
    expect(saved.target_protein_g).toBe(120);
  });

  it("returns plates for a hall", async () => {
    const res = await mockRequest<PlateRecommendation>("POST", "/api/ai/plates", {
      location_id: "loc-stokely", meal_period: "dinner", remaining: { calories: 1200, protein_g: 80, carbs_g: 120, fat_g: 40 },
    });
    expect(res.plates.length).toBeGreaterThanOrEqual(2);
  });

  it("returns 401 without a session and fails on ?fail=1", async () => {
    await expect(mockRequest("GET", "/api/logs")).rejects.toMatchObject({ status: 401 });
    fakeWindow.location.search = "?fail=1";
    await expect(mockRequest("GET", "/api/locations")).rejects.toBeInstanceOf(ApiError);
  });
});
