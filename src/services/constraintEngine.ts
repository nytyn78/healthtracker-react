// ── constraintEngine.ts ────────────────────────────────────────────────────────
// Mode-aware nutrition validator (commit 11.0).
// Validates a generated plan against (a) the user's prescribed macro targets
// and (b) mode-specific carb/fibre rules. Does NOT correct plans — correction
// is a future layer.
//
// 11.0 changes vs the pre-11.0 keto-only validator:
//   - DietType ("keto" | "lowCarb" | "balanced") → MacroMode (the canonical
//     6-mode union from adaptiveTDEE.ts). Single source of truth for mode.
//   - Protein and calorie checks parameterised against the user's actual
//     GeneratorTargets, not hardcoded to 95-110g protein / 1400-1550 kcal
//     (those were calibrated to one specific user and broke for anyone else).
//   - Carb / fibre rules tightened mode by mode so "validator passes" matches
//     "macro profile honestly reflects the chosen mode" (e.g. a 280g-carb
//     LOW_CARB plan is now flagged; previously only > 70g failed).

import { computeDayMacros } from "./macroEngine"
import { FOODS } from "./foodDatabase"
import type { ComposedDayPlan, GeneratorTargets } from "./composedTypes"
import type { MacroMode } from "./adaptiveTDEE"

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

// ── Issue types ───────────────────────────────────────────────────────────────

export type IssueCode =
  | "PROTEIN_LOW"                  // > soft tolerance below target
  | "PROTEIN_HIGH"                 // > hard tolerance above target (error)
  | "PROTEIN_OVER_TARGET"          // soft–hard tolerance band above target (warning)
  | "CALORIES_LOW"                 // > tolerance below target
  | "CALORIES_HIGH"                // > tolerance above target
  | "CARBS_EXCEEDED"               // above mode ceiling (or below floor)
  | "FIBER_LOW"
  | "PROTEIN_SOURCE_INSUFFICIENT"  // protein target unreachable
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

// ── Mode rules ────────────────────────────────────────────────────────────────
// Mode-specific carb and fibre rules. Protein and calorie targets come from
// the user's GeneratorTargets at call time — those are user-specific and
// don't belong in a static table.
//
// Carb numbers are set to the LOWER half of each mode's MODE_PROFILES band
// in adaptiveTDEE.ts. This keeps "mode label" and "macro profile" honest:
// a BALANCED plan at 280g carbs flexes within band; a BALANCED plan at 320g
// is flagged because at that point it's drifted from the mode's identity.
//
// Fibre minimums scale with carb headroom (KETO can't reach 25g fibre with
// < 30g net carbs, so fibre min relaxed to 12g; balanced has headroom for 25g).

export type ModeRules = {
  carbsMax:     number   // upper ceiling for carbs (net for KETO, total elsewhere)
  carbsMin?:    number   // lower floor — only for non-KETO modes
  carbsAreNet:  boolean  // KETO uses net carbs (total - fibre); others use total
  fiberMin:     number   // error threshold
  fiberTarget:  number   // info threshold (above min, below target)
}

export const MODE_RULES: Record<MacroMode, ModeRules> = {
  KETO:             { carbsMax: 30,  carbsAreNet: true,  fiberMin: 12, fiberTarget: 15 },
  VERY_LOW_CARB:    { carbsMax: 70,  carbsMin: 50,  carbsAreNet: false, fiberMin: 15, fiberTarget: 20 },
  LOW_CARB:         { carbsMax: 110, carbsMin: 80,  carbsAreNet: false, fiberMin: 18, fiberTarget: 25 },
  BALANCED:         { carbsMax: 280, carbsMin: 130, carbsAreNet: false, fiberMin: 25, fiberTarget: 30 },
  HIGH_PROTEIN_CUT: { carbsMax: 220, carbsMin: 80,  carbsAreNet: false, fiberMin: 20, fiberTarget: 28 },
  RECOMPOSITION:    { carbsMax: 250, carbsMin: 100, carbsAreNet: false, fiberMin: 22, fiberTarget: 28 },
}

// ── Target tolerances ─────────────────────────────────────────────────────────
// How close the day's actual macros must land to the prescribed targets.
// Soft = warning band; hard = error band. Centred on user's actual targets,
// not on a one-user-specific absolute range.

const PROTEIN_TOLERANCE_SOFT_G = 10   // ±10g around target is fine
const PROTEIN_TOLERANCE_HARD_G = 20   // > 20g over target is a hard error
const CALORIE_TOLERANCE_KCAL   = 100  // ±100 kcal around target

// ── Ingredient validator helpers ───────────────────────────────────────────────

const MAX_CORE_INGREDIENTS_PER_MEAL = 5  // trace/spice items excluded
const MAX_TOTAL_INGREDIENTS_PER_MEAL = 8

function checkIngredientCounts(plan: ComposedDayPlan): Issue[] {
  const issues: Issue[] = []
  for (const meal of plan.meals) {
    if (meal.slot === "shake") continue  // shake slot exempt

    const coreCount  = meal.ingredients.filter(i => !(FOODS[i.foodId] as any)?.isTrace).length
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
    meal.ingredients.some(i => (FOODS[i.foodId] as any)?.tags?.includes("vitamin-c"))
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
  plan:      ComposedDayPlan,
  macroMode: MacroMode,
  targets:   GeneratorTargets,
): ValidationResult {
  const rules   = MODE_RULES[macroMode]
  const totals  = computeDayMacros(plan)
  const issues: Issue[] = []

  // ── Protein (parameterised against user's target, not hardcoded band) ───────
  const proteinDelta = totals.protein - targets.proteinG  // signed: + = over target
  if (-proteinDelta > PROTEIN_TOLERANCE_SOFT_G) {
    issues.push({
      type: "error",
      code: "PROTEIN_LOW",
      message: `Protein ${totals.protein}g is ${round1(-proteinDelta)}g below target ${targets.proteinG}g`,
    })
  } else if (proteinDelta > PROTEIN_TOLERANCE_HARD_G) {
    issues.push({
      type: "error",
      code: "PROTEIN_HIGH",
      message: `Protein ${totals.protein}g is ${round1(proteinDelta)}g over target ${targets.proteinG}g (>${PROTEIN_TOLERANCE_HARD_G}g hard limit)`,
    })
  } else if (proteinDelta > PROTEIN_TOLERANCE_SOFT_G) {
    issues.push({
      type: "warning",
      code: "PROTEIN_OVER_TARGET",
      message: `Protein ${totals.protein}g is ${round1(proteinDelta)}g over target ${targets.proteinG}g`,
    })
  }

  // ── Calories (parameterised against user's target) ──────────────────────────
  const calorieDelta = totals.calories - targets.calories
  if (-calorieDelta > CALORIE_TOLERANCE_KCAL) {
    issues.push({
      type: "error",
      code: "CALORIES_LOW",
      message: `Calories ${totals.calories} kcal is ${round1(-calorieDelta)} below target ${targets.calories} kcal`,
    })
  } else if (calorieDelta > CALORIE_TOLERANCE_KCAL) {
    issues.push({
      type: "error",
      code: "CALORIES_HIGH",
      message: `Calories ${totals.calories} kcal is ${round1(calorieDelta)} over target ${targets.calories} kcal`,
    })
  }

  // ── Carbs (mode-specific rules) ─────────────────────────────────────────────
  // KETO uses NET carbs (glycemic impact is what matters); other modes use
  // TOTAL carbs (energy balance is what matters).
  const effectiveCarbs = rules.carbsAreNet
    ? totals.carbs - totals.fiber
    : totals.carbs

  if (effectiveCarbs > rules.carbsMax) {
    issues.push({
      type: "error",
      code: "CARBS_EXCEEDED",
      message: rules.carbsAreNet
        ? `Net carbs ${round1(effectiveCarbs)}g exceeds ${macroMode} limit ${rules.carbsMax}g (total: ${totals.carbs}g, fibre: ${totals.fiber}g)`
        : `Carbs ${round1(effectiveCarbs)}g exceeds ${macroMode} limit ${rules.carbsMax}g`,
    })
  }
  if (rules.carbsMin !== undefined && effectiveCarbs < rules.carbsMin) {
    issues.push({
      type: "warning",
      code: "CARBS_EXCEEDED",
      message: `Carbs ${round1(effectiveCarbs)}g below ${macroMode} minimum ${rules.carbsMin}g`,
    })
  }

  // ── Fibre ────────────────────────────────────────────────────────────────────
  if (totals.fiber < rules.fiberMin) {
    issues.push({
      type: "error",
      code: "FIBER_LOW",
      message: `Fibre ${totals.fiber}g below ${macroMode} minimum ${rules.fiberMin}g`,
    })
  } else if (totals.fiber < rules.fiberTarget) {
    issues.push({
      type: "info",
      code: "FIBER_LOW",
      message: `Fibre ${totals.fiber}g — ${macroMode} target is ${rules.fiberTarget}g`,
    })
  }

  // ── Vitamin C ────────────────────────────────────────────────────────────────
  const vitCIssue = checkVitaminCSource(plan)
  if (vitCIssue) issues.push(vitCIssue)

  // ── Ingredient counts ────────────────────────────────────────────────────────
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
