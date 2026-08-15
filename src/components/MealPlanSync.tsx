/**
 * MealPlanSync.tsx
 * Shows when the meal plan is out of sync with current macro targets,
 * and lets the user regenerate it with one tap.
 *
 * Displayed at the top of MealPlanBuilder and on the Today tab meal section.
 *
 * Fix (this pass): regenerate() now delegates to autoGenerateAndSaveMealPlan()
 * — the shared orchestration in mealPlanGeneration.ts — instead of calling
 * generateWeekPlan(targets, diet) directly with only 2 arguments. The direct
 * call silently used the function's defaults for every other parameter
 * (macroMode="KETO", schedule=LEGACY_IF_SCHEDULE 2-meal times, shape=
 * "two_plus_shake"), so EVERY user got a keto-shaped 2-meal+shake plan
 * regardless of their actual diet/macro-split/IF settings. This is what
 * produced mismatched meal times and diet-mode-mismatched dishes in
 * practice. autoGenerateAndSaveMealPlan derives macroMode from the user's
 * real macroSplit, the schedule from their real IF protocol, and the shape
 * from fasting/minor status — and already includes its own additive
 * protein-shake mechanism (settings.proteinShake), so this component no
 * longer needs (or should have) any shake logic of its own.
 *
 * computeMacros() here now also passes goalMode — previously omitted, which
 * meant maintenance/pregnancy/child users saw a deficit-shaped calorie
 * target in this card even though their actual targets (used for meal
 * generation) were correctly zero-deficit / surplus via mealPlanGeneration.
 */

import { useState } from "react"
import { computeMacros } from "../services/adaptiveTDEE"
import { useHealthStore } from "../store/useHealthStore"
import { GeneratorTargets } from "../services/mealGenerator"
import { autoGenerateAndSaveMealPlan, getMealPlanTargetHash } from "../services/mealPlanGeneration"
import { loadGoalMode } from "../services/goalModeConfig"
import { KEYS } from "../services/storageKeys"
import type { DietTag } from "../store/useHealthStore"

function getDietTag(): DietTag {
  try {
    const cfg = JSON.parse(localStorage.getItem(KEYS.DIET_CONFIG) || "{}")
    return (cfg.tag as DietTag) || "eggetarian"
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
  if (macroSplit.carbsPct <= 5)  return "keto"
  if (macroSplit.carbsPct <= 25) return "low-carb"
  if (macroSplit.proteinPct >= 35) return "high-protein"
  return "balanced"
}

function getSavedHash(): string {
  try { return localStorage.getItem(KEYS.MEAL_PLAN + "_target_hash") || "" } catch { return "" }
}

interface Props {
  onRegenerated?: () => void
  compact?: boolean
}

export default function MealPlanSync({ onRegenerated, compact = false }: Props) {
  const { profile, goals, settings } = useHealthStore()
  const [generating, setGenerating] = useState(false)
  const [justDone, setJustDone]     = useState(false)
  const [failed, setFailed]         = useState(false)

  const goalMode = loadGoalMode()
  const computed = computeMacros(profile, goals, settings, goalMode)
  if (!computed) return null

  const targets: GeneratorTargets = {
    proteinG:  computed.proteinG,
    fatG:      computed.fatG,
    carbsG:    computed.carbsG,
    calories:  computed.targetCalories,
  }

  const currentHash = getMealPlanTargetHash(
    targets, settings.proteinShake, settings.mealShape, settings.proteinShakeSplit
  )
  const savedHash   = getSavedHash()
  const isOutOfSync = savedHash !== currentHash && savedHash !== ""
  const neverGenerated = savedHash === ""

  // Derive labels for description text
  const dietTag    = getDietTag()
  const dietLabel  = getDietLabel(dietTag)
  const macroLabel = getMacroSplitLabel(settings.macroSplit)

  function regenerate() {
    setGenerating(true)
    setFailed(false)
    const ok = autoGenerateAndSaveMealPlan(dietTag)
    if (ok) {
      setJustDone(true)
      setTimeout(() => setJustDone(false), 3000)
      onRegenerated?.()
    } else {
      setFailed(true)
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
        {failed && (
          <p className="text-[11px] text-red-500 mt-2">
            Couldn't generate a plan — check your profile is complete (age, height, weight) in Settings.
          </p>
        )}
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
        {failed && (
          <p className="text-[11px] text-red-500 mt-2">
            Couldn't update the plan — check your profile is complete in Settings.
          </p>
        )}
      </div>
    )
  }

  return null
}
