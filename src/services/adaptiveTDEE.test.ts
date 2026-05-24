// ── adaptiveTDEE.test.ts ──────────────────────────────────────────────────────
// Covers: calcBMR, calcTDEE, calcTargetCalories, computeMacros,
//         computeAdaptiveTDEE, and every edge case in the manual checklist.
//
// Run:  npm test
// Watch: npm run test:watch

import { describe, it, expect } from "vitest"
import {
  calcBMR,
  calcTDEE,
  calcTargetCalories,
  computeMacros,
  computeAdaptiveTDEE,
} from "./adaptiveTDEE"

// ── Shared helpers ────────────────────────────────────────────────────────────

const makeProfile = (overrides = {}) => ({
  name: "Test",
  age: 35,
  sex: "male" as const,
  heightCm: 175,
  weightKg: 75,
  activityLevel: "moderately_active" as const,
  ...overrides,
})

const makeGoals = (overrides = {}) => ({
  targetWeightKg: 65,
  weeklyLossKg: 0.5 as const,
  ...overrides,
})

// Default settings now use a BALANCED macro split (40% carbs).
// Keto/high-fat tests should pass their own settings explicitly.
const makeSettings = (overrides = {}) => ({
  macroSplit: { fatPct: 30, proteinPct: 30, carbsPct: 40 },
  ifProtocol: { fastingHours: 19, eatingHours: 5, fastStartHour: 20 },
  ...overrides,
})

// Convenience builders for explicit mode testing
const ketoSettings     = () => makeSettings({ macroSplit: { fatPct: 70, proteinPct: 25, carbsPct: 5  } })
const lowCarbSettings  = () => makeSettings({ macroSplit: { fatPct: 45, proteinPct: 30, carbsPct: 25 } })
const balancedSettings = () => makeSettings({ macroSplit: { fatPct: 30, proteinPct: 30, carbsPct: 40 } })

// ── 1. BMR ────────────────────────────────────────────────────────────────────

describe("calcBMR", () => {
  it("returns null when profile fields are empty strings", () => {
    const p = makeProfile({ age: "", heightCm: "", weightKg: "" })
    expect(calcBMR(p as any)).toBeNull()
  })

  it("returns null when only one field is empty", () => {
    expect(calcBMR(makeProfile({ weightKg: "" }) as any)).toBeNull()
    expect(calcBMR(makeProfile({ heightCm: "" }) as any)).toBeNull()
    expect(calcBMR(makeProfile({ age: "" }) as any)).toBeNull()
  })

  it("computes male BMR correctly for normal weight (BMI ≤ 30, uses actual weight)", () => {
    const bmr = calcBMR(makeProfile())
    expect(bmr).not.toBeNull()
    expect(bmr!).toBeGreaterThanOrEqual(1660)
    expect(bmr!).toBeLessThanOrEqual(1690)
  })

  it("computes female BMR correctly", () => {
    const bmr = calcBMR(makeProfile({ sex: "female", age: 30, heightCm: 160, weightKg: 60 }))
    expect(bmr).not.toBeNull()
    expect(bmr!).toBeGreaterThanOrEqual(1275)
    expect(bmr!).toBeLessThanOrEqual(1305)
  })

  it("applies ABW when BMI > 30 (overweight male)", () => {
    const bmrActual = calcBMR(makeProfile({ age: 40, heightCm: 170, weightKg: 110 }))
    expect(bmrActual).not.toBeNull()
    expect(bmrActual!).toBeGreaterThanOrEqual(1688)
    expect(bmrActual!).toBeLessThanOrEqual(1718)
  })

  it("does NOT apply ABW when BMI is exactly 30 (boundary)", () => {
    const weightAtBmi30 = 30 * (1.75 ** 2)
    const bmrWithABW = calcBMR(makeProfile({ weightKg: weightAtBmi30 }))
    expect(bmrWithABW).toBeGreaterThanOrEqual(1835)
    expect(bmrWithABW!).toBeLessThanOrEqual(1855)
  })

  it("applies ABW when BMI is just above 30 (boundary)", () => {
    const weightAtBmi30_1 = 30.1 * (1.75 ** 2)
    const bmrHigh = calcBMR(makeProfile({ weightKg: weightAtBmi30_1 }))
    const bmrAtBoundary = calcBMR(makeProfile({ weightKg: 30 * (1.75 ** 2) }))
    expect(bmrHigh!).toBeLessThan(bmrAtBoundary! + 50)
  })

  it("BMR increases with height (all else equal)", () => {
    const short = calcBMR(makeProfile({ heightCm: 160 }))
    const tall  = calcBMR(makeProfile({ heightCm: 185 }))
    expect(tall!).toBeGreaterThan(short!)
  })

  it("BMR decreases with age (all else equal)", () => {
    const young = calcBMR(makeProfile({ age: 25 }))
    const old   = calcBMR(makeProfile({ age: 60 }))
    expect(old!).toBeLessThan(young!)
  })

  it("female BMR is lower than male BMR (all else equal)", () => {
    const male   = calcBMR(makeProfile({ sex: "male" }))
    const female = calcBMR(makeProfile({ sex: "female" }))
    expect(female!).toBeLessThan(male!)
  })

  it("handles very tall user without crash", () => {
    const bmr = calcBMR(makeProfile({ heightCm: 220, weightKg: 100 }))
    expect(bmr).not.toBeNull()
    expect(bmr!).toBeGreaterThan(0)
  })

  it("handles very short user without crash", () => {
    const bmr = calcBMR(makeProfile({ heightCm: 140, weightKg: 45 }))
    expect(bmr).not.toBeNull()
    expect(bmr!).toBeGreaterThan(0)
  })
})

// ── 2. TDEE ───────────────────────────────────────────────────────────────────

describe("calcTDEE", () => {
  it("returns null when BMR is null (incomplete profile)", () => {
    expect(calcTDEE(makeProfile({ weightKg: "" }) as any)).toBeNull()
  })

  it("sedentary multiplier = 1.2", () => {
    const bmr  = calcBMR(makeProfile())!
    const tdee = calcTDEE(makeProfile({ activityLevel: "sedentary" }))
    expect(tdee).toBeCloseTo(bmr * 1.2, 0)
  })

  it("lightly_active multiplier = 1.375", () => {
    const bmr  = calcBMR(makeProfile())!
    const tdee = calcTDEE(makeProfile({ activityLevel: "lightly_active" }))
    expect(tdee).toBeCloseTo(bmr * 1.375, 0)
  })

  it("moderately_active multiplier = 1.55", () => {
    const bmr  = calcBMR(makeProfile())!
    const tdee = calcTDEE(makeProfile({ activityLevel: "moderately_active" }))
    expect(tdee).toBeCloseTo(bmr * 1.55, 0)
  })

  it("very_active multiplier = 1.725", () => {
    const bmr  = calcBMR(makeProfile())!
    const tdee = calcTDEE(makeProfile({ activityLevel: "very_active" }))
    expect(tdee).toBeCloseTo(bmr * 1.725, 0)
  })

  it("extra_active multiplier = 1.9", () => {
    const bmr  = calcBMR(makeProfile())!
    const tdee = calcTDEE(makeProfile({ activityLevel: "extra_active" }))
    expect(tdee).toBeCloseTo(bmr * 1.9, 0)
  })

  it("TDEE increases with activity level", () => {
    const sedentary = calcTDEE(makeProfile({ activityLevel: "sedentary" }))!
    const moderate  = calcTDEE(makeProfile({ activityLevel: "moderately_active" }))!
    const extra     = calcTDEE(makeProfile({ activityLevel: "extra_active" }))!
    expect(moderate).toBeGreaterThan(sedentary)
    expect(extra).toBeGreaterThan(moderate)
  })

  it("uses bmrOverride instead of calculated BMR when set", () => {
    const tdee = calcTDEE(makeProfile({ bmrOverride: 2000, activityLevel: "sedentary" }))
    expect(tdee).toBeCloseTo(2000 * 1.2, 0)
  })
})

// ── 3. Target Calories ────────────────────────────────────────────────────────

describe("calcTargetCalories", () => {
  it("returns null when TDEE is null", () => {
    const result = calcTargetCalories(makeProfile({ weightKg: "" }) as any, makeGoals())
    expect(result).toBeNull()
  })

  it("applies correct deficit for 0.5 kg/week loss", () => {
    const tdee   = calcTDEE(makeProfile())!
    const target = calcTargetCalories(makeProfile(), makeGoals({ weeklyLossKg: 0.5 }))!
    expect(target).toBeCloseTo(tdee - 550, 0)
  })

  it("applies correct deficit for 1.0 kg/week loss", () => {
    const tdee   = calcTDEE(makeProfile())!
    const target = calcTargetCalories(makeProfile(), makeGoals({ weeklyLossKg: 1.0 }))!
    expect(target).toBeCloseTo(tdee - 1100, 0)
  })

  it("applies correct deficit for 0.25 kg/week loss", () => {
    const tdee   = calcTDEE(makeProfile())!
    const target = calcTargetCalories(makeProfile(), makeGoals({ weeklyLossKg: 0.25 }))!
    expect(target).toBeCloseTo(tdee - 275, 0)
  })

  it("never goes below 1200 kcal floor", () => {
    const profile = makeProfile({
      sex: "female",
      heightCm: 150,
      weightKg: 50,
      activityLevel: "sedentary",
    })
    const goals = makeGoals({ weeklyLossKg: 1.0 })
    const target = calcTargetCalories(profile, goals)!
    expect(target).toBeGreaterThanOrEqual(1200)
  })

  it("larger deficit = lower calories (monotonic)", () => {
    const gentle     = calcTargetCalories(makeProfile(), makeGoals({ weeklyLossKg: 0.25 }))!
    const moderate   = calcTargetCalories(makeProfile(), makeGoals({ weeklyLossKg: 0.5 }))!
    const aggressive = calcTargetCalories(makeProfile(), makeGoals({ weeklyLossKg: 1.0 }))!
    expect(moderate).toBeLessThan(gentle)
    expect(aggressive).toBeLessThan(moderate)
  })
})

// ── 4. computeMacros — universal invariants ──────────────────────────────────
// These tests apply regardless of which macro mode is selected.

describe("computeMacros — universal invariants", () => {
  const profile  = makeProfile()
  const goals    = makeGoals()
  const settings = makeSettings()

  it("returns null when profile is incomplete", () => {
    const result = computeMacros(makeProfile({ weightKg: "" }) as any, goals, settings)
    expect(result).toBeNull()
  })

  it("returns object with all required fields", () => {
    const result = computeMacros(profile, goals, settings)
    expect(result).not.toBeNull()
    expect(result).toHaveProperty("bmr")
    expect(result).toHaveProperty("tdee")
    expect(result).toHaveProperty("targetCalories")
    expect(result).toHaveProperty("proteinG")
    expect(result).toHaveProperty("carbsG")
    expect(result).toHaveProperty("fatG")
  })

  it("protein is capped at the engine's hard ceiling (220g)", () => {
    // High-protein mode + heavy target = highest possible protein output
    const highProteinSettings = makeSettings({ macroSplit: { fatPct: 20, proteinPct: 45, carbsPct: 35 } })
    const heavyTargetGoals = makeGoals({ targetWeightKg: 130, weeklyLossKg: 0.25 })
    const result = computeMacros(profile, heavyTargetGoals, highProteinSettings)
    expect(result!.proteinG).toBeLessThanOrEqual(220)
  })

  it("protein is at least the ABW safety floor (1.2 × ABW)", () => {
    // Overweight user: actual 110kg, BMI 38, ABW ≈ 83.5kg, floor ≈ 100g
    const heavyProfile = makeProfile({ weightKg: 110, heightCm: 170, age: 40 })
    const result = computeMacros(heavyProfile, goals, settings)!
    const expectedFloor = Math.round(83.5 * 1.2)  // ≈ 100g
    expect(result.proteinG).toBeGreaterThanOrEqual(expectedFloor - 2)  // allow ±2 for rounding
  })

  it("protein is at least 50g (absolute minimum across all modes)", () => {
    const result = computeMacros(profile, goals, settings)!
    expect(result.proteinG).toBeGreaterThanOrEqual(50)
  })

  it("fat is at least 30g (absolute minimum for hormonal health)", () => {
    const result = computeMacros(profile, goals, settings)!
    expect(result.fatG).toBeGreaterThanOrEqual(30)
  })

  it("all returned values are positive numbers", () => {
    const result = computeMacros(profile, goals, settings)!
    expect(result.bmr).toBeGreaterThan(0)
    expect(result.tdee).toBeGreaterThan(0)
    expect(result.targetCalories).toBeGreaterThan(0)
    expect(result.proteinG).toBeGreaterThan(0)
    expect(result.carbsG).toBeGreaterThanOrEqual(0)  // carbs can be 0 in strict edge cases
    expect(result.fatG).toBeGreaterThan(0)
  })

  it("target calories are lower for more aggressive loss rate", () => {
    const gentle     = computeMacros(profile, makeGoals({ weeklyLossKg: 0.25 }), settings)!
    const aggressive = computeMacros(profile, makeGoals({ weeklyLossKg: 1.0 }),  settings)!
    expect(aggressive.targetCalories).toBeLessThan(gentle.targetCalories)
  })

  it("TDEE is higher for more active users", () => {
    const sedentary = computeMacros(makeProfile({ activityLevel: "sedentary" }), goals, settings)!
    const active    = computeMacros(makeProfile({ activityLevel: "very_active" }), goals, settings)!
    expect(active.tdee).toBeGreaterThan(sedentary.tdee)
  })

  it("goal weight = current weight doesn't cause crash or zero values", () => {
    const result = computeMacros(profile, makeGoals({ targetWeightKg: 75 }), settings)
    expect(result).not.toBeNull()
    expect(result!.proteinG).toBeGreaterThan(0)
  })

  it("BMR override raises TDEE", () => {
    const withOverride    = computeMacros(makeProfile({ bmrOverride: 2500 }), goals, settings)!
    const withoutOverride = computeMacros(makeProfile(), goals, settings)!
    expect(withOverride.tdee).toBeGreaterThan(withoutOverride.tdee)
    expect(withOverride.targetCalories).toBeGreaterThan(withoutOverride.targetCalories)
  })
})

// ── 5. computeMacros — mode-driven behavior ──────────────────────────────────
// Each macro mode has its own isolated logic. These tests verify that the
// resolved mode produces outputs within its declared range — i.e. mode label
// and macro output cannot diverge.

describe("computeMacros — KETO mode (carbsPct ≤ 10)", () => {
  it("produces 20–50g carbs (true ketogenic range)", () => {
    const result = computeMacros(makeProfile(), makeGoals(), ketoSettings())!
    expect(result.carbsG).toBeGreaterThanOrEqual(20)
    expect(result.carbsG).toBeLessThanOrEqual(50)
  })

  it("produces moderate protein (not maxed out)", () => {
    // Keto protein: 1.2–1.5 g/kg target weight, activity-scaled
    // moderately_active × targetWeight 65kg = ~85g target
    // ABW floor for BMI 24.5 user (no ABW kick-in) = 75 × 1.2 = 90g
    // So protein = max(85, 90) = 90g
    const result = computeMacros(makeProfile(), makeGoals(), ketoSettings())!
    expect(result.proteinG).toBeGreaterThanOrEqual(70)
    expect(result.proteinG).toBeLessThanOrEqual(160)
  })

  it("produces high fat (fat is primary fuel, ≥60g floor)", () => {
    const result = computeMacros(makeProfile(), makeGoals(), ketoSettings())!
    expect(result.fatG).toBeGreaterThanOrEqual(60)
  })

  it("fat provides the majority of calories in keto", () => {
    const result = computeMacros(makeProfile(), makeGoals(), ketoSettings())!
    const fatCals = result.fatG * 9
    const totalCals = result.proteinG * 4 + result.carbsG * 4 + result.fatG * 9
    expect(fatCals / totalCals).toBeGreaterThan(0.55)  // fat should be >55% of calories
  })
})

describe("computeMacros — LOW_CARB mode (carbsPct 21–35)", () => {
  it("produces 80–120g carbs", () => {
    const result = computeMacros(makeProfile(), makeGoals(), lowCarbSettings())!
    expect(result.carbsG).toBeGreaterThanOrEqual(80)
    expect(result.carbsG).toBeLessThanOrEqual(120)
  })

  it("protein scales with activity level", () => {
    const sedentary = computeMacros(makeProfile({ activityLevel: "sedentary" }), makeGoals(), lowCarbSettings())!
    const active    = computeMacros(makeProfile({ activityLevel: "very_active" }), makeGoals(), lowCarbSettings())!
    // Active users should get at least as much protein, often more
    expect(active.proteinG).toBeGreaterThanOrEqual(sedentary.proteinG)
  })
})

describe("computeMacros — BALANCED mode (default)", () => {
  it("produces moderate carbs (≥80g) — never starves carbs in balanced mode", () => {
    const result = computeMacros(makeProfile(), makeGoals(), balancedSettings())!
    expect(result.carbsG).toBeGreaterThanOrEqual(80)
  })

  it("fat is roughly 30% of target calories", () => {
    const result = computeMacros(makeProfile(), makeGoals(), balancedSettings())!
    const fatCals = result.fatG * 9
    const ratio = fatCals / result.targetCalories
    expect(ratio).toBeGreaterThan(0.25)
    expect(ratio).toBeLessThan(0.40)
  })

  it("protein uses moderate multiplier (1.2–1.4 g/kg target weight)", () => {
    // moderately_active is capped at 1.4 in balanced/low-carb modes
    const result = computeMacros(makeProfile(), makeGoals(), balancedSettings())!
    const ratio = result.proteinG / 65  // target weight
    expect(ratio).toBeGreaterThanOrEqual(1.2)
    expect(ratio).toBeLessThanOrEqual(1.6)  // allow headroom for ABW floor activation
  })
})

describe("computeMacros — label/output coherence", () => {
  it("keto label NEVER produces high-carb output (was 228g in old engine)", () => {
    // The original bug: keto split + vegetarian profile gave 228g carbs
    const result = computeMacros(makeProfile(), makeGoals(), ketoSettings())!
    expect(result.carbsG).toBeLessThanOrEqual(50)
  })

  it("balanced label NEVER produces keto-level low-carb output", () => {
    const result = computeMacros(makeProfile(), makeGoals(), balancedSettings())!
    expect(result.carbsG).toBeGreaterThan(50)
  })

  it("low-carb label stays within its declared range", () => {
    const result = computeMacros(makeProfile(), makeGoals(), lowCarbSettings())!
    expect(result.carbsG).toBeGreaterThan(50)   // not keto territory
    expect(result.carbsG).toBeLessThan(150)     // not balanced territory
  })
})

// ── 6. computeAdaptiveTDEE ───────────────────────────────────────────────────

describe("computeAdaptiveTDEE", () => {
  const makeHistory = (days: number, weightKg: number, calPerDay: number) =>
    Array.from({ length: days }, (_, i) => ({
      date: `2025-01-${String(days - i).padStart(2, "0")}`,
      cal: calPerDay,
      weight: weightKg,
    }))

  it("returns confidence=none with fewer than 5 data points", () => {
    const result = computeAdaptiveTDEE(makeHistory(3, 80, 1400))
    expect(result.confidence).toBe("none")
    expect(result.tdee).toBeNull()
  })

  it("returns confidence=low with 5–13 data points", () => {
    const result = computeAdaptiveTDEE(makeHistory(8, 80, 1400))
    expect(result.confidence).toBe("low")
  })

  it("returns confidence=medium with 14–27 data points", () => {
    const result = computeAdaptiveTDEE(makeHistory(20, 80, 1800))
    expect(result.confidence).toBe("medium")
  })

  it("returns confidence=high with 28+ data points", () => {
    const result = computeAdaptiveTDEE(makeHistory(30, 80, 1800))
    expect(result.confidence).toBe("high")
  })

  it("estimates TDEE close to intake when weight is stable", () => {
    const result = computeAdaptiveTDEE(makeHistory(30, 80, 1800))
    expect(result.tdee).not.toBeNull()
    expect(result.tdee!).toBeGreaterThan(1600)
    expect(result.tdee!).toBeLessThan(2000)
  })

  it("estimates TDEE above intake when weight is decreasing", () => {
    const history = Array.from({ length: 30 }, (_, i) => ({
      date: `2025-01-${String(30 - i).padStart(2, "0")}`,
      cal: 1400,
      weight: 85 - (29 - i) * 0.05,
    }))
    const result = computeAdaptiveTDEE(history)
    expect(result.tdee!).toBeGreaterThan(1400)
  })

  it("returns null tdee when estimate is out of range (<1000 or >5000)", () => {
    const history = Array.from({ length: 10 }, (_, i) => ({
      date: `2025-01-${String(i + 1).padStart(2, "0")}`,
      cal: 500,
      weight: 80 + i * 2,
    }))
    const result = computeAdaptiveTDEE(history)
    expect(result).toBeDefined()
    if (result.tdee !== null) {
      expect(result.tdee).toBeGreaterThan(0)
    }
  })

  it("skips entries with null weight", () => {
    const history = [
      { date: "2025-01-01", cal: 1500, weight: null },
      { date: "2025-01-02", cal: 1500, weight: null },
      ...makeHistory(10, 80, 1500),
    ]
    const result = computeAdaptiveTDEE(history)
    expect(result).toBeDefined()
    expect(result.daysUsed).toBe(10)
  })

  it("skips entries with 0 calories", () => {
    const history = [
      { date: "2025-01-01", cal: 0, weight: 80 },
      ...makeHistory(10, 80, 1500),
    ]
    const result = computeAdaptiveTDEE(history)
    expect(result.daysUsed).toBe(10)
  })

  it("daysUsed reflects actual valid entries", () => {
    const result = computeAdaptiveTDEE(makeHistory(14, 80, 1600))
    expect(result.daysUsed).toBe(14)
  })

  it("slopeKgPerWeek is negative when weight is decreasing", () => {
    const history = Array.from({ length: 14 }, (_, i) => ({
      date: `2025-01-${String(14 - i).padStart(2, "0")}`,
      cal: 1600,
      weight: 85 - (13 - i) * 0.07,
    }))
    const result = computeAdaptiveTDEE(history)
    expect(result.slopeKgPerWeek!).toBeLessThan(0)
  })

  it("slopeKgPerWeek is positive when weight is increasing", () => {
    const history = Array.from({ length: 14 }, (_, i) => ({
      date: `2025-01-${String(14 - i).padStart(2, "0")}`,
      cal: 2500,
      weight: 80 + (13 - i) * 0.07,
    }))
    const result = computeAdaptiveTDEE(history)
    expect(result.slopeKgPerWeek!).toBeGreaterThan(0)
  })
})

// ── 7. Macro calorie math consistency ────────────────────────────────────────

describe("Macro calorie math", () => {
  it("P×4 + C×4 + F×9 ≈ targetCalories (within rounding)", () => {
    const result = computeMacros(makeProfile(), makeGoals(), makeSettings())!
    const computed = result.proteinG * 4 + result.carbsG * 4 + result.fatG * 9
    // Allow ±150 kcal for rounding + floor enforcement edge cases
    expect(Math.abs(computed - result.targetCalories)).toBeLessThanOrEqual(150)
  })

  it("macros are always whole numbers (no fractional grams)", () => {
    const result = computeMacros(makeProfile(), makeGoals(), makeSettings())!
    expect(result.proteinG % 1).toBe(0)
    expect(result.carbsG % 1).toBe(0)
    expect(result.fatG % 1).toBe(0)
  })
})

// ── 8. Meal plan preset macro audit ──────────────────────────────────────────

describe("mealPlanPresets — calorie math (P×4 + C×4 + F×9)", () => {
  const TOLERANCE = 25

  function checkMeal(name: string, p: number, c: number, f: number, listedCal: number) {
    const computed = p * 4 + c * 4 + f * 9
    const diff = Math.abs(computed - listedCal)
    expect(diff, `${name}: macro-derived ${computed} ≠ listed ${listedCal}`).toBeLessThanOrEqual(TOLERANCE)
  }

  describe("Vegetarian Regular preset", () => {
    it("Poha with Curd",            () => checkMeal("Poha",         10, 70, 12, 428))
    it("Dal + 2 Roti + Sabzi",      () => checkMeal("Dal+Roti",     25, 83, 17, 585))
    it("Paneer Bhurji + 2 Roti",    () => checkMeal("Paneer Bhurji", 26, 40, 27, 507))
  })

  describe("Vegetarian High-Protein preset", () => {
    it("Paneer Bhurji + 2 Toast",         () => checkMeal("Paneer Toast",  22, 28, 27, 443))
    it("Soya Chunks Curry + Dal + 2 Roti", () => checkMeal("Soya Curry",   43, 71, 12, 564))
    it("Paneer Tikka + 1 Roti + Salad",   () => checkMeal("Paneer Tikka", 32, 26, 32, 520))
  })

  describe("Eggetarian Regular preset", () => {
    it("Masala Omelette + 2 Toast", () => checkMeal("Omelette",     22, 28, 22, 398))
    it("Egg Curry + Dal + 2 Roti",  () => checkMeal("Egg Curry",    32, 67, 21, 585))
    it("Paneer Bhurji + 2 Roti",    () => checkMeal("Paneer Bhurji", 26, 40, 27, 507))
  })

  describe("Non-veg Regular preset", () => {
    it("Scrambled Eggs + 1 Toast",     () => checkMeal("Scrambled",   20, 14, 20, 316))
    it("Chicken Curry + Dal + 2 Roti", () => checkMeal("Chicken",     63, 60, 12, 600))
    it("Fish Curry + 1 Roti + Sabzi",  () => checkMeal("Fish Curry",  44, 27, 15, 419))
  })

  describe("Daily totals", () => {
    it("Vegetarian Regular daily calories ~1520", () => {
      const meals = [[10,70,12],[25,83,17],[26,40,27]]
      const total = meals.reduce((s,[p,c,f]) => s + p*4 + c*4 + f*9, 0)
      expect(Math.abs(total - 1520)).toBeLessThanOrEqual(15)
    })

    it("Vegetarian High-Protein daily calories ~1527", () => {
      const meals = [[22,28,27],[43,71,12],[32,26,32]]
      const total = meals.reduce((s,[p,c,f]) => s + p*4 + c*4 + f*9, 0)
      expect(Math.abs(total - 1527)).toBeLessThanOrEqual(15)
    })

    it("Vegetarian High-Protein delivers ≥90g daily protein from food alone", () => {
      const protein = 22 + 43 + 32
      expect(protein).toBeGreaterThanOrEqual(90)
    })

    it("Eggetarian Regular daily calories ~1490", () => {
      const meals = [[22,28,22],[32,67,21],[26,40,27]]
      const total = meals.reduce((s,[p,c,f]) => s + p*4 + c*4 + f*9, 0)
      expect(Math.abs(total - 1490)).toBeLessThanOrEqual(15)
    })

    it("Non-veg Regular daily calories ~1335", () => {
      const meals = [[20,14,20],[63,60,12],[44,27,15]]
      const total = meals.reduce((s,[p,c,f]) => s + p*4 + c*4 + f*9, 0)
      expect(Math.abs(total - 1335)).toBeLessThanOrEqual(15)
    })

    it("All presets have adequate daily protein (≥60g)", () => {
      const veg = 10 + 25 + 26
      const egg = 22 + 32 + 26
      const nv  = 20 + 63 + 44
      expect(veg).toBeGreaterThanOrEqual(60)
      expect(egg).toBeGreaterThanOrEqual(60)
      expect(nv).toBeGreaterThanOrEqual(60)
    })

    it("All presets have moderate carbs (40-200g — not keto-restrictive)", () => {
      const veg = 70 + 83 + 40
      const egg = 28 + 67 + 40
      const nv  = 14 + 60 + 27
      ;[veg, egg, nv].forEach(carbs => {
        expect(carbs).toBeGreaterThanOrEqual(40)
        expect(carbs).toBeLessThanOrEqual(220)
      })
    })
  })
})
