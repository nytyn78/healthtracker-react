import { useState } from "react"
import {
  loadMealPlan, saveMealPlan, MealPlanEntry, DietTag, DIET_TAG_LABELS,
  loadDietConfig, saveDietConfig, DietMode, DIET_MODE_LABELS,
} from "../store/useHealthStore"
import { PRESETS, PresetKey } from "../services/mealPlanPresets"

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday","Any day"]
const TAG_COLORS: Record<DietTag, string> = {
  veg:        "bg-green-100 text-green-700",
  eggetarian: "bg-yellow-100 text-yellow-700",
  non_veg:    "bg-red-100 text-red-700",
}

function makeId() { return `meal-${Date.now()}-${Math.random().toString(36).slice(2)}` }

// ── Meal Card ─────────────────────────────────────────────────────────────────
function MealCard({ meal, onDelete }: { meal: MealPlanEntry; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden mb-2">
      <button onClick={() => setExpanded(e => !e)}
        className="w-full flex items-start justify-between p-3 bg-white text-left">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${TAG_COLORS[meal.tag]}`}>
              {DIET_TAG_LABELS[meal.tag]}
            </span>
            {meal.day && meal.day !== "Any day" && (
              <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{meal.day}</span>
            )}
            {meal.time && (
              <span className="text-[9px] text-gray-400">{meal.time}</span>
            )}
          </div>
          <div className="text-xs font-semibold text-gray-800 leading-tight">{meal.name}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">
            P {meal.protein}g · C {meal.carbs}g · F {meal.fat}g · {meal.cal} kcal
          </div>
        </div>
        <div className="flex items-center gap-1 ml-2 shrink-0">
          <button onClick={e => { e.stopPropagation(); onDelete() }}
            className="text-red-300 text-xs px-1.5 py-0.5 border border-red-100 rounded-lg">✕</button>
          <span className="text-gray-400 text-xs">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>
      {expanded && (
        <div className="bg-gray-50 px-3 pb-3">
          {meal.ingredients.length > 0 && (
            <>
              <div className="text-[10px] font-bold text-gray-500 mt-2 mb-1">Ingredients</div>
              {meal.ingredients.map((ing, i) => (
                <div key={i} className="text-[10px] text-gray-600 py-0.5">· {ing}</div>
              ))}
            </>
          )}
          {meal.steps.length > 0 && (
            <>
              <div className="text-[10px] font-bold text-gray-500 mt-2 mb-1">Steps</div>
              {meal.steps.map((s, i) => (
                <div key={i} className="text-[10px] text-gray-600 py-0.5">{i + 1}. {s}</div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Add Meal Form ─────────────────────────────────────────────────────────────
function AddMealForm({ onAdd, onCancel, dietTag }: {
  onAdd: (meal: MealPlanEntry) => void
  onCancel: () => void
  dietTag: DietTag
}) {
  const [form, setForm] = useState({
    name: "", time: "2:00 PM", protein: "", carbs: "", fat: "", cal: "",
    tag: dietTag, day: "Any day",
    ingredients: "", steps: "",
  })

  function handleAdd() {
    if (!form.name.trim()) return
    const p = parseFloat(form.protein) || 0
    const c = parseFloat(form.carbs)   || 0
    const f = parseFloat(form.fat)     || 0
    const cal = parseFloat(form.cal)   || Math.round(p * 4 + c * 4 + f * 9)
    const meal: MealPlanEntry = {
      id: makeId(),
      name: form.name.trim(),
      time: form.time,
      protein: p, carbs: c, fat: f, cal,
      tag: form.tag as DietTag,
      day: form.day === "Any day" ? undefined : form.day,
      ingredients: form.ingredients.split("\n").map(s => s.trim()).filter(Boolean),
      steps: form.steps.split("\n").map(s => s.trim()).filter(Boolean),
    }
    onAdd(meal)
  }

  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"

  return (
    <div className="bg-gray-50 rounded-xl p-3 mb-3">
      <div className="text-xs font-bold text-gray-700 mb-3">Add Meal</div>

      <input className={inputCls + " mb-2"} type="text" placeholder="Meal name"
        value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />

      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <label className="text-[10px] text-gray-500 block mb-1">Diet type</label>
          <select className={inputCls} value={form.tag}
            onChange={e => setForm(f => ({ ...f, tag: e.target.value as DietTag }))}>
            <option value="veg">🌱 Vegetarian</option>
            <option value="eggetarian">🥚 Eggetarian</option>
            <option value="non_veg">🍗 Non-veg</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-gray-500 block mb-1">Day (optional)</label>
          <select className={inputCls} value={form.day}
            onChange={e => setForm(f => ({ ...f, day: e.target.value }))}>
            {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <label className="text-[10px] text-gray-500 block mb-1">Time</label>
          <input className={inputCls} type="text" placeholder="2:00 PM"
            value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
        </div>
        <div>
          <label className="text-[10px] text-gray-500 block mb-1">Calories (auto if blank)</label>
          <input className={inputCls} type="number" placeholder="kcal"
            value={form.cal} onChange={e => setForm(f => ({ ...f, cal: e.target.value }))} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2">
        {[["protein","Protein (g)"],["carbs","Carbs (g)"],["fat","Fat (g)"]].map(([key, label]) => (
          <div key={key}>
            <label className="text-[10px] text-gray-500 block mb-1">{label}</label>
            <input className={inputCls} type="number"
              value={form[key as keyof typeof form]}
              onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
          </div>
        ))}
      </div>

      <div className="mb-2">
        <label className="text-[10px] text-gray-500 block mb-1">Ingredients (one per line)</label>
        <textarea className={inputCls} rows={3} placeholder="e.g. 3 whole eggs&#10;80g paneer&#10;1 tsp ghee"
          value={form.ingredients} onChange={e => setForm(f => ({ ...f, ingredients: e.target.value }))} />
      </div>

      <div className="mb-3">
        <label className="text-[10px] text-gray-500 block mb-1">Steps (one per line)</label>
        <textarea className={inputCls} rows={3} placeholder="e.g. Heat ghee&#10;Add spices&#10;Serve hot"
          value={form.steps} onChange={e => setForm(f => ({ ...f, steps: e.target.value }))} />
      </div>

      <div className="flex gap-2">
        <button onClick={onCancel}
          className="flex-1 py-2 bg-gray-100 text-gray-500 rounded-lg text-sm font-bold">Cancel</button>
        <button onClick={handleAdd}
          className="flex-1 py-2 bg-teal-600 text-white rounded-lg text-sm font-bold">Add Meal</button>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function MealPlanBuilder() {
  const [plan, setPlan] = useState<MealPlanEntry[]>(() => loadMealPlan())
  const [dietConfig, setDietConfig] = useState(() => loadDietConfig())
  const [adding, setAdding] = useState(false)
  const [filterTag, setFilterTag] = useState<DietTag | "all">("all")
  const [filterDay, setFilterDay] = useState<string>("all")
  const [showPresets, setShowPresets] = useState(false)
  const [importedPreset, setImportedPreset] = useState<string | null>(null)

  function persistPlan(updated: MealPlanEntry[]) {
    setPlan(updated)
    saveMealPlan(updated)
  }

  function updateDietConfig(patch: Partial<typeof dietConfig>) {
    const updated = { ...dietConfig, ...patch }
    setDietConfig(updated)
    saveDietConfig(updated)
  }

  function importPreset(key: PresetKey) {
    const preset = PRESETS[key]
    const existing = plan.map(m => m.name)
    const toAdd = preset.entries.filter(e => !existing.includes(e.name))
    persistPlan([...plan, ...toAdd])
    setImportedPreset(key)
    setShowPresets(false)
    setTimeout(() => setImportedPreset(null), 3000)
  }

  function removeMeal(id: string) {
    persistPlan(plan.filter(m => m.id !== id))
  }

  function addMeal(meal: MealPlanEntry) {
    persistPlan([...plan, meal])
    setAdding(false)
  }

  // Filter
  const filtered = plan.filter(m => {
    const tagOk = filterTag === "all" || m.tag === filterTag
    const dayOk = filterDay === "all" || !m.day || m.day === filterDay
    return tagOk && dayOk
  })

  const dayGroups = DAYS.slice(0, 7).reduce<Record<string, MealPlanEntry[]>>((acc, day) => {
    acc[day] = filtered.filter(m => m.day === day)
    return acc
  }, {})
  const anyDay = filtered.filter(m => !m.day)

  return (
    <div className="p-3 pb-24">

      <div className="bg-gradient-to-br from-gray-900 to-teal-800 rounded-2xl p-4 mb-3 text-white">
        <div className="text-xs opacity-70 mb-0.5">Meal Plan</div>
        <div className="text-base font-bold">Your Weekly Meals</div>
        <div className="text-xs opacity-60 mt-0.5">{plan.length} meal{plan.length !== 1 ? "s" : ""} saved</div>
      </div>

      {/* Diet config */}
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
        <div className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-3">Diet Preferences</div>
        <div className="mb-3">
          <label className="text-xs text-gray-500 block mb-1">Diet type</label>
          <div className="flex gap-2 flex-wrap">
            {(["veg","eggetarian","non_veg"] as DietTag[]).map(tag => (
              <button key={tag} onClick={() => updateDietConfig({ tag })}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors
                  ${dietConfig.tag === tag ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-500 border-gray-200"}`}>
                {DIET_TAG_LABELS[tag]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Diet mode</label>
          <select value={dietConfig.mode}
            onChange={e => updateDietConfig({ mode: e.target.value as DietMode })}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500">
            {(Object.entries(DIET_MODE_LABELS) as [DietMode, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Preset import */}
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
        <div className="flex justify-between items-center mb-1">
          <div className="text-xs font-bold text-gray-600 uppercase tracking-wide">Import a Preset</div>
          <button onClick={() => setShowPresets(s => !s)}
            className="text-xs text-teal-600 border border-teal-200 px-3 py-1 rounded-lg">
            {showPresets ? "Cancel" : "Browse presets"}
          </button>
        </div>
        <div className="text-[10px] text-gray-400 mb-2">Start with a template and customise it</div>

        {importedPreset && (
          <div className="text-xs text-green-600 bg-green-50 rounded-lg p-2 mb-2">
            ✓ {PRESETS[importedPreset as PresetKey].label} imported — {PRESETS[importedPreset as PresetKey].entries.length} meals added
          </div>
        )}

        {showPresets && (
          <div className="space-y-2">
            {(Object.entries(PRESETS) as [PresetKey, typeof PRESETS[PresetKey]][]).map(([key, preset]) => (
              <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div>
                  <div className="text-xs font-semibold text-gray-700">{preset.label}</div>
                  <div className="text-[10px] text-gray-400">{preset.entries.length} meals · {DIET_TAG_LABELS[preset.tag]}</div>
                </div>
                <button onClick={() => importPreset(key)}
                  className="text-xs px-3 py-1.5 bg-teal-600 text-white rounded-lg font-bold">
                  Import
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      {plan.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-3 mb-3">
          <div className="flex gap-2 mb-2 flex-wrap">
            {(["all","veg","eggetarian","non_veg"] as const).map(tag => (
              <button key={tag} onClick={() => setFilterTag(tag)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border capitalize
                  ${filterTag === tag ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-500 border-gray-200"}`}>
                {tag === "all" ? "All types" : DIET_TAG_LABELS[tag as DietTag]}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => setFilterDay("all")}
              className={`px-2 py-0.5 rounded-lg text-[9px] font-bold border
                ${filterDay === "all" ? "bg-gray-700 text-white border-gray-700" : "bg-white text-gray-400 border-gray-200"}`}>
              All days
            </button>
            {DAYS.slice(0, 7).map(d => (
              <button key={d} onClick={() => setFilterDay(filterDay === d ? "all" : d)}
                className={`px-2 py-0.5 rounded-lg text-[9px] font-bold border
                  ${filterDay === d ? "bg-gray-700 text-white border-gray-700" : "bg-white text-gray-400 border-gray-200"}`}>
                {d.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add form */}
      {adding && (
        <AddMealForm
          onAdd={addMeal}
          onCancel={() => setAdding(false)}
          dietTag={dietConfig.tag}
        />
      )}

      {/* Meal list by day */}
      {plan.length === 0 && !adding ? (
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-400 mb-3">
          <div className="text-3xl mb-3">🍽</div>
          <div className="text-sm font-medium text-gray-500 mb-1">No meals yet</div>
          <div className="text-xs mb-4">Import a preset to get started or add meals manually</div>
          <button onClick={() => setAdding(true)}
            className="px-5 py-2 bg-teal-600 text-white rounded-xl text-sm font-bold">
            + Add First Meal
          </button>
        </div>
      ) : (
        <div>
          {/* Any day meals */}
          {anyDay.length > 0 && (
            <div className="mb-3">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Any Day</div>
              {anyDay.map(m => <MealCard key={m.id} meal={m} onDelete={() => removeMeal(m.id)} />)}
            </div>
          )}

          {/* Day-specific meals */}
          {DAYS.slice(0, 7).map(day => {
            const meals = dayGroups[day]
            if (!meals?.length) return null
            return (
              <div key={day} className="mb-3">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{day}</div>
                {meals.map(m => <MealCard key={m.id} meal={m} onDelete={() => removeMeal(m.id)} />)}
              </div>
            )
          })}

          {filtered.length === 0 && plan.length > 0 && (
            <div className="text-center text-gray-400 text-xs py-6">No meals match this filter</div>
          )}
        </div>
      )}

      {/* Add button */}
      {!adding && (
        <button onClick={() => setAdding(true)}
          className="w-full py-3 border-2 border-dashed border-teal-300 text-teal-600 rounded-2xl text-sm font-bold mb-3">
          + Add Meal
        </button>
      )}
    </div>
  )
}
