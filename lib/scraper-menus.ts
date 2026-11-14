/*
 * Real UTK dining hall menus, straight from the scraper output in
 * scraper/data/*.json (kept fresh by the scrape-menus GitHub Action, which
 * commits new data every 2 hours when the menu changes; each commit redeploys).
 *
 * Used by the real route handlers (app/api/menus, app/api/locations) AND by
 * lib/mock-api.ts, so mock mode and real mode show the same food.
 */
import type { Allergen, DietTag, MealPeriod, MenuItem } from "./types";
import rockytop from "@/scraper/data/rockytop.json";
import stokely from "@/scraper/data/stokely.json";

/** Subset of the scraper's HallMenu (scraper/index.d.ts) that we use. */
export interface ScraperItem {
  id: string;
  name: string;
  station: string | null;
  period: string;
  serving: string | null;
  nutrition: Record<string, number | null | undefined>;
  vegan: boolean | null;
  vegetarian: boolean | null;
  contains: Partial<Record<Allergen, boolean | null>>;
}

export interface ScraperHallMenu {
  hallId: string;
  date: string | null;
  scrapedAt: string;
  items: ScraperItem[];
}

export const HALL_MENUS: { location_id: string; menu: ScraperHallMenu }[] = [
  { location_id: "loc-rockytop", menu: rockytop as unknown as ScraperHallMenu },
  { location_id: "loc-stokely", menu: stokely as unknown as ScraperHallMenu },
];

const ALLERGENS: Allergen[] = ["milk", "eggs", "fish", "shellfish", "tree_nuts", "peanut", "wheat", "gluten", "soy", "sesame"];
const PERIODS: Record<string, MealPeriod> = { breakfast: "breakfast", lunch: "lunch", dinner: "dinner" };
/** Toppings, condiments and sauces aren't meals; keep them out of menus and plates. */
const SKIP_STATION = /topping|upon request|condiment|dressing/i;

export function tagsFor(item: ScraperItem): DietTag[] {
  const c = item.contains ?? {};
  const tags: DietTag[] = [];
  if (item.vegan) tags.push("vegan", "vegetarian");
  else if (item.vegetarian) tags.push("vegetarian");
  if (c.gluten === false && c.wheat === false) tags.push("gluten_free");
  if (c.milk === false) tags.push("dairy_free");
  return tags;
}

/** UTK data has some whole-batch values (e.g. a 19,010 kcal cookie); drop those and items missing macros. */
export function plausible(item: ScraperItem): boolean {
  const n = item.nutrition ?? {};
  const kcal = n.calories;
  return typeof kcal === "number" && kcal > 20 && kcal < 1500 && n.protein != null && n.carbohydrate != null && n.total_fat != null;
}

/** Maps one hall's scraper output to MenuItem[] (ids match the old mock: `${location_id}-${id}-${period}`). */
export function toMenuItems(menu: ScraperHallMenu, location_id: string): MenuItem[] {
  const out: MenuItem[] = [];
  const seen = new Set<string>();
  for (const i of menu.items ?? []) {
    const period = PERIODS[i.period?.toLowerCase()];
    if (!period || (i.station && SKIP_STATION.test(i.station)) || !plausible(i)) continue;
    const id = `${location_id}-${i.id}-${period}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      location_id,
      date: menu.date,
      meal_period: period,
      station: i.station,
      name: i.name,
      serving_size: i.serving,
      calories: Math.round(i.nutrition.calories ?? 0),
      protein_g: Math.round(i.nutrition.protein ?? 0),
      carbs_g: Math.round(i.nutrition.carbohydrate ?? 0),
      fat_g: Math.round(i.nutrition.total_fat ?? 0),
      tags: tagsFor(i),
      allergens: ALLERGENS.filter((a) => i.contains?.[a] === true),
    });
  }
  return out;
}

/** All dining hall items, optionally filtered. Only the latest scraped day exists, so `date` isn't filtered on. */
export function hallMenuItems(filter: { location_id?: string | null; meal_period?: MealPeriod | null } = {}): MenuItem[] {
  return HALL_MENUS.filter((h) => !filter.location_id || h.location_id === filter.location_id)
    .flatMap((h) => toMenuItems(h.menu, h.location_id))
    .filter((i) => !filter.meal_period || i.meal_period === filter.meal_period);
}

/** Date + scrape time of each hall's data, for freshness headers / debugging. */
export function menuFreshness() {
  return HALL_MENUS.map((h) => ({ location_id: h.location_id, date: h.menu.date, scrapedAt: h.menu.scrapedAt }));
}
