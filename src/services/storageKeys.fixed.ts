// ── storageKeys.ts ─────────────────────────────────────────────────────────────
// Single source of truth for ALL localStorage keys used by this app.
//
// PREFIX isolates this app from any other app on the same domain (nytyn78.github.io).
// Changing PREFIX = all keys change = clean slate for users.
//
// NEVER hardcode a localStorage key string anywhere else in the codebase.
// ALWAYS import from here.

const PREFIX = "ht2_"
const K = (key: string) => `${PREFIX}${key}`

// ── Core store ────────────────────────────────────────────────────────────────
export const KEYS = {
  // Zustand main store (profile, goals, settings, food logs)
  MAIN_STORE:           K("store"),

  // Day logs — keyed by date string YYYY-MM-DD
  DAY_LOG:              (date: string) => K(`hlog_${date}`),

  // History summary array
  HISTORY:              K("hlog_history"),

  // ── User data ─────────────────────────────────────────────────────────────
  USER_MEDICATIONS:     K("user_medications"),
  USER_BLOOD_TESTS:     K("user_blood_tests"),
  BLOOD_TEST_LOG:       K("blood_test_log"),
  BODY_COMP_LOG:        K("body_comp_log"),
  MEASURE_LOG:          K("measure_log"),
  ONBOARDING:           K("onboarding"),
  WATER_TARGET:         K("water_target"),

  // ── Meal plan ─────────────────────────────────────────────────────────────
  MEAL_PLAN:            K("meal_plan"),
  DIET_CONFIG:          K("diet_config"),

  // Swap-as-substitution (commit 13): per-date, per-slot meal overrides.
  // Date-stamped (YYYY-MM-DD) so today's swaps auto-expire at midnight and
  // tomorrow's become today's when the date rolls. Pruned on app load.
  MEAL_SWAP:            (date: string) => K(`meal_swap_${date}`),

  // ── Workout ───────────────────────────────────────────────────────────────
  WORKOUT_PLAN:         K("workout_plan"),
  DONE_EXERCISES:       (date: string) => K(`done_ex_${date}`),

  // ── Fasting / eating out ──────────────────────────────────────────────────
  EATING_OUT:           (date: string) => K(`eating_out_${date}`),

  // ── Med tracking ──────────────────────────────────────────────────────────
  MED_TAKEN:            (date: string) => K(`med_taken_${date}`),
  MED_WEEKLY:           (medId: string) => K(`med_weekly_${medId}`),

  // ── Goal / pregnancy mode ──────────────────────────────────────────────────
  GOAL_MODE:            K("goal_mode"),
  PREGNANCY_SETTINGS:   K("pregnancy_settings"),
  PREGNANCY_DISCLAIMER: (mode: string) => K(`pregnancy_disclaimer_shown_${mode}`),
  MICRONUTRIENT_LOG:    (date: string) => K(`micronutrient_${date}`),

  // ── Health conditions ──────────────────────────────────────────────────────
  HEALTH_CONDITIONS:    K("health_conditions"),

  // ── Family mode ────────────────────────────────────────────────────────────
  FAMILY_SETTINGS:      K("family_settings"),

  // ── UI state ───────────────────────────────────────────────────────────────
  ACTIVE_TAB:           K("active_tab"),
  TODAY_SECTION_PREFS:  K("today_section_prefs"),
  APP_THEME:            K("app_theme"),
  GUIDANCE_TOUR_STATE:  K("guidance_tour"),
  DISCLAIMER_ACCEPTED:  K("disclaimer_accepted_v1"),

  // ── Misc / AI ─────────────────────────────────────────────────────────────
  AI_SETTINGS:          K("ai_settings"),
  WEEKLY_FEEDBACK:      K("weekly_feedback"),
  CUSTOM_FOODS:         K("custom_foods"),
  TASK_CONFIG:          K("task_config"),
  FOCUS_ITEMS:          K("focus_items"),
  BREAK_PERIODS:        K("break_periods"),

  // Note: supp_offer uses sessionStorage not localStorage — no prefix needed
  // as sessionStorage is cleared when tab closes anyway
}

// Raw prefix for keyspace scans (e.g. pruning date-stamped swap keys on load).
// The only sanctioned use of the bare prefix outside the K() helper.
export const MEAL_SWAP_KEY_PREFIX = `${PREFIX}meal_swap_`
