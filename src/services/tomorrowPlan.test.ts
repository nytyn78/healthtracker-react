// ── tomorrowPlan.test.ts ──────────────────────────────────────────────────────
// Tests for the Tomorrow section's pure-data helpers (commit 12).
// UI rendering is not tested here — that's a separate React testing concern
// outside the existing vitest setup.

import { describe, it, expect } from "vitest"
import {
  computeDailyTotals,
  computeGroceryList,
  formatGroceryForSharing,
  formatRecipesForSharing,
  getRulesForCook,
} from "./tomorrowPlan"
import type { MealPlanEntry } from "../store/useHealthStore"

function meal(name: string, ingredients: string[], macros: Partial<MealPlanEntry> = {}): MealPlanEntry {
  return {
    id:          `meal-${name}`,
    name,
    time:        macros.time   ?? "2:00 PM",
    protein:     macros.protein ?? 30,
    carbs:       macros.carbs   ?? 10,
    fat:         macros.fat     ?? 25,
    cal:         macros.cal     ?? 380,
    tag:         "eggetarian",
    ingredients,
    steps:       ["Cook it.", "Serve it."],
  }
}

// ── Daily totals ──────────────────────────────────────────────────────────────

describe("computeDailyTotals", () => {
  it("sums macros across meals", () => {
    const meals: MealPlanEntry[] = [
      meal("Lunch", [], { protein: 30, carbs: 5, fat: 25, cal: 365 }),
      meal("Dinner", [], { protein: 35, carbs: 8, fat: 22, cal: 370 }),
      meal("Shake", [], { protein: 25, carbs: 2, fat: 1, cal: 115 }),
    ]
    const totals = computeDailyTotals(meals)
    expect(totals).toEqual({ protein: 90, carbs: 15, fat: 48, cal: 850 })
  })

  it("returns zeros for an empty list", () => {
    expect(computeDailyTotals([])).toEqual({ protein: 0, carbs: 0, fat: 0, cal: 0 })
  })

  it("handles missing macro fields safely", () => {
    const meals = [{ ...meal("X", []), protein: undefined as any }]
    expect(() => computeDailyTotals(meals)).not.toThrow()
  })
})

// ── Grocery aggregation: parsing happy path ───────────────────────────────────

describe("computeGroceryList — parsing", () => {
  it("parses 'Ng <name>' into qty + name", () => {
    const meals = [meal("Lunch", ["80g paneer"])]
    const list = computeGroceryList(meals)
    expect(list).toEqual([
      { name: "paneer", totalQty: "80 g", unparseable: false },
    ])
  })

  it("parses 'N tsp <name>' into qty + unit + name", () => {
    const meals = [meal("Lunch", ["2 tsp ghee"])]
    const list = computeGroceryList(meals)
    expect(list[0]).toEqual({ name: "ghee", totalQty: "2 tsp", unparseable: false })
  })

  it("strips parenthetical notes from ingredient names", () => {
    // "80g paneer (cubed)" and "100g paneer (crumbled)" should aggregate.
    const meals = [
      meal("Lunch",  ["80g paneer (cubed)"]),
      meal("Dinner", ["100g paneer (crumbled)"]),
    ]
    const list = computeGroceryList(meals)
    expect(list).toEqual([
      { name: "paneer", totalQty: "180 g", unparseable: false },
    ])
  })

  it("aggregates same name + same unit across meals", () => {
    const meals = [
      meal("Lunch",  ["1 tsp ghee"]),
      meal("Dinner", ["2 tsp ghee"]),
    ]
    const list = computeGroceryList(meals)
    expect(list).toEqual([
      { name: "ghee", totalQty: "3 tsp", unparseable: false },
    ])
  })

  it("keeps different units of the same name separate (no unit conversion)", () => {
    const meals = [
      meal("Lunch",  ["1 tsp ghee"]),
      meal("Dinner", ["5 g ghee"]),
    ]
    const list = computeGroceryList(meals)
    expect(list).toHaveLength(2)
  })

  it("handles decimal quantities", () => {
    const meals = [meal("Lunch", ["1.5 tbsp coconut oil"])]
    const list = computeGroceryList(meals)
    expect(list[0]).toEqual({ name: "coconut oil", totalQty: "1.5 tbsp", unparseable: false })
  })

  it("formats integer aggregated quantities without trailing zero", () => {
    const meals = [meal("Lunch", ["1.5 tsp ghee"]), meal("Dinner", ["1.5 tsp ghee"])]
    const list = computeGroceryList(meals)
    expect(list[0].totalQty).toBe("3 tsp")
  })

  it("parses ingredient lines with no unit (counted items)", () => {
    const meals = [meal("Lunch", ["2 eggs (boiled and peeled)"])]
    const list = computeGroceryList(meals)
    // "eggs" with no unit → totalQty is just the number
    expect(list[0]).toEqual({ name: "eggs", totalQty: "2", unparseable: false })
  })
})

describe("computeGroceryList — unparseable fallback", () => {
  it("keeps unparseable lines verbatim", () => {
    const meals = [meal("Lunch", ["salt to taste", "fresh coriander"])]
    const list = computeGroceryList(meals)
    expect(list).toHaveLength(2)
    for (const item of list) {
      expect(item.unparseable).toBe(true)
      expect(item.totalQty).toBe("")
    }
  })

  it("deduplicates unparseable lines across meals", () => {
    const meals = [
      meal("Lunch",  ["salt to taste"]),
      meal("Dinner", ["salt to taste"]),
    ]
    const list = computeGroceryList(meals)
    const saltLines = list.filter(i => i.name === "salt to taste")
    expect(saltLines).toHaveLength(1)
  })

  it("sorts unparseable lines after aggregated lines", () => {
    const meals = [meal("Lunch", ["80g paneer", "salt to taste", "1 tsp ghee"])]
    const list = computeGroceryList(meals)
    const lastTwo = list.slice(-1)
    expect(lastTwo[0].unparseable).toBe(true)
  })

  it("a mix of parseable and unparseable produces both kinds", () => {
    const meals = [meal("Lunch", ["80g paneer", "fresh coriander to garnish"])]
    const list = computeGroceryList(meals)
    expect(list.filter(i => !i.unparseable)).toHaveLength(1)
    expect(list.filter(i => i.unparseable)).toHaveLength(1)
  })
})

// ── Share-text formatting ─────────────────────────────────────────────────────

describe("formatGroceryForSharing", () => {
  it("produces a labelled bulleted list", () => {
    const list = [
      { name: "paneer", totalQty: "180 g", unparseable: false },
      { name: "salt to taste", totalQty: "", unparseable: true },
    ]
    const text = formatGroceryForSharing(list, "Monday")
    expect(text).toContain("Monday")
    expect(text).toContain("180 g paneer")
    expect(text).toContain("salt to taste")
  })
})

describe("formatRecipesForSharing", () => {
  it("includes meal name, time, ingredients, and steps", () => {
    const meals = [
      meal("Paneer Bhurji", ["80g paneer", "1 tsp ghee"], { time: "2:00 PM" }),
    ]
    const text = formatRecipesForSharing(meals, "Monday")
    expect(text).toContain("Monday")
    expect(text).toContain("Paneer Bhurji")
    expect(text).toContain("2:00 PM")
    expect(text).toContain("80g paneer")
    expect(text).toContain("Cook it.")
  })

  it("formats multiple meals in order", () => {
    const meals = [
      meal("Lunch",  [], { time: "2:00 PM" }),
      meal("Dinner", [], { time: "6:30 PM" }),
    ]
    const text = formatRecipesForSharing(meals, "Tuesday")
    expect(text.indexOf("Lunch")).toBeLessThan(text.indexOf("Dinner"))
  })
})

// ── Rules-for-cook (mode + diet aware) ────────────────────────────────────────

describe("getRulesForCook — mode awareness", () => {
  it("KETO mentions no rice / no roti", () => {
    const rules = getRulesForCook("KETO", "eggetarian")
    expect(rules.some(r => r.toLowerCase().includes("rice"))).toBe(true)
  })

  it("BALANCED does NOT mention no rice / no roti", () => {
    const rules = getRulesForCook("BALANCED", "eggetarian")
    expect(rules.some(r => r.toLowerCase().includes("no rice"))).toBe(false)
  })

  it("LOW_CARB has portion-control rules but doesn't forbid carbs", () => {
    const rules = getRulesForCook("LOW_CARB", "eggetarian")
    expect(rules.some(r => r.toLowerCase().includes("portion"))).toBe(true)
    expect(rules.some(r => r.toLowerCase().includes("no rice, no roti, no dal"))).toBe(false)
  })

  it("every mode includes the universal rules (light salt, no sugar)", () => {
    for (const mode of ["KETO", "BALANCED", "LOW_CARB", "HIGH_PROTEIN_CUT", "RECOMPOSITION"] as const) {
      const rules = getRulesForCook(mode, "eggetarian")
      expect(rules.some(r => r.toLowerCase().includes("light salt"))).toBe(true)
      expect(rules.some(r => r.toLowerCase().includes("no sugar"))).toBe(true)
    }
  })
})

describe("getRulesForCook — diet awareness", () => {
  it("veg mentions no eggs, no meat", () => {
    const rules = getRulesForCook("BALANCED", "veg")
    expect(rules.some(r => r.toLowerCase().includes("no eggs"))).toBe(true)
  })

  it("eggetarian mentions no meat but allows eggs", () => {
    const rules = getRulesForCook("BALANCED", "eggetarian")
    const eggRule = rules.find(r => r.toLowerCase().includes("egg"))
    expect(eggRule?.toLowerCase()).toContain("ok")
  })

  it("non-veg has no diet restriction beyond the universal rules", () => {
    const rules = getRulesForCook("BALANCED", "non_veg")
    expect(rules.some(r => r.toLowerCase().includes("vegetarian"))).toBe(false)
    expect(rules.some(r => r.toLowerCase().includes("no eggs"))).toBe(false)
  })
})
