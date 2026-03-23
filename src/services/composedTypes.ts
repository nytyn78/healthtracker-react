// ── composedTypes.ts ───────────────────────────────────────────────────────────
// Engine-layer types. Never merged with store types.
// Transformer converts ComposedDayPlan → MealPlanEntry[] for the UI.

import type { FoodId } from "./foodDatabase"

export type MealSlot = "primary" | "secondary" | "shake"

export type ComposedIngredient = {
  foodId:    FoodId
  quantity:  number       // in units matching FoodItem.unitType
  prepNote?: {
    hi: string
    en: string
  }
}

export type ComposedMeal = {
  name:        string
  slot:        MealSlot
  time:        string     // display only — "2:00 PM" etc.
  recipeId:    string
  ingredients: ComposedIngredient[]
}

export type ComposedDayPlan = {
  meals: ComposedMeal[]
  meta: {
    decisions: string[]   // explainability log — not user-facing initially
  }
}

export type PlanInstance = {
  id:           string
  date:         string
  dietType:     string
  composedPlan: ComposedDayPlan
  status:       "generated" | "edited" | "completed"
}

// ── Ground truth test case — Keto Day ─────────────────────────────────────────
// Hand-constructed. Used to verify macro engine and validator before generator.
// Target: ~95–105g protein, ~1400–1550 kcal, <25g carbs, ≥12g fiber (keto)
//
// Manual calculation (verify against computeDayMacros output):
//
// MEAL 1 — Paneer Bhurji with Eggs + Spinach (2:00 PM)
//   2 EGG       → 12g P, 1.2g C, 10g F, 140 kcal, 0g fiber
//   100g PANEER → 18g P, 2g C,  20g F, 265 kcal, 0g fiber
//   2 tsp GHEE  → 0g P,  0g C,  10g F, 90 kcal,  0g fiber
//   80g SPINACH → 2.3g P, 2.9g C, 0.3g F, 18.4 kcal, 1.76g fiber
//   60g TOMATO  → 0.5g P, 2.3g C, 0.1g F, 10.8 kcal, 0.72g fiber
//   40g ONION   → 0.4g P, 3.7g C, 0g F,   16 kcal,   0.68g fiber
//   Meal 1 total → ~33.2g P, ~12.1g C, ~40.4g F, ~540 kcal, ~3.16g fiber
//
// SHAKE — Whey (4:30 PM)
//   1 WHEY      → 25g P, 2g C, 1g F, 120 kcal, 0g fiber
//
// MEAL 2 — Egg Masala with Paneer (6:30 PM)
//   3 EGG       → 18g P, 1.8g C, 15g F, 210 kcal, 0g fiber
//   80g PANEER  → 14.4g P, 1.6g C, 16g F, 212 kcal, 0g fiber
//   2 tsp GHEE  → 0g P, 0g C, 10g F, 90 kcal, 0g fiber
//   50g SPINACH → 1.45g P, 1.8g C, 0.2g F, 11.5 kcal, 1.1g fiber
//   80g TOMATO  → 0.72g P, 3.1g C, 0.16g F, 14.4 kcal, 0.96g fiber
//   40g ONION   → 0.44g P, 3.7g C, 0.04g F, 16 kcal, 0.68g fiber
//   Meal 2 total → ~38.0g P, ~12.0g C, ~41.4g F, ~554 kcal, ~2.74g fiber
//
// DAY TOTAL (manual): ~96.2g P, ~26.1g C, ~82.8g F, ~1214 kcal, ~5.9g fiber
//
// ⚠ NOTE: This day intentionally has issues for validation testing:
//   - Carbs will be slightly over 25g keto limit (test CARBS_EXCEEDED)
//   - Fiber will be under 12g keto minimum (test FIBER_LOW)
//   - Calories will be under 1400 (test CALORIES_LOW) — shake not enough to bridge
//   These are EXPECTED failures. They validate the constraint engine is working.
//
// To create a PASSING day: increase paneer in meal 2 to 120g and add cucumber salad.

export const KETO_TEST_DAY: ComposedDayPlan = {
  meals: [
    {
      name: "Paneer Bhurji with Eggs",
      slot: "primary",
      time: "2:00 PM",
      recipeId: "PANEER_EGG_BHURJI",
      ingredients: [
        { foodId: "EGG",     quantity: 2, prepNote: { hi: "फेंटे हुए", en: "whisked" } },
        { foodId: "PANEER",  quantity: 100, prepNote: { hi: "क्रम्बल्ड", en: "crumbled" } },
        { foodId: "GHEE",    quantity: 2 },
        { foodId: "SPINACH", quantity: 80, prepNote: { hi: "बारीक कटी", en: "finely chopped" } },
        { foodId: "TOMATO",  quantity: 60, prepNote: { hi: "बारीक कटा", en: "finely chopped" } },
        { foodId: "ONION",   quantity: 40, prepNote: { hi: "बारीक कटा", en: "finely chopped" } },
      ],
    },
    {
      name: "Whey Protein Shake",
      slot: "shake",
      time: "4:30 PM",
      recipeId: "WHEY_SHAKE",
      ingredients: [
        { foodId: "WHEY", quantity: 1 },
      ],
    },
    {
      name: "Egg Masala with Paneer",
      slot: "secondary",
      time: "6:30 PM",
      recipeId: "EGG_PANEER_MASALA",
      ingredients: [
        { foodId: "EGG",     quantity: 3, prepNote: { hi: "उबले और छिले", en: "boiled and peeled" } },
        { foodId: "PANEER",  quantity: 80, prepNote: { hi: "मोटे क्यूब्स", en: "thick cubes" } },
        { foodId: "GHEE",    quantity: 2 },
        { foodId: "SPINACH", quantity: 50, prepNote: { hi: "बारीक कटी", en: "finely chopped" } },
        { foodId: "TOMATO",  quantity: 80, prepNote: { hi: "बारीक कटा", en: "finely chopped" } },
        { foodId: "ONION",   quantity: 40, prepNote: { hi: "बारीक कटा", en: "finely chopped" } },
      ],
    },
  ],
  meta: { decisions: ["Hand-constructed ground truth keto test case"] },
}
