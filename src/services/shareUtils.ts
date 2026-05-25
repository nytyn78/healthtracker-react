// ── shareUtils.ts ──────────────────────────────────────────────────────────────
// Sharing utilities. Primary channel: WhatsApp.
// Falls back to Web Share API (mobile) then clipboard (desktop).
//
// Five export functions:
//   - formatDailySummaryForShare       — daily tracker summary (calories vs target, etc.)
//   - formatGroceryListForShare        — weekly grocery list, deduplicated
//   - formatRecipeForShare             — single meal's ingredients + steps
//   - formatDailyCookMessageForShare   — NEW: full daily cook-ready message bundling
//                                         eating window + all meals + rules + macros
//   - shareViaWhatsApp / shareOrCopy   — core delivery helpers

import type { MacroMode } from "./adaptiveTDEE"

// ────────────────────────────────────────────────────────────────────────────
// DAILY SUMMARY
// ────────────────────────────────────────────────────────────────────────────

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

// ────────────────────────────────────────────────────────────────────────────
// SHAREABLE MEAL TYPE — used by grocery, recipe, and cook-message formatters
// ────────────────────────────────────────────────────────────────────────────

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

// ────────────────────────────────────────────────────────────────────────────
// GROCERY LIST (weekly) — keep existing dedup behavior, no breaking changes
// ────────────────────────────────────────────────────────────────────────────

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

// ────────────────────────────────────────────────────────────────────────────
// SINGLE RECIPE SHARE — unchanged
// ────────────────────────────────────────────────────────────────────────────

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

// ────────────────────────────────────────────────────────────────────────────
// MACRO-MODE-DERIVED RULES — what NOT to do, what TO do, per diet style
// ────────────────────────────────────────────────────────────────────────────
//
// The "rules" section is meant for forwarding the cook message to a household
// cook so they understand the dietary boundaries. Derived from the user's
// resolved MacroMode. Users can override with custom rules in Settings.
//
// Format: { donts: string[], dos: string[] } — both bullet-ready strings.

export type CookRules = {
  donts: string[]
  dos:   string[]
}

export function deriveRulesForMacroMode(mode: MacroMode): CookRules {
  switch (mode) {
    case "KETO":
      return {
        donts: [
          "No rice, roti, dal, sugar",
          "No starchy vegetables (potato, sweet potato, corn)",
          "No fruit except a few berries",
          "No vegetable oils — use ghee or butter only",
        ],
        dos: [
          "Use ghee, butter, coconut oil",
          "Green leafy vegetables welcome",
          "Salt to taste — keto needs more sodium",
        ],
      }
    case "VERY_LOW_CARB":
      return {
        donts: [
          "No rice, roti, sugar",
          "Limit dal to ½ katori per meal",
          "No vegetable oils — use ghee or butter only",
        ],
        dos: [
          "Use ghee, butter, olive oil",
          "Green leafy vegetables welcome",
        ],
      }
    case "LOW_CARB":
      return {
        donts: [
          "No sugar",
          "Limit rice/roti to 1 portion per meal",
          "No vegetable oils for deep-frying",
        ],
        dos: [
          "Use ghee, butter, olive oil",
          "Plenty of vegetables",
        ],
      }
    case "HIGH_PROTEIN_CUT":
      return {
        donts: [
          "No deep-fried foods",
          "No added sugar",
          "Limit fats — keep portions modest",
        ],
        dos: [
          "Lean protein priority (chicken, fish, paneer, dal)",
          "Vegetables fill the plate",
          "Use minimum oil — 1-2 tsp per meal",
        ],
      }
    case "RECOMPOSITION":
      return {
        donts: [
          "No added sugar",
          "No deep-fried foods",
        ],
        dos: [
          "Protein with every meal",
          "Carbs around workouts",
          "Use ghee or olive oil moderately",
        ],
      }
    case "BALANCED":
    default:
      return {
        donts: [
          "No added sugar in cooking",
          "No deep-fried foods",
        ],
        dos: [
          "Use any traditional oil moderately",
          "Vegetables with every meal",
        ],
      }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// DAILY COOK MESSAGE — bundles eating window + all meals + rules + totals
// ────────────────────────────────────────────────────────────────────────────
//
// This is the message you'd forward to a household cook on WhatsApp. Includes:
//   - Day header
//   - Eating window (if IF is active)
//   - Each meal: time, name, macros, ingredients, method
//   - Whey shake / supplement reminder (optional)
//   - Rules section (derived from MacroMode, or user-overridden)
//   - Daily macro totals
//
// English-only. Bilingual output is a deferred feature (see TODO.md).

export type CookMessageOptions = {
  dayLabel?:       string       // e.g. "Monday" or "Today"
  eatingWindow?:   string       // e.g. "12 PM – 8 PM"
  macroMode?:      MacroMode    // for auto-deriving rules
  customRules?:    CookRules    // overrides macroMode-derived rules if set
  shakeReminder?:  string       // e.g. "Whey shake — 4 PM, 1 scoop + 300ml water"
  appName?:        string       // footer signature, defaults to "HealthTracker"
}

export function formatDailyCookMessageForShare(
  meals: ShareableMeal[],
  options: CookMessageOptions = {},
): string {
  const {
    dayLabel        = "Today",
    eatingWindow,
    macroMode       = "BALANCED",
    customRules,
    shakeReminder,
    appName         = "HealthTracker",
  } = options

  if (meals.length === 0) {
    return `No meals planned for ${dayLabel}. Add meals to your plan first.`
  }

  const line = "─────────────────────"
  const lines: string[] = []

  // ── Header ──────────────────────────────────────────────────────────────
  lines.push(`🍳 *${dayLabel}'s Meal Plan*`)
  if (eatingWindow) {
    lines.push(`⏰ *Eating window: ${eatingWindow}*`)
  }
  lines.push(line)
  lines.push("")

  // ── Each meal ───────────────────────────────────────────────────────────
  meals.forEach((meal, idx) => {
    lines.push(`🍽 *Meal ${idx + 1}${meal.time ? ` — ${meal.time}` : ""}*`)
    lines.push(`*${meal.name}*`)
    lines.push(`📊 P ${meal.protein}g · C ${meal.carbs}g · F ${meal.fat}g · ${meal.cal} kcal`)
    lines.push(line)
    lines.push("")

    if (meal.ingredients.length > 0) {
      lines.push(`📦 *Ingredients*`)
      meal.ingredients.forEach(ing => lines.push(`  • ${ing}`))
      lines.push("")
    }

    if (meal.steps.length > 0) {
      lines.push(`👨‍🍳 *Method*`)
      meal.steps.forEach((step, i) => lines.push(`  ${i + 1}. ${step}`))
      lines.push("")
    }
  })

  // ── Shake / supplement reminder ─────────────────────────────────────────
  if (shakeReminder) {
    lines.push(line)
    lines.push(`🥤 *${shakeReminder}*`)
    lines.push("")
  }

  // ── Rules section ───────────────────────────────────────────────────────
  const rules = customRules ?? deriveRulesForMacroMode(macroMode)
  if (rules.donts.length > 0 || rules.dos.length > 0) {
    lines.push(line)
    lines.push(`⚠️ *Important*`)
    rules.donts.forEach(d => lines.push(`❌ ${d}`))
    rules.dos.forEach(d   => lines.push(`✅ ${d}`))
    lines.push("")
  }

  // ── Daily totals ────────────────────────────────────────────────────────
  const totals = meals.reduce(
    (acc, m) => ({
      protein: acc.protein + (m.protein || 0),
      carbs:   acc.carbs   + (m.carbs   || 0),
      fat:     acc.fat     + (m.fat     || 0),
      cal:     acc.cal     + (m.cal     || 0),
    }),
    { protein: 0, carbs: 0, fat: 0, cal: 0 },
  )

  lines.push(line)
  lines.push(
    `📊 *Daily totals:* P ${totals.protein}g · C ${totals.carbs}g · F ${totals.fat}g · ${totals.cal} kcal`,
  )
  lines.push("")
  lines.push(`_Sent from ${appName}_`)

  return lines.join("\n")
}

// ────────────────────────────────────────────────────────────────────────────
// CORE SHARE HELPERS
// ────────────────────────────────────────────────────────────────────────────

export function shareViaWhatsApp(text: string) {
  const encoded = encodeURIComponent(text)
  window.open(`https://wa.me/?text=${encoded}`, "_blank")
}

export async function shareOrCopy(
  text: string,
  title = "HealthTracker Summary",
): Promise<"whatsapp" | "native" | "clipboard"> {
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
