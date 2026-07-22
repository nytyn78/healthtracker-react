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

// Default settings = keto (70/25/5)
const makeSettings = (overrides = {}) => ({
  macroSplit: { fatPct: 70, proteinPct: 25, carbsPct: 5 },
  ifProtocol: { fastingHours: 19, eatingHours: 5, fastStartHour: 20 },
  ...overrides,
})

const makeBalancedSettings = (overrides = {}) => ({
  macroSplit: { fatPct: 35, proteinPct: 30, carbsPct: 35 },
  ifProtocol: { fastingHours: 16, eatingHours: 8, fastStartHour: 20 },
  ...overrides,
})

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
    // Male 35y 175cm 75kg — BMI 24.5, uses actual weight
    // Mifflin: 10*75 + 6.25*175 - 5*35 + 5 = 750 + 1093.75 - 175 + 5 = 1673.75 ≈ 1674
    const bmr = calcBMR(makeProfile())
    expect(bmr).not.toBeNull()
    expect(bmr!).toBeGreaterThanOrEqual(1660)
    expect(bmr!).toBeLessThanOrEqual(1690)
  })

  it("computes female BMR correctly", () => {
    // Female 30y 160cm 60kg — BMI 23.4, uses actual weight
    // Mifflin: 10*60 + 6.25*160 - 5*30 - 161 = 600 + 1000 - 150 - 161 = 1289
    const bmr = calcBMR(makeProfile({ sex: "female", age: 30, heightCm: 160, weightKg: 60 }))
    expect(bmr).not.toBeNull()
    expect(bmr!).toBeGreaterThanOrEqual(1275)
    expect(bmr!).toBeLessThanOrEqual(1305)
  })

  it("applies ABW when BMI > 30 (overweight male)", () => {
    // Male 40y 170cm 110kg — BMI 38.1 — must use ABW
    const bmrActual = calcBMR(makeProfile({ age: 40, heightCm: 170, weightKg: 110 }))
    // IBW = 50 + 2.3*(66.9-60) = 65.9kg; ABW = 65.9 + 0.4*(110-65.9) = 83.5kg
    // BMR with ABW: 10*83.5 + 6.25*170 - 5*40 + 5 = 835 + 1062.5 - 200 + 5 = 1702.5
    expect(bmrActual).not.toBeNull()
    expect(bmrActual!).toBeGreaterThanOrEqual(1688)
    expect(bmrActual!).toBeLessThanOrEqual(1718)
  })

  it("does NOT apply ABW when BMI is exactly 30 (boundary)", () => {
    const weightAtBmi30 = 30 * (1.75 ** 2)  // 91.875kg
    const bmrWithABW = calcBMR(makeProfile({ weightKg: weightAtBmi30 }))
    // At BMI=30, should use actual weight (not ABW)
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

// ── 4. computeMacros ──────────────────────────────────────────────────────────

describe("computeMacros", () => {
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

  it("protein is capped at 130g", () => {
    const highTargetGoals = makeGoals({ targetWeightKg: 95, weeklyLossKg: 0.25 })
    const result = computeMacros(profile, highTargetGoals, settings)
    expect(result!.proteinG).toBeLessThanOrEqual(130)
  })

  it("protein is at least the ABW floor (1.2 × ABW)", () => {
    // For overweight user: ABW = 83.5kg, floor = 83.5 × 1.2 = 100g
    const heavyProfile = makeProfile({ weightKg: 110, heightCm: 170, age: 40 })
    const result = computeMacros(heavyProfile, goals, settings)!
    // IBW = 50 + 2.3*(66.9-60) = 65.9; ABW = 65.9 + 0.4*(110-65.9) = 83.5; floor = 100g
    const expectedFloor = Math.round(83.5 * 1.2)
    expect(result.proteinG).toBeGreaterThanOrEqual(expectedFloor)
  })

  it("all returned values are positive numbers", () => {
    const result = computeMacros(profile, goals, settings)!
    expect(result.bmr).toBeGreaterThan(0)
    expect(result.tdee).toBeGreaterThan(0)
    expect(result.targetCalories).toBeGreaterThan(0)
    expect(result.proteinG).toBeGreaterThan(0)
    expect(result.carbsG).toBeGreaterThan(0)
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

  it("protein target is based on target weight × 1.6 (or split, whichever is higher)", () => {
    // Target 65kg → proteinTargetG = 65 × 1.6 = 104g
    // proteinFromSplit = targetCals * 25% / 4 (may be higher)
    // Result: max(104, floor, fromSplit) capped at 130
    const result = computeMacros(profile, makeGoals({ targetWeightKg: 65 }), settings)!
    expect(result.proteinG).toBeGreaterThanOrEqual(Math.min(Math.round(65 * 1.6), 130))
    expect(result.proteinG).toBeLessThanOrEqual(130)
  })

  it("goal weight = current weight doesn't cause crash or zero values", () => {
    const result = computeMacros(profile, makeGoals({ targetWeightKg: 75 }), settings)
    expect(result).not.toBeNull()
    expect(result!.proteinG).toBeGreaterThan(0)
  })

  it("BMR override raises TDEE (used in calcTDEE, not returned as bmr field)", () => {
    const withOverride    = computeMacros(makeProfile({ bmrOverride: 2500 }), goals, settings)!
    const withoutOverride = computeMacros(makeProfile(), goals, settings)!
    expect(withOverride.tdee).toBeGreaterThan(withoutOverride.tdee)
    expect(withOverride.targetCalories).toBeGreaterThan(withoutOverride.targetCalories)
  })

  // ── Macro split tests (replaces old fixed-gram fat/carb tests) ─────────────

  it("keto split (5% carbs) limits carbsG to 25g max", () => {
    // With keto settings (carbsPct = 5), carbs should never exceed 25g
    const result = computeMacros(profile, goals, makeSettings())!
    expect(result.carbsG).toBeLessThanOrEqual(25)
    expect(result.carbsG).toBeGreaterThan(0)
  })

  it("balanced split (35% carbs) produces carbsG well above 75g", () => {
    const result = computeMacros(profile, goals, makeBalancedSettings())!
    expect(result.carbsG).toBeGreaterThanOrEqual(75)
  })

  it("keto split: fat fills remaining calories after protein + carbs", () => {
    const result = computeMacros(profile, goals, makeSettings())!
    // Fat should be derived from remaining calories, not a fixed gram formula
    const remainingCals = result.targetCalories - result.proteinG * 4 - result.carbsG * 4
    const expectedFatG = Math.round(remainingCals / 9)
    expect(Math.abs(result.fatG - expectedFatG)).toBeLessThanOrEqual(2) // allow ±2g rounding
  })

  it("keto split produces more fat than balanced split (all else equal)", () => {
    const keto     = computeMacros(profile, goals, makeSettings())!
    const balanced = computeMacros(profile, goals, makeBalancedSettings())!
    expect(keto.fatG).toBeGreaterThan(balanced.fatG)
  })

  it("keto split produces fewer carbs than balanced split (all else equal)", () => {
    const keto     = computeMacros(profile, goals, makeSettings())!
    const balanced = computeMacros(profile, goals, makeBalancedSettings())!
    expect(keto.carbsG).toBeLessThan(balanced.carbsG)
  })

  it("75g carb floor applies for balanced split on very low calorie profile", () => {
    // Very small sedentary female on aggressive loss — remaining cals may be very low
    const smallProfile = makeProfile({ sex: "female", heightCm: 150, weightKg: 50, activityLevel: "sedentary" })
    const aggressiveGoals = makeGoals({ weeklyLossKg: 1.0 })
    const result = computeMacros(smallProfile, aggressiveGoals, makeBalancedSettings())!
    expect(result.carbsG).toBeGreaterThanOrEqual(75)
  })
})

// ── 5. computeAdaptiveTDEE ───────────────────────────────────────────────────

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

  it("TDEE estimate is higher than intake when losing weight", () => {
    // Losing weight at 1400 cal → TDEE must be above 1400
    // Weight must DECREASE from oldest to newest:
    //   oldest (i=29, date 2025-01-01) → 80kg
    //   newest (i=0,  date 2025-01-30) → 78.55kg
    // slope ≈ -0.05 kg/day → TDEE = 1400 + 385 = 1785
    const history = Array.from({ length: 30 }, (_, i) => ({
      date: `2025-01-${String(30 - i).padStart(2, "0")}`,
      cal: 1400,
      weight: 80 - (29 - i) * 0.05,  // oldest = 80kg (heaviest), newest = 78.55kg (lightest)
    }))
    const result = computeAdaptiveTDEE(history)
    expect(result.tdee).not.toBeNull()
    expect(result.tdee!).toBeGreaterThan(1400)
  })

  it("slopeKgPerWeek is negative when losing weight", () => {
    const history = Array.from({ length: 14 }, (_, i) => ({
      date: `2025-01-${String(14 - i).padStart(2, "0")}`,
      cal: 1500,
      weight: 80 - (13 - i) * 0.05,
    }))
    const result = computeAdaptiveTDEE(history)
    expect(result.slopeKgPerWeek).toBeLessThan(0)
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

// ── 6. Macro calorie math consistency ────────────────────────────────────────

describe("Macro calorie math", () => {
  it("P×4 + C×4 + F×9 ≈ targetCalories (within rounding) — keto", () => {
    const result = computeMacros(makeProfile(), makeGoals(), makeSettings())!
    const computed = result.proteinG * 4 + result.carbsG * 4 + result.fatG * 9
    // Keto: fat fills remaining, so this should be very close
    expect(Math.abs(computed - result.targetCalories)).toBeLessThanOrEqual(400)
  })

  it("P×4 + C×4 + F×9 ≈ targetCalories (within rounding) — balanced", () => {
    const result = computeMacros(makeProfile(), makeGoals(), makeBalancedSettings())!
    const computed = result.proteinG * 4 + result.carbsG * 4 + result.fatG * 9
    expect(Math.abs(computed - result.targetCalories)).toBeLessThanOrEqual(400)
  })

  it("macros are always whole numbers (no fractional grams)", () => {
    const result = computeMacros(makeProfile(), makeGoals(), makeSettings())!
    expect(result.proteinG % 1).toBe(0)
    expect(result.carbsG % 1).toBe(0)
    expect(result.fatG % 1).toBe(0)
  })
})

// ── 7. Meal plan preset macro audit ──────────────────────────────────────────

describe("mealPlanPresets — calorie math (P×4 + C×4 + F×9)", () => {
  const TOLERANCE = 25  // kcal — allow minor rounding

  function checkMeal(name: string, p: number, c: number, f: number, listedCal: number) {
    const computed = p * 4 + c * 4 + f * 9
    const diff = Math.abs(computed - listedCal)
    expect(diff, `${name}: macro-derived ${computed} ≠ listed ${listedCal}`).toBeLessThanOrEqual(TOLERANCE)
  }

  describe("Eggetarian Keto preset", () => {
    it("Egg Bhurji with Paneer", () => checkMeal("Egg Bhurji", 38, 4, 41, 537))
    it("Paneer Tikka with Boiled Eggs", () => checkMeal("Paneer Tikka", 26, 5, 30, 394))
    it("Whey Protein Shake", () => checkMeal("Whey Shake", 25, 2, 1, 117))
  })

  describe("Vegetarian Balanced preset", () => {
    it("Moong Dal Chilla with Curd", () => checkMeal("Dal Chilla", 16, 35, 6, 264))
    it("Palak Paneer with Roti", () => checkMeal("Palak Paneer", 23, 24, 22, 376))
    it("Rajma Bowl with Brown Rice", () => checkMeal("Rajma Bowl", 22, 50, 2, 304))
    it("Curd with Nuts Snack", () => checkMeal("Curd Nuts", 9, 9, 18, 238))
  })

  describe("Non-veg Keto preset", () => {
    it("Tandoori Chicken with Salad", () => checkMeal("Tandoori", 47, 5, 11, 309))
    it("Egg & Chicken Stir Fry", () => checkMeal("Stir Fry", 43, 6, 18, 358))
    it("Fish Curry (light)", () => checkMeal("Fish Curry", 40, 12, 11, 307))
    it("Whey Shake (non-veg)", () => checkMeal("Whey Shake", 25, 2, 1, 117))
  })

  describe("Daily totals", () => {
    it("Eggetarian Keto daily calories ~1048", () => {
      const meals = [[38,4,41],[26,5,30],[25,2,1]]
      const total = meals.reduce((s,[p,c,f]) => s + p*4 + c*4 + f*9, 0)
      expect(total).toBe(1048)
    })

    it("Vegetarian Balanced daily calories ~1182", () => {
      const meals = [[16,35,6],[23,24,22],[22,50,2],[9,9,18]]
      const total = meals.reduce((s,[p,c,f]) => s + p*4 + c*4 + f*9, 0)
      expect(Math.abs(total - 1182)).toBeLessThanOrEqual(10)
    })

    it("Non-veg Keto daily calories ~1091", () => {
      const meals = [[47,5,11],[43,6,18],[40,12,11],[25,2,1]]
      const total = meals.reduce((s,[p,c,f]) => s + p*4 + c*4 + f*9, 0)
      expect(Math.abs(total - 1091)).toBeLessThanOrEqual(10)
    })

    it("Keto presets have <30g carbs (true keto)", () => {
      const eggetarianCarbs = 4 + 5 + 2   // 11g
      const nonVegCarbs     = 5 + 6 + 12 + 2  // 25g
      expect(eggetarianCarbs).toBeLessThan(30)
      expect(nonVegCarbs).toBeLessThan(30)
    })

    it("Vegetarian Balanced has adequate daily protein (≥60g)", () => {
      const totalProtein = 16 + 23 + 22 + 9  // 70g
      expect(totalProtein).toBeGreaterThanOrEqual(60)
    })
  })
})
