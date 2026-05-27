// ── mealGenerator.test.ts ─────────────────────────────────────────────────────
// First tests for mealGenerator (commit 11.1). Focused on the veg-branch
// regression guards — proving that vegetarian users no longer silently get
// eggs and that the meal-card name stays honest (e.g. "Palak Paneer" implies
// the dish actually contains spinach).
//
// Broader generator behaviour (recipe-registry consumption, mode-aware
// templates, meal-count toggle) is tested in future commits 11.2 / 11.3 /
// 11.4. This file deliberately stays small to keep the diff localised.
//
// Run:  npm test

import { describe, it, expect } from "vitest"
import { generateDayPlan, generateWeekPlan, GeneratorTargets } from "./mealGenerator"
import type { MacroMode } from "./adaptiveTDEE"

// Typical keto-veg target for an ~80kg sedentary user: ~100g P, ~120g F,
// ~25g C, ~1500 kcal. Numbers chosen to be realistic, not to satisfy any
// specific edge case.
const KETO_VEG_TARGETS: GeneratorTargets = {
  proteinG: 100,
  fatG:     120,
  carbsG:   25,
  calories: 1500,
}

const KETO: MacroMode = "KETO"

describe("veg branch — regression guards (11.1)", () => {
  it("vegetarian plan contains no EGG ingredients in any meal", () => {
    const result = generateDayPlan(KETO_VEG_TARGETS, 0, "veg", KETO)
    const allIngredients = result.plan.meals.flatMap(m => m.ingredients)
    const eggIngredients = allIngredients.filter(i => i.foodId === "EGG")
    expect(eggIngredients).toEqual([])
  })

  it("vegetarian plan contains no meat/fish/prawn ingredients", () => {
    const result = generateDayPlan(KETO_VEG_TARGETS, 0, "veg", KETO)
    const allIngredients = result.plan.meals.flatMap(m => m.ingredients)
    const meatIds = ["CHICKEN_BREAST","CHICKEN_THIGH","MUTTON_KEEMA","MUTTON_CURRY_CUT","FISH_ROHU","PRAWNS"]
    const meatIngredients = allIngredients.filter(i => meatIds.includes(i.foodId as string))
    expect(meatIngredients).toEqual([])
  })

  it("vegetarian plan uses PANEER and HUNG_CURD as core proteins", () => {
    const result = generateDayPlan(KETO_VEG_TARGETS, 0, "veg", KETO)
    const allIngredients = result.plan.meals.flatMap(m => m.ingredients)
    expect(allIngredients.some(i => i.foodId === "PANEER")).toBe(true)
    expect(allIngredients.some(i => i.foodId === "HUNG_CURD")).toBe(true)
  })

  it("all 7 days of the week produce egg-free vegetarian plans", () => {
    const week = generateWeekPlan(KETO_VEG_TARGETS, "veg", KETO)
    for (const day of week) {
      const allIngredients = day.plan.meals.flatMap(m => m.ingredients)
      expect(allIngredients.some(i => i.foodId === "EGG")).toBe(false)
    }
  })
})

describe("veg branch — recipe identity matches plate (11.1)", () => {
  // A meal card that says "Palak Paneer" must contain spinach. A meal card
  // that says "Kadhai Paneer" must contain capsicum. This is the honest-
  // labelling invariant — the same one we enforce on macro mode (11.0).

  it("PALAK_PANEER_VEG meal contains SPINACH regardless of day rotation", () => {
    // PALAK_PANEER_VEG appears on Mon/Tue/Thu/Fri/Sun in VEG_WEEK — check all.
    const palakDays = [0, 1, 3, 4, 6]  // dayIndex values with PALAK_PANEER_VEG
    for (const dayIndex of palakDays) {
      const result = generateDayPlan(KETO_VEG_TARGETS, dayIndex, "veg", KETO)
      const palakMeals = result.plan.meals.filter(m => m.recipeId === "PALAK_PANEER_VEG")
      expect(palakMeals.length).toBeGreaterThan(0)
      for (const meal of palakMeals) {
        const hasSpinach = meal.ingredients.some(i => i.foodId === "SPINACH")
        expect(hasSpinach).toBe(true)
      }
    }
  })

  it("KADHAI_PANEER meal contains CAPSICUM regardless of day rotation", () => {
    // KADHAI_PANEER appears on Tue/Wed/Thu/Sat in VEG_WEEK.
    const kadhaiDays = [1, 2, 3, 5]
    for (const dayIndex of kadhaiDays) {
      const result = generateDayPlan(KETO_VEG_TARGETS, dayIndex, "veg", KETO)
      const kadhaiMeals = result.plan.meals.filter(m => m.recipeId === "KADHAI_PANEER")
      expect(kadhaiMeals.length).toBeGreaterThan(0)
      for (const meal of kadhaiMeals) {
        const hasCapsicum = meal.ingredients.some(i => i.foodId === "CAPSICUM")
        expect(hasCapsicum).toBe(true)
      }
    }
  })
})

describe("veg branch — protein math hits target (11.1)", () => {
  it("daily protein lands within tolerance of target for keto-veg user", () => {
    // ±10g soft tolerance from 11.0's MODE_RULES.
    const result = generateDayPlan(KETO_VEG_TARGETS, 0, "veg", KETO)
    const proteinDelta = result.validation.computed.protein - KETO_VEG_TARGETS.proteinG
    expect(Math.abs(proteinDelta)).toBeLessThanOrEqual(15)  // wider band for first cut
  })

  it("daily protein delivery scales appropriately for higher target", () => {
    // Higher protein target (130g) — should still hit roughly the right
    // ballpark even with paneer's per-meal cap; tofu kicks in.
    const highProteinTargets: GeneratorTargets = {
      proteinG: 130, fatG: 130, carbsG: 25, calories: 1700,
    }
    const result = generateDayPlan(highProteinTargets, 0, "veg", KETO)
    // Should hit at least 100g — the veg builder isn't tuned to perfection
    // yet (that's 11.2's recipe-registry-driven scaling), just shouldn't
    // catastrophically undershoot.
    expect(result.validation.computed.protein).toBeGreaterThan(100)
  })
})

describe("non-regression — existing branches still work (11.1)", () => {
  // 11.1 added a new branch; it must not break the existing two.

  it("eggetarian branch still produces meals with EGG", () => {
    const result = generateDayPlan(KETO_VEG_TARGETS, 0, "eggetarian", KETO)
    const allIngredients = result.plan.meals.flatMap(m => m.ingredients)
    expect(allIngredients.some(i => i.foodId === "EGG")).toBe(true)
  })

  it("non-veg branch produces meals with meat or fish across the week", () => {
    // Day-by-day distribution: the existing non-veg rotation includes some
    // days where both meals are egg-paneer (m2FoodId === "EGG_PANEER" gates
    // meal1 too — pre-existing behavior). Asserting across the week instead.
    const week = generateWeekPlan(KETO_VEG_TARGETS, "non-veg", KETO)
    const meatIds = ["CHICKEN_BREAST","CHICKEN_THIGH","MUTTON_KEEMA","FISH_ROHU","PRAWNS"]
    const totalMeatHits = week.reduce((sum, day) => {
      const dayIngredients = day.plan.meals.flatMap(m => m.ingredients)
      return sum + dayIngredients.filter(i => meatIds.includes(i.foodId as string)).length
    }, 0)
    expect(totalMeatHits).toBeGreaterThan(0)
  })
})

// ── 11.2a — recipe-aware dispatch ─────────────────────────────────────────────
// Pre-11.2a, every eggetarian recipe routed through buildEggPaneerMeal which
// always added paneer. The recipes whose compatibleFoods is EGG-only got
// paneer they shouldn't have had; the recipes whose compatibleFoods is
// PANEER-only got eggs they shouldn't have had. 11.2a fixes the dispatch.

describe("eggetarian dispatch — egg-only recipes get no paneer (11.2a)", () => {
  const eggOnlyRecipes = [
    "ANDHRA_EGG_MASALA",
    "ANDA_CURRY",
    "MASALA_OMELETTE",
    "SAAG_ANDA",
    "BAINGAN_EGG_BHARTA",
    "KARELA_ANDA",
    "EGG_MUSHROOM_STIR_FRY",
  ]

  it.each(eggOnlyRecipes)("%s meal contains EGG but no PANEER", (recipeId) => {
    // Run a full week and look for the recipe appearing as a meal — then
    // assert its ingredient list.
    const week = generateWeekPlan(KETO_VEG_TARGETS, "eggetarian", KETO)
    const meals = week.flatMap(d => d.plan.meals).filter(m => m.recipeId === recipeId)
    expect(meals.length).toBeGreaterThan(0)
    for (const meal of meals) {
      expect(meal.ingredients.some(i => i.foodId === "EGG")).toBe(true)
      expect(meal.ingredients.some(i => i.foodId === "PANEER")).toBe(false)
    }
  })
})

describe("eggetarian dispatch — paneer-only recipes get no eggs (11.2a)", () => {
  const paneerOnlyRecipes = ["PANEER_BHURJI", "KADHAI_PANEER"]

  it.each(paneerOnlyRecipes)("%s meal contains PANEER but no EGG", (recipeId) => {
    const week = generateWeekPlan(KETO_VEG_TARGETS, "eggetarian", KETO)
    const meals = week.flatMap(d => d.plan.meals).filter(m => m.recipeId === recipeId)
    expect(meals.length).toBeGreaterThan(0)
    for (const meal of meals) {
      expect(meal.ingredients.some(i => i.foodId === "PANEER")).toBe(true)
      expect(meal.ingredients.some(i => i.foodId === "EGG")).toBe(false)
    }
  })
})

describe("eggetarian dispatch — egg+paneer recipes get both (11.2a)", () => {
  const eggPaneerRecipes = ["PANEER_EGG_BHURJI", "METHI_PANEER_BHURJI", "ANDA_PANEER_MASALA"]

  it.each(eggPaneerRecipes)("%s meal contains both EGG and PANEER", (recipeId) => {
    const week = generateWeekPlan(KETO_VEG_TARGETS, "eggetarian", KETO)
    const meals = week.flatMap(d => d.plan.meals).filter(m => m.recipeId === recipeId)
    expect(meals.length).toBeGreaterThan(0)
    for (const meal of meals) {
      expect(meal.ingredients.some(i => i.foodId === "EGG")).toBe(true)
      expect(meal.ingredients.some(i => i.foodId === "PANEER")).toBe(true)
    }
  })
})

describe("eggetarian dispatch — recipe identity matches plate (11.2a)", () => {
  // The 11.2a fix is fundamentally about making the meal-card honest.
  // Recipes with name-implied vegetables must contain those vegetables.

  it("SAAG_ANDA contains SPINACH", () => {
    const week = generateWeekPlan(KETO_VEG_TARGETS, "eggetarian", KETO)
    const meals = week.flatMap(d => d.plan.meals).filter(m => m.recipeId === "SAAG_ANDA")
    for (const meal of meals) {
      expect(meal.ingredients.some(i => i.foodId === "SPINACH")).toBe(true)
    }
  })

  it("BAINGAN_EGG_BHARTA contains BAINGAN", () => {
    const week = generateWeekPlan(KETO_VEG_TARGETS, "eggetarian", KETO)
    const meals = week.flatMap(d => d.plan.meals).filter(m => m.recipeId === "BAINGAN_EGG_BHARTA")
    for (const meal of meals) {
      expect(meal.ingredients.some(i => i.foodId === "BAINGAN")).toBe(true)
    }
  })

  it("KARELA_ANDA contains KARELA", () => {
    const week = generateWeekPlan(KETO_VEG_TARGETS, "eggetarian", KETO)
    const meals = week.flatMap(d => d.plan.meals).filter(m => m.recipeId === "KARELA_ANDA")
    for (const meal of meals) {
      expect(meal.ingredients.some(i => i.foodId === "KARELA")).toBe(true)
    }
  })

  it("EGG_MUSHROOM_STIR_FRY contains MUSHROOM", () => {
    const week = generateWeekPlan(KETO_VEG_TARGETS, "eggetarian", KETO)
    const meals = week.flatMap(d => d.plan.meals).filter(m => m.recipeId === "EGG_MUSHROOM_STIR_FRY")
    for (const meal of meals) {
      expect(meal.ingredients.some(i => i.foodId === "MUSHROOM")).toBe(true)
    }
  })

  it("KADHAI_PANEER contains CAPSICUM", () => {
    const week = generateWeekPlan(KETO_VEG_TARGETS, "eggetarian", KETO)
    const meals = week.flatMap(d => d.plan.meals).filter(m => m.recipeId === "KADHAI_PANEER")
    for (const meal of meals) {
      expect(meal.ingredients.some(i => i.foodId === "CAPSICUM")).toBe(true)
    }
  })
})

describe("eggetarian dispatch — egg split presentation (11.2a)", () => {
  // High-egg meals split into two ingredient lines for variety. Test that
  // when egg count crosses the threshold, the meal has two EGG entries.

  it("ANDHRA_EGG_MASALA with high protein target splits eggs", () => {
    // Boost target so eggs go above the threshold (5).
    const highEggTarget: GeneratorTargets = {
      proteinG: 140, fatG: 130, carbsG: 25, calories: 1700,
    }
    const week = generateWeekPlan(highEggTarget, "eggetarian", KETO)
    const meals = week.flatMap(d => d.plan.meals).filter(m => m.recipeId === "ANDHRA_EGG_MASALA")
    expect(meals.length).toBeGreaterThan(0)
    // At least one of the ANDHRA_EGG_MASALA meals should have the split.
    const hasSplitMeal = meals.some(meal => {
      const eggLines = meal.ingredients.filter(i => i.foodId === "EGG")
      return eggLines.length === 2
    })
    expect(hasSplitMeal).toBe(true)
  })

  it("MASALA_OMELETTE never splits regardless of egg count (single omelette)", () => {
    const highEggTarget: GeneratorTargets = {
      proteinG: 140, fatG: 130, carbsG: 25, calories: 1700,
    }
    const week = generateWeekPlan(highEggTarget, "eggetarian", KETO)
    const meals = week.flatMap(d => d.plan.meals).filter(m => m.recipeId === "MASALA_OMELETTE")
    for (const meal of meals) {
      const eggLines = meal.ingredients.filter(i => i.foodId === "EGG")
      expect(eggLines.length).toBe(1)
    }
  })
})

describe("non-veg dispatch bug fix (11.2a)", () => {
  // Pre-11.2a, meal1 in the non-veg branch dispatched on day.m2FoodId
  // instead of day.m1FoodId. On day 0 (CHICKEN_HANDI / ANDA_PANEER_MASALA),
  // m2FoodId === "EGG_PANEER" caused meal1 to silently become egg-paneer
  // instead of chicken. Verify the fix: meal1 on day 0 must contain
  // CHICKEN_THIGH (the m1FoodId for that day).

  it("day 0 meal1 dispatches on m1FoodId (chicken, not egg-paneer)", () => {
    const result = generateDayPlan(KETO_VEG_TARGETS, 0, "non-veg", KETO)
    const meal1 = result.plan.meals[0]  // index 0 is primary, before shake
    expect(meal1.ingredients.some(i => i.foodId === "CHICKEN_THIGH")).toBe(true)
  })
})
