// ── transformer.ts ─────────────────────────────────────────────────────────────
// Bridge between engine layer and existing UI/store types.
// Engine types and store types stay independent — this is the ONLY connection.
// Never modify MealPlanEntry or FoodEntry to accommodate engine types.

import type { ComposedMeal, ComposedDayPlan } from "./composedTypes"
import type { MealPlanEntry, DietTag } from "../store/useHealthStore"
import { computeMealMacros, formatIngredientDisplay } from "./macroEngine"
import { getRecipe } from "./recipeRegistry"
import { FOODS } from "./foodDatabase"

// ── toMealPlanEntry ────────────────────────────────────────────────────────────
// Converts one ComposedMeal to the existing MealPlanEntry format.
// Macros are computed fresh — never trusted from stored values.

export function toMealPlanEntry(
  meal: ComposedMeal,
  opts: {
    lang:    "hi" | "en"
    dietTag: DietTag
    day?:    string
    id?:     string
  }
): MealPlanEntry {
  const macros  = computeMealMacros(meal)
  const recipe  = getRecipe(meal.recipeId)
  const lang    = opts.lang

  // Build ingredient strings: "3 पूरे अंडे — उबले और छिले"
  const ingredients = meal.ingredients.map(ing => {
    const food = FOODS[ing.foodId]
    if (!food) return `${ing.quantity} ${ing.foodId}`
    return formatIngredientDisplay(ing.foodId, ing.quantity, ing.prepNote, lang)
  })

  // Steps from recipe registry. For composite meals (thali = dal + sabzi +
  // protein), concatenate each sub-recipe's steps under its own dish header so
  // the cook gets instructions for every component, not just the main dish.
  // Single-recipe meals (extraRecipeIds absent) keep a flat step list with no
  // header, exactly as before.
  let steps: string[]
  if (meal.extraRecipeIds && meal.extraRecipeIds.length > 0) {
    const allRecipeIds = [meal.recipeId, ...meal.extraRecipeIds]
    steps = []
    for (const rid of allRecipeIds) {
      const r = getRecipe(rid)
      const rSteps = r.steps[lang]
      if (!rSteps || rSteps.length === 0) continue
      // Dish header — recipe's localized name, so the cook can tell sections apart.
      steps.push(`— ${r.name[lang]} —`)
      for (const s of rSteps) steps.push(s)
    }
  } else {
    steps = recipe.steps[lang]
  }

  return {
    id:          opts.id ?? `gen-${meal.slot}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name:        meal.name,
    time:        meal.time,
    protein:     macros.protein,
    carbs:       macros.carbs,
    netCarbs:    Math.round((macros.carbs - macros.fiber) * 10) / 10,  // derived, never stored
    fat:         macros.fat,
    cal:         macros.calories,
    tag:         opts.dietTag,
    ingredients,
    steps,
    day:         opts.day,
    isPreset:    false,
  }
}

// ── toDayMealPlanEntries ───────────────────────────────────────────────────────
// Converts a full ComposedDayPlan to MealPlanEntry[].

export function toDayMealPlanEntries(
  plan: ComposedDayPlan,
  opts: {
    lang:    "hi" | "en"
    dietTag: DietTag
    day?:    string
  }
): MealPlanEntry[] {
  return plan.meals.map((meal, idx) =>
    toMealPlanEntry(meal, { ...opts, id: `gen-${opts.day ?? "today"}-${idx}` })
  )
}

// ── toFoodEntry ────────────────────────────────────────────────────────────────
// Converts one ComposedMeal to FoodEntry (for the food log).
// Groups the entire meal as one log entry.
// source + referencePlanId are stored as metadata for traceability.

export function toFoodEntry(
  meal:          ComposedMeal,
  planInstanceId: string
): {
  id:              string
  name:            string
  calories:        number
  protein:         number
  carbs:           number
  fat:             number
  timestamp:       number
  source:          "generated" | "manual"
  referencePlanId: string
} {
  const macros = computeMealMacros(meal)

  return {
    id:              `log-${meal.slot}-${Date.now()}`,
    name:            meal.name,
    calories:        macros.calories,
    protein:         macros.protein,
    carbs:           macros.carbs,
    fat:             macros.fat,
    timestamp:       Date.now(),
    source:          "generated",
    referencePlanId: planInstanceId,
  }
}
