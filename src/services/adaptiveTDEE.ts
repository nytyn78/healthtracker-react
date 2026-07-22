// ── adaptiveTDEE.ts ───────────────────────────────────────────────────────────
// Calorie and macro calculations using Mifflin-St Jeor BMR + activity multiplier.
// computeMacros now correctly respects the user's macroSplit setting.
//
// Commit 7a stubs: calcTargetCalories and computeMacros accept an optional
// goalMode parameter so components compile cleanly. Full goal-mode-aware
// calorie adjustments (pregnancy surplus, maintenance zero-deficit, teen caps)
// are implemented when goalMode is supplied.

import type { UserProfile, UserGoals, AppSettings, ComputedMacros } from "../store/useHealthStore"
import { ACTIVITY_MULTIPLIERS } from "../store/useHealthStore"
import { type GoalMode, GOAL_MODE_FLAGS, getFlags } from "./goalModeConfig"

// ── MacroMode ─────────────────────────────────────────────────────────────────
// Derived from macroSplit percentages — used by components and meal generator
// to label the current eating style without storing a separate field.

export type MacroMode = "keto" | "low_carb" | "balanced" | "high_protein"

export function resolveMacroMode(
  macroSplit: { fatPct: number; proteinPct: number; carbsPct: number }
): MacroMode {
  if (macroSplit.carbsPct <= 10) return "keto"
  if (macroSplit.carbsPct <= 25) return "low_carb"
  if (macroSplit.proteinPct >= 35) return "high_protein"
  return "balanced"
}

// ── BMR ───────────────────────────────────────────────────────────────────────
// Mifflin-St Jeor with Adjusted Body Weight for BMI > 30.
// ABW = IBW + 0.4 × (actual − IBW) — prevents over-estimating BMR in obesity.
// Reference: Mifflin 1990, clinical ABW consensus (ASPEN)

export function calcBMR(profile: UserProfile): number | null {
  const { age, sex, heightCm, weightKg } = profile
  if (age === "" || heightCm === "" || weightKg === "") return null
  const w = Number(weightKg), h = Number(heightCm), a = Number(age)

  const bmi = w / ((h / 100) ** 2)
  const hIn = h / 2.54
  const ibw = (sex === "female" ? 45.5 : 50) + 2.3 * Math.max(0, hIn - 60)
  const abw = bmi > 30 ? ibw + 0.4 * (w - ibw) : w

  const base = 10 * abw + 6.25 * h - 5 * a
  return Math.round(sex === "male" ? base + 5 : base - 161)
}

export function calcTDEE(profile: UserProfile): number | null {
  const bmr = profile.bmrOverride || calcBMR(profile)
  if (!bmr) return null
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[profile.activityLevel])
}

// ── calcTargetCalories ────────────────────────────────────────────────────────
// Accepts optional goalMode (Commit 7a) to apply mode-specific adjustments:
//   - maintenance / child / teen_early: zero deficit regardless of weeklyLossKg
//   - pregnancy_t2: +300 kcal surplus above TDEE
//   - pregnancy_t3 / breastfeeding: +450 kcal surplus above TDEE
//   - teen_older / geriatric: cap weeklyLossKg at mode's maxWeightLossPerWeekKg
//
// When goalMode is omitted, behaves identically to the pre-7a version.

const ZERO_DEFICIT_MODES = new Set<GoalMode>([
  "maintenance", "child", "teen_early",
  "pregnancy_t1", "pregnancy_t2", "pregnancy_t3",
  "postpartum", "breastfeeding", "pre_conception",
])

export function calcTargetCalories(
  profile: UserProfile,
  goals: UserGoals,
  goalMode?: GoalMode
): number | null {
  const tdee = calcTDEE(profile)
  if (!tdee) return null

  if (goalMode) {
    const flags = getFlags(goalMode)

    // Modes that must never apply a weight-loss deficit
    if (ZERO_DEFICIT_MODES.has(goalMode)) {
      const adjustment = flags.calorieAdjustment ?? 0
      return Math.round(Math.max(tdee + adjustment, 1200))
    }

    // Modes with a maximum loss rate cap
    const rawLossKg = Number(goals.weeklyLossKg) || 0
    const cappedLossKg = flags.maxWeightLossPerWeekKg !== null
      ? Math.min(rawLossKg, flags.maxWeightLossPerWeekKg)
      : rawLossKg

    const dailyDeficit = (cappedLossKg * 7700) / 7
    const adjustment = flags.calorieAdjustment ?? 0
    return Math.round(Math.max(tdee + adjustment - dailyDeficit, 1200))
  }

  // Legacy path (no goalMode supplied)
  const dailyDeficit = (goals.weeklyLossKg * 7700) / 7
  return Math.round(Math.max(tdee - dailyDeficit, 1200))
}

// ── computeMacros ─────────────────────────────────────────────────────────────
// Respects macroSplit percentages for fat and carbs.
// Accepts optional goalMode (Commit 7a) — passed through to calcTargetCalories.
//
// Key fix (vs pre-7a): macro split is now actually applied.
//   keto (5% carbs)    → carbsG ≤ 25, fat fills remainder
//   low-carb (25%)     → carbsG from %, fat fills remainder
//   balanced/high-prot → fat from %, carbs fill remainder (floor 75g)

export function computeMacros(
  profile: UserProfile,
  goals: UserGoals,
  settings: AppSettings,
  goalMode?: GoalMode
): ComputedMacros | null {
  const bmr = calcBMR(profile)
  const tdee = calcTDEE(profile)
  const targetCalories = calcTargetCalories(profile, goals, goalMode)
  if (!bmr || !tdee || !targetCalories) return null

  const { fatPct, proteinPct, carbsPct } = settings.macroSplit

  // ── Protein ───────────────────────────────────────────────────────────────
  // ABW floor (1.2 g/kg) prevents muscle loss during deficit.
  // Reference: Helms et al. 2013, PROT-AGE guidelines
  const w = Number(profile.weightKg)
  const h = Number(profile.heightCm)
  const bmi = w / ((h / 100) ** 2)
  const hIn = h / 2.54
  const ibw = (profile.sex === "female" ? 45.5 : 50) + 2.3 * Math.max(0, hIn - 60)
  const abw = bmi > 30 ? ibw + 0.4 * (w - ibw) : w
  const proteinFloorG = Math.round(abw * 1.2)

  const targetWeight = goals.targetWeightKg || Number(profile.weightKg)
  const proteinTargetG = Math.round(Number(targetWeight) * 1.6)
  const proteinFromSplit = Math.round((targetCalories * proteinPct) / 100 / 4)

  const proteinG = Math.min(
    Math.max(proteinTargetG, proteinFloorG, proteinFromSplit),
    130
  )

  // ── Fat & Carbs: from macroSplit percentages ──────────────────────────────

  if (carbsPct <= 10) {
    // Keto / very low-carb: hard cap at 25g net carbs
    const carbsFromPct = Math.round((targetCalories * carbsPct) / 100 / 4)
    const carbsG = Math.min(carbsFromPct, 25)
    const fatG = Math.round((targetCalories - proteinG * 4 - carbsG * 4) / 9)
    return { bmr, tdee, targetCalories, proteinG, carbsG, fatG }
  }

  if (carbsPct <= 25) {
    // Low-carb: percentage-based carbs, fat fills remainder
    const carbsG = Math.round((targetCalories * carbsPct) / 100 / 4)
    const fatG = Math.round((targetCalories - proteinG * 4 - carbsG * 4) / 9)
    return { bmr, tdee, targetCalories, proteinG, carbsG, fatG }
  }

  // Balanced / High-protein: fat from split percentage, carbs fill remainder
  const fatG = Math.round((targetCalories * fatPct) / 100 / 9)
  const carbsG = Math.max(75, Math.round((targetCalories - proteinG * 4 - fatG * 9) / 4))

  return { bmr, tdee, targetCalories, proteinG, carbsG, fatG }
}

// ── formatHour ────────────────────────────────────────────────────────────────

export function formatHour(h: number): string {
  const period = h >= 12 ? "PM" : "AM"
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:00 ${period}`
}

// ── Adaptive TDEE — regression engine ────────────────────────────────────────
// Uses linear regression on weight vs time to estimate real TDEE from data.
// More accurate than formula-based TDEE after 2+ weeks of consistent logging.

export type HistoryEntry = { date: string; cal: number; weight: number | null }

export type TDEEResult = {
  tdee: number | null
  slopeKgPerWeek: number | null
  avgCalories: number | null
  confidence: "none" | "low" | "medium" | "high"
  daysUsed: number
  message: string
}

export function computeAdaptiveTDEE(history: HistoryEntry[]): TDEEResult {
  const valid = history
    .filter(h => h.weight !== null && h.cal > 0)
    .map(h => ({ date: h.date, cal: h.cal, weight: h.weight as number }))
    .sort((a, b) => a.date.localeCompare(b.date)) // oldest first

  const days = valid.length

  if (days < 5) return {
    tdee: null, slopeKgPerWeek: null, avgCalories: null,
    confidence: "none", daysUsed: days,
    message: "Need at least 5 days of data",
  }

  const xs = valid.map((_, i) => i)
  const ys = valid.map(h => h.weight)
  const n = xs.length
  const sumX = xs.reduce((a, b) => a + b, 0)
  const sumY = ys.reduce((a, b) => a + b, 0)
  const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0)
  const sumX2 = xs.reduce((a, x) => a + x * x, 0)
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) // kg/day

  const avgCal = valid.reduce((a, h) => a + h.cal, 0) / days
  const tdeeRaw = avgCal - (slope * 7700)

  const confidence: TDEEResult["confidence"] =
    days >= 28 ? "high" : days >= 14 ? "medium" : "low"

  if (tdeeRaw < 1000 || tdeeRaw > 5000) return {
    tdee: null,
    slopeKgPerWeek: Math.round(slope * 7 * 100) / 100,
    avgCalories: Math.round(avgCal),
    confidence, daysUsed: days,
    message: "TDEE estimate out of range — check calorie logging accuracy",
  }

  return {
    tdee: Math.round(tdeeRaw),
    slopeKgPerWeek: Math.round(slope * 7 * 100) / 100,
    avgCalories: Math.round(avgCal),
    confidence, daysUsed: days,
    message: "Estimated from calorie intake vs weight trend",
  }
}
