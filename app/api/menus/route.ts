// GET /api/menus?location_id=&date=&meal_period=  →  MenuItem[]
// Dining halls come from the scraper (lib/scraper-menus.ts); retail is static (mock/retail-items.ts).
import type { MealPeriod } from "@/lib/types";
import { hallMenuItems, menuFreshness } from "@/lib/scraper-menus";
import { RETAIL_ITEMS } from "@/mock/retail-items";

const PERIODS = new Set(["breakfast", "lunch", "dinner"]);

export function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const location_id = q.get("location_id");
  const rawPeriod = q.get("meal_period");
  if (rawPeriod && !PERIODS.has(rawPeriod)) {
    return new Response(`Invalid meal_period "${rawPeriod}"`, { status: 400 });
  }
  const meal_period = rawPeriod as MealPeriod | null;

  const retail = RETAIL_ITEMS.filter(
    (i) =>
      (!location_id || i.location_id === location_id) &&
      (!meal_period || i.meal_period === meal_period || i.meal_period === "all_day"),
  );
  const items = [...hallMenuItems({ location_id, meal_period }), ...retail];

  const dates = menuFreshness().filter((f) => !location_id || f.location_id === location_id);
  return Response.json(items, {
    headers: {
      // Date of the scraped menu (may lag "today" until the next scrape lands).
      "X-Menu-Date": dates.map((d) => d.date ?? "unknown").join(","),
    },
  });
}
