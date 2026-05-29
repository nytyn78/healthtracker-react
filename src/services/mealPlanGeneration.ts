// ── mealPlanGeneration.ts ─────────────────────────────────────────────────────
// Shared meal-plan generation helper used by:
//   - MealPlanSync (the explicit "Generate" button on the dashboard)
//   - Onboarding's complete() handler (auto-generate on sign-up, commit 14)
//
// Extracted in commit 14 so both call sites produce the same plan from the
// same logic. Pre-14, MealPlanSync had this logic inline and Onboarding
// silently wrote static presets — meaning new users never saw generator
// output until they manually pressed "Generate".

import { useHealthStore, saveMealPlan, DietTag } from "../store/useHealthStore"
import { KEYS } from "./storageKeys"
import { computeMacros, resolveMacroMode } from "./adaptiveTDEE"
import { loadGoalMode } from "./goalModeConfig"
import { generateWeekPlan, GeneratorTargets, deriveMealSchedule } from "./mealGenerator"
import { toDayMealPlanEntries } from "./transformer"
import type { MealPlanEntry } from "../store/useHealthStore"

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

function getMealPlanTargetHash(targets: GeneratorTargets): string {
  return `${targets.proteinG}-${targets.fatG}-${targets.carbsG}-${targets.calories}`
}

function saveHash(hash: string) {
  try { localStorage.setItem(KEYS.MEAL_PLAN + "_target_hash", hash) } catch {}
}

/**
 * Generate a 7-day meal plan from the user's CURRENT store state and save it.
 *
 * Reads profile/goals/settings via useHealthStore.getState() — NOT from React
 * closure props — so it sees the freshest values even when called immediately
 * after a sequence of store updates (e.g. inside an onboarding complete()
 * handler that has just patched profile, goals, and dietConfig).
 *
 * @param dietTag  the user's diet preference (veg / eggetarian / non_veg).
 *                 Passed in rather than re-derived because onboarding may
 *                 already have it in scope from the screen the user just
 *                 completed; MealPlanSync passes its derived value too.
 * @returns true if a plan was generated and saved; false if computeMacros
 *          couldn't produce targets (missing profile data) — caller should
 *          fall back to a preset or skip.
 */
export function autoGenerateAndSaveMealPlan(dietTag: DietTag): boolean {
  // Read fresh state — bypasses any stale React closures.
  const { profile, goals, settings } = useHealthStore.getState()
  const goalMode = loadGoalMode()

  const computed = computeMacros(profile, goals, settings, goalMode)
  if (!computed) {
    // Can't compute targets — caller should use a static preset instead.
    return false
  }

  const targets: GeneratorTargets = {
    proteinG: computed.proteinG,
    fatG:     computed.fatG,
    carbsG:   computed.carbsG,
    calories: computed.targetCalories,
  }

  // Map stored diet tag to generator's diet enum.
  const diet =
    dietTag === "non_veg"    ? "non-veg"    :
    dietTag === "eggetarian" ? "eggetarian" :
                               "veg"

  const macroMode = resolveMacroMode(settings.macroSplit)

  // ── Meal schedule from the user's IF settings (commit 11.4) ───────────────
  // Pre-11.4 the generator baked in a 19:5 schedule (2 PM / 4:30 PM / 6:30 PM)
  // for everyone. Now meal times come from the user's actual IFProtocol: an
  // IF user keeps a compressed eating window, a non-IF user (maintenance,
  // geriatric) gets meals spread across a normal day. The whey shake is kept
  // for fasting users (it fits the compressed window and the protein target
  // assumes it) and dropped for non-fasting users, who get that protein
  // redistributed into their main meals instead.
  const ifp = settings.ifProtocol
  const schedule = deriveMealSchedule(ifp, { includeShake: ifp.fastingEnabled })

  try {
    const weekResults = generateWeekPlan(targets, diet, macroMode, schedule)

    // Flatten 7 days × 3 meals into a single MealPlanEntry[] with the day
    // label on each entry. This matches MealPlanSync's pre-14 behavior.
    const allEntries: MealPlanEntry[] = weekResults.flatMap((result, i) =>
      toDayMealPlanEntries(result.plan, {
        lang:    "en",
        dietTag: dietTag,
        day:     DAYS[i],
      })
    )

    saveMealPlan(allEntries)
    saveHash(getMealPlanTargetHash(targets))
    return true
  } catch (e) {
    // Generator threw — log and let caller fall back to preset.
    console.error("Meal plan generation failed:", e)
    return false
  }
}
