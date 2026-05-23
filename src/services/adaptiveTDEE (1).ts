// ── adaptiveTDEE.ts ───────────────────────────────────────────────────────────
// Calorie and macro calculations using Mifflin-St Jeor BMR + activity multiplier.
// computeMacros now correctly respects the user's macroSplit setting.

import type { UserProfile, UserGoals, AppSettings, ComputedMacros } from "../store/useHealthStore"
import { ACTIVITY_MULTIPLIERS } from "../store/useHealthStore"

export function calcBMR(profile: UserProfile): number | null {
  const { age, sex, heightCm, weightKg } = profile
  if (age === "" || heightCm === "" || weightKg === "") return null
  const w = Number(weightKg), h = Number(heightCm), a = Number(age)

  // Adjusted Body Weight (ABW) for BMI > 30
  // Clinical standard: ABW = IBW + 0.4 × (actual - IBW)
  // Prevents overestimating BMR for higher body weights
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

export function calcTargetCalories(profile: UserProfile, goals: UserGoals): number | null {
  const tdee = calcTDEE(profile)
  if (!tdee) return null
  const dailyDeficit = (goals.weeklyLossKg * 7700) / 7
  return Math.round(Math.max(tdee - dailyDeficit, 1200))
}

export function computeMacros(
  profile: UserProfile,
  goals: UserGoals,
  settings: AppSettings
): ComputedMacros | null {
  const bmr = calcBMR(profile)
  const tdee = calcTDEE(profile)
  const targetCalories = calcTargetCalories(profile, goals)
  if (!bmr || !tdee || !targetCalories) return null

  const { fatPct, proteinPct, carbsPct } = settings.macroSplit

  // ── Protein: evidence-based floor, never fully overridden by macro split ──
  // Uses ABW floor (1.2g/kg) for muscle preservation during deficit.
  // Reference: Helms et al. 2013, PROT-AGE guidelines
  const w = Number(profile.weightKg)
  const h = Number(profile.heightCm)
  const bmi = w / ((h / 100) ** 2)
  const hIn = h / 2.54
  const ibw = (profile.sex === "female" ? 45.5 : 50) + 2.3 * Math.max(0, hIn - 60)
  const abw = bmi > 30 ? ibw + 0.4 * (w - ibw) : w
  const proteinFloorG = Math.round(abw * 1.2)

  // Protein target based on TARGET weight when available
  const targetWeight = goals.targetWeightKg || Number(profile.weightKg)
  const proteinTargetG = Math.round(Number(targetWeight) * 1.6)

  // Protein from macro split (as a cross-check / alternative)
  const proteinFromSplit = Math.round((targetCalories * proteinPct) / 100 / 4)

  // Use the higher of: evidence-based target OR macro-split-derived protein,
  // respecting the floor and cap
  const proteinG = Math.min(
    Math.max(proteinTargetG, proteinFloorG, proteinFromSplit),
    130
  )

  // ── Fat & Carbs: directly from macroSplit percentages ────────────────────
  // This is the fix: use the user's chosen macro split for fat and carbs,
  // not fixed gram targets. Keto (70% fat, 5% carbs) now actually gives
  // ~22g carbs and ~95g fat, not 228g carbs.

  if (carbsPct <= 10) {
    // Keto / very low-carb: use percentage-based carbs with a hard cap of 25g
    const carbsFromPct = Math.round((targetCalories * carbsPct) / 100 / 4)
    const carbsG = Math.min(carbsFromPct, 25)

    // Fat fills remaining calories after protein + carbs
    const proteinCals = proteinG * 4
    const carbsCals = carbsG * 4
    const fatG = Math.round((targetCalories - proteinCals - carbsCals) / 9)

    return { bmr, tdee, targetCalories, proteinG, carbsG, fatG }
  }

  if (carbsPct <= 25) {
    // Low-carb: use percentage-based carbs, fat fills the rest
    const carbsG = Math.round((targetCalories * carbsPct) / 100 / 4)
    const proteinCals = proteinG * 4
    const carbsCals = carbsG * 4
    const fatG = Math.round((targetCalories - proteinCals - carbsCals) / 9)
    return { bmr, tdee, targetCalories, proteinG, carbsG, fatG }
  }

  // Balanced / High-protein: allocate fat from split, carbs fill the rest
  const fatG = Math.round((targetCalories * fatPct) / 100 / 9)
  const proteinCals = proteinG * 4
  const fatCals = fatG * 9
  const carbsG = Math.max(75, Math.round((targetCalories - proteinCals - fatCals) / 4))

  return { bmr, tdee, targetCalories, proteinG, carbsG, fatG }
}

export function formatHour(h: number): string {
  const period = h >= 12 ? "PM" : "AM"
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:00 ${period}`
}

// ── Adaptive TDEE from weight + calorie history ───────────────────────────────
// Uses linear regression on (calories in - weight change) to estimate real TDEE.
// More accurate than formula-based TDEE after 2+ weeks of consistent logging.

type HistoryEntry = { date: string; cal: number; weight: number }

export type AdaptiveTDEEResult = {
  tdee: number | null
  slopeKgPerWeek: number
  avgCalories: number
  confidence: "none" | "low" | "medium" | "high"
  daysUsed: number
  message: string
}

export function computeAdaptiveTDEE(history: HistoryEntry[]): AdaptiveTDEEResult {
  const valid = history
    .filter(h => h.cal > 0 && h.weight > 0)
    .sort((a, b) => a.date.localeCompare(b.date))

  const days = valid.length

  if (days < 5) return {
    tdee: null, slopeKgPerWeek: 0, avgCalories: 0,
    confidence: "none", daysUsed: days,
    message: "Need at least 5 days of data",
  }

  // Linear regression: weight ~ days
  const xs = valid.map((_, i) => i)
  const ys = valid.map(h => h.weight)
  const n = xs.length
  const sumX = xs.reduce((a, b) => a + b, 0)
  const sumY = ys.reduce((a, b) => a + b, 0)
  const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0)
  const sumX2 = xs.reduce((a, x) => a + x * x, 0)
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) // kg/day
  const avgCal = valid.reduce((a, h) => a + h.cal, 0) / days

  // TDEE = avg calories - (slope × 7700 / 7)
  // If losing 0.5kg/week at 1800 kcal → TDEE = 1800 + 550 = 2350
  const tdeeRaw = avgCal - (slope * 7700)

  const confidence: AdaptiveTDEEResult["confidence"] =
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
