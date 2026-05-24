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

export function computeAdaptiveTDEE(
  history: HistoryEntry[],
  goalMode?: GoalMode,
): TDEEResult {
  // ── Goal-mode awareness ──────────────────────────────────────────────────
  // Adaptive TDEE assumes weight changes reflect fat-mass changes calibrated
  // by 7700 kcal/kg. That assumption fails in some life stages:
  //
  // - Pregnancy: weight gain is fetal tissue, placenta, fluid + maternal fat.
  //   The 7700 kcal/kg model would interpret normal pregnancy weight gain as
  //   a calorie surplus and falsely lower the user's target.
  //
  // - Child / early teen: weight gain reflects growth, not surplus. Same
  //   misinterpretation risk — could under-prescribe a growing child.
  //
  // In these modes we return null and let static calculation (Mifflin + goal-mode
  // adjustments) be authoritative.
  if (goalMode && isPregnancyMode(goalMode)) {
    return {
      tdee: null, slopeKgPerWeek: null, avgCalories: null,
      confidence: "none", daysUsed: 0,
      message: "Adaptive TDEE is paused during pregnancy — weight changes during this " +
               "time reflect fetal growth, fluid, and tissue, not fat. Your target is " +
               "based on Mifflin-St Jeor + pregnancy stage surplus.",
    }
  }
  if (goalMode === "child" || goalMode === "teen_early") {
    return {
      tdee: null, slopeKgPerWeek: null, avgCalories: null,
      confidence: "none", daysUsed: 0,
      message: "Adaptive TDEE is disabled during growth phase — weight changes " +
               "reflect growth, not fat. Targets are based on age-appropriate calculation.",
    }
  }

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
  const tdeeRaw  = avgCal - slope * 7700 // slope kg/day × 7700 kcal/kg

  const confidence: TDEEResult["confidence"] =
    days >= 28 ? "high" : days >= 14 ? "medium" : "low"

  if (tdeeRaw < 1000 || tdeeRaw > 5000) return {
    tdee: null,
    slopeKgPerWeek: Math.round(slope * 7 * 100) / 100,
    avgCalories: Math.round(avgCal),
    confidence, daysUsed: days,
    message: "TDEE estimate out of range — check calorie logging accuracy",
  }

  // Breastfeeding / postpartum lactation caveat — the regression sees only
  // food intake vs weight, but lactation burns ~500 kcal/day on top of body
  // expenditure. The estimate is still useful for trend tracking, but the
  // user should know the number doesn't account for milk production cost.
  let message = "Estimated from calorie intake vs weight trend"
  if (goalMode === "breastfeeding" || goalMode === "postpartum") {
    message += " — note: this doesn't account for the ~400-500 kcal/day used " +
               "to produce milk. Your body is likely using more than this estimate."
  }

  return {
    tdee: Math.round(tdeeRaw),
    slopeKgPerWeek: Math.round(slope * 7 * 100) / 100,
    avgCalories: Math.round(avgCal),
    confidence, daysUsed: days,
    message,
  }
}

// ── Mifflin-St Jeor BMR / TDEE ────────────────────────────────────────────────
import type { UserProfile, UserGoals, AppSettings, ComputedMacros } from "../store/useHealthStore"
import { ACTIVITY_MULTIPLIERS } from "../store/useHealthStore"
import { GoalMode, GOAL_MODE_FLAGS, isPregnancyMode } from "./goalModeConfig"

export function calcBMR(profile: UserProfile): number | null {
  const { age, sex, heightCm, weightKg } = profile
  if (age === "" || heightCm === "" || weightKg === "") return null
  const w = Number(weightKg), h = Number(heightCm), a = Number(age)
  const abw  = calcABW(w, h, sex)
  const base = 10 * abw + 6.25 * h - 5 * a
  return Math.round(sex === "male" ? base + 5 : base - 161)
}

export function calcTDEE(profile: UserProfile): number | null {
  const bmr = profile.bmrOverride || calcBMR(profile)
  if (!bmr) return null
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[profile.activityLevel])
}

export function calcTargetCalories(
  profile: UserProfile,
  goals: UserGoals,
  goalMode?: GoalMode,
): number | null {
  const tdee = calcTDEE(profile)
  if (!tdee) return null

  // ── Goal-mode calorie adjustment ───────────────────────────────────────────
  // Pregnancy / breastfeeding need extra calories regardless of dietary choice.
  // This is physiology, not preference — applied silently because the body
  // requires it. Values from IOM 2005 dietary guidelines.
  //   pregnancy_t2:  +300  kcal
  //   pregnancy_t3:  +450  kcal
  //   breastfeeding: +450  kcal
  //   pre_conception: -300 kcal if overweight (max 0.5 kg/week)
  //   recomposition: -250  kcal (small built-in deficit)
  const calorieAdjustment = goalMode ? GOAL_MODE_FLAGS[goalMode]?.calorieAdjustment ?? 0 : 0

  // ── Weight-loss deficit ────────────────────────────────────────────────────
  // Capped by mode-specific maximum (breastfeeding 0.3 kg/wk, geriatric 0.25,
  // pregnancy null = no deficits allowed at all).
  const maxLoss = goalMode ? GOAL_MODE_FLAGS[goalMode]?.maxWeightLossPerWeekKg : null
  const cappedWeeklyLoss =
    maxLoss === null && goalMode && isPregnancyMode(goalMode)
      ? 0  // pregnancy: no deficits ever
      : maxLoss !== undefined && maxLoss !== null
        ? Math.min(goals.weeklyLossKg, maxLoss)
        : goals.weeklyLossKg
  const dailyDeficit = (cappedWeeklyLoss * 7700) / 7

  // ── Floor selection ────────────────────────────────────────────────────────
  // Standard adult floor: 1200 kcal (universally accepted minimum)
  // Breastfeeding:        1800 kcal (BFN/AAP — below this, milk supply drops)
  // Pregnancy T2/T3:      1700 kcal (lower bound for adequate nutrition)
  // Geriatric:            1400 kcal (sarcopenia risk below this)
  let floor = 1200
  if (goalMode === "breastfeeding") floor = 1800
  else if (goalMode === "pregnancy_t2" || goalMode === "pregnancy_t3") floor = 1700
  else if (goalMode === "geriatric") floor = 1400

  return Math.round(Math.max(tdee + calorieAdjustment - dailyDeficit, floor))
}

// ── Adjusted Body Weight (ABW) ────────────────────────────────────────────────
// ABW = IBW + 0.4 × (actualWeight − IBW) when BMI > 30.
// For BMI ≤ 30, returns actual weight.
//
// Role in this engine: SAFETY FLOOR ONLY.
// ABW sets the minimum protein prescription to protect muscle mass
// in obesity, aggressive deficits, and fasting contexts.
// It does NOT drive the default recommendation — the mode does that.
//
// Reference: Devine formula for IBW; ABW standard from clinical
// pharmacy / nutrition literature (Pai & Paloucek, Ann Pharmacother 2000).
function calcABW(weightKg: number, heightCm: number, sex: "male" | "female"): number {
  const bmi = weightKg / ((heightCm / 100) ** 2)
  if (bmi <= 30) return weightKg
  const hIn = heightCm / 2.54
  const ibw = (sex === "female" ? 45.5 : 50) + 2.3 * Math.max(0, hIn - 60)
  return Math.round((ibw + 0.4 * (weightKg - ibw)) * 10) / 10
}

// ── Macro Mode ────────────────────────────────────────────────────────────────
// The mode is the SINGLE SOURCE OF TRUTH for macro calculation.
// Each mode runs completely isolated logic for protein, carbs, and fat.
// No cross-mode fallbacks. No global carb floors that leak across modes.
//
// This makes it mathematically impossible for mode label ≠ actual macros.
export type MacroMode =
  | "KETO"
  | "VERY_LOW_CARB"
  | "LOW_CARB"
  | "BALANCED"
  | "HIGH_PROTEIN_CUT"
  | "RECOMPOSITION"

// ── Mode resolver ─────────────────────────────────────────────────────────────
// Derives the effective mode from the user's macroSplit slider percentages.
// Checked from most restrictive → most general. First match wins.
function resolveMacroMode(
  macroSplit: { fatPct: number; proteinPct: number; carbsPct: number }
): MacroMode {
  const { carbsPct, proteinPct } = macroSplit

  if (carbsPct <= 10)                                        return "KETO"
  if (carbsPct <= 20)                                        return "VERY_LOW_CARB"
  if (proteinPct >= 40)                                      return "HIGH_PROTEIN_CUT"
  if (proteinPct >= 30 && carbsPct >= 20 && carbsPct <= 40)  return "RECOMPOSITION"
  if (carbsPct <= 35)                                        return "LOW_CARB"
  return "BALANCED"
}

// ── Protein multipliers by activity level ─────────────────────────────────────
// Sustainable defaults for fat loss and general health.
// These are the mode's RECOMMENDED target — not the floor.
// ABW × 1.2 g/kg is always enforced as a separate hard floor (see below).
//
// Evidence base:
//   Helms et al. (2013) — natural bodybuilding: 2.3–3.1 g/kg LBM
//   Morton et al. (2018) — meta-analysis: ~1.6 g/kg sufficient for most
//   ISSN Position Stand (2017) — 1.4–2.0 g/kg for active individuals
//   For mainstream fat loss (non-athletes): 1.2–1.6 g/kg is appropriate
const PROTEIN_MULTIPLIER: Record<string, number> = {
  sedentary:         1.2,
  lightly_active:    1.25,
  moderately_active: 1.3,
  very_active:       1.4,
  extra_active:      1.5,
}

// Higher multipliers for specialist modes requiring maximum muscle retention
const PROTEIN_MULTIPLIER_HIGH: Record<string, number> = {
  sedentary:         1.5,
  lightly_active:    1.6,
  moderately_active: 1.7,
  very_active:       1.75,
  extra_active:      1.8,
}

// ── Child / early-teen protein multipliers ──────────────────────────────────
// Children 4-13 years need more protein per kg than adults due to growth.
// WHO 2007: 0.95 g/kg baseline; sports nutrition guidance 1.2-1.5 g/kg for
// active children. We scale by activity, with a higher ceiling than the adult
// PROTEIN_MULTIPLIER table to ensure growing bodies aren't under-fed.
const PROTEIN_MULTIPLIER_CHILD: Record<string, number> = {
  sedentary:         1.0,   // baseline WHO + small growth allowance
  lightly_active:    1.1,
  moderately_active: 1.3,
  very_active:       1.5,   // active growing child — top of range
  extra_active:      1.6,
}

// ── ABW protein floor ─────────────────────────────────────────────────────────
// 1.2 g/kg ABW is the universal minimum protein across ALL modes.
//
// Prevents severe under-prescription in:
//   - obesity (ABW corrects for non-metabolically active fat mass)
//   - aggressive calorie deficits
//   - IF / time-restricted feeding users
//   - sedentary but catabolic states (illness, stress, ageing)
//
// ABW floor ≠ default recommendation.
// The mode sets the recommendation; ABW only prevents the floor from going
// dangerously low. A sedentary user in a moderate deficit still gets the
// mode's recommended multiplier — ABW only activates when that would
// under-prescribe for their actual body composition.
const ABW_PROTEIN_FLOOR_MULTIPLIER = 1.2

// ── Per-mode calorie floors ───────────────────────────────────────────────────
// Each mode has its own minimum — keto can safely go lower due to fat satiety.
// Balanced needs a higher floor to avoid micronutrient deficiency.
const CALORIE_FLOOR: Record<MacroMode, number> = {
  KETO:             1100,
  VERY_LOW_CARB:    1150,
  LOW_CARB:         1200,
  BALANCED:         1300,
  HIGH_PROTEIN_CUT: 1200,
  RECOMPOSITION:    1400,  // needs adequate calories for muscle synthesis
}

// ── Per-mode fat minimums ─────────────────────────────────────────────────────
// Hormonal health floor. Women especially should not go below 40g fat.
// Keto modes have higher floors since fat is the primary fuel source.
const FAT_FLOOR: Record<MacroMode, number> = {
  KETO:             60,
  VERY_LOW_CARB:    55,
  LOW_CARB:         45,
  BALANCED:         40,
  HIGH_PROTEIN_CUT: 40,
  RECOMPOSITION:    40,
}

// ── computeMacros ─────────────────────────────────────────────────────────────
// Mode-driven engine. Each mode is a self-contained logic path.
// Sequence within each mode: Protein → [fixed macro] → Fat/Carbs fill remaining.
// No shared logic bleeds between modes.
export function computeMacros(
  profile: UserProfile,
  goals: UserGoals,
  settings: AppSettings,
  goalMode?: GoalMode,
): ComputedMacros | null {
  const bmr  = calcBMR(profile)
  const tdee = calcTDEE(profile)
  if (!bmr || !tdee) return null

  const w = Number(profile.weightKg)
  const h = Number(profile.heightCm)
  if (!w || !h) return null

  // Target weight: use goal weight when set and lower than current.
  // Protein prescription should be based on target body, not current obese mass.
  const targetWeight =
    goals.targetWeightKg !== "" && Number(goals.targetWeightKg) > 0
      ? Math.min(Number(goals.targetWeightKg), w)
      : w

  // ABW: safety floor reference weight only — not the recommendation basis.
  const abw = calcABW(w, h, profile.sex)

  const rawTargetCalories = calcTargetCalories(profile, goals, goalMode)
  if (!rawTargetCalories) return null

  // ── Step 1: Resolve mode ───────────────────────────────────────────────────
  // The user's macroSplit preference is the single source of truth.
  // No silent overrides — if a user's choice has clinical caveats (CKD,
  // diabetes, ED history, maternal modes), those are surfaced as
  // *warnings* via services/macroWarnings.ts so the user can make
  // informed decisions rather than being silently overridden.
  const macroMode = resolveMacroMode(settings.macroSplit)

  // ── Step 2: Clamp calories to mode-specific floor ──────────────────────────
  const targetCalories = Math.max(rawTargetCalories, CALORIE_FLOOR[macroMode])

  // ── Step 3: Mode-isolated macro logic ─────────────────────────────────────
  let proteinG: number
  let carbsG:   number
  let fatG:     number

  // ─────────────────────────────────────────────────────────────────────────
  // KETO
  // Protein: 1.2–1.5 g/kg, activity-scaled. ABW floor enforced.
  // Carbs:   fixed 25g net (midpoint of 20–50g). Defines keto — not a suggestion.
  // Fat:     fills remaining calories. Keto is fat-fuelled.
  // ─────────────────────────────────────────────────────────────────────────
  if (macroMode === "KETO") {
    const mult      = PROTEIN_MULTIPLIER[profile.activityLevel] ?? 1.2
    proteinG        = Math.max(
      Math.round(targetWeight * mult),
      Math.round(abw * ABW_PROTEIN_FLOOR_MULTIPLIER)
    )
    proteinG        = Math.min(proteinG, 160)
    carbsG          = 25
    const remaining = targetCalories - proteinG * 4 - carbsG * 4
    fatG            = Math.max(Math.round(remaining / 9), FAT_FLOOR[macroMode])

  // ─────────────────────────────────────────────────────────────────────────
  // VERY LOW CARB
  // Protein: 1.2–1.5 g/kg. ABW floor enforced.
  // Carbs:   fixed 65g (midpoint of 50–80g). More vegetables, some legumes.
  // Fat:     fills remaining.
  // ─────────────────────────────────────────────────────────────────────────
  } else if (macroMode === "VERY_LOW_CARB") {
    const mult      = PROTEIN_MULTIPLIER[profile.activityLevel] ?? 1.2
    proteinG        = Math.max(
      Math.round(targetWeight * mult),
      Math.round(abw * ABW_PROTEIN_FLOOR_MULTIPLIER)
    )
    proteinG        = Math.min(proteinG, 160)
    carbsG          = 65
    const remaining = targetCalories - proteinG * 4 - carbsG * 4
    fatG            = Math.max(Math.round(remaining / 9), FAT_FLOOR[macroMode])

  // ─────────────────────────────────────────────────────────────────────────
  // LOW CARB
  // Protein: 1.2–1.4 g/kg (capped — carbs carry more load here). ABW floor.
  // Carbs:   fixed 100g (midpoint of 80–120g).
  // Fat:     fills remaining.
  // ─────────────────────────────────────────────────────────────────────────
  } else if (macroMode === "LOW_CARB") {
    const mult      = Math.min(PROTEIN_MULTIPLIER[profile.activityLevel] ?? 1.2, 1.4)
    proteinG        = Math.max(
      Math.round(targetWeight * mult),
      Math.round(abw * ABW_PROTEIN_FLOOR_MULTIPLIER)
    )
    proteinG        = Math.min(proteinG, 150)
    carbsG          = 100
    const remaining = targetCalories - proteinG * 4 - carbsG * 4
    fatG            = Math.max(Math.round(remaining / 9), FAT_FLOOR[macroMode])

  // ─────────────────────────────────────────────────────────────────────────
  // HIGH PROTEIN CUT
  // Protein: 1.6–1.8 g/kg (high — aggressive cut, maximum muscle retention).
  // Fat:     fixed ~0.7 g/kg targetWeight (moderate; preserves hormonal health).
  // Carbs:   fills remaining (serves training performance — not restricted).
  // ─────────────────────────────────────────────────────────────────────────
  } else if (macroMode === "HIGH_PROTEIN_CUT") {
    const mult      = PROTEIN_MULTIPLIER_HIGH[profile.activityLevel] ?? 1.6
    proteinG        = Math.max(
      Math.round(targetWeight * mult),
      Math.round(abw * ABW_PROTEIN_FLOOR_MULTIPLIER)
    )
    proteinG        = Math.min(proteinG, 220)
    fatG            = Math.max(Math.round(targetWeight * 0.7), FAT_FLOOR[macroMode])
    const remaining = targetCalories - proteinG * 4 - fatG * 9
    // Carbs fill remaining, but capped at 150g — above this the diet no longer
    // reads as a "cut". Surplus calories beyond the cap are absorbed by fat,
    // which improves satiety and hormonal health without inflating carbs.
    carbsG          = Math.min(Math.max(Math.round(remaining / 4), 50), 150)
    const carbOverflow = remaining - carbsG * 4
    if (carbOverflow > 0) fatG += Math.round(carbOverflow / 9)

  // ─────────────────────────────────────────────────────────────────────────
  // RECOMPOSITION
  // Protein: 1.6–1.8 g/kg (high — needed for simultaneous synthesis + deficit).
  // Carbs:   110–130g anchored (supports resistance training performance).
  // Fat:     fills remaining.
  // ─────────────────────────────────────────────────────────────────────────
  } else if (macroMode === "RECOMPOSITION") {
    const mult      = PROTEIN_MULTIPLIER_HIGH[profile.activityLevel] ?? 1.6
    proteinG        = Math.max(
      Math.round(targetWeight * mult),
      Math.round(abw * ABW_PROTEIN_FLOOR_MULTIPLIER)
    )
    proteinG        = Math.min(proteinG, 220)
    carbsG          = targetCalories >= 1600 ? 130 : 110
    const remaining = targetCalories - proteinG * 4 - carbsG * 4
    fatG            = Math.max(Math.round(remaining / 9), FAT_FLOOR[macroMode])

  } else {
    // BALANCED MODE
    // Protein: 1.2–1.4 g/kg adult, 1.0-1.6 g/kg for children (higher per kg due to growth).
    // ABW floor enforced.
    // Fat:     anchored at 30% of total target calories (midpoint of 25–35%).
    // Carbs:   fill remaining after protein + fat.
    //
    // Children and early teens use a separate protein multiplier table
    // (PROTEIN_MULTIPLIER_CHILD) calibrated for growing bodies. The ABW floor
    // still applies as a safety net.
    const isChildMode = goalMode === "child" || goalMode === "teen_early"
    const mult   = isChildMode
      ? PROTEIN_MULTIPLIER_CHILD[profile.activityLevel] ?? 1.2
      : Math.min(PROTEIN_MULTIPLIER[profile.activityLevel] ?? 1.2, 1.4)
    proteinG     = Math.max(
      Math.round(targetWeight * mult),
      Math.round(abw * ABW_PROTEIN_FLOOR_MULTIPLIER)
    )
    proteinG     = Math.min(proteinG, 150)
    fatG         = Math.max(Math.round((targetCalories * 0.30) / 9), FAT_FLOOR[macroMode])
    // Carbs fill remaining calories — naturally scales with the calorie budget
    carbsG       = Math.max(
      Math.round((targetCalories - proteinG * 4 - fatG * 9) / 4),
      80  // below 80g carbs this is no longer balanced — user should switch modes
    )
  }

  // ── Step 4: Absolute last-resort guards ───────────────────────────────────
  // These should never activate in normal operation.
  // They exist only to prevent catastrophic output from edge-case inputs.
  // They are NOT design constraints — the mode logic above handles that.
  proteinG = Math.max(proteinG, 50)
  fatG     = Math.max(fatG, 30)
  carbsG   = Math.max(carbsG, 0)

  return { bmr, tdee, targetCalories, proteinG, carbsG, fatG }
}

export function formatHour(h: number): string {
  const period = h >= 12 ? "PM" : "AM"
  const hour   = h % 12 === 0 ? 12 : h % 12
  return `${hour}:00 ${period}`
}
