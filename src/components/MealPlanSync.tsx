/**
 * MealPlanSync.tsx
 * Shows when the meal plan is out of sync with current macro targets,
 * and lets the user regenerate it with one tap.
 *
 * Displayed at the top of MealPlanBuilder and on the Today tab meal section.
 */

import { useState } from "react"
import { computeMacros, resolveMacroMode } from "../services/adaptiveTDEE"
import { useHealthStore, saveMealPlan, MealPlanEntry, DietTag, DIET_TAG_LABELS } from "../store/useHealthStore"
import { generateWeekPlan, GeneratorTargets } from "../services/mealGenerator"
import { toDayMealPlanEntries } from "../services/transformer"
import { loadGoalMode } from "../services/goalModeConfig"
import { KEYS } from "../services/storageKeys"

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]

// ── Diet tag resolution ──────────────────────────────────────────────────────
// Reads the user's chosen dietary tag from storage. Defaults to "veg" (was
// previously "eggetarian" — that default caused the long-running "eggetarian
// keto" label bug for vegetarian users who never explicitly picked a tag).
function getDietTag(): DietTag {
  try {
    const cfg = JSON.parse(localStorage.getItem(KEYS.DIET_CONFIG) || "{}")
    // Reject empty / falsy / unknown values; fall back to safe default
    if (cfg.tag === "veg" || cfg.tag === "eggetarian" || cfg.tag === "non_veg") return cfg.tag
    return "veg"
  } catch { return "veg" }
}

// ── Macro mode label resolution ──────────────────────────────────────────────
// Mirrors the resolveMacroMode logic in adaptiveTDEE.ts. We re-derive the mode
// from the user's actual settings.macroSplit so the label NEVER contradicts the
// engine output. This is what fixes the "balanced selected, label says keto" bug.
function resolveMacroModeLabel(macroSplit: { fatPct: number; proteinPct: number; carbsPct: number }): string {
  const { carbsPct, proteinPct } = macroSplit
  if (carbsPct <= 10)                                        return "keto"
  if (carbsPct <= 20)                                        return "very low-carb"
  if (proteinPct >= 40)                                      return "high-protein"
  if (proteinPct >= 30 && carbsPct >= 20 && carbsPct <= 40)  return "recomposition"
  if (carbsPct <= 35)                                        return "low-carb"
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

  // ── Goal-mode aware macro computation ─────────────────────────────────────
  // Reads the user's goal mode (fat_loss, breastfeeding, pregnancy_t2, etc.)
  // so that maternal calorie surplus and other mode-specific adjustments
  // are applied correctly. Previously this call omitted goalMode, silently
  // under-prescribing calories for breastfeeding and pregnant users.
  const goalMode = loadGoalMode()
  const computed = computeMacros(profile, goals, settings, goalMode)
  if (!computed) return null

  const targets: GeneratorTargets = {
    proteinG:  computed.proteinG,
    fatG:      computed.fatG,
    carbsG:    computed.carbsG,
    calories:  computed.targetCalories,
  }

  // ── Dynamic label assembly ─────────────────────────────────────────────────
  // Both the diet tag (veg/eggetarian/non_veg) and macro mode label are derived
  // from the user's actual current state — NOT hardcoded. This ensures the
  // header text always matches the macros being prescribed below it.
  const dietTag    = getDietTag()
  const macroLabel = resolveMacroModeLabel(settings.macroSplit)
  const dietTagLabel = DIET_TAG_LABELS[dietTag].toLowerCase()

  const currentHash = getMealPlanTargetHash(targets)
  const savedHash   = getSavedHash()
  const isOutOfSync = savedHash !== currentHash && savedHash !== ""
  const neverGenerated = savedHash === ""

  function regenerate() {
    setGenerating(true)
    try {
      // Map stored diet tag to generator's expected diet type.
      // The generator currently only supports "non-veg" and "eggetarian" branches
      // (no pure vegetarian branch yet). For vegetarian users we'd ideally want
      // a pure-veg branch — flagged for a future iteration. For now, vegetarian
      // users get the eggetarian branch but their actual logged meals respect
      // the dietTag stored on each entry.
      // TODO(meal-generator): add a pure-veg branch that excludes egg ingredients
      //                       (commit 11.1 — already on the pending list).
      const diet = (dietTag === "non_veg" ? "non-veg" : "eggetarian") as any
      // Macro mode is derived from settings.macroSplit at call time — same
      // resolution used by the engine, so validator + generator agree.
      // Pre-11.0 the generator forced "keto" inside validateNutrition; now
      // the user's actual mode flows through.
      const macroMode = resolveMacroMode(settings.macroSplit)
      const weekResults = generateWeekPlan(targets, diet, macroMode)

      // Convert each day to MealPlanEntry[] and flatten
      const allEntries: MealPlanEntry[] = weekResults.flatMap((result, i) =>
        toDayMealPlanEntries(result.plan, {
          lang:    "en",
          dietTag: dietTag,
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
          Generate a 7-day {dietTagLabel} {macroLabel} meal plan matched to your targets —
          {' '}{targets.proteinG}g protein · {targets.fatG}g fat · {targets.carbsG}g carbs · {targets.calories} kcal/day
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
          {generating ? "Regenerating…" : "Update meal plan to match targets"}
        </button>
      </div>
    )
  }

  return null  // In sync — show nothing
}
