import { describe, expect, it } from "vitest";
import { buildPlates, mealBudget } from "./plate-builder";
import { computeTargets } from "./targets";
import type { Macros, MenuItem } from "./types";

const item = (id: string, station: string, calories: number, protein_g: number, carbs_g: number, fat_g: number): MenuItem => ({
  id,
  location_id: "loc-test",
  date: "2026-11-14",
  meal_period: "lunch",
  station,
  name: id,
  serving_size: null,
  calories,
  protein_g,
  carbs_g,
  fat_g,
  tags: [],
  allergens: [],
});

const MENU: MenuItem[] = [
  item("chicken", "Grill", 180, 32, 0, 5),
  item("salmon", "Entree", 250, 25, 0, 15),
  item("burger", "Burgers", 500, 28, 40, 25),
  item("rice", "Sides", 200, 4, 44, 0),
  item("pasta", "Pasta", 350, 12, 60, 6),
  item("beans", "Vegan", 220, 14, 38, 1),
  item("eggs", "Omelet", 140, 12, 1, 10),
  item("broccoli", "Veg", 50, 4, 8, 0),
  item("salad", "Salad", 80, 3, 10, 3),
  item("cookie", "Bakery", 200, 2, 28, 9),
];

const remainingFor = (weight_kg: number, height_cm: number, age: number, sex: "male" | "female", activity_level: "light" | "very_active", goal_type: "lose_fat" | "build_muscle"): Macros =>
  computeTargets({ weight_kg, height_cm, age, sex, activity_level, goal_type });

describe("mealBudget", () => {
  it("splits what's left over the meals still to come", () => {
    const r = { calories: 1800, protein_g: 120, carbs_g: 200, fat_g: 60 };
    expect(mealBudget(r, "breakfast").calories).toBe(600);
    expect(mealBudget(r, "lunch").protein_g).toBe(60);
    expect(mealBudget(r, "dinner")).toEqual(r);
  });
});

describe("buildPlates", () => {
  it("sizes the high-protein plate to the user's lunch budget", () => {
    const remaining = { calories: 2400, protein_g: 180, carbs_g: 270, fat_g: 70 };
    const plate = buildPlates(MENU, remaining).plates[0];
    expect(plate.title).toBe("High-protein plate");
    expect(plate.totals.calories).toBeLessThanOrEqual(1200 * 1.15);
    expect(plate.totals.calories).toBeGreaterThanOrEqual(1200 * 0.7);
    expect(Math.abs(plate.totals.protein_g - 90 * 1.15)).toBeLessThanOrEqual(30);
  });

  it("gives a big, active lifter a bigger plate than a small user cutting", () => {
    const big = remainingFor(95, 190, 20, "male", "very_active", "build_muscle");
    const small = remainingFor(55, 160, 20, "female", "light", "lose_fat");
    const bigPlate = buildPlates(MENU, big).plates[0];
    const smallPlate = buildPlates(MENU, small).plates[0];
    expect(bigPlate.totals.calories).toBeGreaterThan(smallPlate.totals.calories + 300);
    expect(bigPlate.totals.protein_g).toBeGreaterThan(smallPlate.totals.protein_g);
  });

  it("keeps servings in 0.5 steps between 0.5 and 2, skips desserts and doesn't repeat items across plates", () => {
    const { plates } = buildPlates(MENU, { calories: 1600, protein_g: 120, carbs_g: 180, fat_g: 50 });
    expect(plates).toHaveLength(3);
    const ids = plates.flatMap((p) => p.items.map((i) => i.menu_item_id));
    expect(ids).not.toContain("cookie");
    expect(new Set(ids).size).toBe(ids.length);
    for (const i of plates.flatMap((p) => p.items)) {
      expect(i.servings * 2).toBe(Math.round(i.servings * 2));
      expect(i.servings).toBeGreaterThanOrEqual(0.5);
      expect(i.servings).toBeLessThanOrEqual(2);
    }
  });

  it("offers one light snack when the day's calories are used up", () => {
    const { plates } = buildPlates(MENU, { calories: 100, protein_g: 0, carbs_g: 0, fat_g: 0 });
    expect(plates).toHaveLength(1);
    expect(plates[0].totals.calories).toBeLessThanOrEqual(300);
  });

  it("Regenerate (variant) changes the picks; empty menu gives no plates", () => {
    const r = { calories: 1600, protein_g: 120, carbs_g: 180, fat_g: 50 };
    const names = (v: number) => buildPlates(MENU, r, v).plates.flatMap((p) => p.items.map((i) => i.menu_item_id)).join();
    expect([1, 2, 3].some((v) => names(v) !== names(0))).toBe(true);
    expect(buildPlates([], r).plates).toEqual([]);
  });
});
