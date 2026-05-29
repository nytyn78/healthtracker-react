// ── mealSchedule.ts ─────────────────────────────────────────────────────────────
// Commit 11.4 — Meal-count + IF decoupling.
//
// PROBLEM this solves:
// Pre-11.4, mealGenerator hardcoded the day shape to 2 meals + a shake at
// fixed clock times (2:00 PM / 4:30 PM / 6:30 PM). That is a 19:5 IF schedule
// baked into the generator. A non-IF family member (e.g. a 77F on
// Balanced/maintenance with fasting OFF) still received three items crammed
// into the afternoon, ignoring that they eat breakfast.
//
// This module is the single source of truth for WHEN meals happen and WHETHER
// a shake is included. It is pure, deterministic, and unit-testable. It reads
// the user's IFProtocol (the same one the FastingTimer + Settings already use)
// and turns it into concrete meal times.
//
// WHAT THIS MODULE DOES NOT DO (deliberate scope boundary for 11.4):
//   - It does not change the NUMBER of main meals beyond 2. The MealSlot
//     vocabulary (primary | secondary | shake) supports exactly two main
//     meals plus a shake, and the per-meal macro split in mealGenerator
//     assumes a two-way primary/secondary division of the daily target.
//     Supporting 3+ main meals requires (a) a new MealSlot value and (b)
//     an N-way macro split — a genuine feature expansion deferred to a
//     later commit. The MealSchedule.mealTimes array is sized for that
//     future (it can hold N times), but generateDayPlan currently consumes
//     only the first two plus the shake.
//   - It does not decide meal CONTENT. That's mealGenerator's rotations.
//   - It does not mutate the store or persist anything.
//
// DESIGN PRINCIPLE — no silent defaults:
// generateDayPlan takes an OPTIONAL schedule. When omitted it falls back to
// the exact pre-11.4 hardcoded 19:5 times, so every existing caller and test
// keeps its current behavior with zero changes. Callers that want IF-aware
// timing (mealPlanGeneration) opt in by passing deriveMealSchedule(ifProtocol).

import type { IFProtocol } from "../store/useHealthStore"

// ── MealSchedule ──────────────────────────────────────────────────────────────
// The concrete timing plan for a day.
//
//   mealTimes   — display clock strings ("2:00 PM"), time-sorted, one per
//                 MAIN meal. Length is the main-meal count. (11.4 consumes the
//                 first two; the array supports more for a future commit.)
//   shakeTime   — display clock string for the shake, or null when no shake.
//                 When present it sits between the main meals.
//   includeShake— whether a protein shake is part of the day.
export type MealSchedule = {
  mealTimes:    string[]
  shakeTime:    string | null
  includeShake: boolean
}

// ── Pre-11.4 default schedule ──────────────────────────────────────────────────
// The exact hardcoded behavior generateDayPlan used before 11.4. Returned by
// the generator when no schedule is supplied, so legacy callers are unaffected.
export const LEGACY_IF_SCHEDULE: MealSchedule = {
  mealTimes:    ["2:00 PM", "6:30 PM"],
  shakeTime:    "4:30 PM",
  includeShake: true,
}

// ── Clock formatting ────────────────────────────────────────────────────────────
// formatHour in adaptiveTDEE.ts only renders whole hours (":00"). Evenly-spread
// meal times can land on half hours, so we need a minute-aware formatter here.
// Hours are normalised into 0–23 first (a window can wrap past midnight when
// fastStartHour + fastingHours exceeds 24).
export function formatClock(hour: number, minute: number): string {
  const h24    = ((Math.floor(hour) % 24) + 24) % 24
  const period = h24 >= 12 ? "PM" : "AM"
  const h12    = h24 % 12 === 0 ? 12 : h24 % 12
  const mm     = String(Math.round(minute)).padStart(2, "0")
  return `${h12}:${mm} ${period}`
}

// ── Eating-window resolution ────────────────────────────────────────────────────
// Returns [windowStartHour, windowLengthHours] in fractional hours.
//
// When fasting is ENABLED:
//   The fast begins at fastStartHour and lasts fastingHours. The eating
//   window therefore OPENS at (fastStartHour + fastingHours) and lasts
//   eatingHours. Example 19:5 with fastStartHour 20:
//     window opens at (20 + 19) mod 24 = 15:00 (3 PM), lasts 5h → closes 8 PM.
//   (Note: the legacy hardcoded 2 PM start was actually slightly outside the
//   strict 19:5 window; 11.4 makes the window honest. The legacy schedule is
//   still available verbatim via LEGACY_IF_SCHEDULE for callers that don't
//   opt in, so nothing changes unless a caller passes a derived schedule.)
//
// When fasting is DISABLED:
//   A normal all-day eating window is used: WINDOW_START_NO_FAST to
//   WINDOW_END_NO_FAST. This is what a non-IF user (maintenance, geriatric,
//   child) should see — meals spread across a normal day, not crammed into
//   an afternoon feeding window.
const WINDOW_START_NO_FAST = 8   // 8 AM — first meal of a normal day
const WINDOW_END_NO_FAST   = 20  // 8 PM — last meal of a normal day

function resolveEatingWindow(ifp: IFProtocol): { startHour: number; lengthHours: number } {
  if (!ifp.fastingEnabled) {
    return {
      startHour:   WINDOW_START_NO_FAST,
      lengthHours: WINDOW_END_NO_FAST - WINDOW_START_NO_FAST,
    }
  }
  // Fasting enabled: window opens when the fast ends.
  const startHour = (ifp.fastStartHour + ifp.fastingHours) % 24
  // eatingHours is kept in sync with fastingHours by the store
  // (updateIfProtocol sets eatingHours = 24 - fastingHours), but we clamp
  // defensively in case a stale value slipped through.
  const lengthHours = Math.max(1, Math.min(ifp.eatingHours, 24))
  return { startHour, lengthHours }
}

// ── Schedule derivation ─────────────────────────────────────────────────────────
// Turn an IFProtocol into a concrete MealSchedule.
//
// Options:
//   mainMealCount — how many main meals (default 2 — the only value 11.4's
//                   generator consumes; see module header). Values > 2 are
//                   accepted and produce that many times in mealTimes, but
//                   the generator currently uses only the first two.
//   includeShake  — whether to include a protein shake (default true). A
//                   non-IF / maintenance / geriatric user typically sets this
//                   false; an IF/keto user keeps it.
//
// Time distribution:
//   Main meals are placed at evenly-spaced points across the eating window,
//   inset from the very edges so the first meal isn't exactly at window-open
//   and the last isn't exactly at window-close. For 2 meals across a 5h
//   window opening at 3 PM: meals at ~3:50 PM and ~7:10 PM. Times are rounded
//   to the nearest 5 minutes for tidy display.
//   The shake is placed at the midpoint between the first and last main meal.
export function deriveMealSchedule(
  ifp: IFProtocol,
  opts?: { mainMealCount?: number; includeShake?: boolean },
): MealSchedule {
  const mainMealCount = Math.max(1, opts?.mainMealCount ?? 2)
  const includeShake  = opts?.includeShake ?? true

  const { startHour, lengthHours } = resolveEatingWindow(ifp)

  // Inset the meals from the window edges by a fraction of the window so the
  // first/last meals breathe. For an N-meal plan we divide the usable span
  // into N slots and place each meal at the centre of its slot.
  //   usableStart = startHour + edgeInset
  //   slotSpan    = (lengthHours - 2*edgeInset) / (N - 1)   [N > 1]
  // For N === 1 the single meal sits at the window midpoint.
  const edgeInset = Math.min(0.75, lengthHours * 0.15)  // ≤ 45 min inset

  const mealTimes: string[] = []
  if (mainMealCount === 1) {
    const t = startHour + lengthHours / 2
    mealTimes.push(toClock(t))
  } else {
    const usableStart = startHour + edgeInset
    const usableSpan  = Math.max(0, lengthHours - 2 * edgeInset)
    const step        = usableSpan / (mainMealCount - 1)
    for (let i = 0; i < mainMealCount; i++) {
      mealTimes.push(toClock(usableStart + step * i))
    }
  }

  // Shake at the midpoint between first and last main meal.
  let shakeTime: string | null = null
  if (includeShake) {
    const firstT = startHour + edgeInset
    const lastT  = startHour + lengthHours - edgeInset
    const midT   = mainMealCount === 1
      ? startHour + lengthHours / 2 + 1  // 1 hour after the single meal
      : (firstT + lastT) / 2
    shakeTime = toClock(midT)
  }

  return { mealTimes, shakeTime, includeShake }
}

// Round a fractional hour to the nearest 5 minutes and format as a clock string.
function toClock(fractionalHour: number): string {
  const totalMinutes = Math.round((fractionalHour * 60) / 5) * 5
  const hour   = Math.floor(totalMinutes / 60)
  const minute = totalMinutes % 60
  return formatClock(hour, minute)
}
