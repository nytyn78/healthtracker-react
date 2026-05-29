import { create } from "zustand"
import { KEYS } from "../services/storageKeys"

// ── Food / Log types (existing, preserved) ──────────────────────────────────
export type FoodEntry = {
  id: string
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  timestamp: number
}
export type DayLog = { date: string; foods: FoodEntry[] }
export function mergeCloudLogs(
  local: Record<string, DayLog>,
  cloud: Record<string, DayLog>
): Record<string, DayLog> {
  return { ...local }
}

// ── Settings types ───────────────────────────────────────────────────────────
export type Sex = "male" | "female"

export type ActivityLevel =
  | "sedentary"
  | "lightly_active"
  | "moderately_active"
  | "very_active"
  | "extra_active"

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary:         "Sedentary — desk job, minimal movement",
  lightly_active:    "Lightly active — 1–3 workouts/week",
  moderately_active: "Moderately active — 4–5 workouts/week",
  very_active:       "Very active — daily intense training",
  extra_active:      "Extra active — physical job + training",
}

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary:         1.2,
  lightly_active:    1.375,
  moderately_active: 1.55,
  very_active:       1.725,
  extra_active:      1.9,
}

export type WeightLossRate = 0.25 | 0.5 | 0.75 | 1.0

// ── Medical context ──────────────────────────────────────────────────────────
// Captured during onboarding and editable later from Settings → Health Context.
// The engine reads this to surface relevant scientific caveats, but never to
// silently override user choices — see services/macroWarnings.ts.
export type MedicalContext = {
  hasDiabetes?: boolean              // Type 1 or insulin-dependent T2
  hasCKD?: boolean                   // Chronic kidney disease stage 3+
  hasEDHistory?: boolean             // Eating disorder, current or recent
  acknowledgedDisclaimer?: boolean
  acknowledgedAt?: number            // Unix ms timestamp
}

export type UserProfile = {
  name: string
  age: number | ""
  sex: Sex
  heightCm: number | ""
  weightKg: number | ""
  activityLevel: ActivityLevel
  bmrOverride?: number
  medicalContext?: MedicalContext
}

export type UserGoals = {
  targetWeightKg: number | ""
  weeklyLossKg: WeightLossRate
}

export type MacroSplit = {
  fatPct: number
  proteinPct: number
  carbsPct: number
}

export type IFProtocol = {
  fastingHours: number
  eatingHours: number
  fastStartHour: number
  // Master on/off for intermittent fasting. Decoupled from showFasting (which
  // is whether fasting is *offered* for a goal mode) and from fastingHours
  // (which no longer doubles as a fake "off" via its 12h floor). Set at
  // onboarding from the mode's fastingDefaultOn; toggleable in Settings.
  fastingEnabled: boolean
}

export type AppSettings = {
  macroSplit: MacroSplit
  ifProtocol: IFProtocol
}

export type ComputedMacros = {
  bmr: number
  tdee: number
  targetCalories: number
  proteinG: number
  fatG: number
  carbsG: number
}

// ── Defaults ──────────────────────────────────────────────────────────────────
const DEFAULT_PROFILE: UserProfile = {
  name: "",
  age: "",
  sex: "male",
  heightCm: "",
  weightKg: "",
  activityLevel: "moderately_active",
}

const DEFAULT_GOALS: UserGoals = {
  targetWeightKg: "",
  weeklyLossKg: 0.5,
}

// ── Canonical macro-split mapping ─────────────────────────────────────────────
// Single source of truth: each user-facing DietMode maps to exactly one
// MacroSplit percentage triple. This is the inverse of resolveMacroMode in
// adaptiveTDEE.ts — picking the centre of each mode's band.
//
// HISTORY: previously the store kept macroSplit as an independent settings
// value, separate from dietConfig.mode. Onboarding wrote to dietConfig.mode
// but never touched macroSplit, so the engine (which reads macroSplit) kept
// the keto default while the user's actual choice (balanced/low_carb/etc.)
// lived in a different storage slot. This caused users who picked balanced
// in onboarding to receive keto macros silently. The mapping below makes
// dietConfig.mode the source of truth; macroSplit is derived from it.
export const MACRO_SPLIT_FOR_MODE: Record<DietMode, MacroSplit> = {
  keto:                { fatPct: 70, proteinPct: 25, carbsPct: 5  },
  low_carb:            { fatPct: 50, proteinPct: 25, carbsPct: 25 },
  balanced:            { fatPct: 30, proteinPct: 25, carbsPct: 45 },
  high_protein:        { fatPct: 25, proteinPct: 40, carbsPct: 35 },
  vegetarian_balanced: { fatPct: 30, proteinPct: 25, carbsPct: 45 }, // alias of balanced
}

// Inverse: macroSplit → DietMode. Mirrors resolveMacroMode in adaptiveTDEE.ts
// but returns the user-facing DietMode union (not the engine's MacroMode).
// Used by the legacy migration path and by updateMacroSplit (Settings slider
// writes propagate to dietConfig).
export function dietModeFromMacroSplit(macroSplit: MacroSplit): DietMode {
  const { carbsPct, proteinPct } = macroSplit
  if (carbsPct <= 10)                                       return "keto"
  if (proteinPct >= 40)                                     return "high_protein"
  if (carbsPct <= 35)                                       return "low_carb"
  return "balanced"
}

// Balanced is the safe default for an unknown user — matches mainstream
// dietary guidance (AMDR 45-65% carbs / 20-35% fat / 10-35% protein) and
// works for the broadest user base.
const DEFAULT_MACRO_SPLIT: MacroSplit = MACRO_SPLIT_FOR_MODE.balanced

// Default IF protocol. fastingEnabled defaults true here so existing users
// (whose saved ifProtocol predates this field) keep their current behavior via
// the { ...DEFAULT_IF, ...saved } merge. New users get fastingEnabled set
// explicitly at onboarding from their goal mode's fastingDefaultOn flag.
const DEFAULT_IF: IFProtocol = {
  fastingHours: 16,
  eatingHours: 8,
  fastStartHour: 20,
  fastingEnabled: true,
}

const DEFAULT_SETTINGS: AppSettings = {
  macroSplit: DEFAULT_MACRO_SPLIT,
  ifProtocol: DEFAULT_IF,
}

// ── Store state ───────────────────────────────────────────────────────────────
type HealthState = {
  today: string
  logs: Record<string, DayLog>
  loading: boolean
  error: string | null
  profile: UserProfile
  goals: UserGoals
  settings: AppSettings
  settingsVersion: number
  bumpSettingsVersion: () => void
  init: () => Promise<void>
  addFood: (f: FoodEntry) => void
  removeFood: (id: string) => void
  clearToday: () => void
  updateProfile: (patch: Partial<UserProfile>) => void
  updateGoals: (patch: Partial<UserGoals>) => void
  updateMacroSplit: (patch: Partial<MacroSplit>) => void
  updateIFProtocol: (patch: Partial<IFProtocol>) => void
}

// ── Persistence ───────────────────────────────────────────────────────────────
const STORAGE_KEY = KEYS.MAIN_STORE

function loadPersisted(): Partial<HealthState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function persist(state: HealthState) {
  try {
    const { profile, goals, settings, logs } = state
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ profile, goals, settings, logs }))
  } catch {}
}

const saved = loadPersisted()

// ── macroSplit ↔ dietConfig.mode reconciliation (Commit 6) ─────────────────────
// Before this commit, macroSplit and dietConfig.mode lived in separate storage
// slots and could disagree. The user-facing source of truth is now
// dietConfig.mode; macroSplit is always derived from it.
//
// On store init we reconcile the two storage slots to ensure consistency
// going forward:
//
//   - Both exist:   Trust dietConfig.mode. Recompute macroSplit from it.
//                   (Fixes the bug where onboarding wrote mode=balanced but
//                   the engine kept reading the keto macroSplit default.)
//
//   - Only macro:   Legacy user — no dietConfig stored. Derive a DietMode
//                   from their existing macroSplit and write it to
//                   dietConfig. Their experience is unchanged; the
//                   inconsistency is just resolved.
//
//   - Only diet:    Recompute macroSplit from dietConfig.mode. Normal path
//                   for a freshly-onboarded user (onboarding only writes
//                   dietConfig, not macroSplit).
//
//   - Neither:      Use defaults (balanced macroSplit). Brand-new user.
function reconcileMacroSplitAndDietConfig(): MacroSplit {
  let diet: { mode?: DietMode; tag?: DietTag } = {}
  try {
    const raw = localStorage.getItem(KEYS.DIET_CONFIG)
    diet = raw ? JSON.parse(raw) : {}
  } catch {}

  const storedSplit = saved.settings?.macroSplit
  const dietMode = diet.mode as DietMode | undefined

  // dietConfig.mode is authoritative when present.
  if (dietMode && MACRO_SPLIT_FOR_MODE[dietMode]) {
    return MACRO_SPLIT_FOR_MODE[dietMode]
  }

  // Legacy: macroSplit exists but no dietConfig. Derive mode and persist it
  // so subsequent reads find dietConfig as the source of truth.
  if (storedSplit && (storedSplit.fatPct + storedSplit.proteinPct + storedSplit.carbsPct) > 0) {
    const derivedMode = dietModeFromMacroSplit({ ...DEFAULT_MACRO_SPLIT, ...storedSplit })
    const derivedTag  = (diet.tag as DietTag | undefined) ?? "veg"
    try {
      localStorage.setItem(
        KEYS.DIET_CONFIG,
        JSON.stringify({ mode: derivedMode, tag: derivedTag }),
      )
    } catch {}
    return { ...DEFAULT_MACRO_SPLIT, ...storedSplit }
  }

  // Brand-new user: defaults.
  return DEFAULT_MACRO_SPLIT
}

const reconciledMacroSplit = reconcileMacroSplitAndDietConfig()

export const useHealthStore = create<HealthState>((set, get) => ({
  today: "",
  logs: saved.logs ?? {},
  loading: false,
  error: null, settingsVersion: 0, bumpSettingsVersion: () => set(s => ({ settingsVersion: s.settingsVersion + 1 })),
  profile:  { ...DEFAULT_PROFILE,  ...(saved.profile  ?? {}) },
  goals:    { ...DEFAULT_GOALS,    ...(saved.goals    ?? {}) },
  settings: {
    macroSplit: reconciledMacroSplit,
    ifProtocol: { ...DEFAULT_IF,          ...(saved.settings?.ifProtocol ?? {}) },
  },
  init: async () => {},
  addFood: () => {},
  removeFood: () => {},
  clearToday: () => {},
  updateProfile: (patch: Partial<UserProfile>) => set((s: HealthState) => { const n = { ...s, profile: { ...s.profile, ...patch } }; persist(n); return n }),
  updateGoals: (patch: Partial<UserGoals>) => set((s: HealthState) => { const n = { ...s, goals: { ...s.goals, ...patch } }; persist(n); return n }),
  // updateMacroSplit (Settings macro-preset buttons / slider) writes through
  // to dietConfig as well, so the two storage locations never drift apart.
  // The DietMode is derived from the new macroSplit via dietModeFromMacroSplit.
  updateMacroSplit: (patch: Partial<MacroSplit>) => set((s: HealthState) => {
    const newSplit = { ...s.settings.macroSplit, ...patch }
    // Mirror to dietConfig so all readers stay consistent
    try {
      const raw = localStorage.getItem(KEYS.DIET_CONFIG)
      const cur = raw ? JSON.parse(raw) : {}
      const newMode = dietModeFromMacroSplit(newSplit)
      localStorage.setItem(
        KEYS.DIET_CONFIG,
        JSON.stringify({ mode: newMode, tag: cur.tag ?? "veg" }),
      )
    } catch {}
    const n = { ...s, settings: { ...s.settings, macroSplit: newSplit } }
    persist(n); return n
  }),
  updateIFProtocol: (patch: Partial<IFProtocol>) => set((s: HealthState) => {
    const updated = { ...s.settings.ifProtocol, ...patch }
    if (patch.fastingHours !== undefined) updated.eatingHours = 24 - patch.fastingHours
    const n = { ...s, settings: { ...s.settings, ifProtocol: updated } }
    persist(n); return n
  }),
}))
export function bumpSettingsVersion() {
  useHealthStore.getState().bumpSettingsVersion()
}

// ── Day log types ─────────────────────────────────────────────────────────────
export type DayData = {
  date: string
  entries: FoodEntry[]
  weight: number | null
  water: number           // litres
  fasting: boolean
  fastStart: number | null  // timestamp ms
  fastBest: number          // seconds
  fastAccum: number         // seconds accumulated before pause
  meds: Record<string, boolean>
  workouts: WorkoutEntry[]
}

export type WorkoutEntry = {
  id: string
  type: "walk" | "circuit" | "other"
  duration: number   // minutes
  dist?: string
  note?: string
  exercises?: string[]
}

// ── Day store extension ───────────────────────────────────────────────────────
export function makeDayData(date: string): DayData {
  return {
    date, entries: [], weight: null, water: 0,
    fasting: false, fastStart: null, fastBest: 0, fastAccum: 0,
    meds: {}, workouts: [],
  }
}

const DAY_KEY = KEYS.DAY_LOG

export function loadDayData(date: string): DayData {
  try {
    const raw = localStorage.getItem(DAY_KEY(date))
    return raw ? { ...makeDayData(date), ...JSON.parse(raw) } : makeDayData(date)
  } catch { return makeDayData(date) }
}

export function saveDayData(day: DayData) {
  try { localStorage.setItem(DAY_KEY(day.date), JSON.stringify(day)) } catch {}
}

// ── History types ─────────────────────────────────────────────────────────────
export type HistoryRow = {
  date: string; cal: number; protein: number; carbs: number; fat: number
  weight: number | null; water: number; workoutDone: boolean; fastBest?: number
  weightEvent?: WeightEventTag | null   // flags data point as influenced
  weightNote?: string                   // free text note
}

export function loadHistory(): HistoryRow[] {
  try { return JSON.parse(localStorage.getItem(KEYS.HISTORY) || "[]") } catch { return [] }
}

export function saveHistory(h: HistoryRow[]) {
  try { localStorage.setItem(KEYS.HISTORY, JSON.stringify(h)) } catch {}
}

// ── Medications ───────────────────────────────────────────────────────────────
export type MedFrequency = "daily" | "weekly" | "custom"

export type Medication = {
  id: string
  name: string
  frequency: MedFrequency
  days?: string[]        // for weekly: ["Sunday"] etc
  note: string           // e.g. "Take with Meal 1"
  enabled: boolean
}

// ── Blood tests ───────────────────────────────────────────────────────────────
export type BloodTest = {
  id: string
  name: string
  reason: string         // why it's being monitored
  intervalDays: number   // e.g. 90
  enabled: boolean
}

// ── Health config storage helpers ─────────────────────────────────────────────
export function loadMedications(): Medication[] {
  try { return JSON.parse(localStorage.getItem(KEYS.USER_MEDICATIONS) || "[]") } catch { return [] }
}

export function saveMedications(meds: Medication[]) {
  try {
    localStorage.setItem(KEYS.USER_MEDICATIONS, JSON.stringify(meds))
    bumpSettingsVersion()
  } catch {}
}

export function loadBloodTests(): BloodTest[] {
  try { return JSON.parse(localStorage.getItem(KEYS.USER_BLOOD_TESTS) || "[]") } catch { return [] }
}

export function saveBloodTests(tests: BloodTest[]) {
  try {
    localStorage.setItem(KEYS.USER_BLOOD_TESTS, JSON.stringify(tests))
    bumpSettingsVersion()
  } catch {}
}

// ── Task bubble config ────────────────────────────────────────────────────────
export type TaskId =
  | "meds" | "walk" | "protein" | "meals"
  | "water" | "carbs" | "fast" | "workout" | "weight"

export type TaskConfig = { id: TaskId; enabled: boolean }

export function loadTaskConfig(): TaskConfig[] {
  const defaults: TaskConfig[] = [
    { id: "meds",    enabled: true },
    { id: "walk",    enabled: true },
    { id: "protein", enabled: true },
    { id: "meals",   enabled: true },
    { id: "water",   enabled: true },
    { id: "carbs",   enabled: true },
    { id: "fast",    enabled: true },
    { id: "workout", enabled: true },
    { id: "weight",  enabled: true },
  ]
  try {
    const saved = JSON.parse(localStorage.getItem(KEYS.TASK_CONFIG) || "null")
    if (!saved) return defaults
    // Merge to handle new task IDs added in future
    return defaults.map(d => ({ ...d, ...(saved.find((s: TaskConfig) => s.id === d.id) || {}) }))
  } catch { return defaults }
}

export function saveTaskConfig(config: TaskConfig[]) {
  try { localStorage.setItem(KEYS.TASK_CONFIG, JSON.stringify(config)) } catch {}
}

// ── Water target ──────────────────────────────────────────────────────────────
export function loadWaterTarget(): number {
  try { return Number(localStorage.getItem(KEYS.WATER_TARGET) || "2.5") } catch { return 2.5 }
}

export function saveWaterTarget(l: number) {
  try { localStorage.setItem(KEYS.WATER_TARGET, String(l)) } catch {}
}

// ── Workout plan config ───────────────────────────────────────────────────────
export type WorkoutType = "walk" | "circuit" | "custom" | "rest"

export type ExerciseConfig = {
  id: string
  name: string
  sets: string      // e.g. "3-4"
  reps: string      // e.g. "12" or "30 sec"
  isTimed: boolean  // if true, reps is treated as seconds
  note: string
}

export type DaySchedule = {
  day: string        // "Monday" etc
  types: WorkoutType[]
  walkTarget: number // minutes
  note: string
}

export type WorkoutPlan = {
  exercises: ExerciseConfig[]
  schedule: DaySchedule[]
  circuitRounds: number
  restBetweenRounds: number // seconds
}

const DEFAULT_SCHEDULE: DaySchedule[] = [
  { day: "Monday",    types: ["walk","circuit"], walkTarget: 45, note: "Full workout day" },
  { day: "Tuesday",   types: ["walk"],           walkTarget: 45, note: "Walk only — active recovery" },
  { day: "Wednesday", types: ["walk","circuit"], walkTarget: 45, note: "Full workout day" },
  { day: "Thursday",  types: ["rest"],           walkTarget: 0,  note: "Complete rest — muscle rebuilds" },
  { day: "Friday",    types: ["walk","circuit"], walkTarget: 45, note: "Full workout day" },
  { day: "Saturday",  types: ["walk"],           walkTarget: 45, note: "Long walk — no strength" },
  { day: "Sunday",    types: ["walk"],           walkTarget: 30, note: "Light walk — prepare for new week" },
]

const DEFAULT_PLAN: WorkoutPlan = {
  exercises: [],
  schedule: DEFAULT_SCHEDULE,
  circuitRounds: 3,
  restBetweenRounds: 90,
}

export function loadWorkoutPlan(): WorkoutPlan {
  try {
    const raw = localStorage.getItem(KEYS.WORKOUT_PLAN)
    if (!raw) return DEFAULT_PLAN
    const saved = JSON.parse(raw)
    return {
      ...DEFAULT_PLAN,
      ...saved,
      schedule: saved.schedule ?? DEFAULT_SCHEDULE,
    }
  } catch { return DEFAULT_PLAN }
}

export function saveWorkoutPlan(plan: WorkoutPlan) {
  try {
    localStorage.setItem(KEYS.WORKOUT_PLAN, JSON.stringify(plan))
    bumpSettingsVersion()
  } catch {}
}

export function getTodaySchedule(plan: WorkoutPlan): DaySchedule {
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]
  const today = days[new Date().getDay()]
  return plan.schedule.find(s => s.day === today) ?? plan.schedule[0]
}

// ── Weight event tags ─────────────────────────────────────────────────────────
export type WeightEventTag =
  | "nsaid"        // ibuprofen, combiflam, aspirin
  | "poor_sleep"   // <5 hours
  | "high_sodium"  // salty meal, restaurant
  | "menstruation" // hormonal water retention
  | "illness"      // fever, infection
  | "travel"       // disrupted routine
  | "alcohol"      // causes water retention
  | "refeed"       // planned high-carb day
  | "other"

export const WEIGHT_EVENT_LABELS: Record<WeightEventTag, { label: string; icon: string; note: string }> = {
  nsaid:        { label: "NSAID / Painkiller", icon: "💊", note: "Ibuprofen, Combiflam, Aspirin — causes sodium & water retention" },
  poor_sleep:   { label: "Poor Sleep",         icon: "😴", note: "Less than 5–6 hours — elevates cortisol, causes water retention" },
  high_sodium:  { label: "High Sodium Meal",   icon: "🧂", note: "Restaurant, processed food — water follows sodium" },
  menstruation: { label: "Menstrual Cycle",    icon: "🔴", note: "Hormonal water retention — normal 0.5–2 kg fluctuation" },
  illness:      { label: "Illness / Fever",    icon: "🤒", note: "Inflammation causes temporary water retention" },
  travel:       { label: "Travel",             icon: "✈️", note: "Disrupted routine, airport food, timezone shift" },
  alcohol:      { label: "Alcohol",            icon: "🍺", note: "Causes glycogen storage + water retention" },
  refeed:       { label: "Refeed Day",         icon: "🍚", note: "Planned high-carb day — glycogen + water expected" },
  other:        { label: "Other",              icon: "📝", note: "Custom note" },
}

// ── Blood test log ────────────────────────────────────────────────────────────
export type BloodTestLog = {
  testId: string
  doneAt: number  // timestamp ms
  note?: string
}

export function loadBloodTestLog(): BloodTestLog[] {
  try { return JSON.parse(localStorage.getItem(KEYS.BLOOD_TEST_LOG) || "[]") } catch { return [] }
}

export function saveBloodTestLog(log: BloodTestLog[]) {
  try { localStorage.setItem(KEYS.BLOOD_TEST_LOG, JSON.stringify(log)) } catch {}
}

// ── Med taken log (per day, keyed by date) ────────────────────────────────────
export function loadMedTakenForDate(date: string): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(KEYS.MED_TAKEN(date)) || "{}") } catch { return {} }
}

export function saveMedTakenForDate(date: string, taken: Record<string, boolean>) {
  try { localStorage.setItem(KEYS.MED_TAKEN(date), JSON.stringify(taken)) } catch {}
}

// Weekly med last-taken timestamp
export function loadWeeklyMedLastTaken(medId: string): number | null {
  try {
    const v = localStorage.getItem(KEYS.MED_WEEKLY(medId))
    return v ? Number(v) : null
  } catch { return null }
}

export function saveWeeklyMedLastTaken(medId: string, ts: number) {
  try { localStorage.setItem(KEYS.MED_WEEKLY(medId), String(ts)) } catch {}
}

// ── Diet mode ─────────────────────────────────────────────────────────────────
export type DietMode = "keto" | "low_carb" | "balanced" | "high_protein" | "vegetarian_balanced"
export type DietTag  = "veg" | "eggetarian" | "non_veg"

export const DIET_MODE_LABELS: Record<DietMode, string> = {
  keto:                  "Keto (≤25g carbs)",
  low_carb:              "Low-carb (≤80g carbs)",
  balanced:              "Balanced macro split",
  high_protein:          "High protein (muscle gain/recomposition)",
  vegetarian_balanced:   "Vegetarian balanced",
}

export const DIET_TAG_LABELS: Record<DietTag, string> = {
  veg:         "🌱 Vegetarian",
  eggetarian:  "🥚 Eggetarian",
  non_veg:     "🍗 Non-vegetarian",
}

export function loadDietConfig(): { mode: DietMode; tag: DietTag } {
  try {
    const raw = localStorage.getItem(KEYS.DIET_CONFIG)
    return raw ? JSON.parse(raw) : { mode: "balanced", tag: "veg" }
  } catch { return { mode: "balanced", tag: "veg" } }
}

// Writes dietConfig AND propagates the change into the Zustand store's
// settings.macroSplit so the engine, warnings system, and any subscribed
// component all see the updated mode immediately. Before this commit,
// saveDietConfig only touched localStorage; the store kept whatever
// macroSplit it had been initialised with, which is the parallel-storage
// bug that caused balanced-mode onboarding choices to be silently overridden
// with the keto default. (See reconcileMacroSplitAndDietConfig above.)
export function saveDietConfig(config: { mode: DietMode; tag: DietTag }) {
  try { localStorage.setItem(KEYS.DIET_CONFIG, JSON.stringify(config)) } catch {}
  // Sync macroSplit through the Zustand store so all React consumers update.
  // Direct setState (not via updateMacroSplit) — updateMacroSplit would write
  // dietConfig back, causing a redundant write.
  try {
    const newSplit = MACRO_SPLIT_FOR_MODE[config.mode] ?? DEFAULT_MACRO_SPLIT
    useHealthStore.setState((s: HealthState) => {
      const next = { ...s, settings: { ...s.settings, macroSplit: newSplit } }
      persist(next)
      return next
    })
    bumpSettingsVersion()
  } catch {}
}

// ── Meal plan ─────────────────────────────────────────────────────────────────
export type MealPlanEntry = {
  id: string
  name: string
  time: string           // e.g. "2:00 PM"
  protein: number
  carbs: number
  netCarbs?: number      // derived at transformation time — absent on manual/legacy entries → UI shows "Net: —"
  fat: number
  cal: number
  tag: DietTag           // veg / eggetarian / non_veg
  ingredients: string[]  // plain text list
  steps: string[]        // plain text steps
  day?: string           // optional — "Monday" etc, blank = any day
  isPreset?: boolean     // came from a preset template
}

export function loadMealPlan(): MealPlanEntry[] {
  try { return JSON.parse(localStorage.getItem(KEYS.MEAL_PLAN) || "[]") } catch { return [] }
}

export function saveMealPlan(plan: MealPlanEntry[]) {
  try {
    localStorage.setItem(KEYS.MEAL_PLAN, JSON.stringify(plan))
    bumpSettingsVersion()
  } catch {}
}

// ── Eating out log ────────────────────────────────────────────────────────────
export function markEatingOut(date: string) {
  try { localStorage.setItem(KEYS.EATING_OUT(date), "1") } catch {}
}

export function wasEatingOut(date: string): boolean {
  try { return localStorage.getItem(KEYS.EATING_OUT(date)) === "1" } catch { return false }
}

// ── Theme ─────────────────────────────────────────────────────────────────────
export type Theme = "light" | "dark"

export function loadTheme(): Theme {
  try { return (localStorage.getItem(KEYS.APP_THEME) as Theme) || "light" } catch { return "light" }
}

export function saveTheme(t: Theme) {
  try {
    localStorage.setItem(KEYS.APP_THEME, t)
    document.documentElement.classList.toggle("dark", t === "dark")
  } catch {}
}

// Apply theme on load
if (typeof document !== "undefined") {
  document.documentElement.classList.toggle("dark", loadTheme() === "dark")
}

// ── Break Periods (vacation, events, etc) ────────────────────────────────────
export type BreakPeriod = {
  id: string
  label: string          // e.g. "Goa vacation", "Rahul's wedding"
  startDate: string      // YYYY-MM-DD
  endDate: string        // YYYY-MM-DD
  type: "vacation" | "wedding" | "festival" | "illness" | "travel" | "other"
}

export function loadBreakPeriods(): BreakPeriod[] {
  try { return JSON.parse(localStorage.getItem(KEYS.BREAK_PERIODS) || "[]") } catch { return [] }
}

export function saveBreakPeriods(periods: BreakPeriod[]) {
  try { localStorage.setItem(KEYS.BREAK_PERIODS, JSON.stringify(periods)) } catch {}
}

export function isInBreakPeriod(date: string): BreakPeriod | null {
  const periods = loadBreakPeriods()
  return periods.find(p => date >= p.startDate && date <= p.endDate) || null
}

// ── Body Composition Log ──────────────────────────────────────────────────────
export type BodyCompositionEntry = {
  date: string          // YYYY-MM-DD
  weight: number
  fatMassKg?: number
  fatPct?: number
  muscleMassKg?: number
  skeletalMusclePct?: number
  visceralFat?: number
  bodyAge?: number
  bmr?: number
  source?: string       // e.g. "Samso scale", "DEXA", "Manual estimate"
  note?: string
}

export function loadBodyCompositionLog(): BodyCompositionEntry[] {
  try { return JSON.parse(localStorage.getItem(KEYS.BODY_COMP_LOG) || "[]") } catch { return [] }
}

export function saveBodyCompositionLog(log: BodyCompositionEntry[]) {
  try { localStorage.setItem(KEYS.BODY_COMP_LOG, JSON.stringify(log.slice(0, 120))) } catch {}
}

// ── Onboarding ────────────────────────────────────────────────────────────────
export type FitnessLevel = "beginner" | "intermediate" | "active"

export const FITNESS_LEVEL_LABELS: Record<FitnessLevel, { label: string; desc: string }> = {
  beginner:     { label: "Beginner",     desc: "New to exercise or returning after a long break" },
  intermediate: { label: "Intermediate", desc: "Exercise 2-4 times/week, comfortable with basics" },
  active:       { label: "Active",       desc: "Exercise 5+ times/week, looking to optimise" },
}

export type EatingStyle = "skip_breakfast" | "early_eater" | "late_eater" | "aggressive_if"

export const EATING_STYLE_LABELS: Record<EatingStyle, { label: string; window: string; fastH: number; startH: number }> = {
  skip_breakfast: { label: "I naturally skip breakfast", window: "12 PM → 8 PM", fastH: 16, startH: 20 },
  early_eater:    { label: "I prefer eating early",      window: "8 AM → 4 PM",  fastH: 16, startH: 16 },
  late_eater:     { label: "I eat later in the day",     window: "2 PM → 7 PM",  fastH: 19, startH: 19 },
  aggressive_if:  { label: "I want aggressive results",  window: "2 PM → 6 PM",  fastH: 20, startH: 20 },
}

export type OnboardingData = {
  completed: boolean
  step: number
  fitnessLevel?: FitnessLevel
  eatingStyle?: EatingStyle
}

export function loadOnboarding(): OnboardingData {
  try {
    const raw = localStorage.getItem(KEYS.ONBOARDING)
    return raw ? JSON.parse(raw) : { completed: false, step: 0 }
  } catch { return { completed: false, step: 0 } }
}

export function saveOnboarding(data: OnboardingData) {
  try { localStorage.setItem(KEYS.ONBOARDING, JSON.stringify(data)) } catch {}
}

export function needsOnboarding(): boolean {
  const ob = loadOnboarding()
  if (ob.completed) return false
  // Check if key profile fields are empty
  try {
    const store = JSON.parse(localStorage.getItem(KEYS.MAIN_STORE) || "{}")
    const profile = store?.state?.profile
    return !profile?.weightKg || !profile?.heightCm || !profile?.age
  } catch { return true }
}

// ── Setup completeness ────────────────────────────────────────────────────────
export type SetupItem = {
  id: string
  label: string
  done: boolean
  tab: string
  priority: "required" | "recommended" | "optional"
}

export function getSetupCompleteness(): { items: SetupItem[]; pct: number; level: "red" | "amber" | "green" } {
  let profile: any = {}, goals: any = {}
  try {
    const store = JSON.parse(localStorage.getItem(KEYS.MAIN_STORE) || "{}")
    profile = store?.profile || {}
goals   = store?.goals   || {}
  } catch {}

  const meds  = loadMedications()
  const tests = loadBloodTests()
  const plan  = loadWorkoutPlan()

  const items: SetupItem[] = [
    { id: "weight",   label: "Current weight",        done: !!profile.weightKg,  tab: "settings", priority: "required" },
    { id: "height",   label: "Height",                done: !!profile.heightCm,  tab: "settings", priority: "required" },
    { id: "age",      label: "Age",                   done: !!profile.age,       tab: "settings", priority: "required" },
    { id: "goal",     label: "Target weight",         done: !!goals.targetWeightKg, tab: "settings", priority: "required" },
    { id: "meds",     label: "Medications added",     done: meds.length > 0,     tab: "settings", priority: "recommended" },
    { id: "blood",    label: "Blood tests configured",done: tests.length > 0,    tab: "settings", priority: "recommended" },
    { id: "workout",  label: "Workout plan set up",   done: plan.exercises.length > 0, tab: "settings", priority: "recommended" },
    { id: "meals",    label: "Meal plan started",     done: loadMealPlan().length > 0, tab: "meals", priority: "optional" },
  ]

  const required    = items.filter(i => i.priority === "required")
  const recommended = items.filter(i => i.priority === "recommended")
  const requiredDone    = required.filter(i => i.done).length
  const recommendedDone = recommended.filter(i => i.done).length
  const totalDone = items.filter(i => i.done).length
  const pct = Math.round(totalDone / items.length * 100)

  const level = requiredDone < required.length ? "red"
    : recommendedDone < recommended.length ? "amber"
    : "green"

  return { items, pct, level }
}

// ── Focus items (from AI feedback) ───────────────────────────────────────────
export type FocusItem = {
  id: string
  text: string
  createdAt: number
  expiresAt: number  // 7 days default
  done: boolean
}

export function loadFocusItems(): FocusItem[] {
  try {
    const items = JSON.parse(localStorage.getItem(KEYS.FOCUS_ITEMS) || "[]") as FocusItem[]
    // Auto-expire
    const now = Date.now()
    return items.filter(i => !i.done && i.expiresAt > now)
  } catch { return [] }
}

export function saveFocusItems(items: FocusItem[]) {
  try { localStorage.setItem(KEYS.FOCUS_ITEMS, JSON.stringify(items)) } catch {}
}

export function addFocusItem(text: string): FocusItem {
  const item: FocusItem = {
    id: `focus-${Date.now()}`,
    text, createdAt: Date.now(),
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    done: false,
  }
  const items = loadFocusItems()
  saveFocusItems([item, ...items].slice(0, 5))
  return item
}

// ── AI settings ───────────────────────────────────────────────────────────────
export type AISettings = {
  anthropicKey: string
  openaiKey: string
  voiceMode: "webspeech" | "whisper"
}

export function loadAISettings(): AISettings {
  try {
    return JSON.parse(localStorage.getItem(KEYS.AI_SETTINGS) || '{"anthropicKey":"","openaiKey":"","voiceMode":"webspeech"}')
  } catch { return { anthropicKey: "", openaiKey: "", voiceMode: "webspeech" } }
}

export function saveAISettings(s: AISettings) {
  try { localStorage.setItem(KEYS.AI_SETTINGS, JSON.stringify(s)) } catch {}
}
