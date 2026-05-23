// ── shareUtils.ts ──────────────────────────────────────────────────────────────
// Sharing utilities. Primary channel: WhatsApp.
// Falls back to Web Share API (mobile) then clipboard (desktop).

export type DailySummary = {
  date:       string   // YYYY-MM-DD
  calories:   number
  calTarget:  number
  protein:    number
  proteinTarget: number
  carbs:      number
  fat:        number
  water:      number
  waterTarget: number
  weight?:    number
  fastHours?: number
  medsAllTaken: boolean
}

export function formatDailySummaryForShare(s: DailySummary): string {
  const date = new Date(s.date).toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short"
  })
  const calPct   = Math.round(s.calories   / s.calTarget     * 100)
  const protPct  = Math.round(s.protein    / s.proteinTarget * 100)
  const waterPct = Math.round(s.water      / s.waterTarget   * 100)

  const lines: string[] = [
    `📊 *HealthTracker — ${date}*`,
    ``,
    `🔥 Calories: ${Math.round(s.calories)} / ${s.calTarget} kcal (${calPct}%)`,
    `🥩 Protein:  ${Math.round(s.protein)}g / ${s.proteinTarget}g (${protPct}%)`,
    `🌾 Carbs:    ${Math.round(s.carbs)}g`,
    `🧈 Fat:      ${Math.round(s.fat)}g`,
    `💧 Water:    ${s.water.toFixed(1)}L / ${s.waterTarget}L (${waterPct}%)`,
  ]

  if (s.weight) {
    lines.push(`⚖️  Weight:   ${s.weight} kg`)
  }

  if (s.fastHours && s.fastHours > 0) {
    const h = Math.floor(s.fastHours / 3600)
    const m = Math.floor((s.fastHours % 3600) / 60)
    lines.push(`⏱️  Fast:     ${h}h ${m}m`)
  }

  lines.push(`💊 Meds:     ${s.medsAllTaken ? "✅ All taken" : "⚠️ Pending"}`)

  const onTrack = calPct >= 85 && calPct <= 115 && protPct >= 85
  lines.push(``)
  lines.push(onTrack ? `✅ On track today!` : `📌 Keep going — log the rest of the day`)
  lines.push(`_Sent from HealthTracker_`)

  return lines.join("\n")
}

// ── Grocery list share ────────────────────────────────────────────────────────
// Collects all ingredients across all meals, deduplicates by ingredient name,
// and formats a clean WhatsApp-friendly shopping list.

export type ShareableMeal = {
  name: string
  ingredients: string[]
  steps: string[]
  protein: number
  carbs: number
  fat: number
  cal: number
  time?: string
}

export function formatGroceryListForShare(meals: ShareableMeal[]): string {
  if (meals.length === 0) return "No meals in your plan yet."

  // Deduplicate ingredients across all meals
  const seen = new Map<string, string[]>()   // ingredient key → meal names that need it
  for (const meal of meals) {
    for (const ing of meal.ingredients) {
      const trimmed = ing.trim()
      if (!trimmed) continue
      // Normalise key: lowercase, strip leading quantities for grouping
      // e.g. "80g paneer" and "100g paneer" both key as "paneer"
      const key = trimmed
        .toLowerCase()
        .replace(/^\d+(\.\d+)?\s*(g|ml|tsp|tbsp|scoop|kg|l)?\s*/i, "")
        .replace(/\s*[-—].*$/, "")  // strip prep notes like "— crumbled"
        .trim()
      if (!seen.has(key)) seen.set(key, [])
      if (!seen.get(key)!.includes(meal.name)) {
        seen.get(key)!.push(meal.name)
      }
    }
  }

  // Sort alphabetically
  const items = Array.from(seen.entries()).sort((a, b) => a[0].localeCompare(b[0]))

  const lines: string[] = [
    `🛒 *Weekly Grocery List*`,
    `_${meals.length} meals · ${items.length} ingredients_`,
    ``,
  ]

  for (const [ingredient, mealNames] of items) {
    const mealHint = mealNames.length <= 2
      ? mealNames.join(", ")
      : `${mealNames.slice(0, 2).join(", ")} +${mealNames.length - 2} more`
    lines.push(`☐ ${ingredient.charAt(0).toUpperCase() + ingredient.slice(1)}`)
    lines.push(`  _↳ ${mealHint}_`)
  }

  lines.push(``)
  lines.push(`_Sent from HealthTracker_`)

  return lines.join("\n")
}

// ── Recipe share ──────────────────────────────────────────────────────────────
// Formats a single meal's ingredients + steps for WhatsApp.

export function formatRecipeForShare(meal: ShareableMeal): string {
  const lines: string[] = [
    `🍽 *${meal.name}*`,
    meal.time ? `_${meal.time}_` : "",
    ``,
    `📊 P ${meal.protein}g · C ${meal.carbs}g · F ${meal.fat}g · ${meal.cal} kcal`,
    ``,
  ]

  if (meal.ingredients.length > 0) {
    lines.push(`*Ingredients:*`)
    for (const ing of meal.ingredients) {
      lines.push(`• ${ing}`)
    }
    lines.push(``)
  }

  if (meal.steps.length > 0) {
    lines.push(`*Method:*`)
    meal.steps.forEach((step, i) => {
      lines.push(`${i + 1}. ${step}`)
    })
    lines.push(``)
  }

  lines.push(`_Sent from HealthTracker_`)

  return lines.filter(l => l !== undefined).join("\n")
}

// ── Core share helpers ────────────────────────────────────────────────────────

export function shareViaWhatsApp(text: string) {
  const encoded = encodeURIComponent(text)
  window.open(`https://wa.me/?text=${encoded}`, "_blank")
}

export async function shareOrCopy(text: string, title = "HealthTracker Summary"): Promise<"whatsapp" | "native" | "clipboard"> {
  if (navigator.share) {
    try {
      await navigator.share({ title, text })
      return "native"
    } catch {}
  }
  try {
    await navigator.clipboard.writeText(text)
    return "clipboard"
  } catch {}
  shareViaWhatsApp(text)
  return "whatsapp"
}
