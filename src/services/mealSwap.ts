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
