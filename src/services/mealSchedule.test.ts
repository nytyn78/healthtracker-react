// ── mealSchedule.test.ts ──────────────────────────────────────────────────────
// Commit 11.4 — Meal-count + IF decoupling.
// Tests for deriveMealSchedule + formatClock, and for the generator's
// schedule-awareness (IF window timing, optional shake, protein redistribution
// when the shake is dropped).
//
// Run: npm test

import { describe, it, expect } from "vitest"
import {
  deriveMealSchedule, formatClock, LEGACY_IF_SCHEDULE, type MealSchedule,
} from "./mealSchedule"
import { generateDayPlan, generateWeekPlan, GeneratorTargets } from "./mealGenerator"
import type { IFProtocol } from "../store/useHealthStore"
import type { MacroMode } from "./adaptiveTDEE"
import { computeMealMacros } from "./macroEngine"

// ── Fixtures ──────────────────────────────────────────────────────────────────

const IF_19_5: IFProtocol = {
  fastingHours: 19, eatingHours: 5, fastStartHour: 20, fastingEnabled: true,
}
const IF_16_8: IFProtocol = {
  fastingHours: 16, eatingHours: 8, fastStartHour: 20, fastingEnabled: true,
}
const NO_FAST: IFProtocol = {
  fastingHours: 16, eatingHours: 8, fastStartHour: 20, fastingEnabled: false,
}

const TARGETS: GeneratorTargets = {
  proteinG: 100, fatG: 120, carbsG: 25, calories: 1500,
}
const KETO: MacroMode = "KETO"

function minutesFromClock(time: string): number {
  const m = time.match(/(\d+)(?::(\d+))?\s*(AM|PM)?/i)!
  let h = parseInt(m[1], 10)
  const min = m[2] ? parseInt(m[2], 10) : 0
  const ampm = m[3]?.toUpperCase()
  if (ampm === "PM" && h < 12) h += 12
  if (ampm === "AM" && h === 12) h = 0
  return h * 60 + min
}

// ── formatClock ───────────────────────────────────────────────────────────────

describe("formatClock (11.4)", () => {
  it("formats whole hours", () => {
    expect(formatClock(14, 0)).toBe("2:00 PM")
    expect(formatClock(8, 0)).toBe("8:00 AM")
  })
  it("formats half hours", () => {
    expect(formatClock(16, 30)).toBe("4:30 PM")
  })
  it("handles midnight and noon", () => {
    expect(formatClock(0, 0)).toBe("12:00 AM")
    expect(formatClock(12, 0)).toBe("12:00 PM")
  })
  it("wraps hours past 24 back into range", () => {
    // (20 + 19) = 39 → 39 mod 24 = 15 → 3 PM
    expect(formatClock(39, 0)).toBe("3:00 PM")
  })
  it("pads single-digit minutes", () => {
    expect(formatClock(9, 5)).toBe("9:05 AM")
  })
})

// ── deriveMealSchedule — fasting enabled ────────────────────────────────────────

describe("deriveMealSchedule — fasting enabled (11.4)", () => {
  it("places meals inside the eating window for 19:5", () => {
    // Window opens at (20 + 19) mod 24 = 15:00 (3 PM), lasts 5h → closes 8 PM.
    const sched = deriveMealSchedule(IF_19_5)
    expect(sched.mealTimes.length).toBe(2)
    const t1 = minutesFromClock(sched.mealTimes[0])
    const t2 = minutesFromClock(sched.mealTimes[1])
    // Both within [3 PM, 8 PM] = [900, 1200] minutes
    expect(t1).toBeGreaterThanOrEqual(15 * 60)
    expect(t2).toBeLessThanOrEqual(20 * 60)
    expect(t1).toBeLessThan(t2)
  })

  it("places the shake between the two main meals", () => {
    const sched = deriveMealSchedule(IF_19_5)
    expect(sched.includeShake).toBe(true)
    expect(sched.shakeTime).not.toBeNull()
    const t1 = minutesFromClock(sched.mealTimes[0])
    const tS = minutesFromClock(sched.shakeTime!)
    const t2 = minutesFromClock(sched.mealTimes[1])
    expect(tS).toBeGreaterThan(t1)
    expect(tS).toBeLessThan(t2)
  })

  it("16:8 produces a wider spread than 19:5", () => {
    // 16:8 window opens at (20+16) mod 24 = 12 PM, lasts 8h → 8 PM.
    const s16 = deriveMealSchedule(IF_16_8)
    const s19 = deriveMealSchedule(IF_19_5)
    const spread16 = minutesFromClock(s16.mealTimes[1]) - minutesFromClock(s16.mealTimes[0])
    const spread19 = minutesFromClock(s19.mealTimes[1]) - minutesFromClock(s19.mealTimes[0])
    expect(spread16).toBeGreaterThan(spread19)
  })

  it("respects includeShake=false even when fasting", () => {
    const sched = deriveMealSchedule(IF_19_5, { includeShake: false })
    expect(sched.includeShake).toBe(false)
    expect(sched.shakeTime).toBeNull()
  })
})

// ── deriveMealSchedule — fasting disabled ───────────────────────────────────────

describe("deriveMealSchedule — fasting disabled (11.4)", () => {
  it("spreads meals across a normal all-day window", () => {
    const sched = deriveMealSchedule(NO_FAST)
    const t1 = minutesFromClock(sched.mealTimes[0])
    const t2 = minutesFromClock(sched.mealTimes[1])
    // Normal window is 8 AM – 8 PM. First meal in the morning half, last in evening.
    expect(t1).toBeGreaterThanOrEqual(8 * 60)
    expect(t2).toBeLessThanOrEqual(20 * 60)
    // The spread should be substantially wider than any fasting window
    expect(t2 - t1).toBeGreaterThan(5 * 60)  // > 5 hours apart
  })

  it("first meal is a morning meal when not fasting", () => {
    const sched = deriveMealSchedule(NO_FAST)
    // First meal should be before noon (a breakfast), unlike the IF afternoon start
    expect(minutesFromClock(sched.mealTimes[0])).toBeLessThan(12 * 60)
  })
})

// ── deriveMealSchedule — meal count ─────────────────────────────────────────────

describe("deriveMealSchedule — main meal count (11.4)", () => {
  it("defaults to 2 main meals", () => {
    expect(deriveMealSchedule(IF_16_8).mealTimes.length).toBe(2)
  })
  it("can produce a single meal at the window midpoint (OMAD-style)", () => {
    const sched = deriveMealSchedule(IF_19_5, { mainMealCount: 1, includeShake: false })
    expect(sched.mealTimes.length).toBe(1)
    const t = minutesFromClock(sched.mealTimes[0])
    // Midpoint of [3 PM, 8 PM] ≈ 5:30 PM
    expect(t).toBeGreaterThan(15 * 60)
    expect(t).toBeLessThan(20 * 60)
  })
  it("can produce 3 main meal times for future use", () => {
    const sched = deriveMealSchedule(NO_FAST, { mainMealCount: 3 })
    expect(sched.mealTimes.length).toBe(3)
    // Time-ordered
    const ms = sched.mealTimes.map(minutesFromClock)
    expect(ms[0]).toBeLessThan(ms[1])
    expect(ms[1]).toBeLessThan(ms[2])
  })
})

// ── LEGACY_IF_SCHEDULE default ──────────────────────────────────────────────────

describe("legacy schedule fallback (11.4)", () => {
  it("LEGACY_IF_SCHEDULE matches the pre-11.4 hardcoded times", () => {
    expect(LEGACY_IF_SCHEDULE.mealTimes).toEqual(["2:00 PM", "6:30 PM"])
    expect(LEGACY_IF_SCHEDULE.shakeTime).toBe("4:30 PM")
    expect(LEGACY_IF_SCHEDULE.includeShake).toBe(true)
  })

  it("generateDayPlan with no schedule reproduces legacy times exactly", () => {
    const result = generateDayPlan(TARGETS, 0, "eggetarian", KETO)
    const times = result.plan.meals.map(m => m.time)
    // Time-sorted: 2 PM, 4:30 PM, 6:30 PM
    expect(times).toEqual(["2:00 PM", "4:30 PM", "6:30 PM"])
  })

  it("generateDayPlan with no schedule still produces 3 meals incl shake", () => {
    const result = generateDayPlan(TARGETS, 0, "eggetarian", KETO)
    expect(result.plan.meals).toHaveLength(3)
    expect(result.plan.meals.some(m => m.slot === "shake")).toBe(true)
  })
})

// ── Generator — schedule-aware behavior ─────────────────────────────────────────

describe("generateDayPlan — schedule integration (11.4)", () => {
  it("uses the schedule's meal times", () => {
    const sched = deriveMealSchedule(IF_16_8)
    const result = generateDayPlan(TARGETS, 0, "eggetarian", KETO, sched)
    const mainTimes = result.plan.meals
      .filter(m => m.slot !== "shake")
      .map(m => m.time)
    expect(mainTimes).toContain(sched.mealTimes[0])
    expect(mainTimes).toContain(sched.mealTimes[1])
  })

  it("omits the shake when schedule.includeShake is false", () => {
    const sched: MealSchedule = {
      mealTimes: ["1:00 PM", "7:00 PM"], shakeTime: null, includeShake: false,
    }
    const result = generateDayPlan(TARGETS, 0, "eggetarian", KETO, sched)
    expect(result.plan.meals).toHaveLength(2)
    expect(result.plan.meals.some(m => m.slot === "shake")).toBe(false)
  })

  it("redistributes shake protein into main meals when shake is dropped", () => {
    // With no shake, the shake's ~25g protein is redistributed into the two
    // main meals' targets rather than silently lost. Per-meal portion caps
    // (e.g. paneer ≤150g/meal, eggs ≤6) limit how much a meal can physically
    // absorb, so the day won't always reach 100g — but it must land clearly
    // above the ~75g it would hit if the shake protein were simply dropped.
    const noShake: MealSchedule = {
      mealTimes: ["1:00 PM", "7:00 PM"], shakeTime: null, includeShake: false,
    }
    const withShakeSched: MealSchedule = {
      mealTimes: ["1:00 PM", "7:00 PM"], shakeTime: "4:00 PM", includeShake: true,
    }
    const noShakeProtein = generateDayPlan(TARGETS, 0, "eggetarian", KETO, noShake)
      .plan.meals.reduce((s, m) => s + computeMealMacros(m).protein, 0)
    const withShakeMains = generateDayPlan(TARGETS, 0, "eggetarian", KETO, withShakeSched)
      .plan.meals.filter(m => m.slot !== "shake")
      .reduce((s, m) => s + computeMealMacros(m).protein, 0)
    // The no-shake day's main meals carry more protein than the with-shake
    // day's main meals — proof the shake's share was redistributed, not lost.
    expect(noShakeProtein).toBeGreaterThan(withShakeMains)
    // And it clears the ~75g floor that dropping-without-redistribution gives.
    expect(noShakeProtein).toBeGreaterThan(78)
  })

  it("keeps the day's meal array time-sorted with a custom schedule", () => {
    const sched = deriveMealSchedule(IF_16_8)
    const result = generateDayPlan(TARGETS, 0, "eggetarian", KETO, sched)
    const ms = result.plan.meals.map(m => minutesFromClock(m.time))
    const sorted = [...ms].sort((a, b) => a - b)
    expect(ms).toEqual(sorted)
  })

  it("no-fast schedule yields a morning first meal in the generated plan", () => {
    const sched = deriveMealSchedule(NO_FAST, { includeShake: false })
    const result = generateDayPlan(TARGETS, 0, "eggetarian", KETO, sched)
    const firstMeal = result.plan.meals[0]  // already time-sorted
    expect(minutesFromClock(firstMeal.time)).toBeLessThan(12 * 60)
  })

  it("records the schedule in meta.decisions", () => {
    const sched = deriveMealSchedule(IF_16_8, { includeShake: false })
    const result = generateDayPlan(TARGETS, 0, "eggetarian", KETO, sched)
    const hasScheduleNote = result.plan.meta.decisions.some(d => d.includes("Schedule:"))
    expect(hasScheduleNote).toBe(true)
    const hasNoShakeNote = result.plan.meta.decisions.some(d => d.includes("no shake"))
    expect(hasNoShakeNote).toBe(true)
  })
})

describe("generateWeekPlan — schedule threading (11.4)", () => {
  it("applies the same schedule to all 7 days", () => {
    const sched = deriveMealSchedule(IF_16_8, { includeShake: false })
    const week = generateWeekPlan(TARGETS, "eggetarian", KETO, sched)
    for (const day of week) {
      expect(day.plan.meals.some(m => m.slot === "shake")).toBe(false)
      const mainTimes = day.plan.meals.map(m => m.time)
      expect(mainTimes).toContain(sched.mealTimes[0])
    }
  })

  it("week plan with no schedule keeps legacy 3-meal shape on every day", () => {
    const week = generateWeekPlan(TARGETS, "eggetarian", KETO)
    for (const day of week) {
      expect(day.plan.meals).toHaveLength(3)
      expect(day.plan.meals.map(m => m.time)).toEqual(["2:00 PM", "4:30 PM", "6:30 PM"])
    }
  })
})
