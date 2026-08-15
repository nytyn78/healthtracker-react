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
import { generateWeekPlan, GeneratorTargets, deriveMealSchedule, resolveMealShape } from "./mealGenerator"
import { toDayMealPlanEntries } from "./transformer"
import type { MealPlanEntry } from "../store/useHealthStore"

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

export function getMealPlanTargetHash(
  targets: GeneratorTargets,
  shakePref: boolean = false,
  shapePref: string = "auto",
  splitPref: boolean = false,
): string {
  // Include the prefs that change plan OUTPUT, so toggling them regenerates the
  // plan (the hash drives MealPlanSync's out-of-sync detection). Macros alone
  // weren't enough — flipping the protein-shake or meal-shape toggle left the
  // hash unchanged and the plan stale.
  return `${targets.proteinG}-${targets.fatG}-${targets.carbsG}-${targets.calories}-sk${shakePref ? 1 : 0}-sh${shapePref}-sp${splitPref ? 1 : 0}`
}

function saveHash(hash: string) {
  try { localStorage.setItem(KEYS.MEAL_PLAN + "_target_hash", hash) } catch {}
}

// Build the growing-minor top-up note (meal-shape feature). Returns "" when the
// plan reaches target (no note needed), else a clear, non-deficit message
// telling a parent how much to add via a snack. Exported for testing.
const MINOR_SHORTFALL_TOLERANCE = 0.08  // within 8% of target = adequately fed
export function computeMinorTopupNote(
  weekResults: { validation: { computed: { calories: number } } }[],
  targetCalories: number,
): string {
  if (weekResults.length === 0) return ""
  const avgCal = weekResults.reduce((s, r) => s + r.validation.computed.calories, 0) / weekResults.length
  const shortfall = targetCalories - avgCal
  if (shortfall <= targetCalories * MINOR_SHORTFALL_TOLERANCE) return ""
  const gap = Math.round(shortfall / 10) * 10
  return `This plan provides about ${Math.round(avgCal)} of the ~${targetCalories} kcal a growing body needs each day. ` +
         `Add roughly ${gap} kcal as a snack — fruit, nuts, milk, curd, a paratha, or an egg. Don't skip it.`
}

// Build a protein-shortfall advisory (applies to ALL users, not just minors).
// Some realistic single-protein veg plans (notably RECOMPOSITION veg, where the
// target is high relative to what whole-food veg plates deliver) can't fully
// reach the protein target without an unrealistic double-protein plate. Rather
// than fake it with portion-stacking, we surface an honest suggestion to add a
// protein shake or curd. Only fires when the shortfall is LARGE (>15%) — small
// undershoots are within normal variation and don't warrant a nag.
const PROTEIN_SHORTFALL_THRESHOLD = 0.15
// Size an additive protein shake to close a day's protein gap. Whey = 25g
// protein/scoop, in 0.5-scoop steps (so small gaps aren't over-shot and the
// total can split into two half-scoops). Capped at 2 scoops. Returns 0 for a
// trivial gap (≤8g).
const WHEY_PROTEIN_PER_SCOOP = 25
export function shakeScoopsForGap(proteinGap: number): number {
  if (proteinGap <= 8) return 0
  const raw = Math.round((proteinGap / WHEY_PROTEIN_PER_SCOOP) * 2) / 2  // nearest 0.5
  return Math.min(2, Math.max(0.5, raw))
}

export function computeProteinShortfallNote(
  weekResults: { validation: { computed: { protein: number } } }[],
  targetProtein: number,
  diet: "veg" | "eggetarian" | "non-veg",
): string {
  if (weekResults.length === 0) return ""
  const avgProtein = weekResults.reduce((s, r) => s + r.validation.computed.protein, 0) / weekResults.length
  const shortfall = targetProtein - avgProtein
  if (shortfall <= targetProtein * PROTEIN_SHORTFALL_THRESHOLD) return ""
  const gap = Math.round(shortfall / 5) * 5
  const source = diet === "veg"
    ? "a soy/whey protein shake, extra curd, or tofu"
    : "a whey protein shake, an extra egg, or curd"
  return `This plan reaches about ${Math.round(avgProtein)}g of your ${targetProtein}g daily protein target. ` +
         `To close the remaining ~${gap}g, add ${source}.`
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
  // ── Meal shape (meal-shape feature) ───────────────────────────────────────
  // Non-fasting users get 3 meals (breakfast/lunch/dinner) by default; fasting
  // users keep 2 meals + shake. Growing minors (child/early teen) always get
  // 3 meals + a growth snack and are never placed in a fasting/2-meal shape.
  // A user override (settings.mealShape) can force two/three for non-minors.
  const isGrowingMinor = goalMode === "child" || goalMode === "teen_early"
  const override = settings.mealShape === "two" || settings.mealShape === "three"
    ? settings.mealShape : undefined
  const shape = resolveMealShape(ifp.fastingEnabled, isGrowingMinor, override)
  const threeMeal = shape === "three" || shape === "three_plus_snack"

  const schedule = deriveMealSchedule(ifp, {
    mainMealCount: threeMeal ? 3 : 2,
    includeShake:  threeMeal ? false : ifp.fastingEnabled,
  })

  try {
    const weekResults = generateWeekPlan(targets, diet, macroMode, schedule, shape)

    // Additive protein shake (user toggle). If on, append a whey shake to each
    // day sized to THAT day's protein gap (1-2 scoops), helping close the
    // shortfall the meals couldn't. Additive: it sits on top of the meals, so
    // it raises protein and calories — the UI surfaces the calorie effect.
    // A day already at/over protein target gets no shake (gap ≤ 8g → 0 scoops).
    if (settings.proteinShake) {
      for (const result of weekResults) {
        const dayProtein = result.validation.computed.protein
        const scoops = shakeScoopsForGap(targets.proteinG - dayProtein)
        if (scoops <= 0) continue
        if (settings.proteinShakeSplit && scoops >= 1) {
          // Two shakes (AM/PM), each half the total. Halves rounded to 0.5.
          const each = Math.round((scoops / 2) * 2) / 2
          result.plan.meals.push({ name: "Protein Shake (AM)", slot: "shake", time: "8:00 AM",
            recipeId: "WHEY_SHAKE", ingredients: [{ foodId: "WHEY" as any, quantity: each }] })
          result.plan.meals.push({ name: "Protein Shake (PM)", slot: "shake", time: "6:00 PM",
            recipeId: "WHEY_SHAKE", ingredients: [{ foodId: "WHEY" as any, quantity: scoops - each }] })
        } else {
          result.plan.meals.push({ name: "Protein Shake", slot: "shake", time: "4:00 PM",
            recipeId: "WHEY_SHAKE", ingredients: [{ foodId: "WHEY" as any, quantity: scoops }] })
        }
      }
    }

    // Flatten 7 days × N meals into a single MealPlanEntry[] with the day
    // label on each entry. This matches MealPlanSync's pre-14 behavior.
    const allEntries: MealPlanEntry[] = weekResults.flatMap((result, i) =>
      toDayMealPlanEntries(result.plan, {
        lang:    "en",
        dietTag: dietTag,
        day:     DAYS[i],
      })
    )

    saveMealPlan(allEntries)
    saveHash(getMealPlanTargetHash(targets, settings.proteinShake, settings.mealShape, settings.proteinShakeSplit))

    // ── Growing-minor calorie safety (meal-shape feature) ─────────────────────
    // A child/teen must never be silently under-fed. If the generated plan's
    // average day falls meaningfully short of their calorie target (the builders
    // cap at realistic portions), persist a clear top-up note so a parent adds
    // a snack — rather than presenting a deficit plan as complete. Never a
    // deficit *frame* (no "eat less"); always "add more".
    if (isGrowingMinor) {
      const note = computeMinorTopupNote(weekResults, targets.calories)
      try { localStorage.setItem(KEYS.MINOR_TOPUP_NOTE, note) } catch {}
    } else {
      try { localStorage.removeItem(KEYS.MINOR_TOPUP_NOTE) } catch {}
    }

    // ── Protein-shortfall advisory (all users) ────────────────────────────────
    // When realistic plates can't fully reach the protein target (e.g. veg
    // recomp), suggest a shake/curd top-up rather than faking it with a
    // double-protein plate. Only fires for a large (>15%) shortfall. If the
    // user's protein-shake toggle is on, the shake protein is already in each
    // day's plan (added above) and counted by validation, so the advisory
    // naturally clears once the shake closes the gap; it still fires if the
    // shake (capped at 2 scoops) wasn't enough.
    const proteinResults = settings.proteinShake
      ? weekResults.map(r => ({
          validation: { computed: { protein:
            r.plan.meals.reduce((sum, m) => sum +
              (m.recipeId === "WHEY_SHAKE"
                ? m.ingredients.reduce((s, i) => s + (i.foodId === "WHEY" ? Number(i.quantity) * 25 : 0), 0)
                : 0), r.validation.computed.protein) } } }))
      : weekResults
    const proteinNote = computeProteinShortfallNote(proteinResults, targets.proteinG, diet)
    try {
      if (proteinNote) localStorage.setItem(KEYS.PROTEIN_ADVISORY, proteinNote)
      else localStorage.removeItem(KEYS.PROTEIN_ADVISORY)
    } catch {}
    return true
  } catch (e) {
    // Generator threw — log and let caller fall back to preset.
    console.error("Meal plan generation failed:", e)
    return false
  }
}
