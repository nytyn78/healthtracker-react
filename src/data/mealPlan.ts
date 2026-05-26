// ── src/data/mealPlan.ts ──────────────────────────────────────────────────────
// Day-name utility.
//
// History: this file previously also contained a hardcoded 7-day Hindi-bilingual
// keto meal rotation (KETO_PLAN) and a getTodayPlan() helper that returned
// today's entry from it. That content was displayed to every user — regardless
// of macro mode, diet, or whether they had generated a personalised plan —
// which silently substituted keto content for balanced/low-carb/recomp/
// maintenance users with empty meal plans.
//
// The keto rotation has been removed. Meal-plan content now comes exclusively
// from the user's generated/imported plan via loadMealPlan(). Users without
// a generated plan see an empty list (and the "Generate your meal plan"
// prompt from MealPlanSync), which is the honest state.
//
// Only getDayName() remains here — a small date utility that didn't depend
// on the keto data.

export function getDayName(offset = 0): string {
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return days[d.getDay()]
}
