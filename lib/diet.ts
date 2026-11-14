import type { Allergen, DietTag, MenuItem, Profile } from "./types";

// UTK data has no halal or pork flags, so pork is detected by name. Names aren't reliable
// (a scraped "Beef Hot Dog" lists pork in its ingredients), so hot dogs and Hawaiian pizza are
// excluded too. Words found by checking scraped ingredient lists.
// TODO(schema): the scraper has full ingredients. Ask Supul for a contains_pork flag derived from
// them, and use that here instead of name matching.
const PORK =
  /\b(pork|bacon|ham|sausages?|pepperoni|prosciutto|chorizo|carnitas|mozole|kielbasa|salami|bratwursts?|brats?|andouille|pancetta|hot ?dogs?|hawaiian)\b/i;

/** Does this item respect the user's diet tags and allergens? */
export function fitsDiet(item: MenuItem, diet: DietTag[], allergens: Allergen[]) {
  if (allergens.some((a) => item.allergens.includes(a))) return false;
  for (const tag of diet) {
    if (tag === "no_pork" || tag === "halal") {
      // Vegetarian/vegan items can't contain pork, so "Incogmeato Sausage" or "Hot Dog Bun" stay in.
      const meatFree = item.tags.includes("vegetarian") || item.tags.includes("vegan");
      if (!meatFree && PORK.test(item.name)) return false;
      // Halal can't be verified from UTK data; non-pork items are allowed through.
      continue;
    }
    if (!item.tags.includes(tag)) return false;
  }
  return true;
}

export function filterForProfile(items: MenuItem[], profile: Pick<Profile, "diet_tags" | "allergens">) {
  return items.filter((i) => fitsDiet(i, profile.diet_tags, profile.allergens));
}

export const DIET_LABELS: Record<DietTag, string> = {
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  halal: "Halal",
  gluten_free: "Gluten-free",
  dairy_free: "Dairy-free",
  no_pork: "No pork",
};

/** Display names for allergens. Use these instead of showing raw values like "tree_nuts". */
export const ALLERGEN_LABELS: Record<Allergen, string> = {
  milk: "Milk",
  eggs: "Eggs",
  fish: "Fish",
  shellfish: "Shellfish",
  soy: "Soy",
  wheat: "Wheat",
  gluten: "Gluten",
  sesame: "Sesame",
  peanut: "Peanuts",
  tree_nuts: "Tree nuts",
};

/** "Milk, Tree nuts" (or lowercase for use mid-sentence). */
export function allergenList(allergens: Allergen[], { lowercase = false } = {}) {
  const names = allergens.map((a) => ALLERGEN_LABELS[a]);
  return (lowercase ? names.map((n) => n.toLowerCase()) : names).join(", ");
}

/** Short badge text for menu rows. */
export const DIET_BADGES: Partial<Record<DietTag, string>> = {
  vegan: "VG",
  vegetarian: "V",
  gluten_free: "GF",
  dairy_free: "DF",
};
