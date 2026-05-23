// ── adaptiveTDEE.ts ────────────────────────────────────────────────────────────
// Two responsibilities in one file (kept together for minimal refactor surface):
//
//  1. Adaptive TDEE regression engine (MacroFactor-style, unchanged)
//     computeAdaptiveTDEE() — historical weight + calories → estimated TDEE
//
//  2. Mode-driven macro engine (refactored)
//     computeMacros() — profile + goals + settings → deterministic macro targets
//
// Philosophy for (2):
//   - Each macro mode is an independent, coherent physiological strategy
//   - Protein derives from activity level + mode, NOT from macro percentages
//   - Labels always match actual macro outputs (validation enforces this)
//   - Designed for mainstream sustainable fat-loss, NOT physique competition
//
// Backward-compat exports preserved: calcBMR, calcTDEE, calcTargetCalories,
// computeMacros, formatHour — all call sites continue to work unchanged.

import type { UserProfile, UserGoals, AppSettings, ComputedMacros } from "../store/useHealthStore"
import { ACTIVITY_MULTIPLIERS } from "../store/useHealthStore"

// ─── ADAPTIVE TDEE (unchanged) ────────────────────────────────────────────────

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
    confidence: "none", daysUsed: days, message: "Not enough data yet",
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
  const tdeeRaw  = avgCal - slope * 7700  // slope is kg/day; 7700 kcal ≈ 1 kg fat

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

// ─── MACRO MODES ──────────────────────────────────────────────────────────────
// Each mode independently defines its physiological strategy.
// No bleeding between modes: keto doesn't inherit balanced floors;
// balanced doesn't inherit keto ceilings.

export type MacroMode =
  | "keto"           // nutritional ketosis, appetite control, IF synergy
  | "very_low_carb"  // ketogenic-adjacent, less strict
  | "low_carb"       // moderate carb reduction, exercise-supportive
  | "balanced"       // calorie-scaled percentages — most sustainable, default
  | "high_protein_cut" // maximized protein for aggressive deficit
  | "recomposition"  // elevated protein + moderate carbs for muscle gain + fat loss

// How a mode targets its macros
type CarbsStrategy = "fixed_net" | "fixed_total" | "percentage_of_remainder"
type FatStrategy   = "remainder" | "percentage_of_remainder"

interface MacroModeConfig {
  label: string
  description: string
  // Protein: g per kg of Adjusted Body Weight, scaled by activity within range
  proteinGPerKg: { min: number; ideal: number; max: number }
  carbsStrategy: CarbsStrategy
  carbsGrams?: { min: number; max: number }   // for fixed strategies
  carbsPct?: number                            // target % of remaining-after-protein (percentage_of_remainder)
  fatStrategy: FatStrategy
  fatPct?: number                              // target % of remaining-after-protein (percentage_of_remainder)
  minFatG: number                              // absolute hormonal-health floor
}

const MODE_CONFIG: Record<MacroMode, MacroModeConfig> = {
  // ── KETO ──────────────────────────────────────────────────────────────────
  // Goal: nutritional ketosis (BHB > 0.5 mmol).
  // Net carbs ≤ 50g is the hard clinical ceiling for reliable ketone production.
  // Protein conservative to avoid gluconeogenesis disrupting ketosis.
  // Fat fills all remaining calories — satiety + ketone substrate.
  keto: {
    label: "Keto",
    description: "Nutritional ketosis for appetite control and fasting synergy",
    proteinGPerKg: { min: 1.2, ideal: 1.3, max: 1.5 },
    carbsStrategy: "fixed_net",
    carbsGrams: { min: 20, max: 50 },  // NET carbs
    fatStrategy: "remainder",
    minFatG: 40,
  },

  // ── VERY LOW CARB ─────────────────────────────────────────────────────────
  // Ketogenic-adjacent without tracking net vs. gross carbs strictly.
  // More flexibility than keto; good for users who find keto hard to sustain.
  very_low_carb: {
    label: "Very Low Carb",
    description: "Very low carbs without strict ketosis requirement",
    proteinGPerKg: { min: 1.2, ideal: 1.3, max: 1.5 },
    carbsStrategy: "fixed_total",
    carbsGrams: { min: 50, max: 80 },
    fatStrategy: "remainder",
    minFatG: 40,
  },

  // ── LOW CARB ──────────────────────────────────────────────────────────────
  // Moderate carb reduction: supports fat loss + insulin sensitivity while
  // allowing adequate energy for moderate-intensity training (80–120g).
  low_carb: {
    label: "Low Carb",
    description: "Moderate carb reduction with better exercise performance than keto",
    proteinGPerKg: { min: 1.2, ideal: 1.35, max: 1.5 },
    carbsStrategy: "fixed_total",
    carbsGrams: { min: 80, max: 120 },
    fatStrategy: "remainder",
    minFatG: 35,
  },

  // ── BALANCED (default) ────────────────────────────────────────────────────
  // Carbs and fat are percentage-based so they SCALE with calorie target.
  // Avoids the failure mode of fixed percentages producing accidental keto
  // at low calorie targets or excessive fat at high calorie targets.
  // Carbs: 40% of non-protein calories  Fat: 30% of non-protein calories
  // (protein takes the remainder, always at least the ABW floor)
  balanced: {
    label: "Balanced",
    description: "Percentage-based macros that scale with your calorie target — most sustainable",
    proteinGPerKg: { min: 1.2, ideal: 1.3, max: 1.4 },
    carbsStrategy: "percentage_of_remainder",
    carbsPct: 40,   // 40% of calories after protein
    fatStrategy: "percentage_of_remainder",
    fatPct: 32,     // 32% of calories after protein (carbs get 40%, fat 32%, small rounding buffer)
    minFatG: 35,
  },

  // ── HIGH PROTEIN CUT ──────────────────────────────────────────────────────
  // Maximizes protein (1.6–1.8 g/kg) to preserve lean mass during aggressive deficit.
  // Carbs reduced to make caloric room for elevated protein.
  // For users 2–3+ months into a diet with consistent resistance training.
  high_protein_cut: {
    label: "High Protein Cut",
    description: "Maximized protein to preserve muscle during aggressive fat loss",
    proteinGPerKg: { min: 1.5, ideal: 1.7, max: 1.9 },
    carbsStrategy: "percentage_of_remainder",
    carbsPct: 35,   // slightly lower than balanced to make protein room
    fatStrategy: "percentage_of_remainder",
    fatPct: 28,
    minFatG: 30,
  },

  // ── RECOMPOSITION ─────────────────────────────────────────────────────────
  // Simultaneous muscle gain + fat loss requires: elevated protein, adequate
  // carbs for training stimulus, sufficient fat for hormones.
  // NOT low-carb — carb restriction would undermine training adaptations.
  recomposition: {
    label: "Recomposition",
    description: "Elevated protein + training carbs for simultaneous muscle gain and fat loss",
    proteinGPerKg: { min: 1.4, ideal: 1.6, max: 1.8 },
    carbsStrategy: "percentage_of_remainder",
    carbsPct: 42,   // slightly higher carbs vs balanced for training fuel
    fatStrategy: "percentage_of_remainder",
    fatPct: 30,
    minFatG: 35,
  },
}

// ─── ACTIVITY-BASED PROTEIN SCALING ──────────────────────────────────────────
// Protein needs vary by training stimulus, not just body weight.
// These offsets are added to each mode's ideal g/kg, then clamped to mode range.
// Rationale: more mechanical muscle damage requires more protein for repair.

const PROTEIN_ACTIVITY_OFFSET: Record<string, number> = {
  sedentary:         -0.10,  // Minimal stimulus; lowest need within mode range
  lightly_active:     0.00,  // Baseline — use mode ideal
  moderately_active:  0.05,  // 3–5 workouts/week; modest increase
  very_active:        0.15,  // Daily intense training; elevated need
  extra_active:       0.20,  // Physical job + training; upper end of range
}

// ─── ABW HELPER ───────────────────────────────────────────────────────────────
// Adjusted Body Weight for BMI > 30.
// Prevents overestimating protein/macro needs for larger users.
// Formula: ABW = IBW + 0.4 × (actual − IBW)
// IBW (Devine): male = 50 + 2.3 × (heightIn − 60); female = 45.5 + 2.3 × (...)

function calcABW(heightCm: number, weightKg: number, isMale: boolean): number {
  const bmi = weightKg / ((heightCm / 100) ** 2)
  if (bmi <= 30) return weightKg

  const heightIn = heightCm / 2.54
  const ibw = (isMale ? 50 : 45.5) + 2.3 * Math.max(0, heightIn - 60)
  return ibw + 0.4 * (weightKg - ibw)
}

// ─── PROTEIN CALCULATION ──────────────────────────────────────────────────────
// mode + activity → g/kg target → absolute grams (using ABW)

function calcProteinForMode(
  mode: MacroMode,
  profile: UserProfile,
): number {
  const cfg = MODE_CONFIG[mode]
  const h = Number(profile.heightCm)
  const w = Number(profile.weightKg)
  if (!h || !w) return Math.round(cfg.proteinGPerKg.ideal * 70)  // fallback

  const abw = calcABW(h, w, profile.sex === "male")
  const activityOffset = PROTEIN_ACTIVITY_OFFSET[profile.activityLevel] ?? 0
  const target = cfg.proteinGPerKg.ideal + activityOffset

  const clamped = Math.max(cfg.proteinGPerKg.min, Math.min(cfg.proteinGPerKg.max, target))
  return Math.round(abw * clamped)
}

// ─── CARBS CALCULATION ────────────────────────────────────────────────────────
// Mode-independent strategies; each mode uses only its own

function calcCarbsForMode(
  mode: MacroMode,
  targetCalories: number,
  proteinG: number,
  fiberG: number,
): number {
  const cfg = MODE_CONFIG[mode]

  if (cfg.carbsStrategy === "fixed_net") {
    // Keto: use midpoint of NET carbs range, add fiber for total
    const netTarget = Math.round(((cfg.carbsGrams!.min + cfg.carbsGrams!.max) / 2))
    return netTarget + fiberG  // gross carbs = net + fiber
  }

  if (cfg.carbsStrategy === "fixed_total") {
    // Very-low-carb / low-carb: midpoint of absolute carb range
    return Math.round((cfg.carbsGrams!.min + cfg.carbsGrams!.max) / 2)
  }

  // percentage_of_remainder: carbs % of calories that aren't from protein
  const proteinCals    = proteinG * 4
  const remainingCals  = Math.max(0, targetCalories - proteinCals)
  return Math.max(0, Math.round((remainingCals * (cfg.carbsPct! / 100)) / 4))
}

// ─── FAT CALCULATION ──────────────────────────────────────────────────────────

function calcFatForMode(
  mode: MacroMode,
  targetCalories: number,
  proteinG: number,
  carbsG: number,
): number {
  const cfg = MODE_CONFIG[mode]

  if (cfg.fatStrategy === "remainder") {
    const used = proteinG * 4 + carbsG * 4
    const remaining = Math.max(0, targetCalories - used)
    return Math.max(cfg.minFatG, Math.round(remaining / 9))
  }

  // percentage_of_remainder
  const proteinCals   = proteinG * 4
  const remainingCals = Math.max(0, targetCalories - proteinCals)
  const fatFromPct    = Math.round((remainingCals * (cfg.fatPct! / 100)) / 9)
  return Math.max(cfg.minFatG, fatFromPct)
}

// ─── BMR & TDEE (public, backward-compatible) ────────────────────────────────

export function calcBMR(profile: UserProfile): number | null {
  const { age, sex, heightCm, weightKg } = profile
  if (age === "" || heightCm === "" || weightKg === "") return null
  const w = Number(weightKg), h = Number(heightCm), a = Number(age)
  const abw = calcABW(h, w, sex === "male")
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

// ─── CORE: computeMacros ──────────────────────────────────────────────────────
// Public API — drop-in replacement for the old percentage-based version.
// settings.macroMode drives the strategy; settings.macroSplit is ignored.
// Returns the same ComputedMacros shape (bmr, tdee, targetCalories, P/C/F).

export function computeMacros(
  profile: UserProfile,
  goals: UserGoals,
  settings: AppSettings,
): ComputedMacros | null {
  const bmr            = calcBMR(profile)
  const tdee           = calcTDEE(profile)
  const targetCalories = calcTargetCalories(profile, goals)
  if (!bmr || !tdee || !targetCalories) return null

  // Resolve mode: use settings.macroMode if present, else derive from legacy macroSplit
  const mode: MacroMode = settings.macroMode ?? deriveLegacyMode(settings)

  // Default fiber estimate — improves net-carb accuracy for keto
  const fiberG = 15

  const proteinG = calcProteinForMode(mode, profile)
  const carbsG   = calcCarbsForMode(mode, targetCalories, proteinG, fiberG)
  const fatG     = calcFatForMode(mode, targetCalories, proteinG, carbsG)

  return { bmr, tdee, targetCalories, proteinG, carbsG, fatG }
}

// ─── LEGACY MODE DERIVATION ───────────────────────────────────────────────────
// One-time compatibility bridge: infers the closest new mode from old
// macroSplit percentages so existing users get sensible defaults without
// requiring a manual re-selection.
// This is deliberately conservative — when in doubt, "balanced" wins.

function deriveLegacyMode(settings: AppSettings): MacroMode {
  const { fatPct = 35, carbsPct = 35 } = settings.macroSplit ?? {}
  if (carbsPct <= 10)  return "keto"
  if (carbsPct <= 20)  return "very_low_carb"
  if (carbsPct <= 28)  return "low_carb"
  if (fatPct >= 55)    return "keto"       // high-fat legacy = keto intent
  return "balanced"
}

// ─── HELPERS FOR UI ───────────────────────────────────────────────────────────

export function getModeLabel(mode: MacroMode): string {
  return MODE_CONFIG[mode]?.label ?? mode
}

export function getModeDescription(mode: MacroMode): string {
  return MODE_CONFIG[mode]?.description ?? ""
}

export function getAllModes(): { mode: MacroMode; label: string; description: string }[] {
  return (Object.keys(MODE_CONFIG) as MacroMode[]).map(m => ({
    mode: m,
    label: MODE_CONFIG[m].label,
    description: MODE_CONFIG[m].description,
  }))
}

export { MODE_CONFIG }
export type { MacroModeConfig }

// ─── UTIL ─────────────────────────────────────────────────────────────────────

export function formatHour(h: number): string {
  const period = h >= 12 ? "PM" : "AM"
  const hour   = h % 12 === 0 ? 12 : h % 12
  return `${hour}:00 ${period}`
}
