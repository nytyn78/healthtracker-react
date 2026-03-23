// ── constraintEngine.ts ────────────────────────────────────────────────────────
// Phase 1: keto validation only.
// Validates nutrition constraints. Ingredient validator is a separate concern.
// Does NOT correct plans — correction loop is a future layer.

import { computeDayMacros } from "./macroEngine"
import { FOODS } from "./foodDatabase"
import type { ComposedDayPlan } from "./composedTypes"

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

// ── Issue types ───────────────────────────────────────────────────────────────

export type IssueCode =
  | "PROTEIN_LOW"
  | "PROTEIN_HIGH"              // >110g — hard error
  | "PROTEIN_OVER_TARGET"       // 105–110g — warning only
  | "CALORIES_LOW"
  | "CALORIES_HIGH"
  | "CARBS_EXCEEDED"
  | "FIBER_LOW"
  | "PROTEIN_SOURCE_INSUFFICIENT"  // replaces WHEY_MISSING — protein can't be met
  | "NO_VITAMIN_C_SOURCE"
  | "INGREDIENT_COUNT_EXCEEDED"

export type Issue = {
  type:    "error" | "warning" | "info"
  code:    IssueCode
  message: string
}

export type ValidationResult = {
  valid:    boolean
  issues:   Issue[]
  computed: {
    protein:  number
    carbs:    number     // always TOTAL carbs
    netCarbs: number     // derived: carbs - fiber (never stored)
    fat:      number
    calories: number
    fiber:    number
  }
}

// ── Diet rules ─────────────────────────────────────────────────────────────────

export type DietType = "keto" | "lowCarb" | "balanced"

export const DIET_RULES: Record<DietType, {
  calorieMin:  number
  calorieMax:  number
  proteinMin:  number
  proteinSoftMax: number  // warning threshold
  proteinHardMax: number  // error threshold
  carbsMax:    number
  carbsMin?:   number
  fiberMin:    number     // diet-specific — keto relaxed to 12g
  fiberTarget: number
}> = {
  keto: {
    calorieMin:      1400,
    calorieMax:      1550,
    proteinMin:      95,
    proteinSoftMax:  105,
    proteinHardMax:  110,
    carbsMax:        25,
    fiberMin:        12,   // relaxed for keto — strict 15g conflicts with <25g carb ceiling
    fiberTarget:     15,
  },
  lowCarb: {
    calorieMin:      1400,
    calorieMax:      1550,
    proteinMin:      95,
    proteinSoftMax:  105,
    proteinHardMax:  110,
    carbsMax:        70,
    carbsMin:        50,
    fiberMin:        15,
    fiberTarget:     20,
  },
  balanced: {
    calorieMin:      1400,
    calorieMax:      1550,
    proteinMin:      95,
    proteinSoftMax:  105,
    proteinHardMax:  110,
    carbsMax:        150,
    carbsMin:        120,
    fiberMin:        15,
    fiberTarget:     20,
  },
}

// ── Ingredient validator helpers ───────────────────────────────────────────────

const MAX_CORE_INGREDIENTS_PER_MEAL = 5  // trace/spice items excluded
const MAX_TOTAL_INGREDIENTS_PER_MEAL = 8

function checkIngredientCounts(plan: ComposedDayPlan): Issue[] {
  const issues: Issue[] = []
  for (const meal of plan.meals) {
    if (meal.slot === "shake") continue  // shake slot exempt

    const coreCount  = meal.ingredients.filter(i => !FOODS[i.foodId]?.isTrace).length
    const totalCount = meal.ingredients.length

    if (totalCount > MAX_TOTAL_INGREDIENTS_PER_MEAL) {
      issues.push({
        type: "warning",
        code: "INGREDIENT_COUNT_EXCEEDED",
        message: `${meal.name}: ${totalCount} ingredients exceeds max of ${MAX_TOTAL_INGREDIENTS_PER_MEAL}`,
      })
    } else if (coreCount > MAX_CORE_INGREDIENTS_PER_MEAL) {
      issues.push({
        type: "info",
        code: "INGREDIENT_COUNT_EXCEEDED",
        message: `${meal.name}: ${coreCount} core ingredients — consider simplifying`,
      })
    }
  }
  return issues
}

function checkVitaminCSource(plan: ComposedDayPlan): Issue | null {
  const hasVitaminC = plan.meals.some(meal =>
    meal.ingredients.some(i => FOODS[i.foodId]?.tags?.includes("vitamin-c"))
  )
  if (!hasVitaminC) {
    return {
      type: "warning",
      code: "NO_VITAMIN_C_SOURCE",
      message: "No Vitamin C source detected. Add tomato, cucumber, or capsicum.",
    }
  }
  return null
}

// ── Main validator ─────────────────────────────────────────────────────────────

export function validateNutrition(
  plan: ComposedDayPlan,
  dietType: DietType
): ValidationResult {
  const rules   = DIET_RULES[dietType]
  const totals  = computeDayMacros(plan)
  const issues: Issue[] = []

  // ── Protein ──────────────────────────────────────────────────────────────────
  if (totals.protein < rules.proteinMin) {
    issues.push({
      type: "error",
      code: "PROTEIN_LOW",
      message: `Protein ${totals.protein}g is below minimum ${rules.proteinMin}g`,
    })
  } else if (totals.protein > rules.proteinHardMax) {
    issues.push({
      type: "error",
      code: "PROTEIN_HIGH",
      message: `Protein ${totals.protein}g exceeds hard maximum ${rules.proteinHardMax}g`,
    })
  } else if (totals.protein > rules.proteinSoftMax) {
    issues.push({
      type: "warning",
      code: "PROTEIN_OVER_TARGET",
      message: `Protein ${totals.protein}g exceeds target range (${rules.proteinMin}–${rules.proteinSoftMax}g)`,
    })
  }

  // ── Calories ─────────────────────────────────────────────────────────────────
  if (totals.calories < rules.calorieMin) {
    issues.push({
      type: "error",
      code: "CALORIES_LOW",
      message: `Calories ${totals.calories} kcal below minimum ${rules.calorieMin} kcal`,
    })
  } else if (totals.calories > rules.calorieMax) {
    issues.push({
      type: "error",
      code: "CALORIES_HIGH",
      message: `Calories ${totals.calories} kcal exceeds maximum ${rules.calorieMax} kcal`,
    })
  }

  // ── Carbs ─────────────────────────────────────────────────────────────────────
  // NOTE: carbs.max represents:
  //   - NET carbs (carbs - fiber) for keto  → glycemic impact is what matters
  //   - TOTAL carbs for all other diets     → energy balance is what matters
  const effectiveCarbs = dietType === "keto"
    ? totals.carbs - totals.fiber
    : totals.carbs

  if (effectiveCarbs > rules.carbsMax) {
    issues.push({
      type: "error",
      code: "CARBS_EXCEEDED",
      message: dietType === "keto"
        ? `Net carbs ${round1(effectiveCarbs)}g exceeds keto limit of ${rules.carbsMax}g (total: ${totals.carbs}g, fiber: ${totals.fiber}g)`
        : `Carbs ${effectiveCarbs}g exceeds ${dietType} limit of ${rules.carbsMax}g`,
    })
  }
  if (rules.carbsMin !== undefined && effectiveCarbs < rules.carbsMin) {
    issues.push({
      type: "warning",
      code: "CARBS_EXCEEDED",
      message: `Carbs ${effectiveCarbs}g below minimum ${rules.carbsMin}g for ${dietType}`,
    })
  }

  // ── Fiber ─────────────────────────────────────────────────────────────────────
  if (totals.fiber < rules.fiberMin) {
    issues.push({
      type: "error",
      code: "FIBER_LOW",
      message: `Fiber ${totals.fiber}g below minimum ${rules.fiberMin}g for ${dietType}`,
    })
  } else if (totals.fiber < rules.fiberTarget) {
    issues.push({
      type: "info",
      code: "FIBER_LOW",
      message: `Fiber ${totals.fiber}g — target is ${rules.fiberTarget}g`,
    })
  }

  // ── Vitamin C ─────────────────────────────────────────────────────────────────
  const vitCIssue = checkVitaminCSource(plan)
  if (vitCIssue) issues.push(vitCIssue)

  // ── Ingredient counts ─────────────────────────────────────────────────────────
  issues.push(...checkIngredientCounts(plan))

  const errors = issues.filter(i => i.type === "error")

  return {
    valid: errors.length === 0,
    issues,
    computed: {
      protein:  totals.protein,
      carbs:    totals.carbs,
      netCarbs: round1(totals.carbs - totals.fiber),
      fat:      totals.fat,
      calories: totals.calories,
      fiber:    totals.fiber,
    },
  }
}
