// ── TomorrowSection.tsx ───────────────────────────────────────────────────────
// Renders tomorrow's plan on the Today tab (commit 12).
//
// Layout, top to bottom:
//   1. "Tomorrow — Monday" header with daily totals row
//   2. Meal cards (read-only — can't log against tomorrow's meals)
//   3. Grocery list (computed from ingredients with light parsing)
//   4. "Send to Cook" actions: copy + WhatsApp for grocery + recipes
//   5. Rules-for-Cook card (mode + diet aware)
//
// Always visible (per user spec: tomorrow's planning happens any time of day,
// not gated on today being complete). If no plan is stored, renders a
// terse "no plan yet — generate one" hint.

import { useState } from "react"
import { useHealthStore } from "../store/useHealthStore"
import { resolveMacroMode } from "../services/adaptiveTDEE"
import {
  getTomorrowMeals,
  computeDailyTotals,
  computeGroceryList,
  formatGroceryForSharing,
  formatRecipesForSharing,
  getRulesForCook,
  openWhatsAppShare,
} from "../services/tomorrowPlan"
import { shareOrCopy } from "../services/shareUtils"
import { KEYS } from "../services/storageKeys"
import type { DietTag } from "../store/useHealthStore"

function getDietTag(): DietTag {
  try {
    const cfg = JSON.parse(localStorage.getItem(KEYS.DIET_CONFIG) || "{}")
    if (cfg.tag === "veg" || cfg.tag === "eggetarian" || cfg.tag === "non_veg") return cfg.tag
    return "veg"
  } catch { return "veg" }
}

export default function TomorrowSection() {
  const { settings } = useHealthStore()
  const macroMode = resolveMacroMode(settings.macroSplit)
  const dietTag   = getDietTag()
  const [showRules, setShowRules]      = useState(false)
  const [copyStatus, setCopyStatus]    = useState<string>("")

  const { meals, dayName } = getTomorrowMeals()

  // Empty state — no plan generated, or generated plan has no entries for
  // tomorrow's day. The MealPlanSync banner higher up the Today tab handles
  // the call-to-action ("Generate your meal plan"); here we render a quiet
  // placeholder so the user knows the section exists.
  if (meals.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-3">
        <div className="text-sm font-bold text-gray-900 mb-1">Tomorrow — {dayName}</div>
        <p className="text-xs text-gray-500 leading-snug">
          No plan generated yet. Use "Generate meal plan" above to create one.
        </p>
      </div>
    )
  }

  const totals      = computeDailyTotals(meals)
  const groceryList = computeGroceryList(meals)
  const rules       = getRulesForCook(macroMode, dietTag)
  const groceryText = formatGroceryForSharing(groceryList, dayName)
  const recipeText  = formatRecipesForSharing(meals, dayName)

  async function copyGrocery() {
    await shareOrCopy(groceryText, "Tomorrow's grocery list")
    setCopyStatus("Grocery list copied")
    setTimeout(() => setCopyStatus(""), 2500)
  }
  async function copyRecipes() {
    await shareOrCopy(recipeText, "Tomorrow's recipes")
    setCopyStatus("Recipes copied")
    setTimeout(() => setCopyStatus(""), 2500)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-3 space-y-3">
      {/* ── Header + totals ──────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-bold text-gray-900">Tomorrow — {dayName}</h3>
          <span className="text-[10px] text-gray-400">For the cook tonight</span>
        </div>
        <div className="flex gap-3 text-xs text-gray-600">
          <span><span className="font-semibold text-gray-900">{Math.round(totals.protein)}g</span> P</span>
          <span><span className="font-semibold text-gray-900">{Math.round(totals.carbs)}g</span> C</span>
          <span><span className="font-semibold text-gray-900">{Math.round(totals.fat)}g</span> F</span>
          <span><span className="font-semibold text-gray-900">{Math.round(totals.cal)}</span> kcal</span>
        </div>
      </div>

      {/* ── Meal cards (read-only) ───────────────────────────────────────── */}
      <div className="space-y-2">
        {meals.map((meal, i) => (
          <details key={meal.id ?? i} className="border border-gray-100 rounded-xl p-3 bg-gray-50">
            <summary className="cursor-pointer flex items-center justify-between text-sm">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 truncate">{meal.name}</div>
                <div className="text-[11px] text-gray-500">{meal.time}</div>
              </div>
              <div className="text-[11px] text-gray-600 ml-2 whitespace-nowrap">
                {Math.round(meal.protein)}P · {Math.round(meal.carbs)}C · {Math.round(meal.fat)}F · {Math.round(meal.cal)}kcal
              </div>
            </summary>
            {meal.ingredients?.length > 0 && (
              <div className="mt-2">
                <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Ingredients</div>
                <ul className="text-xs text-gray-700 space-y-0.5">
                  {meal.ingredients.map((ing, j) => <li key={j}>• {ing}</li>)}
                </ul>
              </div>
            )}
            {meal.steps?.length > 0 && (
              <div className="mt-2">
                <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Steps</div>
                <ol className="text-xs text-gray-700 space-y-0.5 list-decimal pl-4">
                  {meal.steps.map((step, j) => <li key={j}>{step}</li>)}
                </ol>
              </div>
            )}
          </details>
        ))}
      </div>

      {/* ── Grocery list ─────────────────────────────────────────────────── */}
      <div>
        <div className="text-xs font-semibold text-gray-700 mb-1">🛒 Grocery list</div>
        <ul className="text-xs text-gray-700 space-y-0.5 bg-amber-50 border border-amber-100 rounded-xl p-3">
          {groceryList.map((item, i) => (
            <li key={i}>
              {item.unparseable
                ? <span className="text-gray-600">• {item.name}</span>
                : <span>• <span className="font-medium">{item.totalQty}</span> {item.name}</span>}
            </li>
          ))}
        </ul>
      </div>

      {/* ── Send to Cook actions ─────────────────────────────────────────── */}
      <div>
        <div className="text-xs font-semibold text-gray-700 mb-1.5">📤 Send to cook</div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={copyGrocery}
            className="text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-xl">
            Copy grocery
          </button>
          <button onClick={() => openWhatsAppShare(groceryText)}
            className="text-xs font-semibold bg-green-100 hover:bg-green-200 text-green-800 py-2 rounded-xl">
            WhatsApp grocery
          </button>
          <button onClick={copyRecipes}
            className="text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-xl">
            Copy recipes
          </button>
          <button onClick={() => openWhatsAppShare(recipeText)}
            className="text-xs font-semibold bg-green-100 hover:bg-green-200 text-green-800 py-2 rounded-xl">
            WhatsApp recipes
          </button>
        </div>
        {copyStatus && (
          <div className="text-[11px] text-green-700 mt-1.5">✓ {copyStatus}</div>
        )}
      </div>

      {/* ── Rules for cook (collapsible) ─────────────────────────────────── */}
      <div>
        <button onClick={() => setShowRules(s => !s)}
          className="text-xs font-semibold text-gray-600 flex items-center gap-1">
          📋 Rules for cook
          <span className="text-gray-400">{showRules ? "▲" : "▼"}</span>
        </button>
        {showRules && (
          <ul className="text-xs text-gray-700 space-y-1 mt-2 bg-blue-50 border border-blue-100 rounded-xl p-3">
            {rules.map((rule, i) => <li key={i}>• {rule}</li>)}
          </ul>
        )}
      </div>
    </div>
  )
}
