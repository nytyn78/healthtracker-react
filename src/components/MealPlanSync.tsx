/**
 * MealPlanSync.tsx
 * Shows when the meal plan is out of sync with current macro targets,
 * and lets the user regenerate it with one tap.
 *
 * Displayed at the top of MealPlanBuilder and on the Today tab meal section.
 *
 * Fix: description text now reads actual diet tag and macro split label
 * instead of hardcoded "eggetarian keto".
 */

import { useState } from "react"
import { computeMacros } from "../services/adaptiveTDEE"
import { useHealthStore, saveMealPlan, MealPlanEntry } from "../store/useHealthStore"
import { generateWeekPlan, GeneratorTargets } from "../services/mealGenerator"
import { toDayMealPlanEntries } from "../services/transformer"
import { loadGoalMode } from "../services/goalModeConfig"
import { KEYS } from "../services/storageKeys"

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]

function getDietTag() {
  try {
    const cfg = JSON.parse(localStorage.getItem(KEYS.DIET_CONFIG) || "{}")
    return cfg.tag || "eggetarian"
  } catch { return "eggetarian" }
}

// Human-readable diet label from stored tag
function getDietLabel(tag: string): string {
  switch (tag) {
    case "veg":        return "vegetarian"
    case "eggetarian": return "eggetarian"
    case "non_veg":    return "non-veg"
    default:           return "eggetarian"
  }
}

// Derive macro split label from stored percentages
function getMacroSplitLabel(macroSplit: { fatPct: number; proteinPct: number; carbsPct: number }): string {
  if (macroSplit.carbsPct <= 10) return "keto"
  if (macroSplit.carbsPct <= 25) return "low-carb"
  if (macroSplit.proteinPct >= 35) return "high-protein"
  return "balanced"
}

function getMealPlanTargetHash(targets: GeneratorTargets): string {
  return `${targets.proteinG}-${targets.fatG}-${targets.carbsG}-${targets.calories}`
}

function getSavedHash(): string {
  try { return localStorage.getItem(KEYS.MEAL_PLAN + "_target_hash") || "" } catch { return "" }
}

function saveHash(hash: string) {
  try { localStorage.setItem(KEYS.MEAL_PLAN + "_target_hash", hash) } catch {}
}

interface Props {
  onRegenerated?: () => void
  compact?: boolean
}

export default function MealPlanSync({ onRegenerated, compact = false }: Props) {
  const { profile, goals, settings } = useHealthStore()
  const [generating, setGenerating] = useState(false)
  const [justDone, setJustDone]     = useState(false)

  const computed = computeMacros(profile, goals, settings)
  if (!computed) return null

  const targets: GeneratorTargets = {
    proteinG:  computed.proteinG,
    fatG:      computed.fatG,
    carbsG:    computed.carbsG,
    calories:  computed.targetCalories,
  }

  const currentHash = getMealPlanTargetHash(targets)
  const savedHash   = getSavedHash()
  const isOutOfSync = savedHash !== currentHash && savedHash !== ""
  const neverGenerated = savedHash === ""

  // Derive labels for description text
  const dietTag    = getDietTag()
  const dietLabel  = getDietLabel(dietTag)
  const macroLabel = getMacroSplitLabel(settings.macroSplit)

  function regenerate() {
    setGenerating(true)
    try {
      // Map stored diet tag to generator diet type
      // non_veg → "non-veg", everything else → "eggetarian" (eggs+dairy allowed)
      const diet = (dietTag === "non_veg" ? "non-veg" : "eggetarian") as any
      const weekResults = generateWeekPlan(targets, diet)

      // Convert each day to MealPlanEntry[] and flatten
      const allEntries: MealPlanEntry[] = weekResults.flatMap((result, i) =>
        toDayMealPlanEntries(result.plan, {
          lang:    "en",
          dietTag: dietTag as any,
          day:     DAYS[i],
        })
      )

      saveMealPlan(allEntries)
      saveHash(currentHash)
      setJustDone(true)
      setTimeout(() => setJustDone(false), 3000)
      onRegenerated?.()
    } catch (e) {
      console.error("Meal plan generation failed:", e)
    }
    setGenerating(false)
  }

  if (justDone) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-3 flex items-center gap-2">
        <span className="text-green-600">✓</span>
        <span className="text-xs font-semibold text-green-700">
          Meal plan updated to match your current targets
        </span>
      </div>
    )
  }

  if (neverGenerated) {
    return (
      <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 mb-3">
        <div className="text-xs font-bold text-teal-800 mb-1">🍽 Generate your meal plan</div>
        <p className="text-xs text-teal-700 mb-2 leading-snug">
          Generate a 7-day {dietLabel} {macroLabel} meal plan matched to your targets —{" "}
          {targets.proteinG}g protein · {targets.fatG}g fat · {targets.carbsG}g carbs · {targets.calories} kcal/day
        </p>
        <button onClick={regenerate} disabled={generating}
          className="w-full py-2.5 bg-teal-600 text-white rounded-xl text-sm font-bold disabled:opacity-50">
          {generating ? "Generating…" : "Generate meal plan"}
        </button>
      </div>
    )
  }

  if (isOutOfSync) {
    if (compact) {
      return (
        <button onClick={regenerate} disabled={generating}
          className="w-full bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-2 flex items-center justify-between">
          <span className="text-xs text-amber-700 font-semibold">
            ⚠️ Meal plan doesn't match current targets
          </span>
          <span className="text-xs text-amber-600 font-bold underline">
            {generating ? "…" : "Update"}
          </span>
        </button>
      )
    }

    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
        <div className="text-xs font-bold text-amber-800 mb-1">⚠️ Meal plan out of sync</div>
        <p className="text-xs text-amber-700 mb-2 leading-snug">
          Your macro targets have changed. The current meal plan was built for different targets.
          Regenerate to match: {targets.proteinG}g protein · {targets.fatG}g fat · {targets.calories} kcal
        </p>
        <button onClick={regenerate} disabled={generating}
          className="w-full py-2.5 bg-amber-600 text-white rounded-xl text-sm font-bold disabled:opacity-50">
          {generating ? "Updating…" : "Update meal plan"}
        </button>
      </div>
    )
  }

  return null
}
