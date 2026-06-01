import { describe, it, expect } from "vitest"
import { replaceMealWithShake, MealPlanEntry } from "./mealSwap"

function meal(name: string, time: string, p: number, c: number, f: number, cal: number, ings: string[] = []): any {
  return { id: name, name, time, protein: p, carbs: c, fat: f, cal, tag: "veg", ingredients: ings, steps: [] }
}
// A typical day: breakfast, lunch, dinner.
const day = (): any[] => [
  meal("Poha", "8:45 AM", 12, 40, 10, 290, ["30g Poha", "200g Dahi"]),
  meal("Dal Chawal", "2:00 PM", 20, 80, 9, 490, ["45g Toor Dal", "40g Rice"]),
  meal("Kadhai Paneer + Roti", "7:30 PM", 36, 60, 23, 600, ["100g Paneer", "40g Atta"]),
]

describe("replaceMealWithShake", () => {
  it("lighter mode: keeps other meals, day runs lighter, shake added", () => {
    const r = replaceMealWithShake(day(), 1, "lighter")  // skip lunch (490 kcal)
    const names = r.meals.map(m => m.name)
    expect(names).toContain("Protein Shake")
    expect(names).not.toContain("Dal Chawal")
    // breakfast + dinner unchanged
    const dinner = r.meals.find(m => m.name.startsWith("Kadhai"))!
    expect(dinner.cal).toBe(600)
    // lighter by lunch cal minus shake cal (490 - 120 = 370)
    expect(r.caloriesLighterBy).toBe(370)
    expect(r.note).toMatch(/lighter/)
  })

  it("redistribute mode: other meals grow, day stays closer to target", () => {
    const before = day()
    const beforeCal = before.reduce((s, m) => s + m.cal, 0)  // 1380
    const r = replaceMealWithShake(before, 1, "redistribute")
    const afterCal = r.meals.reduce((s, m) => s + m.cal, 0)
    // After redistribute, total should be much closer to the original than lighter mode.
    expect(afterCal).toBeGreaterThan(beforeCal - 200)
    // Other meals grew (dinner > 600)
    const dinner = r.meals.find(m => m.name.startsWith("Kadhai"))!
    expect(dinner.cal).toBeGreaterThan(600)
    // ingredient grams scaled up
    expect(dinner.ingredients.some((i: string) => /\d+g Paneer/.test(i))).toBe(true)
  })

  it("redistribute respects the per-meal growth cap (no brick)", () => {
    // Skip a huge meal so the cap must bite.
    const meals = [meal("Tiny", "8 AM", 5, 5, 2, 100), meal("Huge", "1 PM", 50, 100, 40, 1200)]
    const r = replaceMealWithShake(meals, 1, "redistribute")  // skip Huge
    const tiny = r.meals.find(m => m.name === "Tiny")!
    // Tiny can't grow beyond 1.6x = 160 kcal
    expect(tiny.cal).toBeLessThanOrEqual(160)
    // so the day is reported as still lighter
    expect(r.caloriesLighterBy).toBeGreaterThan(0)
  })

  it("shake is a fixed 1 scoop (25g protein, 120 kcal)", () => {
    const r = replaceMealWithShake(day(), 0, "lighter")
    const shake = r.meals.find(m => m.name === "Protein Shake")!
    expect(shake.protein).toBe(25)
    expect(shake.cal).toBe(120)
  })
})
