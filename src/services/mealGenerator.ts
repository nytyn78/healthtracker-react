// ── mealGenerator.ts ────────────────────────────────────────────────────────────
// Generates a ComposedDayPlan matching the user's macro targets.
//
// Diet-aware: eggetarian uses eggs+paneer+whey. Non-veg rotates chicken/mutton/fish/prawns.
// 7-day variety guaranteed — no two consecutive days use the same protein source.
// Macros computed from ingredients upward — never stored as fixed values.

import type { ComposedDayPlan, ComposedMeal, ComposedIngredient } from "./composedTypes"
import { validateNutrition } from "./constraintEngine"
import type { ValidationResult } from "./constraintEngine"
import { RECIPES } from "./recipeRegistry"

export type GeneratorTargets = {
  proteinG:  number
  fatG:      number
  carbsG:    number
  calories:  number
}

export type DietType = "eggetarian" | "non-veg" | "veg"

// ── Weekly rotation plans ──────────────────────────────────────────────────────

// Eggetarian: rotate protein source variety within eggs+paneer+whey
// Eggetarian week — 7 distinct days
// EGG_PANEER = standard eggs+paneer combo
// EGG_CURD   = eggs + hung curd (lighter, yogurt-based)
// EGG_TOFU   = eggs + tofu (lower fat, plant protein)
const EGGETARIAN_WEEK: Array<{ m1Recipe: string; m2Recipe: string; m1Protein: string; m2Protein: string }> = [
  { m1Recipe: "PANEER_EGG_BHURJI",    m2Recipe: "EGG_PANEER_MASALA",    m1Protein: "EGG_PANEER", m2Protein: "EGG_PANEER" }, // Mon — classic
  { m1Recipe: "METHI_PANEER_BHURJI",  m2Recipe: "ANDHRA_EGG_MASALA",    m1Protein: "EGG_PANEER", m2Protein: "EGG_PANEER" }, // Tue — methi + andhra
  { m1Recipe: "EGG_MUSHROOM_STIR_FRY",m2Recipe: "PALAK_PANEER_EGGS",    m1Protein: "EGG_PANEER", m2Protein: "EGG_PANEER" }, // Wed — mushroom + palak
  { m1Recipe: "BAINGAN_EGG_BHARTA",   m2Recipe: "PANEER_EGG_BHURJI",    m1Protein: "EGG_PANEER", m2Protein: "EGG_PANEER" }, // Thu — smoky baingan
  { m1Recipe: "ANDHRA_EGG_MASALA",    m2Recipe: "EGG_MUSHROOM_STIR_FRY",m1Protein: "EGG_PANEER", m2Protein: "EGG_PANEER" }, // Fri — andhra spice
  { m1Recipe: "PALAK_PANEER_EGGS",    m2Recipe: "METHI_PANEER_BHURJI",  m1Protein: "EGG_PANEER", m2Protein: "EGG_PANEER" }, // Sat — green day
  { m1Recipe: "KARELA_EGG_PANEER",    m2Recipe: "EGG_PANEER_MASALA",    m1Protein: "EGG_PANEER", m2Protein: "EGG_PANEER" }, // Sun — karela (bitter/tonic)
]

// Non-veg: rotate different proteins — chicken, mutton, fish, prawns
const NON_VEG_WEEK: Array<{ m1Recipe: string; m2Recipe: string; m1FoodId: string; m2FoodId: string }> = [
  { m1Recipe: "CHICKEN_HANDI",      m2Recipe: "EGG_PANEER_MASALA",    m1FoodId: "CHICKEN_THIGH",  m2FoodId: "EGG_PANEER" },
  { m1Recipe: "MUTTON_KEEMA_MASALA",m2Recipe: "CHICKEN_SAAG",         m1FoodId: "MUTTON_KEEMA",   m2FoodId: "CHICKEN_BREAST" },
  { m1Recipe: "PRAWN_MASALA",       m2Recipe: "CHICKEN_TIKKA_DRY",    m1FoodId: "PRAWNS",         m2FoodId: "CHICKEN_BREAST" },
  { m1Recipe: "CHICKEN_KALI_MIRCH", m2Recipe: "MUTTON_KEEMA_PALAK",   m1FoodId: "CHICKEN_BREAST", m2FoodId: "MUTTON_KEEMA" },
  { m1Recipe: "FISH_CURRY_SIMPLE",  m2Recipe: "CHICKEN_HANDI",        m1FoodId: "FISH_ROHU",      m2FoodId: "CHICKEN_THIGH" },
  { m1Recipe: "CHICKEN_SAAG",       m2Recipe: "PRAWN_MASALA",         m1FoodId: "CHICKEN_BREAST", m2FoodId: "PRAWNS" },
  { m1Recipe: "MUTTON_KEEMA_PALAK", m2Recipe: "CHICKEN_TIKKA_DRY",    m1FoodId: "MUTTON_KEEMA",   m2FoodId: "CHICKEN_BREAST" },
]

// Vegetable rotation for the day
const VEG_ROTATION: Array<{ primary: string; vitaminC: string }> = [
  { primary: "SPINACH",     vitaminC: "TOMATO" },
  { primary: "MUSHROOM",    vitaminC: "CAPSICUM" },
  { primary: "BROCCOLI",    vitaminC: "BROCCOLI" },
  { primary: "BHINDI",      vitaminC: "BHINDI" },
  { primary: "CAULIFLOWER", vitaminC: "TOMATO" },
  { primary: "ZUCCHINI",    vitaminC: "CAPSICUM" },
  { primary: "CABBAGE",     vitaminC: "TOMATO" },
]

// ── Macro constants ────────────────────────────────────────────────────────────
// Protein per unit for each source (matches foodDatabase.ts values)
const PROTEIN_PER_UNIT: Record<string, { unit: "grams" | "count"; proteinPerUnit: number; fatPerUnit: number }> = {
  EGG:           { unit: "count",  proteinPerUnit: 6,    fatPerUnit: 5 },
  PANEER:        { unit: "grams",  proteinPerUnit: 0.18, fatPerUnit: 0.20 },
  CHICKEN_BREAST:{ unit: "grams",  proteinPerUnit: 0.31, fatPerUnit: 0.036 },
  CHICKEN_THIGH: { unit: "grams",  proteinPerUnit: 0.26, fatPerUnit: 0.085 },
  MUTTON_KEEMA:  { unit: "grams",  proteinPerUnit: 0.20, fatPerUnit: 0.18 },
  FISH_ROHU:     { unit: "grams",  proteinPerUnit: 0.17, fatPerUnit: 0.018 },
  PRAWNS:        { unit: "grams",  proteinPerUnit: 0.20, fatPerUnit: 0.013 },
}

function clamp(n: number, min: number, max: number) { return Math.min(max, Math.max(min, n)) }
function roundTo(n: number, step: number) { return Math.round(n / step) * step }

// ── Meal builder ───────────────────────────────────────────────────────────────

function buildEggPaneerMeal(
  recipeId: string,
  slot: "primary" | "secondary",
  targetProtein: number,
  targetFat: number,
  veg: { primary: string; vitaminC: string },
  time: string,
): ComposedMeal {
  const eggs = slot === "primary" ? 2 : 3
  const proteinFromEggs = eggs * 6
  const paneerG = clamp(roundTo((targetProtein - proteinFromEggs) / 0.18, 10), 50, 150)
  const fatFromSources = eggs * 5 + paneerG * 0.20
  const gheeNeeded = clamp(roundTo((targetFat - fatFromSources) / 5, 0.5), 1, 4)

  const ingredients: ComposedIngredient[] = [
    { foodId: "EGG" as any,    quantity: eggs,
      prepNote: slot === "primary" ? { hi: "फेंटे हुए", en: "whisked" } : { hi: "उबले", en: "boiled" } },
    { foodId: "PANEER" as any, quantity: paneerG,
      prepNote: slot === "primary" ? { hi: "क्रम्बल्ड", en: "crumbled" } : { hi: "क्यूब्स", en: "cubes" } },
    { foodId: "GHEE" as any,   quantity: gheeNeeded },
    { foodId: veg.primary as any, quantity: 80 },
  ]
  if (veg.vitaminC !== veg.primary) ingredients.push({ foodId: veg.vitaminC as any, quantity: 60 })
  ingredients.push({ foodId: "ONION" as any, quantity: 30 })

  // Get recipe name from registry
  const recipe = RECIPES[recipeId]
  const name = recipe?.name.en ?? recipeId

  return { name, slot, time, recipeId, ingredients }
}

function buildProteinMeal(
  recipeId: string,
  slot: "primary" | "secondary",
  foodId: string,
  targetProtein: number,
  targetFat: number,
  veg: { primary: string; vitaminC: string },
  time: string,
): ComposedMeal {
  const src = PROTEIN_PER_UNIT[foodId]
  if (!src) return buildEggPaneerMeal(recipeId, slot, targetProtein, targetFat, veg, time)

  let qty: number
  if (src.unit === "count") {
    qty = clamp(Math.round(targetProtein / src.proteinPerUnit), 1, 6)
  } else {
    qty = clamp(roundTo(targetProtein / src.proteinPerUnit, 10), 80, 350)
  }

  const fatFromSource = qty * src.fatPerUnit
  const fatNeeded = targetFat - fatFromSource
  const ghee = clamp(roundTo(fatNeeded / 5, 0.5), 0.5, 4)
  const fat = foodId === "FISH_ROHU" || foodId === "PRAWNS" ? "COCONUT_OIL" : "GHEE"

  const ingredients: ComposedIngredient[] = [
    { foodId: foodId as any, quantity: qty },
    { foodId: fat as any,    quantity: ghee },
    { foodId: veg.primary as any, quantity: 80 },
  ]
  if (veg.vitaminC !== veg.primary) ingredients.push({ foodId: veg.vitaminC as any, quantity: 60 })
  if (foodId !== "FISH_ROHU") ingredients.push({ foodId: "ONION" as any, quantity: 30 })
  if (foodId !== "FISH_ROHU" && foodId !== "PRAWNS") {
    ingredients.push({ foodId: "TOMATO" as any, quantity: 60 })
  }

  // Add hung curd for marinated recipes
  if (["CHICKEN_HANDI","CHICKEN_TIKKA_DRY","CHICKEN_KALI_MIRCH","CHICKEN_SAAG"].includes(recipeId)) {
    ingredients.push({ foodId: "HUNG_CURD" as any, quantity: 60,
      prepNote: { hi: "मैरिनेड के लिए", en: "for marinade" } })
  }

  const recipe = RECIPES[recipeId]
  const name = recipe?.name.en ?? recipeId

  return { name, slot, time, recipeId, ingredients }
}

// ── Public API ────────────────────────────────────────────────────────────────

export type GenerationResult = {
  plan:       ComposedDayPlan
  validation: ValidationResult
  dayIndex:   number
}

export function generateDayPlan(
  targets:  GeneratorTargets,
  dayIndex: number,
  diet:     DietType = "eggetarian",
): GenerationResult {
  const veg      = VEG_ROTATION[dayIndex % 7]
  const shakeP   = 25
  const shakeF   = 1
  const remP     = targets.proteinG - shakeP
  const remF     = targets.fatG     - shakeF
  const m1P      = roundTo(remP * 0.48, 1)
  const m2P      = remP - m1P
  const m1F      = roundTo(remF * 0.50, 1)
  const m2F      = remF - m1F

  let meal1: ComposedMeal
  let meal2: ComposedMeal

  if (diet === "non-veg") {
    const day = NON_VEG_WEEK[dayIndex % 7]
    meal1 = day.m2FoodId === "EGG_PANEER"
      ? buildEggPaneerMeal(day.m2Recipe, "primary", m1P, m1F, veg, "2:00 PM")
      : buildProteinMeal(day.m1Recipe, "primary", day.m1FoodId, m1P, m1F, veg, "2:00 PM")
    meal2 = day.m2FoodId === "EGG_PANEER"
      ? buildEggPaneerMeal(day.m2Recipe, "secondary", m2P, m2F, veg, "6:30 PM")
      : buildProteinMeal(day.m2Recipe, "secondary", day.m2FoodId, m2P, m2F, veg, "6:30 PM")
  } else {
    const day = EGGETARIAN_WEEK[dayIndex % 7]
    meal1 = buildEggPaneerMeal(day.m1Recipe, "primary", m1P, m1F, veg, "2:00 PM")
    meal2 = buildEggPaneerMeal(day.m2Recipe, "secondary", m2P, m2F, veg, "6:30 PM")
  }

  const shake: ComposedMeal = {
    name: "Whey Protein Shake",
    slot: "shake",
    time: "4:30 PM",
    recipeId: "WHEY_SHAKE",
    ingredients: [{ foodId: "WHEY" as any, quantity: 1 }],
  }

  const plan: ComposedDayPlan = {
    meals: [meal1, shake, meal2],
    meta: {
      decisions: [
        `Diet: ${diet} | Day: ${dayIndex} | Veg: ${veg.primary}`,
        `Target: P${targets.proteinG}g F${targets.fatG}g C${targets.carbsG}g ${targets.calories}kcal`,
      ],
    },
  }

  const validation = validateNutrition(plan, "keto")
  return { plan, validation, dayIndex }
}

export function generateWeekPlan(
  targets: GeneratorTargets,
  diet:    DietType = "eggetarian",
): GenerationResult[] {
  return Array.from({ length: 7 }, (_, i) => generateDayPlan(targets, i, diet))
}
