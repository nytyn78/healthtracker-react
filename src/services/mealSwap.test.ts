// ── mealSwap.test.ts ──────────────────────────────────────────────────────────
// Tests for swap-as-substitution helpers (commit 13).
//
// The vitest environment is "node" (no jsdom, no new deps allowed), so there's
// no real localStorage. We install a minimal in-memory polyfill in beforeEach.
// mealSwap reads the canonical plan via loadMealPlan(), which just reads
// KEYS.MEAL_PLAN from localStorage — so seeding a plan = writing that key.
//
// UI rendering (picker, badge, reset button) is a React concern tested
// elsewhere; this file covers the pure data layer only.

import { describe, it, expect, beforeEach } from "vitest"
import {
  getCanonicalDayMeals,
  getEffectiveMeals,
  getSwapCandidates,
  saveSwap,
  clearSwap,
  isSwapped,
  loadSwaps,
  pruneSwaps,
} from "./mealSwap"
import { KEYS } from "./storageKeys"
import type { MealPlanEntry, DietTag } from "../store/useHealthStore"

// ── In-memory localStorage polyfill ───────────────────────────────────────────

class MemoryStorage {
  private store = new Map<string, string>()
  get length() { return this.store.size }
  key(i: number): string | null { return Array.from(this.store.keys())[i] ?? null }
  getItem(k: string): string | null { return this.store.has(k) ? this.store.get(k)! : null }
  setItem(k: string, v: string): void { this.store.set(k, String(v)) }
  removeItem(k: string): void { this.store.delete(k) }
  clear(): void { this.store.clear() }
}

beforeEach(() => {
  // Fresh storage per test. Cast through unknown — MemoryStorage implements the
  // subset of the Storage interface mealSwap actually uses.
  ;(globalThis as unknown as { localStorage: Storage }).localStorage =
    new MemoryStorage() as unknown as Storage
})

// ── Fixtures ──────────────────────────────────────────────────────────────────

function meal(
  name: string,
  day: string,
  time: string,
  tag: DietTag = "eggetarian",
  macros: Partial<MealPlanEntry> = {},
): MealPlanEntry {
  return {
    id:          `${day}-${name}`,
    name,
    time,
    protein:     macros.protein ?? 30,
    carbs:       macros.carbs   ?? 10,
    fat:         macros.fat     ?? 25,
    cal:         macros.cal     ?? 380,
    tag,
    ingredients: macros.ingredients ?? ["100g paneer"],
    steps:       ["Cook it."],
    day,
  }
}

function seedPlan(plan: MealPlanEntry[]): void {
  localStorage.setItem(KEYS.MEAL_PLAN, JSON.stringify(plan))
}

// A small 2-day, 2-slot plan. Note Monday's meals are seeded out of time order
// to prove getCanonicalDayMeals sorts them.
function seedTwoDayPlan(): void {
  seedPlan([
    meal("Mon Dinner",    "Monday",  "7:00 PM"),   // slot 1 (later)
    meal("Mon Lunch",     "Monday",  "1:00 PM"),   // slot 0 (earlier)
    meal("Tue Lunch",     "Tuesday", "1:00 PM"),   // slot 0
    meal("Tue Dinner",    "Tuesday", "7:00 PM"),   // slot 1
  ])
}

// ── getCanonicalDayMeals ──────────────────────────────────────────────────────

describe("getCanonicalDayMeals", () => {
  it("filters by day name and sorts by time (slot index = position)", () => {
    seedTwoDayPlan()
    const monday = getCanonicalDayMeals("Monday")
    expect(monday.map(m => m.name)).toEqual(["Mon Lunch", "Mon Dinner"])
  })

  it("is case-insensitive on day name", () => {
    seedTwoDayPlan()
    expect(getCanonicalDayMeals("monday")).toHaveLength(2)
  })

  it("treats day-less entries as universal (every day)", () => {
    seedPlan([
      meal("Shake", "", "4:00 PM"),               // no day → universal
      meal("Mon Lunch", "Monday", "1:00 PM"),
    ])
    const monday = getCanonicalDayMeals("Monday")
    expect(monday.map(m => m.name)).toEqual(["Mon Lunch", "Shake"])
  })

  it("returns empty when no meals match", () => {
    seedTwoDayPlan()
    expect(getCanonicalDayMeals("Sunday")).toEqual([])
  })
})

// ── save / clear / isSwapped / loadSwaps ──────────────────────────────────────

describe("swap persistence", () => {
  const date = "2026-05-28"

  it("saves and reads back an override", () => {
    const sub = meal("Substitute", "Tuesday", "1:00 PM")
    saveSwap(date, 0, sub)
    expect(isSwapped(date, 0)).toBe(true)
    expect(loadSwaps(date)[0].name).toBe("Substitute")
  })

  it("clear removes only the targeted slot", () => {
    saveSwap(date, 0, meal("A", "Tuesday", "1:00 PM"))
    saveSwap(date, 1, meal("B", "Tuesday", "7:00 PM"))
    clearSwap(date, 0)
    expect(isSwapped(date, 0)).toBe(false)
    expect(isSwapped(date, 1)).toBe(true)
  })

  it("removes the storage key entirely when the last swap is cleared", () => {
    saveSwap(date, 0, meal("A", "Tuesday", "1:00 PM"))
    clearSwap(date, 0)
    expect(localStorage.getItem(KEYS.MEAL_SWAP(date))).toBeNull()
  })

  it("isSwapped is false for an untouched slot", () => {
    expect(isSwapped(date, 0)).toBe(false)
  })

  it("loadSwaps returns {} for a date with no swaps", () => {
    expect(loadSwaps(date)).toEqual({})
  })
})

// ── getEffectiveMeals ─────────────────────────────────────────────────────────

describe("getEffectiveMeals", () => {
  const date = "2026-05-28"

  it("returns canonical meals when no swaps exist", () => {
    seedTwoDayPlan()
    const eff = getEffectiveMeals(date, "Monday")
    expect(eff.map(m => m.name)).toEqual(["Mon Lunch", "Mon Dinner"])
  })

  it("overlays an override on the matching slot only", () => {
    seedTwoDayPlan()
    saveSwap(date, 0, meal("Swapped In", "Tuesday", "1:00 PM"))
    const eff = getEffectiveMeals(date, "Monday")
    expect(eff.map(m => m.name)).toEqual(["Swapped In", "Mon Dinner"])
  })

  it("does not leak swaps across dates", () => {
    seedTwoDayPlan()
    saveSwap("2026-05-28", 0, meal("Today Sub", "Tuesday", "1:00 PM"))
    const otherDay = getEffectiveMeals("2026-05-29", "Monday")
    expect(otherDay.map(m => m.name)).toEqual(["Mon Lunch", "Mon Dinner"])
  })
})

// ── getSwapCandidates ─────────────────────────────────────────────────────────

describe("getSwapCandidates", () => {
  it("offers other days' meals in the same slot, excluding the current day", () => {
    seedTwoDayPlan()
    // Current = Monday, slot 0 (lunch). Should offer Tuesday's lunch only.
    const cands = getSwapCandidates("Monday", 0, "eggetarian")
    expect(cands.map(m => m.name)).toEqual(["Tue Lunch"])
  })

  it("filters out meals not matching the diet tag", () => {
    seedPlan([
      meal("Mon Lunch", "Monday",  "1:00 PM", "veg"),
      meal("Tue Lunch", "Tuesday", "1:00 PM", "non_veg"),
      meal("Wed Lunch", "Wednesday", "1:00 PM", "veg"),
    ])
    const cands = getSwapCandidates("Monday", 0, "veg")
    expect(cands.map(m => m.name)).toEqual(["Wed Lunch"])
  })

  it("de-duplicates identical meals (same name + time) across days", () => {
    seedPlan([
      meal("Lunch", "Monday",    "1:00 PM", "veg"),
      meal("Lunch", "Tuesday",   "1:00 PM", "veg"),
      meal("Lunch", "Wednesday", "1:00 PM", "veg"),
    ])
    const cands = getSwapCandidates("Monday", 0, "veg")
    expect(cands).toHaveLength(1)
  })

  it("returns empty when no other day has that slot", () => {
    seedPlan([meal("Mon Lunch", "Monday", "1:00 PM", "veg")])
    expect(getSwapCandidates("Monday", 0, "veg")).toEqual([])
  })
})

// ── pruneSwaps ────────────────────────────────────────────────────────────────

describe("pruneSwaps", () => {
  it("removes swap keys older than yesterday, keeps today and tomorrow", () => {
    const m = meal("X", "Tuesday", "1:00 PM")
    saveSwap("2026-05-26", 0, m)  // 2 days ago — stale
    saveSwap("2026-05-27", 0, m)  // yesterday — kept
    saveSwap("2026-05-28", 0, m)  // today — kept
    saveSwap("2026-05-29", 0, m)  // tomorrow — kept

    pruneSwaps("2026-05-28")

    expect(localStorage.getItem(KEYS.MEAL_SWAP("2026-05-26"))).toBeNull()
    expect(localStorage.getItem(KEYS.MEAL_SWAP("2026-05-27"))).not.toBeNull()
    expect(localStorage.getItem(KEYS.MEAL_SWAP("2026-05-28"))).not.toBeNull()
    expect(localStorage.getItem(KEYS.MEAL_SWAP("2026-05-29"))).not.toBeNull()
  })

  it("leaves non-swap keys untouched", () => {
    seedTwoDayPlan()
    saveSwap("2026-05-01", 0, meal("X", "Tuesday", "1:00 PM"))  // very stale
    pruneSwaps("2026-05-28")
    expect(localStorage.getItem(KEYS.MEAL_PLAN)).not.toBeNull()
  })

  it("handles month/year boundaries correctly", () => {
    saveSwap("2025-12-30", 0, meal("X", "Tuesday", "1:00 PM"))  // stale
    saveSwap("2025-12-31", 0, meal("X", "Tuesday", "1:00 PM"))  // yesterday — kept
    pruneSwaps("2026-01-01")
    expect(localStorage.getItem(KEYS.MEAL_SWAP("2025-12-30"))).toBeNull()
    expect(localStorage.getItem(KEYS.MEAL_SWAP("2025-12-31"))).not.toBeNull()
  })
})
