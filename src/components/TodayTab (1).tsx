import { KEYS } from "../services/storageKeys"
import { useState, useEffect, useCallback } from "react"
import { useHealthStore } from "../store/useHealthStore"
import { loadDayData, saveDayData, DayData, loadHistory, saveHistory, loadMedications, loadTaskConfig, loadWaterTarget } from "../store/useHealthStore"
import { getTopNudge } from "../services/nudgeEngine"
import SetupChip from "./SetupChip"
import NextActionCard from "./NextActionCard"
import MacroExplainer from "./MacroExplainer"
import { isInBreakPeriod } from "../store/useHealthStore"
import { computeMacros } from "../services/adaptiveTDEE"
import { getISTDate } from "../utils/dateHelpers"
import { GoalMode, getFlags, isMaternalMode, isGeriatricMode, loadGoalMode, saveGoalMode } from "../services/goalModeConfig"
import MicronutrientChecklist from "./MicronutrientChecklist"
import MealPlanSync from "./MealPlanSync"
import TomorrowSection from "./TomorrowSection"
import { getDayName } from "../data/mealPlan"
import {
  getEffectiveMeals,
  getSwapCandidates,
  saveSwap,
  clearSwap,
  isSwapped,
  pruneSwaps,
} from "../services/mealSwap"
import { getDateForOffset } from "../utils/dateHelpers"
import MealSwapPicker from "./MealSwapPicker"
import type { DietTag } from "../store/useHealthStore"
import { formatDailySummaryForShare, shareOrCopy } from "../services/shareUtils"
import {
  computeGroceryList,
  formatGroceryForSharing,
  formatRecipesForSharing,
} from "../services/tomorrowPlan"

// ── Get today's meals — from stored plan if available, else hardcoded fallback ─
// Routes through getEffectiveMeals so per-slot swaps for `date` are overlaid on
// the canonical plan before mapping to StoredMeal. `date` is YYYY-MM-DD and must
// match the swap key the picker writes (getISTDate()).
function getTodayMeals(dayName: string, date: string): { meals: StoredMeal[]; fromStore: boolean } {
  const todayEntries = getEffectiveMeals(date, dayName)
  if (todayEntries.length > 0) {
    return {
      fromStore: true,
      meals: todayEntries.map(e => ({
        name:        e.name,
        time:        e.time,
        protein:     e.protein,
        carbs:       e.carbs,
        fat:         e.fat,
        cal:         e.cal,
        ingredients: (e.ingredients || []).map((s, i) => ({ hi: s, en: s, qty: "" })),
        steps:       (e.steps       || []).map((s, i) => ({ hi: s, en: s })),
      }))
    }
  }
  // No stored plan and no fallback. Returning an empty meals list is the
  // honest behaviour — previously this fell back to a hardcoded keto rotation
  // (Andhra Egg Masala etc.) regardless of the user's actual mode, which
  // showed keto content to balanced/low-carb/recomp/maintenance users who
  // had no plan generated yet. The UI handles empty meals correctly: the
  // MealPlanSync banner already prompts "Generate your meal plan" in this state.
  return { fromStore: false, meals: [] }
}

type StoredMeal = {
  name: string; time: string
  protein: number; carbs: number; fat: number; cal: number
  ingredients: { hi: string; en: string; qty: string }[]
  steps: { hi: string; en: string }[]
}

// ── Section collapse persistence ──────────────────────────────────────────────
// Each section remembers open/closed state in localStorage.
// Weight section always resets open each new day until weight is logged.

const SECTION_PREFS_KEY = KEYS.TODAY_SECTION_PREFS

function loadSectionPrefs(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(SECTION_PREFS_KEY) || "{}") } catch { return {} }
}

function saveSectionPref(id: string, open: boolean) {
  const prefs = loadSectionPrefs()
  prefs[id] = open
  try { localStorage.setItem(SECTION_PREFS_KEY, JSON.stringify(prefs)) } catch {}
}

function useSectionState(id: string, defaultOpen: boolean) {
  const [open, setOpenState] = useState<boolean>(() => {
    const prefs = loadSectionPrefs()
    return id in prefs ? prefs[id] : defaultOpen
  })
  function setOpen(val: boolean) {
    setOpenState(val)
    saveSectionPref(id, val)
  }
  return [open, setOpen] as const
}

// ── Collapsible Section wrapper ───────────────────────────────────────────────
function Section({ id, title, badge, defaultOpen = true, forceOpen = false, children }: {
  id: string
  title: React.ReactNode
  badge?: React.ReactNode
  defaultOpen?: boolean
  forceOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useSectionState(id, defaultOpen)
  const isOpen = forceOpen || open

  return (
    <div id={`card-${id}`} className="bg-white rounded-2xl shadow-sm mb-3 overflow-hidden">
      <button
        onClick={() => !forceOpen && setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-800">{title}</span>
          {badge}
        </div>
        {!forceOpen && (
          <span className="text-gray-400 text-xs ml-2">{isOpen ? "▲" : "▼"}</span>
        )}
      </button>
      {isOpen && (
        <div className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  )
}

// ── Macro targets (keto defaults, overridden by Settings) ─────────────────────
const DEFAULT_TARGETS = { cal: 1350, protein: 110, carbs: 22, fat: 95 }

// ── Small helpers ─────────────────────────────────────────────────────────────
function sumMacros(entries: DayData["entries"]) {
  return entries.reduce(
    (a, e) => ({ cal: a.cal + e.calories, protein: a.protein + e.protein, carbs: a.carbs + e.carbs, fat: a.fat + e.fat }),
    { cal: 0, protein: 0, carbs: 0, fat: 0 }
  )
}

function pct(val: number, max: number) { return Math.min(100, max > 0 ? Math.round(val / max * 100) : 0) }

// ── SVG Macro Ring ────────────────────────────────────────────────────────────
function MacroRing({ val, max, color, label, unit = "g" }: {
  val: number; max: number; color: string; label: string; unit?: string
}) {
  const p = pct(val, max)
  const r = 28, circ = 2 * Math.PI * r
  const dash = circ * p / 100
  const textColor = p >= 90 && p <= 115 ? "#16a34a" : p > 115 ? "#ef4444" : "#6b7280"
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="70" height="70" viewBox="0 0 70 70">
        <circle cx="35" cy="35" r={r} fill="none" stroke="#e5e7eb" strokeWidth="7" />
        <circle cx="35" cy="35" r={r} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ / 4}
          strokeLinecap="round" />
        <text x="35" y="33" textAnchor="middle" fontSize="11" fontWeight="700" fill="#1f2937">{Math.round(val)}</text>
        <text x="35" y="46" textAnchor="middle" fontSize="9" fill="#9ca3af">{unit}</text>
      </svg>
      <div className="text-[10px] text-gray-500 font-semibold">{label}</div>
      <div className={`text-[9px]`} style={{ color: textColor }}>{p}% of {max}{unit}</div>
    </div>
  )
}

// ── Progress Bar ──────────────────────────────────────────────────────────────
function MacroBar({ val, max, color, label }: { val: number; max: number; color: string; label: string }) {
  const p = pct(val, max)
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{label}</span>
        <span>{Math.round(val)} / {max} ({p}%)</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${p}%`, background: color }} />
      </div>
    </div>
  )
}

// ── Task Bubble ───────────────────────────────────────────────────────────────
function TaskBubble({ icon, line1, line2, done, onTap }: {
  icon: string; line1: string; line2: string; done: boolean; onTap: () => void
}) {
  return (
    <button onClick={onTap} className="flex flex-col items-center gap-1 bg-transparent border-none cursor-pointer p-0.5">
      <div className={`w-13 h-13 rounded-full flex items-center justify-center text-xl shadow-md transition-colors
        ${done ? "bg-teal-600" : "bg-red-500"}`}
        style={{ width: 52, height: 52 }}>
        {icon}
      </div>
      <div className="text-[9px] font-bold text-gray-800 text-center leading-tight max-w-[52px]">
        {line1}<br />
        <span className="font-normal text-gray-500">{line2}</span>
      </div>
    </button>
  )
}

// ── Meal Card ─────────────────────────────────────────────────────────────────
// Users can adjust per-ingredient quantities and see live macro recalculation.
//
// Ingredient string formats handled:
//   "3 whole eggs"          → qty=3, unit="",    rest="whole eggs"
//   "80g paneer — crumbled" → qty=80, unit="g",  rest="paneer — crumbled"
//   "2 tsp ghee"            → qty=2, unit="tsp", rest="ghee"
//   "1 scoop whey"          → qty=1, unit="scoop", rest="whey"

type ParsedIngredient = {
  raw: string      // original display string
  qty: number      // base numeric quantity (0 = unparseable, show as-is)
  unit: string     // "g" | "tsp" | "tbsp" | "scoop" | "ml" | ""
  rest: string     // ingredient name + prep note
  adjQty: number   // user-adjusted quantity
}

function parseIngredient(raw: string): ParsedIngredient {
  const match = raw.match(/^(\d+(?:\.\d+)?)\s*(g|tsp|tbsp|scoop|ml|kg)?\s*(.*)$/)
  if (match) {
    const qty  = parseFloat(match[1])
    const unit = match[2] ?? ""
    const rest = match[3].trim()
    return { raw, qty, unit, rest, adjQty: qty }
  }
  return { raw, qty: 0, unit: "", rest: raw, adjQty: 0 }
}

function formatAdjusted(ing: ParsedIngredient): string {
  if (ing.qty === 0) return ing.raw
  const num = (ing.unit === "g" || ing.unit === "ml" || ing.unit === "kg")
    ? Math.round(ing.adjQty)
    : +ing.adjQty.toFixed(1)
  return `${num}${ing.unit ? ing.unit + " " : " "}${ing.rest}`
}

function stepFor(unit: string): number {
  if (unit === "g" || unit === "ml") return 10
  if (unit === "tsp" || unit === "tbsp") return 0.5
  if (unit === "scoop") return 0.5
  return 1
}

function MealCard({ meal, index, onLog }: { meal: StoredMeal; index: number; onLog: (scaleFactor: number) => void }) {
  const [open, setOpen] = useState(false)

  const [ingredients, setIngredients] = useState<ParsedIngredient[]>(() =>
    meal.ingredients.map(ing => parseIngredient(ing.en || String(ing)))
  )

  const adjustableCount = ingredients.filter(i => i.qty > 0).length
  const scaleFactor = adjustableCount === 0 ? 1 :
    ingredients.filter(i => i.qty > 0).reduce((sum, i) => sum + i.adjQty / i.qty, 0) / adjustableCount

  const scaled = {
    protein: +(meal.protein * scaleFactor).toFixed(1),
    carbs:   +(meal.carbs   * scaleFactor).toFixed(1),
    fat:     +(meal.fat     * scaleFactor).toFixed(1),
    cal:     Math.round(meal.cal * scaleFactor),
  }

  const macrosChanged = Math.abs(scaleFactor - 1) > 0.01

  function adjustQty(idx: number, delta: number) {
    setIngredients(prev => prev.map((ing, i) => {
      if (i !== idx || ing.qty === 0) return ing
      const step = stepFor(ing.unit)
      const min  = (ing.unit === "g" || ing.unit === "ml") ? 10 : 0.5
      const newQ = Math.max(min, +(ing.adjQty + delta * step).toFixed(2))
      return { ...ing, adjQty: newQ }
    }))
  }

  function resetQty(idx: number) {
    setIngredients(prev => prev.map((ing, i) =>
      i === idx ? { ...ing, adjQty: ing.qty } : ing
    ))
  }

  function resetAll() {
    setIngredients(prev => prev.map(ing => ({ ...ing, adjQty: ing.qty })))
  }

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden mb-3">

      {/* ── Header ── */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex justify-between items-start p-3 bg-white text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-teal-700 mb-0.5">Meal {index + 1} · {meal.time}</div>
          <div className="text-sm font-semibold text-gray-800 leading-tight">{meal.name}</div>
          <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-x-2">
            <span className={macrosChanged ? "text-blue-600 font-semibold" : ""}>P {scaled.protein}g</span>
            <span>·</span>
            <span className={macrosChanged ? "text-green-600 font-semibold" : ""}>C {scaled.carbs}g</span>
            <span>·</span>
            <span className={macrosChanged ? "text-amber-600 font-semibold" : ""}>F {scaled.fat}g</span>
            <span>·</span>
            <span className={macrosChanged ? "font-semibold text-teal-700" : ""}>{scaled.cal} kcal</span>
            {macrosChanged && (
              <span className="text-[10px] text-teal-500">
                ({scaleFactor > 1 ? "+" : ""}{Math.round((scaleFactor - 1) * 100)}%)
              </span>
            )}
          </div>
        </div>
        <span className="text-gray-400 ml-2 mt-1 shrink-0">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="bg-gray-50 px-3 pb-3">

          {/* ── Ingredients with quantity controls ── */}
          <div className="flex items-center justify-between mt-2 mb-1.5">
            <div className="text-xs font-semibold text-gray-600">Ingredients</div>
            {macrosChanged && (
              <button onClick={resetAll}
                className="text-[10px] text-gray-400 border border-gray-200 px-2 py-0.5 rounded-full">
                Reset all
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            {ingredients.map((ing, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-gray-700">
                    {ing.qty > 0 ? formatAdjusted(ing) : ing.raw}
                  </span>
                  {/* Show Hindi label if different from English */}
                  {meal.ingredients[i]?.hi && meal.ingredients[i].hi !== meal.ingredients[i].en && (
                    <span className="text-[10px] text-gray-400 ml-1">{meal.ingredients[i].hi}</span>
                  )}
                </div>
                {ing.qty > 0 && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button onClick={() => adjustQty(i, -1)}
                      className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 text-sm font-bold flex items-center justify-center">
                      −
                    </button>
                    <button onClick={() => resetQty(i)}
                      className={`text-[9px] px-1 py-0.5 rounded font-mono min-w-[32px] text-center
                        ${Math.abs(ing.adjQty - ing.qty) > 0.01
                          ? "text-teal-700 font-bold bg-teal-50"
                          : "text-gray-400"}`}>
                      {(ing.unit === "g" || ing.unit === "ml")
                        ? `${Math.round(ing.adjQty)}${ing.unit}`
                        : `${+ing.adjQty.toFixed(1)}${ing.unit}`}
                    </button>
                    <button onClick={() => adjustQty(i, +1)}
                      className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 text-sm font-bold flex items-center justify-center">
                      +
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* ── Live macro preview when adjusted ── */}
          {macrosChanged && (
            <div className="mt-3 bg-teal-50 border border-teal-100 rounded-xl p-2.5">
              <div className="text-[10px] font-semibold text-teal-700 mb-1.5">Adjusted macros</div>
              <div className="flex justify-around text-center">
                {[
                  { label: "Protein", val: scaled.protein, unit: "g", color: "text-blue-600" },
                  { label: "Carbs",   val: scaled.carbs,   unit: "g", color: "text-green-600" },
                  { label: "Fat",     val: scaled.fat,     unit: "g", color: "text-amber-600" },
                  { label: "Cals",    val: scaled.cal,     unit: "",  color: "text-teal-700"  },
                ].map(m => (
                  <div key={m.label}>
                    <div className={`text-sm font-bold ${m.color}`}>{m.val}{m.unit}</div>
                    <div className="text-[9px] text-gray-400">{m.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Steps ── */}
          <div className="text-xs font-semibold text-gray-600 mt-3 mb-1">Steps</div>
          {meal.steps.map((s, i) => (
            <div key={i} className="text-xs text-gray-700 py-0.5">
              <span className="text-teal-600 font-bold mr-1">{i + 1}.</span>{s.en}
            </div>
          ))}

          <button
            onClick={() => onLog(scaleFactor)}
            className="mt-3 w-full py-2 bg-teal-600 text-white rounded-lg text-xs font-bold"
          >
            + Log This Meal{macrosChanged ? ` (${scaled.cal} kcal)` : ""}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Positive Test Modal ───────────────────────────────────────────────────────
function PositiveTestModal({ onConfirm, onCancel }: { onConfirm: (weeks: number) => void; onCancel: () => void }) {
  const [weeks, setWeeks] = useState<number | "">(4)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-5">
        <div className="text-3xl text-center mb-2">🎉</div>
        <div className="text-base font-bold text-center text-gray-900 mb-1">Congratulations!</div>
        <p className="text-xs text-gray-500 text-center mb-4">
          Switching to First Trimester mode. How many weeks pregnant are you?
        </p>
        <input
          type="number" min="1" max="12" placeholder="e.g. 4"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:border-teal-500"
          value={weeks}
          onChange={e => setWeeks(e.target.value ? Number(e.target.value) : "")}
        />
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">
            Cancel
          </button>
          <button
            onClick={() => typeof weeks === "number" && onConfirm(weeks)}
            disabled={typeof weeks !== "number"}
            className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-bold"
          >
            Switch mode
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function TodayTab({ onNavigate, goalMode: propGoalMode }: {
  onNavigate: (tab: string) => void
  goalMode?: GoalMode
}) {
  const { profile, goals, settings } = useHealthStore()
  const today = getISTDate()
  const [day, setDay] = useState<DayData>(() => loadDayData(today))
  const [, setTick] = useState(0)
  // Use the prop directly (with localStorage fallback) instead of useState.
  // useState(propGoalMode ?? loadGoalMode()) would capture the value at first
  // render and never update — meaning a goalMode change in App.tsx (via the
  // post-onboarding sync or the periodic poll) wouldn't propagate here until
  // TodayTab happened to unmount and remount. That caused the "header stuck
  // on Fat Loss after picking Recomposition until I generate a meal plan"
  // bug. Reading the prop on every render keeps the header in sync.
  const goalMode: GoalMode = propGoalMode ?? loadGoalMode()
  const [showPositiveTest, setShowPositiveTest] = useState(false)
  const [shareToast, setShareToast] = useState<string | null>(null)

  const flags = getFlags(goalMode)
  const isMaternal = isMaternalMode(goalMode)

  const medications = loadMedications().filter(m => m.enabled && (
    m.frequency === "daily" ||
    (m.frequency === "weekly" && (m.days || []).includes(new Date().toLocaleDateString("en-US", { weekday: "long" })))
  ))
  const taskConfig = loadTaskConfig()
  const baseWaterTarget = loadWaterTarget()
  const currentWeight = Number(profile.weightKg) || 80
  // In pregnancy, minimum water target from macro targets; otherwise auto-scale
  const waterTarget = isMaternal
    ? Math.max(baseWaterTarget, goalMode === "breastfeeding" ? 3.5 : 3.0)
    : currentWeight > 80
    ? Math.max(baseWaterTarget, Math.round((2.5 + Math.floor((currentWeight - 80) / 20) * 0.5) * 4) / 4)
    : baseWaterTarget

  const isTaskEnabled = (id: string) => taskConfig.find(t => t.id === id)?.enabled ?? true
  const activeBreak = isInBreakPeriod(today)

  // Top nudge — now goal-mode aware
  const macroTargets = computeMacros(profile, goals, settings, goalMode)
  const topNudge = getTopNudge({
    history: loadHistory(),
    calTarget:     macroTargets?.targetCalories ?? 1350,
    proteinTarget: macroTargets?.proteinG ?? 110,
    carbTarget:    macroTargets?.carbsG ?? 22,
    waterTarget,
    fastingTarget: settings.ifProtocol.fastingHours,
    weightGoal:    Number(goals.targetWeightKg) || null,
    goalMode,
  })

  // Reload if date changes
  useEffect(() => {
    const interval = setInterval(() => {
      const now = getISTDate()
      if (now !== today) window.location.reload()
      setTick(t => t + 1)
    }, 60_000)
    return () => clearInterval(interval)
  }, [today])

  // Prune stale meal-swap keys (older than yesterday) once on mount, so
  // localStorage doesn't accumulate dead date-stamped swap entries over time.
  useEffect(() => {
    pruneSwaps(today)
  }, [today])

  const persist = useCallback((updated: DayData) => {
    setDay(updated)
    saveDayData(updated)
    const hist = loadHistory()
    const tots = sumMacros(updated.entries)
    const idx = hist.findIndex(h => h.date === updated.date)
    const row = {
      date: updated.date, cal: tots.cal, protein: tots.protein,
      carbs: tots.carbs, fat: tots.fat, weight: updated.weight,
      water: updated.water,
      workoutDone: updated.workouts.some(w => w.type === "circuit" || (w.exercises?.length ?? 0) > 0),
      fastBest: updated.fastBest,
    }
    if (idx >= 0) hist[idx] = row; else hist.unshift(row)
    hist.sort((a, b) => b.date.localeCompare(a.date))
    saveHistory(hist.slice(0, 180))
  }, [])

  const computed = computeMacros(profile, goals, settings, goalMode)
  const tgt = computed
    ? { cal: computed.targetCalories, protein: computed.proteinG, carbs: computed.carbsG, fat: computed.fatG }
    : DEFAULT_TARGETS

  const tots = sumMacros(day.entries)
  const dayName = getDayName()
  const { meals: todayMeals } = getTodayMeals(dayName, today)

  // ── Swap-as-substitution state (commit 13) ─────────────────────────────────
  // pickerSlot = which slot's picker is open (null = closed). swapVersion forces
  // a re-read after save/clear since localStorage isn't reactive.
  const [pickerSlot, setPickerSlot]   = useState<number | null>(null)
  const [swapVersion, setSwapVersion] = useState(0)
  void swapVersion
  const swapDietTag: DietTag = (() => {
    try {
      const cfg = JSON.parse(localStorage.getItem(KEYS.DIET_CONFIG) || "{}")
      if (cfg.tag === "veg" || cfg.tag === "eggetarian" || cfg.tag === "non_veg") return cfg.tag
    } catch { /* fall through */ }
    return "veg"
  })()
  const dateLabel = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })

  // ── Task completion ───────────────────────────────────────────────────────
  const medsOk = medications.length === 0 || medications.every(m => !!(day.meds || {})[m.id])
  const walkOk = (day.workouts || []).some(w => w.type === "walk" && w.duration >= 30)
  const proteinOk = tots.protein >= tgt.protein * 0.9
  const mealsLogged = todayMeals.filter(m => day.entries.some(e => e.name === m.name)).length
  const mealsOk = mealsLogged >= todayMeals.length
  const waterOk = day.water >= waterTarget
  const carbsOk = day.entries.length > 0 && tots.carbs > 0 && tots.carbs <= tgt.carbs * 1.1
  const fastOk = day.fastBest >= 19 * 3600
  const workoutOk = (day.workouts || []).some(w => w.type === "circuit" || (w.exercises?.length ?? 0) > 0)
  const weightOk = !!day.weight

  const allTasks = [
    { id: "meds",    icon: "💊", line1: "Meds",    line2: "Taken",                              done: medsOk,    tab: "" },
    { id: "walk",    icon: "🚶", line1: "Walk",    line2: "Done",                               done: walkOk,    tab: "workout" },
    { id: "protein", icon: "🥩", line1: "Protein", line2: "Target",                             done: proteinOk, tab: "food" },
    { id: "meals",   icon: "🍽", line1: "Meals",   line2: `${mealsLogged}/${todayMeals.length}`, done: mealsOk,   tab: "food" },
    { id: "water",   icon: "💧", line1: "Water",   line2: `${(day.water||0).toFixed(1)}L`,      done: waterOk,   tab: "" },
    { id: "carbs",   icon: "🌾", line1: "Carbs",   line2: "On Track",                           done: carbsOk,   tab: "food" },
    // Fast task hidden when the mode doesn't use fasting OR the user has it off
    ...(!flags.showFasting || !settings.ifProtocol.fastingEnabled ? [] : [
      { id: "fast", icon: "⏱", line1: "Fast", line2: "Active", done: fastOk, tab: "fasting" },
    ]),
    { id: "workout", icon: "🏋", line1: "Workout", line2: "Done",                               done: workoutOk, tab: "workout" },
    { id: "weight",  icon: "⚖️", line1: "Weight",  line2: "Logged",                             done: weightOk,  tab: "" },
  ]
  const tasks = allTasks.filter(t => isTaskEnabled(t.id))

  const doneCount = tasks.filter(t => t.done).length
  const completePct = Math.round(doneCount / tasks.length * 100)
  const dayComplete = tots.cal >= tgt.cal * 0.9 && tots.cal <= tgt.cal * 1.15 && tots.protein >= tgt.protein * 0.8

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleTaskTap(task: typeof tasks[0]) {
    if (task.tab) { onNavigate(task.tab); return }
    if (task.line1 === "Meds") scrollTo("card-meds")
    if (task.line1 === "Water") addWater(0.25)
    if (task.line1 === "Weight") scrollTo("card-weight")
  }

  function scrollTo(id: string) {
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50)
  }

  function addWater(v: number) {
    persist({ ...day, water: Math.max(0, +((day.water || 0) + v).toFixed(2)) })
  }

  function toggleMed(name: string) {
    const meds = { ...(day.meds || {}) }
    meds[name] = !meds[name]
    persist({ ...day, meds })
  }

  function saveWeight() {
    const val = (document.getElementById("weightInput") as HTMLInputElement)?.value
    const w = parseFloat(val)
    if (!w || w <= 0) return
    persist({ ...day, weight: w })
    ;(document.getElementById("weightInput") as HTMLInputElement).value = ""
  }

  function logMealFromPlan(meal: StoredMeal, scaleFactor: number = 1) {
    const existing = day.entries.find(e => e.name === meal.name)
    if (existing) return
    const entry = {
      id: `meal-${Date.now()}`,
      name: meal.name,
      calories: Math.round(meal.cal     * scaleFactor),
      protein:  +(meal.protein * scaleFactor).toFixed(1),
      carbs:    +(meal.carbs   * scaleFactor).toFixed(1),
      fat:      +(meal.fat     * scaleFactor).toFixed(1),
      timestamp: Date.now(),
    }
    persist({ ...day, entries: [...day.entries, entry] })
  }

  function handlePositiveTest(weeks: number) {
    // Switch to pregnancy_t1 and save weeks pregnant
    saveGoalMode("pregnancy_t1")
    try {
      const pregSettings = JSON.parse(localStorage.getItem(KEYS.PREGNANCY_SETTINGS) || "{}")
      localStorage.setItem(KEYS.PREGNANCY_SETTINGS, JSON.stringify({ ...pregSettings, weeksPregnant: weeks, gdm: false }))
    } catch {}
    setShowPositiveTest(false)
    window.location.reload() // reload so App picks up new mode
  }

  // ── Share handler ─────────────────────────────────────────────────────────
  async function handleShare() {
    const meds = loadMedications().filter(m => m.enabled)
    const medsAllTaken = meds.length === 0 || meds.every(m => !!(day.meds || {})[m.id])
    const text = formatDailySummaryForShare({
      date:          today,
      calories:      tots.cal,
      calTarget:     tgt.cal,
      protein:       tots.protein,
      proteinTarget: tgt.protein,
      carbs:         tots.carbs,
      fat:           tots.fat,
      water:         day.water || 0,
      waterTarget,
      weight:        day.weight ?? undefined,
      fastHours:     day.fastBest,
      medsAllTaken,
    })
    const result = await shareOrCopy(text)
    const msg = result === "clipboard" ? "Copied!" : result === "native" ? "Shared!" : "Opening WhatsApp…"
    setShareToast(msg)
    setTimeout(() => setShareToast(null), 2500)
  }

  // ── Today cook-export handlers (grocery + recipes) ─────────────────────────
  // Mirrors TomorrowSection's "Send to cook" actions but for TODAY's plan.
  // Resolves today's effective meals (swap-aware) fresh at click time so a
  // last-minute swap is reflected. Reuses the same formatters as Tomorrow so
  // the cook receives an identically-shaped message regardless of which day
  // it was sent from. shareOrCopy routes to WhatsApp / native share /
  // clipboard the same way the daily-summary share does.
  async function exportTodayGrocery() {
    const meals       = getEffectiveMeals(today, dayName)
    const groceryList = computeGroceryList(meals)
    const text        = formatGroceryForSharing(groceryList, `Today (${dayName})`)
    const result      = await shareOrCopy(text, "Today's grocery list")
    const msg = result === "clipboard" ? "Grocery copied!" : result === "native" ? "Shared!" : "Opening WhatsApp…"
    setShareToast(msg)
    setTimeout(() => setShareToast(null), 2500)
  }
  async function exportTodayRecipes() {
    const meals  = getEffectiveMeals(today, dayName)
    const text   = formatRecipesForSharing(meals, `Today (${dayName})`)
    const result = await shareOrCopy(text, "Today's recipes")
    const msg = result === "clipboard" ? "Recipes copied!" : result === "native" ? "Shared!" : "Opening WhatsApp…"
    setShareToast(msg)
    setTimeout(() => setShareToast(null), 2500)
  }

  // ── Medication badge helper ───────────────────────────────────────────────
  function getMedStyle(med: any) {
    const type = med.type ?? "prescribed"
    if (type === "supplement") return { bg: "bg-blue-50 border-blue-300",  text: "text-blue-700",  badge: "🔵 Supplement" }
    if (type === "reminder")   return { bg: "bg-gray-50 border-gray-200",  text: "text-gray-700",  badge: "🔔 Reminder" }
    return                            { bg: "bg-teal-50 border-teal-300",  text: "text-teal-700",  badge: "" }
  }

  return (
    <div className="pb-24">

      {/* ── Header — scrolls away ── */}
      <div className={`p-3 pb-2`}>
        <div className={`rounded-2xl p-4 text-white ${
          isMaternalMode(goalMode)   ? "bg-gradient-to-br from-rose-800 to-rose-600"
          : isGeriatricMode(goalMode)  ? "bg-gradient-to-br from-amber-800 to-amber-600"
          : goalMode === "child"       ? "bg-gradient-to-br from-indigo-700 to-purple-600"
          : (goalMode === "teen_early" || goalMode === "teen_older") ? "bg-gradient-to-br from-blue-800 to-blue-600"
          : "bg-gradient-to-br from-gray-900 to-teal-800"
        }`}>
          <div className="text-xs opacity-70 mb-0.5">{dayName} · {dateLabel}</div>
          <div className="text-base font-bold">{
            isMaternalMode(goalMode) ? `${goalMode === "pre_conception" ? "🌱" : "🤰"} ${
              goalMode === "pre_conception" ? "Pre-Conception"
              : goalMode === "pregnancy_t1" ? "First Trimester"
              : goalMode === "pregnancy_t2" ? "Second Trimester"
              : goalMode === "pregnancy_t3" ? "Third Trimester"
              : goalMode === "postpartum"   ? "Postpartum"
              : "Breastfeeding"
            } mode`
            : isGeriatricMode(goalMode)  ? "🧓 Healthy Ageing"
            : goalMode === "child"       ? "🧒 Child — Growing Strong"
            : goalMode === "teen_early"  ? "🧑 Early Teen"
            : goalMode === "teen_older"  ? "👦 Teen"
            // Previously fell back to a hardcoded meal-rotation theme
            // ("Andhra Egg Masala & Bhuna Paneer Tikka") shown to every
            // non-special-mode user regardless of their actual eating mode.
            // Replaced with a goal-mode label so the header always describes
            // what the user is actually doing, not a stale keto-rotation name.
            : goalMode === "recomposition" ? "💪 Recomposition"
            : goalMode === "maintenance"   ? "⚖️ Maintenance"
            : "🎯 Fat Loss"
          }</div>
          {profile.name && <div className="text-xs opacity-60 mt-0.5">Good day, {profile.name} 👋</div>}
        </div>
      </div>

      {/* ── Sticky summary strip — stays visible while scrolling ── */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">

          {/* Calories remaining */}
          <div className="flex-1 text-center">
            <div className={`text-base font-bold leading-tight
              ${tots.cal > tgt.cal * 1.15 ? "text-red-500" : tots.cal >= tgt.cal * 0.9 ? "text-green-600" : "text-gray-800"}`}>
              {Math.max(0, tgt.cal - Math.round(tots.cal))}
            </div>
            <div className="text-[9px] text-gray-400 font-semibold uppercase tracking-wide">kcal left</div>
          </div>

          <div className="w-px h-8 bg-gray-100" />

          {/* Water */}
          <div className="flex-1 text-center">
            <div className={`text-base font-bold leading-tight ${waterOk ? "text-blue-500" : "text-gray-800"}`}>
              {(day.water || 0).toFixed(1)}
              <span className="text-xs font-normal text-gray-400">/{waterTarget}L</span>
            </div>
            <div className="text-[9px] text-gray-400 font-semibold uppercase tracking-wide">water</div>
          </div>

          <div className="w-px h-8 bg-gray-100" />

          {/* Tasks */}
          <div className="flex-1 text-center">
            <div className={`text-base font-bold leading-tight
              ${completePct === 100 ? "text-green-600" : completePct >= 55 ? "text-teal-600" : "text-gray-800"}`}>
              {doneCount}<span className="text-xs font-normal text-gray-400">/{tasks.length}</span>
            </div>
            <div className="text-[9px] text-gray-400 font-semibold uppercase tracking-wide">tasks</div>
          </div>

          <div className="w-px h-8 bg-gray-100" />

          {/* Protein */}
          <div className="flex-1 text-center">
            <div className={`text-base font-bold leading-tight ${proteinOk ? "text-blue-500" : "text-gray-800"}`}>
              {Math.round(tots.protein)}
              <span className="text-xs font-normal text-gray-400">g</span>
            </div>
            <div className="text-[9px] text-gray-400 font-semibold uppercase tracking-wide">protein</div>
          </div>

        </div>

        {/* Calorie progress bar — thin, under the numbers */}
        <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(100, pct(tots.cal, tgt.cal))}%`,
              background: tots.cal > tgt.cal * 1.15 ? "#ef4444" : tots.cal >= tgt.cal * 0.9 ? "#22c55e" : "#0d9488"
            }} />
        </div>

        {/* Share row */}
        <div className="mt-2 flex items-center justify-end gap-2">
          {shareToast && (
            <span className="text-[10px] text-teal-600 font-semibold animate-pulse">{shareToast}</span>
          )}
          <button onClick={handleShare}
            className="flex items-center gap-1 text-[10px] font-bold text-gray-500 border border-gray-200 px-2 py-1 rounded-lg">
            📤 Share day
          </button>
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="p-3 pt-2">

        {/* Pre-conception: positive test button */}
        {goalMode === "pre_conception" && (
          <button
            onClick={() => setShowPositiveTest(true)}
            className="w-full bg-rose-50 border border-rose-200 rounded-xl p-3 mb-3 text-sm font-semibold text-rose-700 text-center"
          >
            🎉 I got a positive test! Switch to Pregnancy mode
          </button>
        )}

        {/* Setup Chip */}
        <SetupChip onNavigate={onNavigate} />

        {/* Next Action — single high-priority "do this now" suggestion */}
        {!activeBreak && (
          <NextActionCard
            day={day}
            meds={medications}
            tgt={tgt}
            tots={tots}
            waterTarget={waterTarget}
            onNavigate={onNavigate}
            onScrollTo={scrollTo}
          />
        )}

        {/* Macro Explainer — tap any number to see how it's calculated */}
        {!activeBreak && <MacroExplainer />}

        {/* Break Period Banner */}
        {activeBreak && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-3 text-center">
            <div className="text-lg mb-1">
              {activeBreak.type === "vacation" ? "✈️" : activeBreak.type === "wedding" ? "💒" : activeBreak.type === "festival" ? "🎉" : "📅"}
            </div>
            <div className="text-sm font-bold text-amber-800">{activeBreak.label}</div>
            <div className="text-xs text-amber-600 mt-0.5">Break period — targets suspended, enjoy!</div>
          </div>
        )}

        {/* Nudge — single card, always visible when present */}
        {topNudge && (
          <div className={`rounded-xl border p-3 mb-3 text-xs leading-relaxed
            ${topNudge.color === "red"   ? "bg-red-50 border-red-200 text-red-800"
              : topNudge.color === "amber" ? "bg-amber-50 border-amber-200 text-amber-800"
              : topNudge.color === "blue"  ? "bg-blue-50 border-blue-200 text-blue-800"
              : topNudge.color === "green" ? "bg-green-50 border-green-200 text-green-800"
              : "bg-teal-50 border-teal-200 text-teal-800"}`}>
            {topNudge.icon} {topNudge.message}
          </div>
        )}

        {/* Day complete banner */}
        {dayComplete && !isMaternal && (
          <div className="bg-gradient-to-r from-green-700 to-green-600 rounded-2xl p-3 mb-3 text-white text-center">
            <div className="text-xl mb-1">🎉</div>
            <div className="text-sm font-bold">Day Complete!</div>
            <div className="text-xs opacity-85">Calories and protein targets hit — great work</div>
          </div>
        )}

        {/* ── WEIGHT — force open until logged, then user-controlled ── */}
        <Section
          id="weight"
          title="⚖️ Morning Weight"
          forceOpen={!weightOk}
          defaultOpen={true}
          badge={weightOk
            ? <span className="text-[10px] bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded-full">✓ {day.weight} kg</span>
            : <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded-full">Not logged</span>
          }
        >
          {day.weight ? (
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-teal-700">{day.weight} kg</div>
                {!isMaternal && profile.weightKg !== "" && (
                  <div className="text-xs text-gray-400 mt-0.5">
                    {(() => {
                      const diff = Number(profile.weightKg) - day.weight!
                      return diff > 0 ? `↓ ${diff.toFixed(1)} kg from start`
                        : diff < 0 ? `↑ ${Math.abs(diff).toFixed(1)} kg from start`
                        : "Same as start weight"
                    })()}
                  </div>
                )}
                {(goalMode === "pregnancy_t1" || goalMode === "pregnancy_t2" || goalMode === "pregnancy_t3") && (() => {
                  try {
                    const ps = JSON.parse(localStorage.getItem(KEYS.PREGNANCY_SETTINGS) || "{}")
                    if (ps.prePregnancyWeightKg) {
                      return <div className="text-xs text-rose-600 mt-0.5">+{(day.weight! - ps.prePregnancyWeightKg).toFixed(1)} kg from pre-pregnancy</div>
                    }
                  } catch {}
                  return null
                })()}
              </div>
              <button onClick={() => persist({ ...day, weight: null })}
                className="text-xs text-gray-400 border border-gray-200 px-3 py-1.5 rounded-lg">
                Clear
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input id="weightInput" type="number" step="0.1" min="30" max="300"
                placeholder="e.g. 113.5"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-teal-500" />
              <button onClick={saveWeight}
                className="px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-bold">
                Log
              </button>
            </div>
          )}
        </Section>

        {/* ── MEDICATIONS ── */}
        {isTaskEnabled("meds") && medications.length > 0 && (
          <Section
            id="meds"
            title={isMaternal ? "💊 Medications & Supplements" : "💊 Medications"}
            forceOpen={!medsOk}
            defaultOpen={true}
            badge={medsOk
              ? <span className="text-[10px] bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded-full">✓ All taken</span>
              : <span className="text-[10px] bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded-full">
                  {medications.filter(m => !(day.meds || {})[m.id]).length} remaining
                </span>
            }
          >
            {medications.map(med => {
              const taken = !!(day.meds || {})[med.id]
              const style = getMedStyle(med)
              return (
                <button key={med.id} onClick={() => toggleMed(med.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl mb-2 border transition-colors
                    ${taken ? style.bg : "bg-gray-50 border-gray-200"}`}>
                  <div className="text-left">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm font-semibold ${taken ? style.text : "text-gray-700"}`}>{med.name}</span>
                      {(med as any).type === "supplement" && (
                        <span className="text-[9px] bg-blue-100 text-blue-600 font-bold px-1.5 py-0.5 rounded-full">Supplement</span>
                      )}
                      {(med as any).type === "reminder" && (
                        <span className="text-[9px] bg-gray-100 text-gray-500 font-bold px-1.5 py-0.5 rounded-full">Reminder</span>
                      )}
                    </div>
                    {med.note && <div className="text-xs text-gray-400">{med.note}</div>}
                  </div>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold
                    ${taken ? "bg-teal-600 text-white" : "bg-gray-200 text-gray-400"}`}>
                    {taken ? "✓" : "○"}
                  </div>
                </button>
              )
            })}
          </Section>
        )}

        {/* ── MACROS ── */}
        <Section id="macros" title="📊 Today's Macros" defaultOpen={true}>
          <div className="flex justify-around mb-3">
            <MacroRing val={tots.protein} max={tgt.protein} color="#3b82f6" label="Protein" />
            <MacroRing val={tots.carbs}   max={tgt.carbs}   color="#22c55e" label="Carbs" />
            <MacroRing val={tots.fat}     max={tgt.fat}     color="#f59e0b" label="Fat" />
          </div>
          <MacroBar val={tots.cal} max={tgt.cal} color="#0d9488" label="Calories" />
          {day.entries.length === 0 && (
            <p className="text-xs text-gray-400 text-center mt-2">No food logged yet today</p>
          )}
        </Section>

        {/* ── WATER ── */}
        <Section
          id="water"
          title="💧 Water"
          defaultOpen={false}
          badge={
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full
              ${waterOk ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
              {(day.water || 0).toFixed(1)}L / {waterTarget}L
            </span>
          }
        >
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-3">
            <div className="h-full bg-blue-400 rounded-full transition-all duration-500"
              style={{ width: `${pct(day.water, waterTarget)}%` }} />
          </div>
          <div className="flex gap-2">
            {[0.25, 0.5, 1].map(v => (
              <button key={v} onClick={() => addWater(v)}
                className="flex-1 py-2 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold border border-blue-200">
                +{v}L
              </button>
            ))}
            <button onClick={() => addWater(-0.25)}
              className="py-2 px-3 bg-gray-50 text-gray-500 rounded-lg text-xs border border-gray-200">
              −
            </button>
          </div>
        </Section>

        {/* ── TASKS ── */}
        <Section
          id="tasks"
          title="✅ Today's Tasks"
          defaultOpen={completePct < 100}
          badge={
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white
              ${completePct === 100 ? "bg-green-500" : completePct >= 55 ? "bg-teal-600" : "bg-red-500"}`}>
              {completePct}%
            </span>
          }
        >
          <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(58px, 1fr))" }}>
            {tasks.map(t => (
              <TaskBubble key={t.line1} icon={t.icon} line1={t.line1} line2={t.line2}
                done={t.done} onTap={() => handleTaskTap(t)} />
            ))}
          </div>
        </Section>

        {/* ── MICRONUTRIENTS (pregnancy / geriatric) ── */}
        {flags.showMicronutrients && (
          <Section id="micronutrients" title="🌿 Micronutrients" defaultOpen={true}>
            <MicronutrientChecklist mode={goalMode} />
          </Section>
        )}

        {/* ── MEAL PLAN ── */}
        <Section
          id="meals"
          title="🍽 Today's Meals"
          defaultOpen={!mealsOk}
          badge={mealsLogged > 0
            ? <span className="text-[10px] bg-teal-100 text-teal-700 font-bold px-1.5 py-0.5 rounded-full">
                {mealsLogged}/{todayMeals.length} logged
              </span>
            : undefined
          }
        >
          {/* Compact sync warning — tap takes user to Meals tab */}
          <MealPlanSync compact onRegenerated={() => window.location.reload()} />
          {todayMeals.map((meal, i) => {
            const logged  = day.entries.some(e => e.name === meal.name)
            const swapped = isSwapped(today, i)
            return (
              <div key={i} className="relative">
                {logged && (
                  <div className="absolute top-2 right-8 z-10 bg-green-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                    ✓ Logged
                  </div>
                )}
                <MealCard meal={meal} index={i} onLog={(sf) => logMealFromPlan(meal, sf)} />
                <div className="flex items-center gap-2 mt-1 mb-2 px-1">
                  {swapped && (
                    <span className="text-[9px] font-bold uppercase tracking-wide bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded">
                      Swapped
                    </span>
                  )}
                  <button
                    onClick={() => setPickerSlot(i)}
                    className="text-[11px] font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1 rounded-lg"
                  >
                    🔄 Swap
                  </button>
                  {swapped && (
                    <button
                      onClick={() => { clearSwap(today, i); setSwapVersion(v => v + 1) }}
                      className="text-[11px] font-semibold bg-gray-50 hover:bg-gray-100 text-gray-500 px-2.5 py-1 rounded-lg"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            )
          })}
          {/* Removed hardcoded "Whey Shake — Isopure 1 scoop / 300ml water · ~4 PM"
              hint that was previously shown to every user regardless of mode,
              diet, or supplement use. This was keto/IF-specific developer
              content that didn't belong as a default UI element for non-keto
              users (or anyone not taking whey). If the user's generated meal
              plan includes a shake, it appears as a normal meal entry above. */}

          {/* ── Export grocery + recipes for today ──────────────────────────
              Single button each. Reuses the same formatters as the Tomorrow
              section so the cook gets an identically-shaped message. Only
              shown when there's a plan to export. */}
          {todayMeals.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="text-xs font-semibold text-gray-700 mb-1.5">📤 Export for today</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={exportTodayGrocery}
                  className="text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-xl"
                >
                  🛒 Grocery
                </button>
                <button
                  onClick={exportTodayRecipes}
                  className="text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-xl"
                >
                  👨‍🍳 Recipes
                </button>
              </div>
            </div>
          )}

          <MealSwapPicker
            open={pickerSlot !== null}
            slotLabel={
              pickerSlot !== null
                ? `Meal ${pickerSlot + 1} · ${todayMeals[pickerSlot]?.time ?? ""}`
                : ""
            }
            candidates={
              pickerSlot !== null ? getSwapCandidates(dayName, pickerSlot, swapDietTag) : []
            }
            onPick={meal => {
              if (pickerSlot !== null) {
                saveSwap(today, pickerSlot, meal)
                setPickerSlot(null)
                setSwapVersion(v => v + 1)
              }
            }}
            onClose={() => setPickerSlot(null)}
          />
        </Section>

        {/* ── TOMORROW (for the cook) ── */}
        <TomorrowSection />

        {/* ── FOOD LOG ── */}
        {day.entries.length > 0 && (
          <Section
            id="foodlog"
            title="📋 Food Log"
            defaultOpen={false}
            badge={
              <span className="text-[10px] bg-gray-100 text-gray-600 font-bold px-1.5 py-0.5 rounded-full">
                {day.entries.length} items · {Math.round(tots.cal)} kcal
              </span>
            }
          >
            {day.entries.map(e => (
              <div key={e.id} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                <div>
                  <div className="text-xs font-medium text-gray-700">{e.name}</div>
                  <div className="text-[10px] text-gray-400">P {e.protein}g · C {e.carbs}g · F {e.fat}g</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-600">{e.calories} kcal</span>
                  <button onClick={() => persist({ ...day, entries: day.entries.filter(x => x.id !== e.id) })}
                    className="text-red-300 text-xs px-1.5 py-0.5 rounded border border-red-100">✕</button>
                </div>
              </div>
            ))}
            <div className="flex justify-between text-xs font-bold text-gray-700 pt-2 mt-1 border-t border-gray-100">
              <span>Total</span>
              <span>{Math.round(tots.cal)} kcal · P{Math.round(tots.protein)}g</span>
            </div>
          </Section>
        )}

      </div>

      {/* Positive test modal */}
      {showPositiveTest && (
        <PositiveTestModal
          onConfirm={handlePositiveTest}
          onCancel={() => setShowPositiveTest(false)}
        />
      )}

    </div>
  )
}
