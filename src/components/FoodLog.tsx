import { KEYS } from "../services/storageKeys"
import { useState, useEffect, useRef, useCallback } from "react"
import { loadDayData, saveDayData, DayData, loadHistory, saveHistory, FoodEntry } from "../store/useHealthStore"
import EatingOut from "./EatingOut"
import { MicButton } from "../hooks/useVoiceInput"
import { getISTDate } from "../utils/dateHelpers"

// ── Types ─────────────────────────────────────────────────────────────────────
type FoodItem = {
  name: string
  protein: number
  carbs: number
  fat: number
  cal: number
  category?: string
  // Extended nutritional fields
  fibre?: number        // grams — digestive health, IBS guidance
  sodium?: number       // mg — hypertension/Olmesartan context
  gi?: number           // glycaemic index 0–100 — diabetes/prediabetes nudges
  tags?: string[]       // e.g. ["keto-friendly","high-protein","indian"]
}

type CustomFood = FoodItem & { id: string }

// ── Helpers ───────────────────────────────────────────────────────────────────
function kcal(p: number, c: number, f: number) { return Math.round(p * 4 + c * 4 + f * 9) }

function carbColor(c: number) {
  return c <= 5 ? "#2E7D32" : c <= 12 ? "#F57F17" : "#C62828"
}

function giLabel(gi?: number): { label: string; color: string } | null {
  if (!gi) return null
  if (gi <= 55) return { label: `GI ${gi} (Low)`,  color: "text-green-600" }
  if (gi <= 69) return { label: `GI ${gi} (Med)`,  color: "text-amber-600" }
  return             { label: `GI ${gi} (High)`, color: "text-red-600" }
}

function scaleFood(food: FoodItem, qty: number): FoodItem {
  return {
    ...food,
    protein: +(food.protein * qty).toFixed(1),
    carbs:   +(food.carbs   * qty).toFixed(1),
    fat:     +(food.fat     * qty).toFixed(1),
    cal:     Math.round(food.cal * qty),
    fibre:   food.fibre  != null ? +(food.fibre  * qty).toFixed(1) : undefined,
    sodium:  food.sodium != null ? Math.round(food.sodium * qty)   : undefined,
  }
}

function loadCustomFoods(): CustomFood[] {
  try { return JSON.parse(localStorage.getItem(KEYS.CUSTOM_FOODS) || "[]") } catch { return [] }
}

function saveCustomFoods(foods: CustomFood[]) {
  try { localStorage.setItem(KEYS.CUSTOM_FOODS, JSON.stringify(foods)) } catch {}
}

// ── USDA Search ───────────────────────────────────────────────────────────────
async function usdaSearch(query: string): Promise<FoodItem[]> {
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=15&api_key=DEMO_KEY`
  const res = await fetch(url)
  if (res.status === 429) throw new Error("Rate limit reached (30/hour). Try again in a few minutes.")
  if (!res.ok) throw new Error(`USDA error ${res.status}. Check connection.`)
  const data = await res.json()
  const hits: FoodItem[] = (data.foods || []).slice(0, 12).map((h: any) => {
    const get = (n: string) => {
      const nut = (h.foodNutrients || []).find((x: any) => x.nutrientName === n)
      return nut ? +Number(nut.value).toFixed(1) : 0
    }
    const p = get("Protein")
    const c = +Math.max(0, get("Carbohydrate, by difference") - get("Fiber, total dietary")).toFixed(1)
    const f = get("Total lipid (fat)")
    const cal = Math.round(get("Energy")) || kcal(p, c, f)
    const srv = h.servingSize ? ` (${h.servingSize}${h.servingSizeUnit || "g"})` : " (100g)"
    return { name: (h.description || "").slice(0, 60) + srv, protein: p, carbs: c, fat: f, cal, category: "USDA" }
  }).filter((f: FoodItem) => f.cal > 0)
  return hits
}

// ── Fast-Break Modal ──────────────────────────────────────────────────────────
function FastBreakModal({ food, elapsed, onConfirm, onCancel }: {
  food: FoodItem; elapsed: number; onConfirm: () => void; onCancel: () => void
}) {
  const hrs = Math.floor(elapsed / 3600)
  const mins = Math.floor((elapsed % 3600) / 60)
  const elStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl p-6 max-w-xs w-full text-center shadow-2xl">
        <div className="text-4xl mb-3">⏱</div>
        <div className="text-base font-bold text-gray-800 mb-2">You're currently fasting</div>
        <div className="text-sm text-gray-500 mb-1">{elStr} elapsed</div>
        <div className="text-sm text-gray-600 mb-5 leading-relaxed">
          Logging <span className="font-bold">{food.name}</span> will break your fast. Continue?
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold text-sm">
            Break Fast
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Food Row ──────────────────────────────────────────────────────────────────
function FoodRow({ food, selected, onSelect }: {
  food: FoodItem; selected: boolean; onSelect: () => void
}) {
  const gi = giLabel(food.gi)
  const isKeto = food.tags?.includes("keto-friendly")
  const isHighProtein = food.tags?.includes("high-protein")

  return (
    <button onClick={onSelect}
      className={`w-full text-left px-3 py-2.5 rounded-xl mb-1.5 border transition-colors
        ${selected ? "bg-teal-50 border-teal-400" : "bg-gray-50 border-transparent"}`}>
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-gray-800 leading-tight">{food.name}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            P <span className="text-blue-600 font-bold">{food.protein}g</span>
            {" · "}C <span style={{ color: carbColor(food.carbs) }} className="font-bold">{food.carbs}g</span>
            {" · "}F <span className="text-purple-600 font-bold">{food.fat}g</span>
            {food.fibre != null && <span className="text-gray-400"> · Fibre {food.fibre}g</span>}
          </div>
          <div className="flex gap-1 flex-wrap mt-1">
            {food.category && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium
                ${food.category === "USDA" ? "bg-blue-100 text-blue-600" : "bg-teal-100 text-teal-600"}`}>
                {food.category}
              </span>
            )}
            {isKeto && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-green-100 text-green-700">🥑 Keto</span>}
            {isHighProtein && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">💪 High protein</span>}
            {gi && <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-gray-100 ${gi.color}`}>{gi.label}</span>}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xs font-bold text-gray-700">{food.cal}</div>
          <div className="text-[9px] text-gray-400">kcal</div>
          {food.sodium != null && <div className="text-[9px] text-gray-400">{food.sodium}mg Na</div>}
        </div>
      </div>
    </button>
  )
}

// ── Selection Panel ───────────────────────────────────────────────────────────
function SelectionPanel({ food, onAdd, onCancel }: {
  food: FoodItem; onAdd: (qty: number, logTime: string) => void; onCancel: () => void
}) {
  const [qty, setQty] = useState(1)
  const now = new Date()
  const defaultTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
  const [logTime, setLogTime] = useState(defaultTime)
  const scaled = scaleFood(food, qty)

  return (
    <div className="mt-3 p-3 bg-teal-50 rounded-xl border border-teal-200">
      <div className="flex justify-between items-start mb-3">
        <div className="text-xs font-bold text-teal-700 leading-tight flex-1 pr-2">{food.name}</div>
        <button onClick={onCancel} className="text-[10px] text-gray-400 border border-gray-200 px-2 py-1 rounded-lg shrink-0">✕</button>
      </div>

      {/* Quantity stepper */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xs text-gray-600">Servings:</span>
        <button onClick={() => setQty(q => Math.max(0.5, +(q - 0.5).toFixed(1)))}
          className="w-7 h-7 rounded-full border-2 border-teal-600 text-teal-600 font-bold text-base flex items-center justify-center">−</button>
        <span className="text-base font-bold text-gray-800 min-w-[28px] text-center">{qty}</span>
        <button onClick={() => setQty(q => +(q + 0.5).toFixed(1))}
          className="w-7 h-7 rounded-full bg-teal-600 text-white font-bold text-base flex items-center justify-center">+</button>
      </div>

      {/* Macro preview */}
      <div className="text-xs text-gray-600 mb-3 space-y-1">
        <div>
          P <span className="font-bold text-blue-600">{scaled.protein}g</span>
          {" · "}C <span className="font-bold" style={{ color: carbColor(scaled.carbs) }}>{scaled.carbs}g</span>
          {" · "}F <span className="font-bold text-purple-600">{scaled.fat}g</span>
          {" · "}<span className="font-bold text-gray-700">{scaled.cal} kcal</span>
        </div>
        {(scaled.fibre != null || scaled.sodium != null) && (
          <div className="text-[10px] text-gray-400 flex gap-3 flex-wrap">
            {scaled.fibre  != null && <span>Fibre <span className="font-semibold text-gray-600">{scaled.fibre}g</span></span>}
            {scaled.sodium != null && <span className={scaled.sodium > 400 ? "text-amber-600 font-semibold" : ""}>
              Sodium <span className="font-semibold">{scaled.sodium}mg</span>
              {scaled.sodium > 400 && " ⚠️"}
            </span>}
            {food.gi != null && (() => { const g = giLabel(food.gi); return g ? <span className={g.color}>{g.label}</span> : null })()}
          </div>
        )}
      </div>

      {/* Time picker */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-gray-500 whitespace-nowrap">Log time:</span>
        <input type="time" value={logTime} onChange={e => setLogTime(e.target.value)}
          className="flex-1 border border-teal-400 rounded-lg px-2 py-1.5 text-sm font-bold focus:outline-none" />
      </div>

      <button onClick={() => onAdd(qty, logTime)}
        className="w-full py-2.5 bg-teal-600 text-white rounded-xl font-bold text-sm">
        Add to Log
      </button>
    </div>
  )
}

// ── Browse Tab ────────────────────────────────────────────────────────────────
function BrowseTab({ allFoods, onSelect, selected }: {
  allFoods: FoodItem[]; onSelect: (f: FoodItem) => void; selected: FoodItem | null
}) {
  const cats = [...new Set(allFoods.map(f => f.category || "Other"))].sort()
  const [activeCat, setActiveCat] = useState(cats[0] || "Eggs")
  const [activeTag, setActiveTag] = useState<string | null>(null)

  const TAG_FILTERS = [
    { tag: "keto-friendly",  label: "🥑 Keto",        color: "bg-green-600" },
    { tag: "high-protein",   label: "💪 High protein", color: "bg-blue-600" },
    { tag: "low-gi",         label: "📉 Low GI",       color: "bg-teal-600" },
    { tag: "high-fibre",     label: "🌾 High fibre",   color: "bg-amber-600" },
  ]

  const baseItems = allFoods.filter(f => (f.category || "Other") === activeCat)
  const items = activeTag ? baseItems.filter(f => f.tags?.includes(activeTag)) : baseItems

  return (
    <div>
      {/* Tag filter chips */}
      <div className="flex gap-1.5 mb-2 overflow-x-auto pb-1">
        {TAG_FILTERS.map(t => (
          <button key={t.tag} onClick={() => setActiveTag(activeTag === t.tag ? null : t.tag)}
            className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors
              ${activeTag === t.tag ? `${t.color} text-white border-transparent` : "bg-white border-gray-200 text-gray-500"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {cats.map(cat => (
          <button key={cat} onClick={() => setActiveCat(cat)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors
              ${activeCat === cat ? "bg-teal-600 border-teal-600 text-white" : "bg-white border-gray-300 text-gray-600"}`}>
            {cat}
          </button>
        ))}
      </div>

      {/* Column headers */}
      <div className="grid gap-1 px-1 pb-2 border-b border-gray-100 mb-1"
        style={{ gridTemplateColumns: "1fr 32px 32px 32px 36px" }}>
        <div className="text-[10px] font-bold text-gray-400 uppercase">Food</div>
        <div className="text-[10px] font-bold text-blue-500 text-center">P</div>
        <div className="text-[10px] font-bold text-orange-500 text-center">C</div>
        <div className="text-[10px] font-bold text-purple-500 text-center">F</div>
        <div className="text-[10px] font-bold text-gray-400 text-center">Cal</div>
      </div>

      <div className="max-h-72 overflow-y-auto">
        {items.length === 0 && (
          <div className="text-center text-gray-400 text-xs py-4">
            No {activeCat} foods match this filter
          </div>
        )}
        {items.map((f, i) => (
          <button key={i} onClick={() => onSelect(f)}
            className={`w-full grid gap-1 px-1 py-2 border-b border-gray-50 text-left transition-colors
              ${selected?.name === f.name ? "bg-teal-50" : "hover:bg-gray-50"}`}
            style={{ gridTemplateColumns: "1fr 32px 32px 32px 36px" }}>
            <div>
              <div className="text-xs font-semibold text-gray-800 leading-tight">{f.name}</div>
              {f.tags && f.tags.length > 0 && (
                <div className="flex gap-1 mt-0.5 flex-wrap">
                  {f.tags.includes("keto-friendly")  && <span className="text-[8px] text-green-600 font-bold">🥑</span>}
                  {f.tags.includes("high-protein")    && <span className="text-[8px] text-blue-600 font-bold">💪</span>}
                  {f.gi != null && f.gi <= 55         && <span className="text-[8px] text-teal-600 font-bold">📉</span>}
                  {f.sodium != null && f.sodium > 400 && <span className="text-[8px] text-amber-600 font-bold">🧂</span>}
                </div>
              )}
            </div>
            <div className="text-center">
              <div className="text-xs font-bold text-blue-600">{f.protein}</div>
            </div>
            <div className="text-center">
              <div className="text-xs font-bold" style={{ color: carbColor(f.carbs) }}>{f.carbs}</div>
            </div>
            <div className="text-center">
              <div className="text-xs font-bold text-purple-600">{f.fat}</div>
            </div>
            <div className="text-center">
              <div className="text-xs font-bold text-gray-600">{f.cal}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="flex gap-3 mt-2">
        <span className="text-[10px] text-green-700">● ≤5g Low</span>
        <span className="text-[10px] text-orange-500">● 6–12g Med</span>
        <span className="text-[10px] text-red-600">● 13g+ High carbs</span>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function FoodLog() {
  const today = getISTDate()
  const [day, setDay] = useState<DayData>(() => loadDayData(today))
  const [logTab, setLogTab] = useState<"search" | "browse" | "custom" | "eatout">("search")
  const [query, setQuery] = useState("")
  const [localFoods, setLocalFoods] = useState<FoodItem[]>([])
  const [searchResults, setSearchResults] = useState<FoodItem[]>([])
  const [usdaResults, setUsdaResults] = useState<FoodItem[]>([])
  const [usdaLoading, setUsdaLoading] = useState(false)
  const [usdaError, setUsdaError] = useState("")
  const [selected, setSelected] = useState<FoodItem | null>(null)
  const [fastBreak, setFastBreak] = useState<{ food: FoodItem; elapsed: number; entry: FoodEntry } | null>(null)
  const [customFoods, setCustomFoods] = useState<CustomFood[]>(() => loadCustomFoods())
  const [cust, setCust] = useState({ name: "", protein: "", carbs: "", fat: "", cal: "" })
  const [showCust, setShowCust] = useState(false)

  // Load local food database
  useEffect(() => {
    fetch("/foods.json")
      .then(r => r.json())
      .then((db: FoodItem[]) => {
        setLocalFoods(db)
        setSearchResults(db)
      })
      .catch(() => setLocalFoods([]))
  }, [])

  // Filter local results as query changes
  useEffect(() => {
    if (!query.trim()) { setSearchResults(localFoods); return }
    const q = query.toLowerCase()
    setSearchResults(localFoods.filter(f => f.name.toLowerCase().includes(q)))
  }, [query, localFoods])

  const persist = useCallback((updated: DayData) => {
    setDay(updated)
    saveDayData(updated)
    // Sync history
    const tots = updated.entries.reduce((a, e) => ({
      cal: a.cal + e.calories, protein: a.protein + e.protein,
      carbs: a.carbs + e.carbs, fat: a.fat + e.fat
    }), { cal: 0, protein: 0, carbs: 0, fat: 0 })
    const hist = loadHistory()
    const idx = hist.findIndex(h => h.date === updated.date)
    const row = {
      date: updated.date, ...tots, weight: updated.weight, water: updated.water,
      workoutDone: updated.workouts.some(w => w.type === "circuit" || (w.exercises?.length ?? 0) > 0),
      fastBest: updated.fastBest,
    }
    if (idx >= 0) hist[idx] = row; else hist.unshift(row)
    saveHistory(hist.slice(0, 180))
  }, [])

  // USDA search
  async function handleUsdaSearch() {
    const q = query.trim()
    if (!q) return
    setUsdaLoading(true); setUsdaError(""); setUsdaResults([])
    try {
      const results = await usdaSearch(q)
      if (!results.length) setUsdaError(`No results for "${q}" — try a simpler term`)
      else setUsdaResults(results)
    } catch (e: any) {
      setUsdaError(e.message)
    }
    setUsdaLoading(false)
  }

  // Build entry from food + qty + time
  function buildEntry(food: FoodItem, qty: number, logTime: string): FoodEntry {
    const scaled = scaleFood(food, qty)
    let ts = Date.now()
    if (logTime) {
      const [hh, mm] = logTime.split(":").map(Number)
      const d = new Date(); d.setHours(hh, mm, 0, 0)
      if (d.getTime() > Date.now()) d.setDate(d.getDate() - 1)
      ts = d.getTime()
    }
    return {
      id: `food-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: food.name,
      calories: scaled.cal,
      protein: scaled.protein,
      carbs: scaled.carbs,
      fat: scaled.fat,
      timestamp: ts,
    }
  }

  function handleAdd(food: FoodItem, qty: number, logTime: string) {
    const entry = buildEntry(food, qty, logTime)

    // Fast-break check
    if (entry.calories >= 20 && day.fasting && day.fastStart) {
      const elapsed = Math.floor((Date.now() - day.fastStart) / 1000)
      setFastBreak({ food, elapsed, entry })
      return
    }

    doAdd(entry, null)
  }

  function doAdd(entry: FoodEntry, fastBreakElapsed: number | null) {
    let updated = { ...day, entries: [...(day.entries || []), entry] }
    if (fastBreakElapsed !== null && fastBreakElapsed > 0) {
      updated = {
        ...updated,
        fastBest: Math.max(updated.fastBest || 0, fastBreakElapsed),
        fasting: false,
        fastStart: null,
      }
    }
    persist(updated)
    setSelected(null)
    setFastBreak(null)
  }

  function removeEntry(id: string) {
    persist({ ...day, entries: (day.entries || []).filter(e => e.id !== id) })
  }

  function addCustomFood() {
    if (!cust.name.trim()) return
    const p = parseFloat(cust.protein) || 0
    const c = parseFloat(cust.carbs) || 0
    const f = parseFloat(cust.fat) || 0
    const cal = parseFloat(cust.cal) || kcal(p, c, f)
    const food: CustomFood = {
      id: `cust-${Date.now()}`, name: cust.name.trim(),
      protein: p, carbs: c, fat: f, cal, category: "Custom"
    }
    const updated = [food, ...customFoods]
    setCustomFoods(updated)
    saveCustomFoods(updated)
    setCust({ name: "", protein: "", carbs: "", fat: "", cal: "" })
    setShowCust(false)
  }

  const allFoods = [...localFoods, ...customFoods]
  const displayedSearch = [...searchResults, ...usdaResults]
  const tots = (day.entries || []).reduce(
    (a, e) => ({ cal: a.cal + e.calories, protein: a.protein + e.protein, carbs: a.carbs + e.carbs, fat: a.fat + e.fat }),
    { cal: 0, protein: 0, carbs: 0, fat: 0 }
  )

  return (
    <div className="p-3 pb-24">

      {/* Fast-break modal */}
      {fastBreak && (
        <FastBreakModal
          food={fastBreak.food}
          elapsed={fastBreak.elapsed}
          onCancel={() => setFastBreak(null)}
          onConfirm={() => doAdd(fastBreak.entry, fastBreak.elapsed)}
        />
      )}

      {/* Header */}
      <div className="bg-gradient-to-br from-gray-900 to-teal-800 rounded-2xl p-4 mb-3 text-white">
        <div className="text-xs opacity-70 mb-0.5">Food Log</div>
        <div className="text-base font-bold">Log Your Meals</div>
        {(day.entries || []).length > 0 && (
          <div className="text-xs opacity-70 mt-0.5">
            Today: {Math.round(tots.cal)} kcal · P {Math.round(tots.protein)}g · C {Math.round(tots.carbs)}g · F {Math.round(tots.fat)}g
          </div>
        )}
      </div>

      {/* Search / Browse / Custom tabs */}
      <div className="bg-white rounded-2xl shadow-sm p-3 mb-3">
        <div className="flex bg-gray-100 rounded-xl p-1 mb-3">
          {(["search", "browse", "custom", "eatout"] as const).map(t => (
            <button key={t} onClick={() => { setLogTab(t); setSelected(null) }}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-colors
                ${logTab === t ? "bg-white text-teal-600 shadow-sm" : "text-gray-500"}`}>
              {t === "search" ? "🔍 Search" : t === "browse" ? "📋 Browse" : t === "custom" ? "✏️ Custom" : "🍽 Eat Out"}
            </button>
          ))}
        </div>

        {/* ── Search Tab ── */}
        {logTab === "search" && (
          <div>
            <div className="flex gap-2 mb-2">
              <input
                value={query}
                onChange={e => { setQuery(e.target.value); setSelected(null); setUsdaResults([]) }}
                placeholder="Search 1000+ Indian foods..."
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
              />
              <button onClick={handleUsdaSearch} disabled={usdaLoading}
                className="px-3 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold shrink-0"
                title="Search USDA database">
                {usdaLoading ? "..." : "🌐"}
              </button>
            </div>
            <div className="text-[10px] text-gray-400 mb-2">🌐 = USDA FoodData Central — search any packaged food</div>

            {usdaError && (
              <div className="text-xs text-red-500 bg-red-50 rounded-lg p-2 mb-2">{usdaError}</div>
            )}

            <div className="max-h-72 overflow-y-auto">
              {displayedSearch.length === 0 && query && !usdaLoading && (
                <div className="text-center text-gray-400 text-xs py-4">No local results — tap 🌐 to search USDA</div>
              )}
              {displayedSearch.map((f, i) => (
                <FoodRow key={i} food={f} selected={selected?.name === f.name} onSelect={() => setSelected(f)} />
              ))}
            </div>

            {selected && (
              <SelectionPanel food={selected} onAdd={(qty, time) => handleAdd(selected, qty, time)} onCancel={() => setSelected(null)} />
            )}
          </div>
        )}

        {/* ── Browse Tab ── */}
        {logTab === "browse" && (
          <div>
            <BrowseTab allFoods={allFoods} onSelect={f => setSelected(f)} selected={selected} />
            {selected && (
              <SelectionPanel food={selected} onAdd={(qty, time) => handleAdd(selected, qty, time)} onCancel={() => setSelected(null)} />
            )}
          </div>
        )}

        {/* ── Eating Out Tab ── */}
        {logTab === "eatout" && (
          <EatingOut />
        )}

        {/* ── Custom Tab ── */}
        {logTab === "custom" && (
          <div>
            <button onClick={() => setShowCust(s => !s)}
              className="w-full py-2 border border-teal-500 text-teal-600 rounded-xl text-sm font-bold mb-3">
              {showCust ? "Cancel" : "+ New Custom Food"}
            </button>

            {showCust && (
              <div className="bg-gray-50 rounded-xl p-3 mb-3">
                {[
                  { key: "name", label: "Food name", type: "text" },
                  { key: "protein", label: "Protein (g)", type: "number" },
                  { key: "carbs", label: "Net Carbs (g)", type: "number" },
                  { key: "fat", label: "Fat (g)", type: "number" },
                  { key: "cal", label: "Calories (auto if blank)", type: "number" },
                ].map(({ key, label, type }) => (
                  <input key={key} type={type} placeholder={label}
                    value={cust[key as keyof typeof cust]}
                    onChange={e => setCust(c => ({ ...c, [key]: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:border-teal-500" />
                ))}
                <button onClick={addCustomFood}
                  className="w-full py-2.5 bg-teal-600 text-white rounded-xl font-bold text-sm">
                  Save Custom Food
                </button>
              </div>
            )}

            {customFoods.length > 0 && (
              <div>
                <div className="text-xs font-bold text-gray-600 mb-2">Saved Custom Foods</div>
                {customFoods.map((f, i) => (
                  <div key={f.id} className="flex items-center gap-2 mb-1.5">
                    <div className="flex-1">
                      <FoodRow food={f} selected={selected?.name === f.name} onSelect={() => setSelected(f)} />
                    </div>
                    <button onClick={() => {
                      const updated = customFoods.filter((_, j) => j !== i)
                      setCustomFoods(updated); saveCustomFoods(updated)
                    }} className="text-red-300 text-xs px-1.5 py-1 border border-red-100 rounded-lg shrink-0">✕</button>
                  </div>
                ))}
                {selected && customFoods.some(f => f.name === selected.name) && (
                  <SelectionPanel food={selected} onAdd={(qty, time) => handleAdd(selected, qty, time)} onCancel={() => setSelected(null)} />
                )}
              </div>
            )}

            {customFoods.length === 0 && !showCust && (
              <div className="text-center text-gray-400 text-xs py-6">No custom foods yet — add one above</div>
            )}
          </div>
        )}
      </div>

      {/* Today's food log */}
      {(day.entries || []).length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
          <div className="text-sm font-bold text-gray-800 mb-3">📋 Logged Today</div>
          {(day.entries || []).map(e => (
            <div key={e.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-700 truncate">{e.name}</div>
                <div className="text-[10px] text-gray-400">
                  P {e.protein}g · C {e.carbs}g · F {e.fat}g
                  {e.timestamp && (
                    <span className="ml-1 text-gray-300">
                      · {new Date(e.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-bold text-gray-600">{e.calories} kcal</span>
                <button onClick={() => removeEntry(e.id)}
                  className="text-red-300 text-xs px-1.5 py-0.5 border border-red-100 rounded-lg">✕</button>
              </div>
            </div>
          ))}
          <div className="flex justify-between text-xs font-bold text-gray-700 pt-2 mt-1 border-t border-gray-100">
            <span>Total</span>
            <span>{Math.round(tots.cal)} kcal · P {Math.round(tots.protein)}g · C {Math.round(tots.carbs)}g · F {Math.round(tots.fat)}g</span>
          </div>
        </div>
      )}

    </div>
  )
}
