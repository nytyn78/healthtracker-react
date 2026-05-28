// ── tomorrowPlan.ts ───────────────────────────────────────────────────────────
// Pure-data helpers for the Tomorrow section on the Today tab (commit 12).
//
// Keeps the React component (TomorrowSection.tsx) thin by isolating:
//   - meal lookup (filter loaded plan by tomorrow's day name)
//   - grocery aggregation (light-parse ingredient strings; sum per name)
//   - daily macro totals (sum P/C/F/kcal across the day's meals)
//   - share-text formatting (grocery + recipe variants for copy and WhatsApp)
//   - rules-for-cook (mode + diet aware)

import { loadMealPlan, MealPlanEntry, DietTag } from "../store/useHealthStore"
import type { MacroMode } from "./adaptiveTDEE"
import { getDayName } from "../data/mealPlan"

// ── Meal lookup ───────────────────────────────────────────────────────────────

/**
 * Returns tomorrow's meals from the stored plan, filtered by day name.
 *
 * Plan entries are stamped with day labels ("Monday", "Tuesday", ...) by the
 * generator. Entries with no day stamp are considered universal (they appear
 * on every day). If no entries match tomorrow's day, returns empty — caller
 * should render the "no plan generated" prompt.
 */
export function getTomorrowMeals(): { meals: MealPlanEntry[]; dayName: string } {
  const tomorrow = getDayName(1)
  const plan = loadMealPlan()
  const meals = plan.filter(
    e => !e.day || e.day.toLowerCase() === tomorrow.toLowerCase()
  )
  // Sort by time so the cook sees the day in order (breakfast → lunch → dinner).
  meals.sort((a, b) => parseTimeForSort(a.time) - parseTimeForSort(b.time))
  return { meals, dayName: tomorrow }
}

function parseTimeForSort(time: string): number {
  // Parse "2:00 PM", "8:30 AM", "10 AM" etc. Returns minutes since midnight.
  const m = time.match(/(\d+)(?::(\d+))?\s*(AM|PM)?/i)
  if (!m) return 9999  // unparseable times sort to end
  let h = parseInt(m[1], 10)
  const min = m[2] ? parseInt(m[2], 10) : 0
  const ampm = m[3]?.toUpperCase()
  if (ampm === "PM" && h < 12) h += 12
  if (ampm === "AM" && h === 12) h = 0
  return h * 60 + min
}

// ── Daily totals ──────────────────────────────────────────────────────────────

export type DailyTotals = {
  protein: number
  carbs:   number
  fat:     number
  cal:     number
}

export function computeDailyTotals(meals: MealPlanEntry[]): DailyTotals {
  return meals.reduce(
    (acc, m) => ({
      protein: acc.protein + (m.protein || 0),
      carbs:   acc.carbs   + (m.carbs   || 0),
      fat:     acc.fat     + (m.fat     || 0),
      cal:     acc.cal     + (m.cal     || 0),
    }),
    { protein: 0, carbs: 0, fat: 0, cal: 0 }
  )
}

// ── Grocery aggregation (light parsing) ───────────────────────────────────────

export type GroceryItem = {
  name:      string  // ingredient name (post-parse), or raw line if unparseable
  totalQty:  string  // aggregated quantity, e.g. "180g" or "3 tsp", or "" if unparseable
  unparseable: boolean  // true if the line was kept verbatim (no aggregation)
}

/**
 * Parses an ingredient line like "80g paneer (cubed)" into { qty: 80, unit:
 * "g", name: "paneer" }. Notes in parentheses are stripped from the name so
 * "80g paneer (cubed)" and "100g paneer (crumbled)" aggregate to one line.
 *
 * Returns null if the line doesn't match the expected pattern — caller
 * keeps the line verbatim in that case.
 */
function parseIngredientLine(line: string): { qty: number; unit: string; name: string } | null {
  // Match: optional integer/decimal + optional unit (g, kg, ml, tsp, tbsp,
  // cup, scoop, slice, piece, no/none) + space + name.
  // Examples that should match:
  //   "80g paneer (cubed)"        → { 80, "g", "paneer" }
  //   "1 tsp ghee"                → { 1, "tsp", "ghee" }
  //   "2 eggs (boiled and peeled)"→ { 2, "", "eggs" }
  //   "1.5 tbsp coconut oil"      → { 1.5, "tbsp", "coconut oil" }
  const m = line.match(/^\s*(\d+(?:\.\d+)?)\s*(g|kg|ml|tsp|tbsp|cup|scoop|slice|slices|piece|pieces)?\s+(.+?)\s*(\([^)]*\))?\s*$/i)
  if (!m) return null
  const qty  = parseFloat(m[1])
  const unit = (m[2] || "").toLowerCase()
  const name = m[3].trim().toLowerCase()
  if (isNaN(qty)) return null
  return { qty, unit, name }
}

function formatQty(qty: number, unit: string): string {
  // Show integers without trailing .0; show one decimal otherwise.
  const qStr = Number.isInteger(qty) ? qty.toString() : qty.toFixed(1)
  return unit ? `${qStr} ${unit}` : qStr
}

/**
 * Aggregates ingredient quantities across all meals of the day.
 *
 * Strategy: light parse each ingredient line. Group by (name, unit) — same
 * name + same unit → sum quantities. Different units of the same name (e.g.
 * "5 g paneer" + "1 tbsp paneer") stay separate; aggregator can't safely
 * convert between unit families. Unparseable lines pass through verbatim.
 *
 * Risks: a typo in an ingredient name ("paneer cube" vs "paneer cubes")
 * produces two lines instead of one. Acceptable failure mode — the cook
 * just sees two lines and adds them mentally. Better than aggregating
 * incorrectly.
 */
export function computeGroceryList(meals: MealPlanEntry[]): GroceryItem[] {
  const grouped: Map<string, { qty: number; unit: string; name: string }> = new Map()
  const unparseable: string[] = []

  for (const meal of meals) {
    for (const line of meal.ingredients || []) {
      const parsed = parseIngredientLine(line)
      if (!parsed) {
        unparseable.push(line.trim())
        continue
      }
      const key = `${parsed.name}|${parsed.unit}`
      const existing = grouped.get(key)
      if (existing) {
        existing.qty += parsed.qty
      } else {
        grouped.set(key, { ...parsed })
      }
    }
  }

  const items: GroceryItem[] = Array.from(grouped.values()).map(g => ({
    name:        g.name,
    totalQty:    formatQty(g.qty, g.unit),
    unparseable: false,
  }))
  // De-duplicate unparseable lines (a "salt to taste" might appear in every meal).
  const seenUnparseable = new Set<string>()
  for (const line of unparseable) {
    if (seenUnparseable.has(line)) continue
    seenUnparseable.add(line)
    items.push({ name: line, totalQty: "", unparseable: true })
  }
  // Sort: aggregated items alphabetically, then unparseable lines at the end.
  items.sort((a, b) => {
    if (a.unparseable !== b.unparseable) return a.unparseable ? 1 : -1
    return a.name.localeCompare(b.name)
  })
  return items
}

// ── Share-text formatting ─────────────────────────────────────────────────────

export function formatGroceryForSharing(
  groceryList: GroceryItem[],
  dayName:     string,
): string {
  const lines: string[] = [`🛒 Grocery list for ${dayName}:`, ""]
  for (const item of groceryList) {
    if (item.unparseable) {
      lines.push(`• ${item.name}`)
    } else {
      lines.push(`• ${item.totalQty} ${item.name}`)
    }
  }
  return lines.join("\n")
}

export function formatRecipesForSharing(
  meals:   MealPlanEntry[],
  dayName: string,
): string {
  const lines: string[] = [`👨‍🍳 Meals for ${dayName}:`, ""]
  for (const meal of meals) {
    lines.push(`━━━ ${meal.time} — ${meal.name} ━━━`)
    if (meal.ingredients?.length) {
      lines.push("", "Ingredients:")
      for (const ing of meal.ingredients) lines.push(`• ${ing}`)
    }
    if (meal.steps?.length) {
      lines.push("", "Steps:")
      meal.steps.forEach((step, i) => lines.push(`${i + 1}. ${step}`))
    }
    lines.push("")
  }
  return lines.join("\n")
}

// ── Rules-for-Cook (mode + diet aware) ────────────────────────────────────────

/**
 * Standing instructions to leave with the cook — overriding rules that apply
 * to every meal regardless of recipe. Mode-aware so a BALANCED user doesn't
 * see "no rice / no roti" instructions intended for KETO.
 */
export function getRulesForCook(macroMode: MacroMode, dietTag: DietTag): string[] {
  const rules: string[] = [
    "Light salt only — no extra salt at the table",
    "No sugar — not in tea/coffee, not in any sabzi",
    "Use the oil/ghee shown in each recipe — don't add more",
    "Quantities are by dry/raw weight — measure before cooking",
  ]

  if (macroMode === "KETO" || macroMode === "VERY_LOW_CARB") {
    rules.push("No rice, no roti, no dal — strict keto / very low-carb diet")
    rules.push("No potato, no sweet potato")
    rules.push("No fruit except small portions if shown in the recipe")
  } else if (macroMode === "LOW_CARB") {
    rules.push("Rice and roti only in the portions shown — don't add extra")
    rules.push("No second helpings of carbs")
  }

  if (dietTag === "veg") {
    rules.push("Pure vegetarian — no eggs, no meat, no fish")
  } else if (dietTag === "eggetarian") {
    rules.push("Eggs OK — no meat, no fish")
  }

  return rules
}

// ── WhatsApp helper ───────────────────────────────────────────────────────────

/**
 * Opens WhatsApp with the given text pre-filled in the share sheet.
 * Uses the wa.me universal link — works on both mobile and desktop browsers.
 */
export function openWhatsAppShare(text: string): void {
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`
  window.open(url, "_blank")
}
