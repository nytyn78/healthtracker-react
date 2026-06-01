// ── mealSwap.ts ───────────────────────────────────────────────────────────────
// Swap-as-substitution (commit 13).
//
// MODEL: the canonical weekly plan in KEYS.MEAL_PLAN is NEVER mutated. A "swap"
// writes a per-date, per-slot override to KEYS.MEAL_SWAP(date). The UI overlays
// overrides on the canonical plan at render time via getEffectiveMeals().
//
// This mirrors the old single-file app's swappedM0 / swappedM1 / tmrSwappedM0 /
// tmrSwappedM1 date-stamped localStorage keys — substitution, not true swap.
//
// SLOT IDENTITY: a slot is the POSITIONAL INDEX of a meal within its day's
// time-sorted list (Meal 1 = 0, Meal 2 = 1, shake = ...). NOT the entry `id`.
// Rationale: a swap means "in this time-of-day slot, use a different day's
// meal" — it's about position, not entity identity. Keying by id would break
// the instant the plan regenerates (ids change); keying by index survives it.
//
// EXPIRY: keys are date-stamped, so expiry is automatic — a new day reads a
// new (empty) key. pruneSwaps() sweeps stale keys (older than yesterday) on
// app load so localStorage doesn't grow unbounded.

import { KEYS, MEAL_SWAP_KEY_PREFIX } from "./storageKeys"
import { loadMealPlan, MealPlanEntry, DietTag } from "../store/useHealthStore"

// ── Types ─────────────────────────────────────────────────────────────────────

// slot index → the substituted meal. A full MealPlanEntry snapshot is stored
// (not a reference/id) so the override survives a plan regeneration.
export type SwapMap = Record<number, MealPlanEntry>

// ── Day filtering + slot ordering ─────────────────────────────────────────────
// Kept local (and identical in spirit to tomorrowPlan.getTomorrowMeals) so slot
// indices computed here match what the UI renders. If the sort ever diverges,
// swaps would target the wrong slot — so this is the single ordering authority.

function parseTimeForSort(time: string): number {
  // "2:00 PM", "8:30 AM", "10 AM" → minutes since midnight. Unparseable → end.
  const m = time.match(/(\d+)(?::(\d+))?\s*(AM|PM)?/i)
  if (!m) return 9999
  let h = parseInt(m[1], 10)
  const min = m[2] ? parseInt(m[2], 10) : 0
  const ampm = m[3]?.toUpperCase()
  if (ampm === "PM" && h < 12) h += 12
  if (ampm === "AM" && h === 12) h = 0
  return h * 60 + min
}

/**
 * Canonical meals for a given day name, time-sorted. Entries with no day stamp
 * are universal (appear every day). The returned array's index IS the slot
 * index used by swaps.
 */
export function getCanonicalDayMeals(dayName: string): MealPlanEntry[] {
  const plan = loadMealPlan()
  const meals = plan.filter(
    e => !e.day || e.day.toLowerCase() === dayName.toLowerCase()
  )
  meals.sort((a, b) => parseTimeForSort(a.time) - parseTimeForSort(b.time))
  return meals
}

// ── Load / save / clear ───────────────────────────────────────────────────────

export function loadSwaps(date: string): SwapMap {
  try {
    return JSON.parse(localStorage.getItem(KEYS.MEAL_SWAP(date)) || "{}")
  } catch {
    return {}
  }
}

function persist(date: string, map: SwapMap): void {
  try {
    if (Object.keys(map).length === 0) {
      // Empty map → remove the key entirely rather than store "{}".
      localStorage.removeItem(KEYS.MEAL_SWAP(date))
    } else {
      localStorage.setItem(KEYS.MEAL_SWAP(date), JSON.stringify(map))
    }
  } catch {}
}

/** Record a substitution: on `date`, slot `slotIndex` becomes `meal`. */
export function saveSwap(date: string, slotIndex: number, meal: MealPlanEntry): void {
  const map = loadSwaps(date)
  map[slotIndex] = meal
  persist(date, map)
}

/** Undo a single slot's substitution, reverting it to the canonical meal. */
export function clearSwap(date: string, slotIndex: number): void {
  const map = loadSwaps(date)
  delete map[slotIndex]
  persist(date, map)
}

/** True if the given slot is currently substituted (drives the SWAPPED badge). */
export function isSwapped(date: string, slotIndex: number): boolean {
  return slotIndex in loadSwaps(date)
}

// ── Effective meals (canonical + overrides) ────────────────────────────────────

/**
 * The meals the UI should actually render for `date` / `dayName`: the canonical
 * day plan with any per-slot overrides applied. Both TodayTab and
 * TomorrowSection route through this so a swapped slot shows everywhere.
 */
export function getEffectiveMeals(date: string, dayName: string): MealPlanEntry[] {
  const canonical = getCanonicalDayMeals(dayName)
  const swaps = loadSwaps(date)
  return canonical.map((meal, i) => swaps[i] ?? meal)
}

// ── Swap candidates ─────────────────────────────────────────────────────────────

const DAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
]

/**
 * Candidate meals offered in the swap picker for a given slot: every OTHER
 * day's meal occupying the same slot index, filtered to the user's diet tag.
 *
 * Matches the old app's "other days' meals in the same slot" pool (~6 options
 * for a 7-day plan). Pulls only from the canonical plan — no recipe-registry
 * browsing — so the user only ever sees meals they've already vetted via the
 * generated plan.
 *
 * dietTag filter is defensive: a generated plan is already single-diet, but if
 * the plan was regenerated after a diet change, stale entries are excluded so a
 * veg user is never offered chicken.
 */
export function getSwapCandidates(
  currentDayName: string,
  slotIndex: number,
  dietTag: DietTag,
): MealPlanEntry[] {
  const candidates: MealPlanEntry[] = []
  for (const dayName of DAY_NAMES) {
    if (dayName.toLowerCase() === currentDayName.toLowerCase()) continue
    const dayMeals = getCanonicalDayMeals(dayName)
    const meal = dayMeals[slotIndex]
    if (!meal) continue
    if (meal.tag !== dietTag) continue
    candidates.push(meal)
  }
  // De-duplicate by name+time — a 7-day plan often repeats the same breakfast,
  // so the picker shouldn't show "Paneer Bhurji" six times.
  const seen = new Set<string>()
  return candidates.filter(m => {
    const key = `${m.name}|${m.time}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ── Prune ───────────────────────────────────────────────────────────────────────

/**
 * Deletes date-stamped swap keys older than `keepFrom` (default: yesterday
 * relative to `today`). Called once on app load. Keeps today's and tomorrow's
 * swaps; drops everything stale so localStorage doesn't accumulate dead keys.
 *
 * `today` is passed in (not read from a clock) so this is pure and testable.
 */
export function pruneSwaps(today: string): void {
  // keepFrom = yesterday. Anything strictly before it is stale.
  const keepFrom = shiftDate(today, -1)
  try {
    const toRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith(MEAL_SWAP_KEY_PREFIX)) continue
      const date = key.slice(MEAL_SWAP_KEY_PREFIX.length)
      // Lexicographic compare is correct for YYYY-MM-DD.
      if (date < keepFrom) toRemove.push(key)
    }
    for (const key of toRemove) localStorage.removeItem(key)
  } catch {}
}

/** Shift a YYYY-MM-DD date by `days` (can be negative). Returns YYYY-MM-DD. */
function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(n => parseInt(n, 10))
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, "0")
  const dd = String(dt.getDate()).padStart(2, "0")
  return `${yy}-${mm}-${dd}`
}

// ── Replace a meal with a protein shake ─────────────────────────────────────
// When a user can't or won't eat a planned meal, they can replace it with a
// fixed 1-scoop whey shake (25g protein, ~120 kcal). The shake covers part of
// the meal's protein; the rest of the meal's protein/calories are handled by
// the user's chosen mode:
//   "redistribute" — grow the REMAINING meals to recover the skipped meal's
//                    protein and calories (minus what the shake provides), so
//                    the day still hits its targets. Capped so no meal becomes
//                    a brick.
//   "lighter"      — leave the remaining meals as-is; the day simply runs
//                    lighter. Honest, fine for a deficit; the caller surfaces
//                    how much lighter so the user can add a snack if they want.
//
// Pure function (no localStorage) so it's unit-testable. Returns the adjusted
// full day plus a summary of the change for the UI to display.

const SHAKE_PROTEIN = 25
const SHAKE_CAL = 120
const SHAKE_FAT = 1
const SHAKE_CARB = 2
// Don't let a redistributed meal balloon: cap any single meal's growth at +60%.
const REDISTRIBUTE_MAX_GROWTH = 1.6

export type ReplaceMode = "redistribute" | "lighter"

export interface ReplaceWithShakeResult {
  meals: MealPlanEntry[]          // the adjusted full day (shake included)
  caloriesLighterBy: number       // 0 for redistribute; >0 for lighter
  proteinShortBy: number          // remaining protein gap after the change
  note: string                    // human summary for the UI
}

function makeShakeEntry(dayName: string, time: string, tag: DietTag): MealPlanEntry {
  return {
    id: `shake-${dayName}-${time}`.replace(/\s+/g, ""),
    name: "Protein Shake",
    time,
    protein: SHAKE_PROTEIN, carbs: SHAKE_CARB, fat: SHAKE_FAT, cal: SHAKE_CAL,
    tag,
    ingredients: ["1 scoop whey protein", "water or milk"],
    steps: ["Blend 1 scoop whey with water or milk."],
  }
}

export function replaceMealWithShake(
  dayMeals: MealPlanEntry[],
  skipIndex: number,
  mode: ReplaceMode,
  dayName: string = "",
): ReplaceWithShakeResult {
  const skipped = dayMeals[skipIndex]
  if (!skipped) {
    return { meals: dayMeals, caloriesLighterBy: 0, proteinShortBy: 0, note: "" }
  }
  const shake = makeShakeEntry(dayName, skipped.time, skipped.tag)
  const others = dayMeals.filter((_, i) => i !== skipIndex)

  // Protein/calories the shake does NOT cover relative to the skipped meal.
  const proteinGap = Math.max(skipped.protein - SHAKE_PROTEIN, 0)
  const calGap     = Math.max(skipped.cal - SHAKE_CAL, 0)

  if (mode === "lighter") {
    // Keep other meals; the day just runs lighter by the uncovered calories.
    const meals = [...others, shake].sort(
      (a, b) => parseTimeForSort(a.time) - parseTimeForSort(b.time))
    const note = calGap > 0
      ? `Replaced ${skipped.name} with a protein shake. Today runs about ${Math.round(calGap)} kcal lighter — fine for a fat-loss day, or add a small snack if you're hungry.`
      : `Replaced ${skipped.name} with a protein shake.`
    return { meals, caloriesLighterBy: Math.round(calGap), proteinShortBy: Math.round(proteinGap), note }
  }

  // redistribute — scale the remaining meals up to recover the gap, capped.
  const otherCalTotal = others.reduce((s, m) => s + m.cal, 0)
  let appliedCal = 0, appliedProtein = 0
  const grown = others.map(m => {
    if (otherCalTotal <= 0) return m
    const share = m.cal / otherCalTotal           // proportional to meal size
    const rawFactor = 1 + (calGap * share) / m.cal
    const factor = Math.min(rawFactor, REDISTRIBUTE_MAX_GROWTH)
    appliedCal     += m.cal * (factor - 1)
    appliedProtein += m.protein * (factor - 1)
    return {
      ...m,
      protein: Math.round(m.protein * factor),
      carbs:   Math.round(m.carbs * factor),
      netCarbs: m.netCarbs != null ? Math.round(m.netCarbs * factor) : undefined,
      fat:     Math.round(m.fat * factor),
      cal:     Math.round(m.cal * factor),
      ingredients: m.ingredients.map(scaleIngredientText(factor)),
    }
  })
  const meals = [...grown, shake].sort(
    (a, b) => parseTimeForSort(a.time) - parseTimeForSort(b.time))
  // If the cap prevented full recovery, the day is still a bit light/short.
  const calStillShort = Math.max(calGap - appliedCal, 0)
  const proteinStillShort = Math.max(proteinGap - appliedProtein, 0)
  const note = calStillShort > 50
    ? `Replaced ${skipped.name} with a protein shake and grew the other meals. They couldn't fully absorb it, so the day is about ${Math.round(calStillShort)} kcal lighter.`
    : `Replaced ${skipped.name} with a protein shake; the other meals were grown to keep your day on target.`
  return {
    meals,
    caloriesLighterBy: Math.round(calStillShort),
    proteinShortBy: Math.round(proteinStillShort),
    note,
  }
}

// Scale the leading gram quantity in an ingredient string ("45g Toor Dal" →
// "59g Toor Dal"). Leaves non-gram lines ("1 scoop whey") untouched.
function scaleIngredientText(factor: number): (line: string) => string {
  return (line: string) => line.replace(/^(\d+(?:\.\d+)?)\s*g\b/, (_, n) =>
    `${Math.round(parseFloat(n) * factor)}g`)
}
