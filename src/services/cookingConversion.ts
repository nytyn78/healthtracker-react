// ── cookingConversion.ts ──────────────────────────────────────────────────────
// Raw-to-cooked mass conversion + household-unit → raw mass for Indian foods.
//
// Why this exists:
// foodDatabase.ts stores all macros per gram of RAW (uncooked, as-purchased)
// ingredient. The macro engine, meal generator, and meal-card UI need to
// translate between this internal raw-gram representation and what users
// actually see on a plate — "1 katori dal", "2 rotis", "1 glass milk".
//
// This module is the single source of truth for those conversions. It is
// pure, deterministic, and unit-testable. Callers opt in: existing code that
// already speaks raw grams (e.g. mealGenerator) does not need to change.
//
// Sources:
//   - Cooking conversion ratios: standard Indian household food-science.
//     Rice 1:3 dry-to-cooked, dal 1:2.5, atta+water → roti are the figures
//     IFCT 2017 and household cookery references converge on. They are
//     approximations (rice variety, water amount, evaporation all shift
//     ±10%); we encode the conventional single value here.
//   - Household-unit gram weights: standard Indian dietary reference
//     portions (katori ≈ 150ml ≈ 150g of typical cooked food at ~1 g/ml;
//     standard roti = 25g atta + 15g water → ~40g cooked). These align
//     with NIN dietary-survey conventions.
//
// What this module does NOT do:
//   - Generic cooking instructions (that's recipeRegistry.ts)
//   - Servings math (depends on recipe / consumer)
//   - Mutate foodDatabase (sits on top of it)
//   - Cover foods without a clean canonical household unit (raw tomato by
//     piece, stuffed parathas, idli batter ratios — all defer to recipes)

import type { FoodId } from "./foodDatabase"

// ── Conversion ratios (raw mass × ratio = cooked mass) ────────────────────────
// All ratios are unitless multipliers. Inverse (cooked → raw) is 1/ratio.

/** Rice absorbs ~2× its mass in water during cooking and retains most of it. */
export const RAW_TO_COOKED_RICE = 3.0

/** Dal/lentils absorb ~1.5× their mass; less than rice because they break down. */
export const RAW_TO_COOKED_DAL = 2.5

/**
 * Sooji (semolina) and rolled oats behave like rice for hydration purposes.
 * Both triple in mass when cooked into porridge/upma at typical Indian
 * water ratios.
 */
export const RAW_TO_COOKED_SOOJI_OATS = 3.0

/**
 * Whole grains (bajra, jowar, ragi, barley) cooked as porridge or bhakri-
 * dough behave similarly to rice — ~3× hydration. Bajra/jowar bhakri
 * specifically is closer to atta+water at 1:0.6 by mass, but for cooked
 * porridge use we treat them as rice-like.
 */
export const RAW_TO_COOKED_WHOLE_GRAIN = 3.0

// ── Atta → roti (special case: not a simple ratio) ────────────────────────────
// Roti is dry flour + water kneaded into dough, then cooked. Some water
// evaporates during cooking; final cooked roti retains most of the added
// water minus a small loss to steam.

/** Grams of atta in one standard household roti (~6-inch, ~3mm thick). */
export const ATTA_PER_ROTI_G = 25

/** Grams of water added when kneading dough for one roti. */
export const WATER_PER_ROTI_G = 15

/**
 * Grams of finished cooked roti, including retained water minus evaporation
 * loss (~3g per roti during cooking on tawa).
 * 25g atta + 15g water - ~3g evaporated = ~37g — we round to 40g as the
 * household-convention value, matching what dietary references use.
 */
export const COOKED_ROTI_G = 40

// ── Household unit gram weights (cooked, plated mass) ─────────────────────────
// "Katori" is the standard Indian steel serving bowl. ~150ml capacity, and
// because cooked rice/dal/sabzi at typical Indian texture are ~1.0 g/ml,
// 1 katori ≈ 150g of cooked food. Slight variance across "small katori"
// (~120g), "medium" (~150g), "large" (~180g) — we use medium as canonical.

/** Cooked grams in one standard Indian katori. */
export const KATORI_COOKED_G = 150

/** Standard glass (~200ml). For milk/buttermilk at ~1 g/ml, ≈ 200g. */
export const GLASS_LIQUID_G = 200

/** 1 teaspoon = 5g for solids (ghee, sugar) and ~5ml for liquids. */
export const TSP_G = 5

/** 1 tablespoon = 15g for solids, ~15ml for liquids. */
export const TBSP_G = 15

// ── Food-to-category mapping ──────────────────────────────────────────────────
// Each FoodId that has a meaningful raw/cooked distinction maps to one of
// the ratios above. Foods not in this map have no raw/cooked distinction
// (e.g. vegetables — sabzi mass changes with cooking but the calling code
// already weighs raw vegetable for macro lookup; meats — same).
//
// If a FoodId isn't listed here, getCookingRatio returns null, signalling
// "use raw mass directly; no conversion applies."

type CookingCategory =
  | { kind: "ratio";    ratio: number }              // simple raw×ratio
  | { kind: "roti" }                                 // special atta→roti math
  | { kind: "as_is" }                                // no conversion needed

const FOOD_COOKING: Partial<Record<FoodId, CookingCategory>> = {
  // Rice
  RICE_WHITE_RAW: { kind: "ratio", ratio: RAW_TO_COOKED_RICE },
  RICE_BROWN_RAW: { kind: "ratio", ratio: RAW_TO_COOKED_RICE },

  // Dal / lentils (the cooking absorbs about the same regardless of which dal)
  TOOR_DAL:    { kind: "ratio", ratio: RAW_TO_COOKED_DAL },
  CHANA_DAL:   { kind: "ratio", ratio: RAW_TO_COOKED_DAL },
  CHANA_WHOLE: { kind: "ratio", ratio: RAW_TO_COOKED_DAL },
  MOONG_DAL:   { kind: "ratio", ratio: RAW_TO_COOKED_DAL },
  URAD_DAL:    { kind: "ratio", ratio: RAW_TO_COOKED_DAL },
  URAD_WHOLE:  { kind: "ratio", ratio: RAW_TO_COOKED_DAL },
  MASOOR_DAL:  { kind: "ratio", ratio: RAW_TO_COOKED_DAL },
  RAJMA:       { kind: "ratio", ratio: RAW_TO_COOKED_DAL },

  // Flours: atta is special (roti math); maida and sooji are by mass
  ATTA:    { kind: "roti" },
  MAIDA:   { kind: "ratio", ratio: RAW_TO_COOKED_SOOJI_OATS }, // e.g. cooked as halwa
  SOOJI:   { kind: "ratio", ratio: RAW_TO_COOKED_SOOJI_OATS },

  // Oats & whole grains
  OATS_RAW: { kind: "ratio", ratio: RAW_TO_COOKED_SOOJI_OATS },
  BAJRA:    { kind: "ratio", ratio: RAW_TO_COOKED_WHOLE_GRAIN },
  JOWAR:    { kind: "ratio", ratio: RAW_TO_COOKED_WHOLE_GRAIN },
  RAGI:     { kind: "ratio", ratio: RAW_TO_COOKED_WHOLE_GRAIN },
  BARLEY:   { kind: "ratio", ratio: RAW_TO_COOKED_WHOLE_GRAIN },

  // Poha is pre-cooked rice; cooking is rehydration to ~2× initial mass.
  // Not 3× because it's already partially cooked.
  POHA: { kind: "ratio", ratio: 2.0 },
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Convert raw (uncooked) mass to cooked mass.
 * Returns null for foods with no meaningful raw/cooked distinction —
 * caller should use the input mass directly (e.g. paneer, milk, vegetables).
 */
export function rawToCookedG(foodId: FoodId, rawG: number): number | null {
  const cat = FOOD_COOKING[foodId]
  if (!cat) return null
  if (cat.kind === "ratio") return rawG * cat.ratio
  if (cat.kind === "roti") {
    // For atta-as-roti: rawG of atta yields (rawG / ATTA_PER_ROTI_G) rotis,
    // each weighing COOKED_ROTI_G after cooking.
    return (rawG / ATTA_PER_ROTI_G) * COOKED_ROTI_G
  }
  return null
}

/**
 * Convert cooked mass back to raw mass for macro lookup.
 * Returns null for foods with no meaningful raw/cooked distinction.
 */
export function cookedToRawG(foodId: FoodId, cookedG: number): number | null {
  const cat = FOOD_COOKING[foodId]
  if (!cat) return null
  if (cat.kind === "ratio") return cookedG / cat.ratio
  if (cat.kind === "roti") {
    return (cookedG / COOKED_ROTI_G) * ATTA_PER_ROTI_G
  }
  return null
}

// ── Household-unit conversions ────────────────────────────────────────────────
// These return RAW grams (for macro lookup) given a household-unit count.

export type HouseholdUnit = "katori" | "roti" | "glass" | "tsp" | "tbsp"

/**
 * Convert N household units of a food to raw grams.
 * Returns null if the combination has no canonical conversion (e.g. "katori
 * of paneer" — paneer isn't served by katori; "roti of rice" — meaningless).
 *
 * Examples:
 *   householdUnitToRawG("katori", 1, "RICE_WHITE_RAW") → 50   (150g cooked / 3.0)
 *   householdUnitToRawG("katori", 1, "TOOR_DAL")       → 60   (150g cooked / 2.5)
 *   householdUnitToRawG("roti",   2, "ATTA")           → 50   (2 × 25g atta)
 *   householdUnitToRawG("glass",  1, "COW_MILK")       → 200  (1g/ml × 200ml)
 *   householdUnitToRawG("tsp",    1, "GHEE")           → null (GHEE is already
 *                                                            stored per-tsp in
 *                                                            foodDatabase, no
 *                                                            mass conversion
 *                                                            needed)
 */
export function householdUnitToRawG(
  unit: HouseholdUnit,
  count: number,
  foodId: FoodId,
): number | null {
  if (unit === "roti") {
    // Only atta produces rotis. Whole rotis don't decompose into other foods.
    if (foodId !== "ATTA") return null
    return count * ATTA_PER_ROTI_G
  }

  if (unit === "katori") {
    // Katori applies to foods served as the cooked-staple bowl: rice, dal,
    // sabzi, porridge. Need a raw/cooked ratio to back out raw mass.
    const cookedG = count * KATORI_COOKED_G
    return cookedToRawG(foodId, cookedG)
  }

  if (unit === "glass") {
    // Glass applies to liquid foods served by volume. Milk, buttermilk.
    // Liquids have no raw/cooked distinction at this granularity.
    const milkFoods: FoodId[] = ["COW_MILK", "BUFFALO_MILK"]
    if (!milkFoods.includes(foodId)) return null
    return count * GLASS_LIQUID_G
  }

  if (unit === "tsp" || unit === "tbsp") {
    // Tsp/tbsp are for added fats and small condiments. Most of these
    // (GHEE, BUTTER, COCONUT_OIL) are already stored per-tsp in foodDatabase,
    // so passing them through here is a category error — return null so
    // callers know to use the food's native unitType directly.
    //
    // Foods stored per-gram that ARE meaningfully measured by tsp/tbsp at
    // typical kitchen scale could be added here in future. None yet qualify
    // unambiguously (sugar isn't in the DB; salt is sub-macro-noise).
    return null
  }

  return null
}

// ── Convenience: roti count <-> atta grams ────────────────────────────────────

/** How much raw atta (in grams) is needed to make N rotis? */
export function rotisToAttaG(rotis: number): number {
  return rotis * ATTA_PER_ROTI_G
}

/** How many rotis does N grams of raw atta produce? */
export function attaToRotis(attaG: number): number {
  return attaG / ATTA_PER_ROTI_G
}
