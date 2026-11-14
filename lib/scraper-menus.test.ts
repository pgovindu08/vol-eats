import { describe, expect, it } from "vitest";
import { hallMenuItems, plausible, tagsFor, toMenuItems, type ScraperHallMenu, type ScraperItem } from "./scraper-menus";

const item = (over: Partial<ScraperItem> = {}): ScraperItem => ({
  id: "1",
  name: "Grilled Chicken",
  station: "Grill",
  period: "Lunch",
  serving: "4 oz",
  nutrition: { calories: 180.4, protein: 31.6, carbohydrate: 0.2, total_fat: 5.5 },
  vegan: false,
  vegetarian: false,
  contains: { milk: false, gluten: false, wheat: false, soy: true },
  ...over,
});

const menu = (items: ScraperItem[]): ScraperHallMenu => ({ hallId: "rockytop", date: "2026-11-14", scrapedAt: "x", items });

describe("toMenuItems", () => {
  it("maps a scraper item to a MenuItem", () => {
    expect(toMenuItems(menu([item()]), "loc-rockytop")).toEqual([
      {
        id: "loc-rockytop-1-lunch",
        location_id: "loc-rockytop",
        date: "2026-11-14",
        meal_period: "lunch",
        station: "Grill",
        name: "Grilled Chicken",
        serving_size: "4 oz",
        calories: 180,
        protein_g: 32,
        carbs_g: 0,
        fat_g: 6,
        tags: ["gluten_free", "dairy_free"],
        allergens: ["soy"],
      },
    ]);
  });

  it("drops toppings, implausible calories, unknown periods and duplicates", () => {
    const out = toMenuItems(
      menu([
        item({ id: "a", station: "Pizza Toppings" }),
        item({ id: "b", nutrition: { calories: 19010, protein: 1, carbohydrate: 1, total_fat: 1 } }),
        item({ id: "c", nutrition: { calories: 200, protein: null, carbohydrate: 1, total_fat: 1 } }),
        item({ id: "d", period: "Late Night" }),
        item({ id: "e" }),
        item({ id: "e" }),
      ]),
      "loc-stokely",
    );
    expect(out.map((i) => i.id)).toEqual(["loc-stokely-e-lunch"]);
  });
});

describe("tagsFor / plausible", () => {
  it("vegan implies vegetarian", () => {
    expect(tagsFor(item({ vegan: true, vegetarian: true, contains: { milk: true } }))).toEqual(["vegan", "vegetarian"]);
  });
  it("rejects missing calories", () => {
    expect(plausible(item({ nutrition: {} }))).toBe(false);
  });
});

describe("hallMenuItems (real scraper data)", () => {
  it("returns items for both halls with valid fields", () => {
    const all = hallMenuItems();
    for (const loc of ["loc-rockytop", "loc-stokely"]) {
      expect(all.some((i) => i.location_id === loc)).toBe(true);
    }
    for (const i of all) {
      expect(["breakfast", "lunch", "dinner"]).toContain(i.meal_period);
      expect(i.calories).toBeGreaterThan(20);
    }
  });

  it("filters by location and meal period", () => {
    const out = hallMenuItems({ location_id: "loc-stokely", meal_period: "lunch" });
    expect(out.every((i) => i.location_id === "loc-stokely" && i.meal_period === "lunch")).toBe(true);
  });
});
