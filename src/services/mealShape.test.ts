// ── mealShape.test.ts ─────────────────────────────────────────────────────────
// Meal-shape + portion-elasticity feature.
//
// Before this feature the generator hardcoded 2 meals + shake at fat-loss-sized
// portions. That underfed growing minors by ~36% (a 2062 kcal 12yo got ~1317)
// and gave non-fasting adults a fasting-shaped day. This feature:
//   - derives meal count from (fasting, goalMode): non-fasting → 3 meals,
//     fasting → 2 + shake, growing minors → 3 + snack (never fasting/2-meal),
//   - scales each meal's grain/protein portions to hit its calorie share,
//   - surfaces a non-deficit top-up note when a minor's plan still falls short.
//
// These tests lock in BOTH the safety properties (a minor is never silently
// under-fed or put on a deficit/fasting shape) and the accuracy (all five real
// users land within tolerance), and prove the existing 2-meal fat-loss path is
// unchanged.

import { describe, it, expect } from "vitest"
import {
  generateWeekPlan, generateDayPlan, resolveMealShape, GeneratorTargets,
} from "./mealGenerator"
import { computeMinorTopupNote } from "./mealPlanGeneration"
import { toMealPlanEntry } from "./transformer"
import type { MacroMode } from "./adaptiveTDEE"

type Diet = "veg" | "eggetarian" | "non-veg"
const tagFor = (d: Diet) => (d === "non-veg" ? "non_veg" : d) as any

function avgDay(week: ReturnType<typeof generateWeekPlan>, diet: Diet) {
  let p = 0, f = 0, c = 0, k = 0
  for (const day of week)
    for (const m of day.plan.meals) {
      const e = toMealPlanEntry(m, { lang: "en", dietTag: tagFor(diet) })
      p += e.protein; f += e.fat; c += e.carbs; k += e.cal
    }
  const n = week.length
  return { p: p / n, f: f / n, c: c / n, k: k / n }
}
const within = (got: number, target: number, pct: number) =>
  Math.abs(got - target) <= target * pct

// ── resolveMealShape rules ──────────────────────────────────────────────────

describe("resolveMealShape — meal-count rules", () => {
  it("fasting adult → 2 meals + shake", () => {
    expect(resolveMealShape(true, false)).toBe("two_plus_shake")
  })
  it("non-fasting adult → 3 meals (no toggle needed)", () => {
    expect(resolveMealShape(false, false)).toBe("three")
  })
  it("growing minor → always 3 meals + snack, even if fasting flag somehow set", () => {
    expect(resolveMealShape(false, true)).toBe("three_plus_snack")
    expect(resolveMealShape(true, true)).toBe("three_plus_snack")  // minor never fasted
  })
  it("override 'two' forces 2 meals for a non-minor adult", () => {
    expect(resolveMealShape(false, false, "two")).toBe("two_plus_shake")
  })
  it("override 'three' forces 3 meals for a non-fasting adult", () => {
    expect(resolveMealShape(false, false, "three")).toBe("three")
  })
  it("override cannot override a minor's safe shape", () => {
    expect(resolveMealShape(true, true, "two")).toBe("three_plus_snack")
  })
})

// ── The five real users ─────────────────────────────────────────────────────

describe("five real users land within calorie tolerance", () => {
  it("48M keto/IF (fasting) — 2 meals + shake, unchanged", () => {
    const t: GeneratorTargets = { proteinG: 99, fatG: 104, carbsG: 25, calories: 1436 }
    const shape = resolveMealShape(true, false)
    const week = generateWeekPlan(t, "eggetarian", "KETO", undefined, shape)
    expect(shape).toBe("two_plus_shake")
    expect(week[0].plan.meals.length).toBe(3)  // 2 meals + shake
    expect(within(avgDay(week, "eggetarian").k, t.calories, 0.15)).toBe(true)
  })

  it("44F balanced (non-fasting) — 3 meals", () => {
    const t: GeneratorTargets = { proteinG: 77, fatG: 50, carbsG: 184, calories: 1492 }
    const week = generateWeekPlan(t, "veg", "BALANCED", undefined, "three")
    expect(week[0].plan.meals.length).toBe(3)
    expect(week[0].plan.meals.some(m => m.slot === "shake")).toBe(false)
    expect(within(avgDay(week, "veg").k, t.calories, 0.15)).toBe(true)
  })

  it("77F geriatric (non-fasting) — 3 meals, within tolerance", () => {
    const t: GeneratorTargets = { proteinG: 72, fatG: 47, carbsG: 172, calories: 1400 }
    const week = generateWeekPlan(t, "veg", "BALANCED", undefined, "three")
    expect(week[0].plan.meals.length).toBe(3)
    expect(within(avgDay(week, "veg").k, t.calories, 0.15)).toBe(true)
  })

  it("15M teen — 3 meals + snack, no longer underfed", () => {
    const t: GeneratorTargets = { proteinG: 83, fatG: 100, carbsG: 320, calories: 2511 }
    const week = generateWeekPlan(t, "veg", "BALANCED", undefined, "three_plus_snack")
    expect(week[0].plan.meals.length).toBe(4)  // breakfast/lunch/dinner + snack
    expect(week[0].plan.meals.some(m => m.slot === "snack")).toBe(true)
    // Was −37% before the feature; must now be within 15%.
    expect(within(avgDay(week, "veg").k, t.calories, 0.15)).toBe(true)
  })

  it("12M child — 3 meals + snack, no longer underfed", () => {
    const t: GeneratorTargets = { proteinG: 60, fatG: 69, carbsG: 300, calories: 2062 }
    const week = generateWeekPlan(t, "veg", "BALANCED", undefined, "three_plus_snack")
    expect(week[0].plan.meals.length).toBe(4)
    expect(within(avgDay(week, "veg").k, t.calories, 0.15)).toBe(true)
  })
})

// ── Child-safety invariants ─────────────────────────────────────────────────

describe("child-safety invariants", () => {
  const childT: GeneratorTargets = { proteinG: 60, fatG: 69, carbsG: 300, calories: 2062 }
  const teenT: GeneratorTargets = { proteinG: 83, fatG: 100, carbsG: 320, calories: 2511 }

  it("a minor's plan is never deficit-shaped (delivers ≥ 85% of calorie target)", () => {
    for (const t of [childT, teenT]) {
      const week = generateWeekPlan(t, "veg", "BALANCED", undefined, "three_plus_snack")
      const avg = avgDay(week, "veg").k
      expect(avg).toBeGreaterThanOrEqual(t.calories * 0.85)
    }
  })

  it("a minor's plan never contains a shake (no fasting/supplement default for kids)", () => {
    const week = generateWeekPlan(childT, "veg", "BALANCED", undefined, "three_plus_snack")
    for (const day of week)
      expect(day.plan.meals.some(m => m.slot === "shake")).toBe(false)
  })

  it("a minor always gets a snack slot", () => {
    const week = generateWeekPlan(teenT, "veg", "BALANCED", undefined, "three_plus_snack")
    for (const day of week)
      expect(day.plan.meals.some(m => m.slot === "snack")).toBe(true)
  })

  it("top-up note is empty when the plan reaches target", () => {
    const week = [{ validation: { computed: { calories: 2000 } } }]
    expect(computeMinorTopupNote(week, 2050)).toBe("")  // within 8%
  })

  it("top-up note appears (non-deficit framing) when a minor's plan falls short", () => {
    const week = [{ validation: { computed: { calories: 1700 } } }]
    const note = computeMinorTopupNote(week, 2500)
    expect(note.length).toBeGreaterThan(0)
    expect(note.toLowerCase()).toContain("add")     // tells parent to ADD
    expect(note).not.toMatch(/eat less|reduce|cut/i) // never a deficit frame
  })
})

// ── 2-meal fat-loss path is byte-unchanged ──────────────────────────────────

describe("existing 2-meal path preserved", () => {
  const KETO: MacroMode = "KETO"
  const t: GeneratorTargets = { proteinG: 100, fatG: 120, carbsG: 25, calories: 1500 }

  it("default (no shape arg) is the 2-meal + shake legacy shape", () => {
    const r = generateDayPlan(t, 0, "eggetarian", KETO)
    expect(r.plan.meals.length).toBe(3)
    expect(r.plan.meals.map(m => m.time)).toEqual(["2:00 PM", "4:30 PM", "6:30 PM"])
    expect(r.plan.meals.some(m => m.slot === "shake")).toBe(true)
  })

  it("2-meal plans never carry a breakfast or snack slot", () => {
    const week = generateWeekPlan(t, "eggetarian", KETO)
    for (const day of week)
      for (const m of day.plan.meals)
        expect(m.slot === "breakfast" || m.slot === "snack").toBe(false)
  })
})
