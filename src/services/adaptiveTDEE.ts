// ── Adaptive TDEE — MacroFactor-style regression engine ───────────────────────
// Uses 7-day smoothed weight + linear regression + calorie average
// More accurate than simple TDEE calculators after 2+ weeks of data

export type HistoryEntry = { date: string; cal: number; weight: number | null }

export type TDEEResult = {
  tdee: number | null
  slopeKgPerWeek: number | null
  avgCalories: number | null
  confidence: "none" | "low" | "medium" | "high"
  daysUsed: number
  message: string
}

function regression(xs: number[], ys: number[]) {
  const n = xs.length
  const sx = xs.reduce((a, b) => a + b, 0)
  const sy = ys.reduce((a, b) => a + b, 0)
  const sxy = xs.reduce((a, b, i) => a + b * ys[i], 0)
  const sxx = xs.reduce((a, b) => a + b * b, 0)
  const denom = n * sxx - sx * sx
  if (denom === 0) return { slope: 0, intercept: sy / n }
  return {
    slope: (n * sxy - sx * sy) / denom,
    intercept: (sy - (n * sxy - sx * sy) / denom * sx) / n,
  }
}

export function computeAdaptiveTDEE(history: HistoryEntry[]): TDEEResult {
  const usable = history
    .filter(d => d.weight !== null && d.cal > 0)
    .map(d => ({ ...d, weight: d.weight as number }))
    .reverse() // oldest first

  const days = usable.length
  if (days < 5) return {
    tdee: null, slopeKgPerWeek: null, avgCalories: null,
    confidence: "none", daysUsed: days, message: "Not enough data yet"
  }

  const weights  = usable.map(d => d.weight)
  const calories = usable.map(d => d.cal)

  // 7-day smoothing removes water/glycogen noise
  const smooth = weights.map((_, i) => {
    const w = weights.slice(Math.max(0, i - 6), i + 1)
    return w.reduce((a, b) => a + b, 0) / w.length
  })

  const { slope } = regression(smooth.map((_, i) => i), smooth)
  const avgCal   = calories.reduce((a, b) => a + b, 0) / calories.length
  const tdeeRaw  = avgCal - slope * 7700 // slope is kg/day, 7700 kcal/kg fat

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

// ── Mifflin-St Jeor TDEE (for Settings display) ───────────────────────────────
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

  // Protein floor based on adjusted body weight (ABW) for overweight users
  // Uses 1.2g/kg ABW as the evidence-based minimum for muscle preservation during deficit
  // Reference: Helms et al. 2013, PROT-AGE guidelines
  // For BMI ≤ 30: use actual weight. For BMI > 30: use ABW = IBW + 0.4 × (actual - IBW)
  const w = Number(profile.weightKg)
  const h = Number(profile.heightCm)
  const bmi = w / ((h / 100) ** 2)
  const hIn = h / 2.54
  const ibw = (profile.sex === "female" ? 45.5 : 50) + 2.3 * Math.max(0, hIn - 60)
  const abw = bmi > 30 ? ibw + 0.4 * (w - ibw) : w
  const proteinFloorG = Math.round(abw * 1.2)

  // Calculate from percentage split first
  const proteinFromPct = Math.round((targetCalories * proteinPct / 100) / 4)

  // Use the higher of: percentage-based or ABW floor
  // This ensures protein is never under-prescribed for overweight users
  const proteinG = Math.max(proteinFromPct, proteinFloorG)

  // If protein floor kicks in, adjust fat down to compensate (keep carbs fixed)
  const carbsG  = Math.round((targetCalories * carbsPct / 100) / 4)
  const proteinCals = proteinG * 4
  const carbsCals   = carbsG  * 4
  const remainingCals = targetCalories - proteinCals - carbsCals
  const fatG = Math.max(30, Math.round(remainingCals / 9)) // minimum 30g fat for hormones

  return {
    bmr, tdee, targetCalories,
    proteinG,
    carbsG,
    fatG,
  }
}

export function formatHour(h: number): string {
  const period = h >= 12 ? "PM" : "AM"
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:00 ${period}`
}
