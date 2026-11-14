/*
 * Macro-fitting plate builder. Used by the mock AI route AND as the offline
 * fallback when the real AI route is slow or fails (Aarohan's AI replaces it).
 *
 * How it works:
 * 1. Meal budget: what's left today (from the user's Mifflin-St Jeor targets,
 *    lib/targets.ts, minus what they've logged) split over the meals still to
 *    come: breakfast gets 1/3, lunch 1/2, dinner all of it.
 * 2. For each plate style (high-protein / balanced / lighter), a greedy search
 *    adds menu items and adjusts servings (0.5 to 2, in 0.5 steps) while that
 *    brings the plate's calories and macros closer to the style's target.
 *    Going over on calories costs double, so plates stay within budget.
 * 3. Plates never share items, and each plate has at most one item per
 *    station. Regenerate (`variant`) skips everything the previous variant
 *    suggested and randomly drops some of the rest, so it always changes.
 */
import { sumLogs, ZERO_MACROS } from "./macros";
import { currentMealPeriod } from "./meal-period";
import type { Macros, MealPeriod, MenuItem, Plate, PlateItem, PlateRecommendation } from "./types";

const KEYS = ["calories", "protein_g", "carbs_g", "fat_g"] as const;
type Key = (typeof KEYS)[number];
type Weights = Record<Key, number>;

/** Meals still to eat today, including this one. */
export const MEALS_LEFT: Record<MealPeriod, number> = { breakfast: 3, lunch: 2, dinner: 1 };
/** Minimum scale per macro when measuring error, so tiny targets don't blow up the score. */
const ERROR_FLOOR: Macros = { calories: 300, protein_g: 20, carbs_g: 30, fat_g: 10 };
const MAX_ITEMS = 4;
const MIN_SERVINGS = 0.5;
const MAX_SERVINGS = 2;
const SNACK: Macros = { calories: 200, protein_g: 15, carbs_g: 15, fat_g: 6 };
/** Sweets can fit macros on paper; keep them out of suggested meals. */
const DESSERT = /bakery|dessert|cookie|brownie|cake|pastry|donut|muffin|waffle bar/i;

interface Style {
  id: string;
  title: string;
  /** Fraction of the meal budget this plate aims for, per macro. */
  scale: Weights;
  /** How much missing each macro matters. */
  weights: Weights;
}

const STYLES: Style[] = [
  {
    id: "plate-protein",
    title: "High-protein plate",
    scale: { calories: 1, protein_g: 1.15, carbs_g: 0.85, fat_g: 0.85 },
    weights: { calories: 1, protein_g: 3, carbs_g: 0.4, fat_g: 0.4 },
  },
  {
    id: "plate-balanced",
    title: "Balanced plate",
    scale: { calories: 1, protein_g: 1, carbs_g: 1, fat_g: 1 },
    weights: { calories: 1.5, protein_g: 1.5, carbs_g: 1, fat_g: 1 },
  },
  {
    id: "plate-light",
    title: "Lighter plate",
    scale: { calories: 0.65, protein_g: 0.85, carbs_g: 0.55, fat_g: 0.55 },
    weights: { calories: 2, protein_g: 1.5, carbs_g: 0.4, fat_g: 0.4 },
  },
];

/** This meal's share of what's left today. */
export function mealBudget(remaining: Macros, period: MealPeriod): Macros {
  const n = MEALS_LEFT[period];
  return {
    calories: remaining.calories / n,
    protein_g: remaining.protein_g / n,
    carbs_g: remaining.carbs_g / n,
    fat_g: remaining.fat_g / n,
  };
}

function scaleBy(m: Macros, s: Weights): Macros {
  return { calories: m.calories * s.calories, protein_g: m.protein_g * s.protein_g, carbs_g: m.carbs_g * s.carbs_g, fat_g: m.fat_g * s.fat_g };
}

/** Weighted squared relative error; overshooting calories counts double. */
function score(total: Macros, target: Macros, w: Weights): number {
  let s = 0;
  for (const k of KEYS) {
    const d = (total[k] - target[k]) / Math.max(target[k], ERROR_FLOOR[k]);
    s += w[k] * d * d * (k === "calories" && d > 0 ? 2 : 1);
  }
  return s;
}

const toPlateItem = (m: MenuItem, servings: number): PlateItem => ({
  menu_item_id: m.id,
  name: m.name,
  servings,
  calories: m.calories,
  protein_g: m.protein_g,
  carbs_g: m.carbs_g,
  fat_g: m.fat_g,
});

/** Deterministic PRNG so the same `variant` always gives the same plates. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Choice {
  item: MenuItem;
  servings: number;
}

const totalsOf = (choices: Choice[]): Macros =>
  choices.length ? sumLogs(choices.map((c) => ({ ...c.item, servings: c.servings }))) : ZERO_MACROS;

/** Greedy local search: add an item or nudge a serving while it improves the fit. */
export function fillPlate(pool: MenuItem[], target: Macros, weights: Weights): Choice[] {
  let choices: Choice[] = [];
  let best = score(ZERO_MACROS, target, weights);

  for (let step = 0; step < 16; step++) {
    const candidates: Choice[][] = [];

    // Add a new item (one per station keeps plates varied).
    if (choices.length < MAX_ITEMS) {
      const stations = new Set(choices.map((c) => c.item.station ?? c.item.id));
      for (const item of pool) {
        if (stations.has(item.station ?? item.id)) continue;
        for (const servings of [1, 0.5]) candidates.push([...choices, { item, servings }]);
      }
    }
    // Change a serving size.
    choices.forEach((c, i) => {
      for (const delta of [0.5, -0.5]) {
        const servings = c.servings + delta;
        if (servings < MIN_SERVINGS || servings > MAX_SERVINGS) continue;
        candidates.push(choices.map((q, j) => (j === i ? { ...q, servings } : q)));
      }
    });

    let bestCandidate: Choice[] | null = null;
    let bestScore = best - 1e-9;
    for (const cand of candidates) {
      const s = score(totalsOf(cand), target, weights);
      if (s < bestScore) {
        bestScore = s;
        bestCandidate = cand;
      }
    }
    if (!bestCandidate) break;
    choices = bestCandidate;
    best = bestScore;
  }
  return choices;
}

function reasonFor(style: Style, totals: Macros, budget: Macros, remaining: Macros, period: MealPeriod, snack: boolean): string {
  if (snack) return "You've about hit today's calories, so this is a light option if you're still hungry.";
  const n = MEALS_LEFT[period];
  const share = n === 1 ? "everything you have left today" : `about 1/${n} of what's left today (${Math.round(remaining.calories)} cal over ${n} meals)`;
  const p = Math.round(totals.protein_g);
  const lead =
    style.id === "plate-protein"
      ? `${p} g protein toward your ${Math.round(remaining.protein_g)} g left today`
      : style.id === "plate-light"
        ? `Lighter at ${Math.round(totals.calories)} cal with ${p} g protein`
        : `${Math.round(totals.calories)} cal and ${p} g protein`;
  return `${lead}. Sized for your ${period} budget of ${Math.round(budget.calories)} cal, ${share}.`;
}

/**
 * Builds up to three plates that fit the user's remaining macros for this meal.
 * `period` defaults to the menu's meal period (or the current one for all-day retail menus).
 */
export function buildPlates(menu: MenuItem[], remaining: Macros, variant = 0, period?: MealPeriod): PlateRecommendation {
  if (menu.length === 0) return { plates: [] };
  const location_id = menu[0].location_id;
  const menuPeriod = menu.find((m) => m.meal_period !== "all_day")?.meal_period;
  const meal: MealPeriod = period ?? (menuPeriod && menuPeriod !== "all_day" ? menuPeriod : currentMealPeriod());

  const budget = mealBudget(remaining, meal);
  const snack = budget.calories < 150;
  const styles = snack ? STYLES.filter((s) => s.id === "plate-light") : STYLES;

  // Candidate pool: real meals (no desserts) when there are enough of them.
  const meals = menu.filter((m) => m.calories > 0 && !DESSERT.test(`${m.station ?? ""} ${m.name}`));
  let pool = meals.length >= 3 ? meals : menu;

  if (variant > 0) {
    // Regenerate: skip what the previous variant suggested, then randomly drop ~35% of the rest.
    const previous = new Set(
      buildPlates(menu, remaining, variant - 1, meal).plates.flatMap((p) => p.items.map((i) => i.menu_item_id)),
    );
    const unseen = pool.filter((m) => !previous.has(m.id));
    if (unseen.length >= 1) pool = unseen;
    const rand = mulberry32(variant * 7919);
    const kept = pool.filter(() => rand() > 0.35);
    if (kept.length >= 3) pool = kept;
  }

  const used = new Set<string>();
  const plates: Plate[] = [];
  for (const style of styles) {
    const fresh = pool.filter((m) => !used.has(m.id));
    if (!fresh.length) break;
    const target = snack ? SNACK : scaleBy(budget, style.scale);
    const choices = fillPlate(fresh, target, style.weights);
    if (!choices.length) continue;
    choices.forEach((c) => used.add(c.item.id));
    const items = choices.map((c) => toPlateItem(c.item, c.servings));
    const totals = sumLogs(items);
    plates.push({
      id: `${style.id}-${variant}`,
      title: style.title,
      location_id,
      items,
      totals,
      reason: reasonFor(style, totals, budget, remaining, meal, snack),
    });
  }
  return { plates };
}
