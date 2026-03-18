import { useState } from "react"
import {
  loadDayData, saveDayData, DayData, loadHistory, saveHistory,
  loadDietConfig, markEatingOut, wasEatingOut, FoodEntry,
} from "../store/useHealthStore"
import {
  EATING_OUT_DB, EATING_OUT_CUISINES, EatingOutDish,
  getOrderingSuggestions,
} from "../services/mealPlanPresets"
import { getISTDate } from "../utils/dateHelpers"
import { computeMacros } from "../services/adaptiveTDEE"
import { useHealthStore } from "../store/useHealthStore"

function makeId() { return `eatout-${Date.now()}-${Math.random().toString(36).slice(2)}` }

// ── Dish Row ──────────────────────────────────────────────────────────────────
function DishRow({ dish, onLog }: { dish: EatingOutDish; onLog: (d: EatingOutDish) => void }) {
  return (
    <button onClick={() => onLog(dish)}
      className="w-full text-left px-3 py-2.5 rounded-xl mb-1.5 bg-gray-50 border border-transparent hover:border-teal-300 transition-colors">
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-gray-800 leading-tight">{dish.name}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">
            P <span className="text-blue-600 font-bold">{dish.protein}g</span>
            {" · "}C <span className="font-bold" style={{ color: dish.carbs <= 10 ? "#16a34a" : dish.carbs <= 25 ? "#f59e0b" : "#ef4444" }}>{dish.carbs}g</span>
            {" · "}F <span className="text-purple-600 font-bold">{dish.fat}g</span>
            {" · "}<span className="text-gray-500">{dish.calRange} kcal</span>
          </div>
          {dish.note && <div className="text-[9px] text-amber-600 mt-0.5">⚠️ {dish.note}</div>}
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          {dish.ketoFriendly && (
            <span className="text-[8px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">Keto ✓</span>
          )}
          <span className="text-[9px] text-teal-600 font-bold">+ Log</span>
        </div>
      </div>
    </button>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function EatingOut() {
  const today = getISTDate()
  const { profile, goals, settings } = useHealthStore()
  const [day, setDay] = useState<DayData>(() => loadDayData(today))
  const [dietConfig] = useState(() => loadDietConfig())
  const [activeCuisine, setActiveCuisine] = useState(EATING_OUT_CUISINES[0])
  const [markedOut, setMarkedOut] = useState(() => wasEatingOut(today))
  const [loggedDish, setLoggedDish] = useState<string | null>(null)

  const macros = computeMacros(profile, goals, settings)

  // Remaining macros today
  const logged = (day.entries || []).reduce(
    (a, e) => ({ cal: a.cal + e.calories, protein: a.protein + e.protein, carbs: a.carbs + e.carbs, fat: a.fat + e.fat }),
    { cal: 0, protein: 0, carbs: 0, fat: 0 }
  )
  const remaining = {
    cal:     (macros?.targetCalories ?? 1350) - logged.cal,
    protein: (macros?.proteinG ?? 110)        - logged.protein,
    carbs:   (macros?.carbsG ?? 22)           - logged.carbs,
    fat:     (macros?.fatG ?? 95)             - logged.fat,
  }

  const isKeto = dietConfig.mode === "keto"
  const suggestions = getOrderingSuggestions(remaining, dietConfig.tag, isKeto)

  // Filter dishes by cuisine + diet tag
  const cuisineDishes = EATING_OUT_DB.filter(d =>
    d.cuisine === activeCuisine &&
    (dietConfig.tag === "non_veg" ? true : d.tag.includes(dietConfig.tag))
  )

  function handleMarkOut() {
    markEatingOut(today)
    setMarkedOut(true)
  }

  function logDish(dish: EatingOutDish) {
    const entry: FoodEntry = {
      id: makeId(),
      name: `~${dish.name}`,  // ~ prefix = estimated
      calories: dish.cal,
      protein: dish.protein,
      carbs: dish.carbs,
      fat: dish.fat,
      timestamp: Date.now(),
    }
    const updated = { ...day, entries: [...(day.entries || []), entry] }
    setDay(updated)
    saveDayData(updated)

    // Sync history
    const hist = loadHistory()
    const tots = updated.entries.reduce(
      (a, e) => ({ cal: a.cal + e.calories, protein: a.protein + e.protein, carbs: a.carbs + e.carbs, fat: a.fat + e.fat }),
      { cal: 0, protein: 0, carbs: 0, fat: 0 }
    )
    const idx = hist.findIndex(h => h.date === today)
    if (idx >= 0) hist[idx] = { ...hist[idx], ...tots }
    saveHistory(hist)

    // Auto-mark eating out
    markEatingOut(today)
    setMarkedOut(true)
    setLoggedDish(dish.name)
    setTimeout(() => setLoggedDish(null), 2500)
  }

  return (
    <div>
      {/* Mark eating out */}
      <div className={`rounded-xl p-3 mb-3 border ${markedOut ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-200"}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-gray-700">🍽 Eating out today?</div>
            <div className="text-[10px] text-gray-400 mt-0.5">
              {markedOut
                ? "Flagged — tomorrow's weight may show sodium/oil effect"
                : "Flag this so tomorrow's weight reading is contextualised correctly"}
            </div>
          </div>
          {!markedOut && (
            <button onClick={handleMarkOut}
              className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-bold shrink-0 ml-2">
              Flag it
            </button>
          )}
          {markedOut && <span className="text-amber-600 text-xs font-bold shrink-0 ml-2">✓ Flagged</span>}
        </div>
      </div>

      {/* Remaining macros */}
      <div className="bg-gray-50 rounded-xl p-3 mb-3">
        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-2">Remaining today</div>
        <div className="flex gap-3">
          {[
            { label: "Cal",     val: Math.round(remaining.cal),     color: remaining.cal < 0 ? "text-red-500" : "text-gray-700" },
            { label: "Protein", val: Math.round(remaining.protein), color: remaining.protein < 10 ? "text-red-500" : "text-blue-600" },
            { label: "Carbs",   val: Math.round(remaining.carbs),   color: remaining.carbs < 0 ? "text-red-500" : "text-green-600" },
          ].map(({ label, val, color }) => (
            <div key={label} className="flex-1 text-center">
              <div className={`text-sm font-bold ${color}`}>{val > 0 ? val : 0}{label === "Cal" ? "" : "g"}</div>
              <div className="text-[9px] text-gray-400">{label} left</div>
            </div>
          ))}
        </div>
      </div>

      {/* Smart ordering suggestions */}
      <div className="bg-white rounded-xl border border-gray-100 p-3 mb-3">
        <div className="text-xs font-bold text-gray-700 mb-2">💡 What to order</div>
        <div className="space-y-1.5">
          {suggestions.slice(0, 5).map((s, i) => (
            <div key={i} className={`flex gap-2 items-start text-[10px]
              ${s.type === "order" ? "text-green-700" : "text-red-600"}`}>
              <span className="shrink-0 font-bold">{s.type === "order" ? "✓" : "✗"}</span>
              <span>{s.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Logged success toast */}
      {loggedDish && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 mb-3 text-xs text-teal-700 font-bold text-center">
          ✓ Logged: ~{loggedDish}
        </div>
      )}

      {/* Cuisine selector */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {EATING_OUT_CUISINES.map(c => (
          <button key={c} onClick={() => setActiveCuisine(c)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border
              ${activeCuisine === c ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-500 border-gray-200"}`}>
            {c}
          </button>
        ))}
      </div>

      {/* Dish list */}
      <div className="text-[10px] text-gray-400 mb-2">
        Macros are midpoint estimates — logged with ~ prefix. Tap to log.
      </div>
      {cuisineDishes.length === 0 ? (
        <div className="text-xs text-gray-400 text-center py-4">
          No {dietConfig.tag} options in this cuisine category
        </div>
      ) : (
        cuisineDishes.map((dish, i) => (
          <DishRow key={i} dish={dish} onLog={logDish} />
        ))
      )}
    </div>
  )
}
