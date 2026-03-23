// ── macroEngine.ts ─────────────────────────────────────────────────────────────
// Derives macro totals upward from ingredients.
// Never reads stored macro values. Always computes from FOODS × quantity.

import { FOODS } from "./foodDatabase"
import type { Macro } from "./foodDatabase"
import type { ComposedMeal, ComposedDayPlan } from "./composedTypes"

const ZERO_MACRO: Macro = { protein: 0, carbs: 0, fat: 0, calories: 0, fiber: 0 }

function addMacros(a: Macro, b: Macro): Macro {
  return {
    protein:  a.protein  + b.protein,
    carbs:    a.carbs    + b.carbs,
    fat:      a.fat      + b.fat,
    calories: a.calories + b.calories,
    fiber:    a.fiber    + b.fiber,
  }
}

function roundMacro(m: Macro, decimals = 1): Macro {
  const f = (n: number) => Math.round(n * 10 ** decimals) / 10 ** decimals
  return {
    protein:  f(m.protein),
    carbs:    f(m.carbs),
    fat:      f(m.fat),
    calories: f(m.calories),
    fiber:    f(m.fiber),
  }
}

export function computeMealMacros(meal: ComposedMeal): Macro {
  const total = meal.ingredients.reduce((acc, ingredient) => {
    const food = FOODS[ingredient.foodId]
    if (!food) {
      console.warn(`[macroEngine] Unknown foodId: ${ingredient.foodId}`)
      return acc
    }
    const scaled: Macro = {
      protein:  food.macros.protein  * ingredient.quantity,
      carbs:    food.macros.carbs    * ingredient.quantity,
      fat:      food.macros.fat      * ingredient.quantity,
      calories: food.macros.calories * ingredient.quantity,
      fiber:    food.macros.fiber    * ingredient.quantity,
    }
    return addMacros(acc, scaled)
  }, { ...ZERO_MACRO })

  return roundMacro(total)
}

export function computeDayMacros(plan: ComposedDayPlan): Macro {
  const total = plan.meals.reduce((acc, meal) => {
    return addMacros(acc, computeMealMacros(meal))
  }, { ...ZERO_MACRO })

  return roundMacro(total)
}

// ── Ingredient display helpers ──────────────────────────────────────────────

// Returns formatted quantity string respecting unitType
// e.g. EGG quantity 3 → "3"  |  PANEER quantity 80 → "80g"  |  WHEY quantity 1 → "1 scoop"
export function formatQuantity(foodId: keyof typeof FOODS, quantity: number): string {
  const food = FOODS[foodId]
  if (!food) return `${quantity}`

  // Enforce no fractional counts
  if (food.unitType === "count") {
    const whole = Math.round(quantity)
    return `${whole}`
  }
  if (food.unitType === "grams") {
    const rounded = Math.round(quantity / food.quantization.step) * food.quantization.step
    return `${rounded}g`
  }
  if (food.unitType === "scoop") {
    return quantity === 1 ? "1 scoop" : `${quantity} scoops`
  }
  if (food.unitType === "tsp") {
    return quantity === 1 ? "1 tsp" : `${quantity} tsp`
  }
  return `${quantity}`
}

// Returns full ingredient display string in requested language
// e.g. "3 पूरे अंडे — उबले और छिले"  or  "3 Whole Eggs — boiled and peeled"
export function formatIngredientDisplay(
  foodId: keyof typeof FOODS,
  quantity: number,
  prepNote: { hi: string; en: string } | undefined,
  lang: "hi" | "en"
): string {
  const food = FOODS[foodId]
  if (!food) return `${quantity} ${foodId}`

  const qty   = formatQuantity(foodId, quantity)
  const name  = food.displayName[lang]
  const prep  = prepNote?.[lang]

  return prep ? `${qty} ${name} — ${prep}` : `${qty} ${name}`
}
