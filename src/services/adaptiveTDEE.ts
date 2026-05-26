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
import type { UserProfile, UserGoals, AppSettings, ComputedMacros, ActivityLevel } from "../store/useHealthStore"
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
  //
  // Growth & maintenance modes (child / teen_early / maintenance) hard-zero
  // the deficit regardless of the user-supplied weeklyLossKg. This is the
  // "inform-don't-override" pattern made explicit: the UI hides the weekly-
  // loss control for these modes, but if a stale value lingers in storage
  // from a previous goal mode, the engine must not silently apply it.
  //
  // Why these three modes specifically:
  //   - child / teen_early: weight changes reflect growth, not surplus. A
  //     deficit during growth is clinically harmful — it can compromise
  //     final adult height, bone density, and pubertal development.
  //   - maintenance: by definition a non-deficit mode. Stale weeklyLossKg
  //     from a previous fat-loss phase shouldn't quietly carry over.
  //
  // teen_older keeps the deficit logic (with the 0.5 kg/wk cap already in
  // GOAL_MODE_FLAGS) — older teens can pursue cautious fat loss with the
  // caveat banners shown in UI.
  const isNonDeficitMode =
    goalMode === "child" || goalMode === "teen_early" || goalMode === "maintenance"
  const maxLoss = goalMode ? GOAL_MODE_FLAGS[goalMode]?.maxWeightLossPerWeekKg : null
  const cappedWeeklyLoss = isNonDeficitMode
    ? 0
    : maxLoss === null && goalMode && isPregnancyMode(goalMode)
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

// ═════════════════════════════════════════════════════════════════════════════
// ── Macro Mode ──────────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
// The macro mode is the SINGLE source of truth for the macro profile.
// Each mode is described as DATA (a MacroModeProfile object) rather than as a
// branch in computeMacros(). This makes it mathematically impossible for the
// mode label to disagree with the macro output, and makes each mode's
// nutritional philosophy explicit and reviewable in one place.
//
// Design principles for this engine (in priority order):
//   1. Sustainability over optimisation. Mainstream users in long-term fat
//      loss, not contest-prep athletes.
//   2. Protein is prescribed from TARGET WEIGHT × mode-appropriate multiplier.
//      ABW only acts as a safety FLOOR — never as the primary basis.
//   3. Carbs are ANCHORED per mode in any mode whose identity is defined by
//      carb level (KETO / VERY_LOW_CARB / LOW_CARB). A "keto" plan must
//      always look like keto.
//   4. In modes where carb level does NOT define the identity (BALANCED,
//      HIGH_PROTEIN_CUT, RECOMPOSITION), fat is anchored at a calorie
//      fraction and carbs flex within a sanity band. This avoids "runaway
//      fats" at high calorie budgets.
//   5. No hidden overrides. No leftover-calorie carb inflation. No accidental
//      drift between displayed mode and actual macro profile.
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
//
// This is the bridge between the legacy "percentage slider" UI input and the
// mode-driven engine. Commit 6 (TODO) will eliminate the slider in favour of
// a direct mode selector — this function will become a one-line lookup then.
export function resolveMacroMode(
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

// ═════════════════════════════════════════════════════════════════════════════
// ── Protein tables ──────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
// Multipliers operate on TARGET BODY WEIGHT (kg). ABW only enters as a floor.
//
// Tier guidance (from the app's nutritional philosophy):
//   Sedentary fat loss          1.0–1.2 g/kg
//   Moderate activity           1.2–1.4 g/kg
//   Frequent resistance work    1.4–1.6 g/kg
//   Aggressive cut / recomp     1.6–1.8 g/kg
//
// Mainstream modes (BALANCED / LOW_CARB / VERY_LOW_CARB / KETO) anchor in the
// lower two tiers — this is enough for muscle preservation in fat loss
// without turning every meal into a chicken-and-paneer chore for users who
// aren't training to failure 5 days a week.
//
// Evidence base:
//   Phillips & Van Loon (2011)           — 1.2–1.6 g/kg sufficient for fat loss
//   Helms et al. (2014, recent meta)     — ~1.6 g/kg LBM ceiling for natural lifters
//   Morton et al. (2018, JNutr meta)     — diminishing returns above ~1.6 g/kg
//   ISSN Position Stand (2017)           — 1.4–2.0 g/kg for active individuals
//   Mettler et al. (2010, cut-specific)  — 2.3+ g/kg only justified in aggressive deficit
//
// For mainstream sustainable fat loss, the lower end of this evidence is
// appropriate — and far more adherent.

type ProteinTable = Record<ActivityLevel, number>

// Default — used by all carb-anchored modes (KETO / VLC / LC / BALANCED).
// 1.1 g/kg sedentary → 1.4 g/kg extra_active. Modest, evidence-aligned,
// adherent. Carb-restricted modes get the same baseline because protein
// doesn't need to spike just because carbs went down — fat carries the
// energy.
const PROTEIN_DEFAULT: ProteinTable = {
  sedentary:         1.1,
  lightly_active:    1.2,
  moderately_active: 1.3,
  very_active:       1.4,
  extra_active:      1.4,
}

// Specialist modes (HIGH_PROTEIN_CUT, RECOMPOSITION).
// 1.6 g/kg sedentary → 1.8 g/kg extra_active. These modes signal the user
// opted in to a higher-protein approach for a specific reason — aggressive
// cut or simultaneous fat loss + muscle gain.
const PROTEIN_HIGH: ProteinTable = {
  sedentary:         1.6,
  lightly_active:    1.65,
  moderately_active: 1.7,
  very_active:       1.75,
  extra_active:      1.8,
}

// Children & early teens — WHO 2007 baseline (0.95 g/kg) plus growth/activity
// allowance. Higher per-kg than adults because growing tissue needs nitrogen
// far in excess of maintenance.
const PROTEIN_CHILD: ProteinTable = {
  sedentary:         1.0,
  lightly_active:    1.1,
  moderately_active: 1.3,
  very_active:       1.5,
  extra_active:      1.6,
}

// ABW protein floor (universal minimum across all modes).
// 1.2 g/kg ABW prevents severe under-prescription in:
//   - obesity (ABW corrects for non-metabolically active fat mass)
//   - aggressive calorie deficits
//   - IF / time-restricted feeding
//   - catabolic states (illness, stress, ageing)
//
// This is a FLOOR, not a default. A sedentary user in mild deficit still
// receives the mode's recommended multiplier — ABW only activates when the
// mode-based number would be lower than 1.2 × ABW for their body comp.
const ABW_PROTEIN_FLOOR_MULTIPLIER = 1.2

// Absolute protein hard ceiling per mode (g/day).
// Defends against pathological outputs from edge-case inputs (e.g. very tall
// + very active + high-protein-cut + heavy target weight). Above ~2.2 g/kg
// LBM there is no further benefit — anything beyond is dietary overhead.
const PROTEIN_CEILING: Record<MacroMode, number> = {
  KETO:             160,
  VERY_LOW_CARB:    160,
  LOW_CARB:         150,
  BALANCED:         150,
  HIGH_PROTEIN_CUT: 220,
  RECOMPOSITION:    220,
}

// Absolute protein hard floor across ALL modes.
// 50g is the minimum protein intake that prevents nitrogen-balance collapse
// in any adult — ABW floor will normally be well above this.
const PROTEIN_HARD_FLOOR_G = 50

// ═════════════════════════════════════════════════════════════════════════════
// ── Mode profiles ───────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
// One self-contained nutritional philosophy per mode, expressed as data.
//
// A mode has exactly ONE flexible macro. Protein is always anchored. The
// remaining slot — carbs or fat — is determined by what defines the mode:
//
//   - In KETO / VLC / LC, carbs DEFINE the mode → carbs anchored, fat flexes.
//   - In BALANCED / HIGH_PROTEIN_CUT / RECOMPOSITION, the proportional split
//     defines the mode → fat anchored at a calorie fraction, carbs flex
//     within a sanity band.
//
// This is the design rule that prevents two failure modes:
//   - "leftover-calorie carb inflation" (carbs growing unbounded as the only
//     residual macro)
//   - "runaway fat" (fat growing unbounded at high calorie budgets when fat
//     is the residual and protein/carbs are small fixed numbers)

type CarbStrategy =
  // Carbs are mode-defining. Fixed grams regardless of calorie budget.
  // bandG = [min, max] for the coherence guard. anchorG must lie inside it.
  | { kind: "fixed_g";       anchorG: number;  bandG: [number, number] }
  // Carbs flex within a sanity band; fat is anchored elsewhere.
  // bandG defines what "balanced" / "moderate" means for this mode.
  | { kind: "flex_in_band";  bandG: [number, number] }

type FatStrategy =
  // Fat is the residual macro. Floor protects hormonal health.
  | { kind: "residual";       floorG: number }
  // Fat is anchored at a fraction of total calories. Floor still applies.
  // Used by modes where carbs flex, to prevent runaway fat at high budgets.
  | { kind: "kcal_fraction";  fraction: number; floorG: number }

type MacroModeProfile = {
  proteinTable: ProteinTable
  proteinCap?:  number          // optional g/kg cap (e.g. LOW_CARB caps at 1.4)
  carbs:        CarbStrategy
  fat:          FatStrategy
  calorieFloor: number
}

const MODE_PROFILES: Record<MacroMode, MacroModeProfile> = {
  // ───────────────────────────────────────────────────────────────────────
  // KETO — true ketogenic, ≤50g net carbs/day.
  // Fat is the dominant fuel. Protein moderate (high protein can blunt
  // ketosis via gluconeogenesis in some users). Carbs anchored at 25g
  // (midpoint of 20–50g clinical keto range), fat absorbs the rest.
  // ───────────────────────────────────────────────────────────────────────
  KETO: {
    proteinTable: PROTEIN_DEFAULT,
    carbs:        { kind: "fixed_g",       anchorG: 25, bandG: [20, 50] },
    fat:          { kind: "residual",      floorG: 60 },
    calorieFloor: 1100,
  },

  // ───────────────────────────────────────────────────────────────────────
  // VERY_LOW_CARB — 50–80g/day. Below LCHF, above strict keto.
  // More vegetables and some legumes are possible. Suits users who want
  // metabolic benefits of carb restriction without strict ketosis.
  // ───────────────────────────────────────────────────────────────────────
  VERY_LOW_CARB: {
    proteinTable: PROTEIN_DEFAULT,
    carbs:        { kind: "fixed_g",       anchorG: 65, bandG: [50, 80] },
    fat:          { kind: "residual",      floorG: 55 },
    calorieFloor: 1150,
  },

  // ───────────────────────────────────────────────────────────────────────
  // LOW_CARB — 80–120g/day. Moderate restriction.
  // Protein capped at 1.4 g/kg: carbs still contribute meaningful energy,
  // so we don't over-prescribe protein here. This is the "Mediterranean-ish"
  // band — popular with sustainable fat loss users.
  // ───────────────────────────────────────────────────────────────────────
  LOW_CARB: {
    proteinTable: PROTEIN_DEFAULT,
    proteinCap:   1.4,
    carbs:        { kind: "fixed_g",       anchorG: 100, bandG: [80, 120] },
    fat:          { kind: "residual",      floorG: 45 },
    calorieFloor: 1200,
  },

  // ───────────────────────────────────────────────────────────────────────
  // BALANCED — moderate, flexible. Defined by proportional split, not by
  // an absolute carb level. Fat anchored at 30% of total calories (the
  // midpoint of the "moderate fat" 25–35% range in mainstream guidance);
  // carbs flex to absorb the remainder, clamped into a sensible band.
  //
  // This is the right design here: a 1200 kcal balanced plan and a
  // 2400 kcal balanced plan both have ~30% fat, but the carb gram total
  // appropriately scales with the budget instead of staying fixed.
  // ───────────────────────────────────────────────────────────────────────
  BALANCED: {
    proteinTable: PROTEIN_DEFAULT,
    proteinCap:   1.4,
    carbs:        { kind: "flex_in_band",  bandG: [110, 320] },
    fat:          { kind: "kcal_fraction", fraction: 0.30, floorG: 40 },
    calorieFloor: 1300,
  },

  // ───────────────────────────────────────────────────────────────────────
  // HIGH_PROTEIN_CUT — aggressive cut with protein-led satiety.
  // High protein, lower fat (25% kcal), carbs flex within a band.
  // Fat is anchored low so it doesn't run away on higher-calorie users;
  // carbs absorb the remainder to support training and adherence.
  //
  // Band upper end is generous (280g) so larger, more active users on a
  // higher calorie budget aren't forced into a carb-clamp that breaks the
  // calorie math. The mode is identified by HIGH protein + LOW-ish fat,
  // not by a carb ceiling — at 2500+ kcal a 30%-protein 25%-fat split
  // naturally lands ~45% carbs, which is appropriate for the mode.
  // ───────────────────────────────────────────────────────────────────────
  HIGH_PROTEIN_CUT: {
    proteinTable: PROTEIN_HIGH,
    carbs:        { kind: "flex_in_band",  bandG: [60, 280] },
    fat:          { kind: "kcal_fraction", fraction: 0.25, floorG: 40 },
    calorieFloor: 1200,
  },

  // ───────────────────────────────────────────────────────────────────────
  // RECOMPOSITION — simultaneous fat loss + muscle gain.
  // High protein, moderate fat (28% kcal), carbs flex to fuel training.
  // Calorie floor lifted to 1400 because muscle protein synthesis suffers
  // below adequate energy availability. Band upper end is generous for
  // the same reason as HIGH_PROTEIN_CUT — active heavy users.
  // ───────────────────────────────────────────────────────────────────────
  RECOMPOSITION: {
    proteinTable: PROTEIN_HIGH,
    carbs:        { kind: "flex_in_band",  bandG: [80, 300] },
    fat:          { kind: "kcal_fraction", fraction: 0.28, floorG: 40 },
    calorieFloor: 1400,
  },
}

// ═════════════════════════════════════════════════════════════════════════════
// ── Helpers (each unit-testable in isolation) ───────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

// Resolve the protein prescription for a given mode + body + goal.
// Returns grams of protein, already clamped to the mode's ceiling and the
// global ABW floor.
export function resolveProtein(
  mode: MacroMode,
  targetWeightKg: number,
  abwKg: number,
  activityLevel: ActivityLevel,
  goalMode?: GoalMode,
): number {
  const modeProfile = MODE_PROFILES[mode]
  const isChild = goalMode === "child" || goalMode === "teen_early"

  // Children use their own table regardless of mode; growth needs override
  // mode-specific philosophies. The mode-specific proteinCap is also bypassed
  // for children — under-feeding a growing body is the larger risk.
  const table = isChild ? PROTEIN_CHILD : modeProfile.proteinTable
  let multiplier = table[activityLevel] ?? PROTEIN_DEFAULT.moderately_active
  if (modeProfile.proteinCap !== undefined && !isChild) {
    multiplier = Math.min(multiplier, modeProfile.proteinCap)
  }

  const fromTargetWeight = Math.round(targetWeightKg * multiplier)
  const fromAbwFloor     = Math.round(abwKg * ABW_PROTEIN_FLOOR_MULTIPLIER)

  // Take the higher of (mode-prescribed) and (ABW floor), then clamp to
  // the mode-specific ceiling and the absolute 50g hard floor.
  let protein = Math.max(fromTargetWeight, fromAbwFloor)
  protein     = Math.min(protein, PROTEIN_CEILING[mode])
  protein     = Math.max(protein, PROTEIN_HARD_FLOOR_G)
  return protein
}

// Compute carbs and fat in grams for a given mode and calorie budget, with
// protein already resolved. Returns [carbsG, fatG].
//
// The function dispatches on the mode's fat strategy:
//   - "residual": fat is residual, carbs are anchored. Used by KETO / VLC / LC.
//   - "kcal_fraction": fat is anchored at a fraction of total calories,
//     carbs flex within their sanity band. Used by BALANCED / HPC / RECOMP.
export function resolveCarbsAndFat(
  mode: MacroMode,
  targetCalories: number,
  proteinG: number,
): { carbsG: number; fatG: number } {
  const modeProfile = MODE_PROFILES[mode]
  const proteinKcal = proteinG * 4

  if (modeProfile.fat.kind === "residual") {
    // Carb-anchored mode (KETO / VLC / LC). Carbs are mode-defining and fixed.
    // Fat absorbs whatever calories are left after protein + carbs are paid.
    // Type narrowing: when fat is residual, carbs must be fixed_g (enforced
    // at the profile level — see MODE_PROFILES above).
    const carbsG = modeProfile.carbs.kind === "fixed_g"
      ? modeProfile.carbs.anchorG
      : 0  // unreachable but keeps the type system happy
    const fatKcalRemaining = targetCalories - proteinKcal - carbsG * 4
    const fatG = Math.max(Math.round(fatKcalRemaining / 9), modeProfile.fat.floorG)
    return { carbsG, fatG }
  }

  // Fat-anchored mode (BALANCED / HPC / RECOMP). Fat is a fraction of total
  // calories with a hormonal floor; carbs absorb the remainder, clamped into
  // the mode's "this is what BALANCED / HPC / RECOMP looks like" band so the
  // mode label always matches the macro profile.
  //
  // At high calorie budgets, the carb upper band can be reached. When that
  // happens, the extra calories overflow back into FAT (which has only a
  // floor, not a ceiling). This is correct: at 2800+ kcal a HPC plan will
  // naturally need more fat too — what matters for the mode identity is the
  // protein/carb FLOOR on fat, not a hard fat ceiling.
  const fatFromFraction   = Math.round((targetCalories * modeProfile.fat.fraction) / 9)
  const fatAnchorG        = Math.max(fatFromFraction, modeProfile.fat.floorG)
  const carbKcalRemaining = targetCalories - proteinKcal - fatAnchorG * 9
  const carbsRaw          = Math.round(carbKcalRemaining / 4)
  // Type narrowing: when fat is kcal_fraction, carbs must be flex_in_band.
  const band = modeProfile.carbs.kind === "flex_in_band"
    ? modeProfile.carbs.bandG
    : [0, 9999] as [number, number]  // unreachable but type-safe
  const carbsG = Math.min(Math.max(carbsRaw, band[0]), band[1])

  // If we clamped carbs at the upper band, the overflow calories go to fat.
  // Fat has only a floor, no ceiling — this prevents the engine from silently
  // under-prescribing total energy at high calorie budgets.
  const carbOverflowKcal = (carbsRaw - carbsG) * 4
  const fatG = carbOverflowKcal > 0
    ? fatAnchorG + Math.round(carbOverflowKcal / 9)
    : fatAnchorG
  return { carbsG, fatG }
}

// Coherence guard. Returns true if the produced macros actually fit the
// declared mode. If false, something has gone wrong upstream (e.g. an
// extreme calorie budget pushed carbs out of the mode's declared band).
// Used by computeMacros for a dev-time sanity check.
export function macrosMatchMode(mode: MacroMode, carbsG: number): boolean {
  const carbs = MODE_PROFILES[mode].carbs
  const band = carbs.kind === "fixed_g" ? carbs.bandG : carbs.bandG
  return carbsG >= band[0] && carbsG <= band[1]
}

// ═════════════════════════════════════════════════════════════════════════════
// ── computeMacros ───────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
// Fully mode-driven. The flow is deliberately simple and uniform across modes:
//
//   1. Resolve mode from user settings (single source of truth).
//   2. Clamp calories to mode floor.
//   3. Resolve PROTEIN via target weight × mode multiplier, with ABW floor.
//   4. Resolve CARBS + FAT per mode strategy (one anchored, one flexible).
//   5. Coherence guard: assert mode label matches macro profile.
//
// No mode has its own custom flow. No "fill from leftovers" logic except as
// the *one* designated flexible macro in each mode — bounded on both ends.
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
  // Protein is prescribed for the target body, not current obese mass.
  const targetWeight =
    goals.targetWeightKg !== "" && Number(goals.targetWeightKg) > 0
      ? Math.min(Number(goals.targetWeightKg), w)
      : w

  const abw = calcABW(w, h, profile.sex)

  const rawTargetCalories = calcTargetCalories(profile, goals, goalMode)
  if (!rawTargetCalories) return null

  // ── Step 1: Resolve mode ───────────────────────────────────────────────────
  // The user's macroSplit is the single source of truth. No silent overrides.
  // Clinical caveats (CKD, diabetes, ED history, maternal modes) are surfaced
  // as warnings via services/macroWarnings.ts — never as silent macro changes.
  const macroMode = resolveMacroMode(settings.macroSplit)
  const modeProfile = MODE_PROFILES[macroMode]

  // ── Step 2: Clamp calories to mode-specific floor ──────────────────────────
  const targetCalories = Math.max(rawTargetCalories, modeProfile.calorieFloor)

  // ── Step 3: Resolve protein ────────────────────────────────────────────────
  // Target weight × mode multiplier (activity-scaled), with ABW as a floor.
  const proteinG = resolveProtein(macroMode, targetWeight, abw, profile.activityLevel, goalMode)

  // ── Step 4: Resolve carbs and fat per mode strategy ───────────────────────
  // One is anchored (mode-defining), the other absorbs the remainder.
  // Which is which depends entirely on the mode profile.
  const { carbsG, fatG } = resolveCarbsAndFat(macroMode, targetCalories, proteinG)

  // ── Step 5: Coherence guard ───────────────────────────────────────────────
  // Dev-time assertion: the carbs we produced must lie inside the mode's
  // declared band. If this ever fires, the mode profile or computation logic
  // has drifted and the user could see a label that doesn't match output.
  // We don't throw in production — meal generation should always have macros
  // to work with — but we surface a console warning so the regression is
  // visible in CI logs and dev tools.
  if (!macrosMatchMode(macroMode, carbsG)) {
    if (typeof console !== "undefined") {
      // eslint-disable-next-line no-console
      console.warn(
        `[adaptiveTDEE] Macro coherence violation: mode=${macroMode} produced ` +
        `carbs=${carbsG}g, outside declared band for this mode. ` +
        `Inputs: targetCal=${targetCalories}, protein=${proteinG}g, fat=${fatG}g.`,
      )
    }
  }

  return { bmr, tdee, targetCalories, proteinG, carbsG, fatG }
}

export function formatHour(h: number): string {
  const period = h >= 12 ? "PM" : "AM"
  const hour   = h % 12 === 0 ? 12 : h % 12
  return `${hour}:00 ${period}`
}
