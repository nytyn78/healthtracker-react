import { create } from "zustand"

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

export type UserProfile = {
  name: string
  age: number | ""
  sex: Sex
  heightCm: number | ""
  weightKg: number | ""
  activityLevel: ActivityLevel
  bmrOverride?: number
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

const DEFAULT_MACRO_SPLIT: MacroSplit = {
  fatPct: 70,
  proteinPct: 25,
  carbsPct: 5,
}

const DEFAULT_IF: IFProtocol = {
  fastingHours: 19,
  eatingHours: 5,
  fastStartHour: 20,
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
const STORAGE_KEY = "ht-react-store"

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

export const useHealthStore = create<HealthState>((set, get) => ({
  today: "",
  logs: saved.logs ?? {},
  loading: false,
  error: null,
  profile:  { ...DEFAULT_PROFILE,  ...(saved.profile  ?? {}) },
  goals:    { ...DEFAULT_GOALS,    ...(saved.goals    ?? {}) },
  settings: {
    macroSplit: { ...DEFAULT_MACRO_SPLIT, ...(saved.settings?.macroSplit ?? {}) },
    ifProtocol: { ...DEFAULT_IF,          ...(saved.settings?.ifProtocol ?? {}) },
  },
  init: async () => {},
  addFood: () => {},
  removeFood: () => {},
  clearToday: () => {},
  updateProfile: (patch: Partial<UserProfile>) => set((s: HealthState) => { const n = { ...s, profile: { ...s.profile, ...patch } }; persist(n); return n }),
  updateGoals: (patch: Partial<UserGoals>) => set((s: HealthState) => { const n = { ...s, goals: { ...s.goals, ...patch } }; persist(n); return n }),
  updateMacroSplit: (patch: Partial<MacroSplit>) => set((s: HealthState) => { const n = { ...s, settings: { ...s.settings, macroSplit: { ...s.settings.macroSplit, ...patch } } }; persist(n); return n }),
  updateIFProtocol: (patch: Partial<IFProtocol>) => set((s: HealthState) => {
    const updated = { ...s.settings.ifProtocol, ...patch }
    if (patch.fastingHours !== undefined) updated.eatingHours = 24 - patch.fastingHours
    const n = { ...s, settings: { ...s.settings, ifProtocol: updated } }
    persist(n); return n
  }),
}))

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

const DAY_KEY = (d: string) => `hlog_${d}`

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
  try { return JSON.parse(localStorage.getItem("hlog_history") || "[]") } catch { return [] }
}

export function saveHistory(h: HistoryRow[]) {
  try { localStorage.setItem("hlog_history", JSON.stringify(h)) } catch {}
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
  try { return JSON.parse(localStorage.getItem("user_medications") || "[]") } catch { return [] }
}

export function saveMedications(meds: Medication[]) {
  try { localStorage.setItem("user_medications", JSON.stringify(meds)) } catch {}
}

export function loadBloodTests(): BloodTest[] {
  try { return JSON.parse(localStorage.getItem("user_blood_tests") || "[]") } catch { return [] }
}

export function saveBloodTests(tests: BloodTest[]) {
  try { localStorage.setItem("user_blood_tests", JSON.stringify(tests)) } catch {}
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
    const saved = JSON.parse(localStorage.getItem("task_config") || "null")
    if (!saved) return defaults
    // Merge to handle new task IDs added in future
    return defaults.map(d => ({ ...d, ...(saved.find((s: TaskConfig) => s.id === d.id) || {}) }))
  } catch { return defaults }
}

export function saveTaskConfig(config: TaskConfig[]) {
  try { localStorage.setItem("task_config", JSON.stringify(config)) } catch {}
}

// ── Water target ──────────────────────────────────────────────────────────────
export function loadWaterTarget(): number {
  try { return Number(localStorage.getItem("water_target") || "2.5") } catch { return 2.5 }
}

export function saveWaterTarget(l: number) {
  try { localStorage.setItem("water_target", String(l)) } catch {}
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
    const raw = localStorage.getItem("workout_plan")
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
  try { localStorage.setItem("workout_plan", JSON.stringify(plan)) } catch {}
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
  try { return JSON.parse(localStorage.getItem("blood_test_log") || "[]") } catch { return [] }
}

export function saveBloodTestLog(log: BloodTestLog[]) {
  try { localStorage.setItem("blood_test_log", JSON.stringify(log)) } catch {}
}

// ── Med taken log (per day, keyed by date) ────────────────────────────────────
export function loadMedTakenForDate(date: string): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(`med_taken_${date}`) || "{}") } catch { return {} }
}

export function saveMedTakenForDate(date: string, taken: Record<string, boolean>) {
  try { localStorage.setItem(`med_taken_${date}`, JSON.stringify(taken)) } catch {}
}

// Weekly med last-taken timestamp
export function loadWeeklyMedLastTaken(medId: string): number | null {
  try {
    const v = localStorage.getItem(`med_weekly_${medId}`)
    return v ? Number(v) : null
  } catch { return null }
}

export function saveWeeklyMedLastTaken(medId: string, ts: number) {
  try { localStorage.setItem(`med_weekly_${medId}`, String(ts)) } catch {}
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
    const raw = localStorage.getItem("diet_config")
    return raw ? JSON.parse(raw) : { mode: "keto", tag: "eggetarian" }
  } catch { return { mode: "keto", tag: "eggetarian" } }
}

export function saveDietConfig(config: { mode: DietMode; tag: DietTag }) {
  try { localStorage.setItem("diet_config", JSON.stringify(config)) } catch {}
}

// ── Meal plan ─────────────────────────────────────────────────────────────────
export type MealPlanEntry = {
  id: string
  name: string
  time: string           // e.g. "2:00 PM"
  protein: number
  carbs: number
  fat: number
  cal: number
  tag: DietTag           // veg / eggetarian / non_veg
  ingredients: string[]  // plain text list
  steps: string[]        // plain text steps
  day?: string           // optional — "Monday" etc, blank = any day
  isPreset?: boolean     // came from a preset template
}

export function loadMealPlan(): MealPlanEntry[] {
  try { return JSON.parse(localStorage.getItem("meal_plan") || "[]") } catch { return [] }
}

export function saveMealPlan(plan: MealPlanEntry[]) {
  try { localStorage.setItem("meal_plan", JSON.stringify(plan)) } catch {}
}

// ── Eating out log ────────────────────────────────────────────────────────────
export function markEatingOut(date: string) {
  try { localStorage.setItem(`eating_out_${date}`, "1") } catch {}
}

export function wasEatingOut(date: string): boolean {
  try { return localStorage.getItem(`eating_out_${date}`) === "1" } catch { return false }
}

// ── Theme ─────────────────────────────────────────────────────────────────────
export type Theme = "light" | "dark"

export function loadTheme(): Theme {
  try { return (localStorage.getItem("app_theme") as Theme) || "light" } catch { return "light" }
}

export function saveTheme(t: Theme) {
  try {
    localStorage.setItem("app_theme", t)
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
  try { return JSON.parse(localStorage.getItem("break_periods") || "[]") } catch { return [] }
}

export function saveBreakPeriods(periods: BreakPeriod[]) {
  try { localStorage.setItem("break_periods", JSON.stringify(periods)) } catch {}
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
  try { return JSON.parse(localStorage.getItem("body_comp_log") || "[]") } catch { return [] }
}

export function saveBodyCompositionLog(log: BodyCompositionEntry[]) {
  try { localStorage.setItem("body_comp_log", JSON.stringify(log.slice(0, 120))) } catch {}
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
  doIF: boolean
}

export function loadOnboarding(): OnboardingData {
  try {
    const raw = localStorage.getItem("onboarding")
    return raw ? JSON.parse(raw) : { completed: false, step: 0, doIF: true }
  } catch { return { completed: false, step: 0, doIF: true } }
}

export function saveOnboarding(data: OnboardingData) {
  try { localStorage.setItem("onboarding", JSON.stringify(data)) } catch {}
}

export function needsOnboarding(): boolean {
  const ob = loadOnboarding()
  if (ob.completed) return false
  // Check if key profile fields are empty
  try {
    const store = JSON.parse(localStorage.getItem("ht-react-store") || "{}")
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
    const store = JSON.parse(localStorage.getItem("ht-react-store") || "{}")
    profile = store?.state?.profile || {}
    goals   = store?.state?.goals   || {}
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
    const items = JSON.parse(localStorage.getItem("focus_items") || "[]") as FocusItem[]
    // Auto-expire
    const now = Date.now()
    return items.filter(i => !i.done && i.expiresAt > now)
  } catch { return [] }
}

export function saveFocusItems(items: FocusItem[]) {
  try { localStorage.setItem("focus_items", JSON.stringify(items)) } catch {}
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
    return JSON.parse(localStorage.getItem("ai_settings") || '{"anthropicKey":"","openaiKey":"","voiceMode":"webspeech"}')
  } catch { return { anthropicKey: "", openaiKey: "", voiceMode: "webspeech" } }
}

export function saveAISettings(s: AISettings) {
  try { localStorage.setItem("ai_settings", JSON.stringify(s)) } catch {}
}
