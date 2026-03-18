import { useState, useCallback } from "react"
import { useHealthStore } from "../store/useHealthStore"
import {
  loadDayData, saveDayData, loadHistory, saveHistory, HistoryRow,
  WeightEventTag, WEIGHT_EVENT_LABELS,
  loadBodyCompositionLog, saveBodyCompositionLog, BodyCompositionEntry,
} from "../store/useHealthStore"
import { getISTDate } from "../utils/dateHelpers"

// ── Types ─────────────────────────────────────────────────────────────────────
type MeasureEntry = {
  date: string
  waist?: number; hip?: number; chest?: number
  neck?: number; larm?: number; rarm?: number
}

const MEASURES = [
  { id: "waist", label: "Waist",  unit: "cm", icon: "📏", note: "Navel level, relaxed exhale" },
  { id: "hip",   label: "Hip",    unit: "cm", icon: "📐", note: "Widest point" },
  { id: "chest", label: "Chest",  unit: "cm", icon: "📐", note: "Nipple line, normal breath" },
  { id: "neck",  label: "Neck",   unit: "cm", icon: "📏", note: "Below larynx" },
  { id: "larm",  label: "L.Arm",  unit: "cm", icon: "💪", note: "Bicep peak, flexed" },
  { id: "rarm",  label: "R.Arm",  unit: "cm", icon: "💪", note: "Bicep peak, flexed" },
] as const

type MeasureId = typeof MEASURES[number]["id"]

function loadMeasureLog(): MeasureEntry[] {
  try { return JSON.parse(localStorage.getItem("measure_log") || "[]") } catch { return [] }
}
function saveMeasureLog(log: MeasureEntry[]) {
  try { localStorage.setItem("measure_log", JSON.stringify(log.slice(0, 90))) } catch {}
}

// ── Event tag picker ──────────────────────────────────────────────────────────
const QUICK_TAGS: WeightEventTag[] = ["nsaid","poor_sleep","high_sodium","menstruation","illness","travel","alcohol","refeed"]

function EventTagPicker({ selected, onSelect }: {
  selected: WeightEventTag | null
  onSelect: (tag: WeightEventTag | null) => void
}) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-2">Flag this reading (optional — excludes from trend)</div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {QUICK_TAGS.map(tag => {
          const info = WEIGHT_EVENT_LABELS[tag]
          return (
            <button key={tag} onClick={() => onSelect(selected === tag ? null : tag)}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors
                ${selected === tag
                  ? "bg-amber-500 text-white border-amber-500"
                  : "bg-white text-gray-500 border-gray-200"}`}>
              {info.icon} {info.label}
            </button>
          )
        })}
      </div>
      {selected && (
        <div className="text-[10px] text-amber-700 bg-amber-50 rounded-lg p-2">
          ⚠️ {WEIGHT_EVENT_LABELS[selected].note}. This entry will be excluded from trend and plateau calculations.
        </div>
      )}
    </div>
  )
}

// ── SVG Sparkline with flagged points ─────────────────────────────────────────
function WeightSparkline({ points, goalY }: {
  points: { y: number; date: string; flagged: boolean }[]
  goalY?: number
}) {
  if (points.length < 2) return null
  const W = 340, H = 80, PAD = 16
  const unflagged = points.filter(p => !p.flagged)
  const ys = (unflagged.length >= 2 ? unflagged : points).map(p => p.y)
  const minY = Math.min(...ys, goalY ?? Infinity) - 0.5
  const maxY = Math.max(...ys, goalY ?? -Infinity) + 0.5
  const toX = (i: number) => PAD + (i / (points.length - 1)) * (W - PAD * 2)
  const toY = (y: number) => PAD + ((maxY - y) / (maxY - minY)) * (H - PAD * 2)

  // Path through unflagged points only
  const pathPts = points.map((p, i) => ({ sx: toX(i), sy: toY(p.y), flagged: p.flagged }))
  const pathSegments: string[] = []
  let inGap = true
  pathPts.forEach((p, i) => {
    if (!p.flagged) {
      pathSegments.push(`${inGap ? "M" : "L"}${p.sx.toFixed(1)},${p.sy.toFixed(1)}`)
      inGap = false
    } else {
      inGap = true
    }
  })

  const goalSy = goalY !== undefined ? toY(goalY) : null

  return (
    <svg viewBox={`0 0 ${W} ${H + 24}`} className="w-full overflow-visible">
      {goalSy !== null && goalSy > PAD && goalSy < H && (
        <>
          <line x1={PAD} y1={goalSy} x2={W - PAD} y2={goalSy} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 3" />
          <text x={W - PAD} y={goalSy - 3} textAnchor="end" fontSize="7" fill="#94a3b8">goal</text>
        </>
      )}
      <path d={pathSegments.join(" ")} fill="none" stroke="#0d9488" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pathPts.map((p, i) => (
        <g key={i}>
          {points[i].flagged ? (
            // Hollow orange circle for flagged points
            <>
              <circle cx={p.sx} cy={p.sy} r="4" fill="white" stroke="#f59e0b" strokeWidth="2" strokeDasharray="2 1" />
              <text x={p.sx} y={p.sy - 7} textAnchor="middle" fontSize="7" fill="#f59e0b">{points[i].y}</text>
            </>
          ) : (
            <>
              <circle cx={p.sx} cy={p.sy} r="3.5" fill="#0d9488" />
              <text x={p.sx} y={p.sy - 7} textAnchor="middle" fontSize="8" fill="#6b7280">{points[i].y}</text>
            </>
          )}
          {(i === 0 || i === points.length - 1 || i % Math.ceil(points.length / 5) === 0) && (
            <text x={p.sx} y={H + 16} textAnchor="middle" fontSize="7" fill="#9ca3af">
              {points[i].date.slice(5)}
            </text>
          )}
        </g>
      ))}
      {/* Legend */}
      <g transform={`translate(${PAD}, ${H + 20})`}>
        <circle cx="4" cy="4" r="3" fill="#0d9488" />
        <text x="10" y="7" fontSize="7" fill="#9ca3af">normal</text>
        <circle cx="55" cy="4" r="3" fill="white" stroke="#f59e0b" strokeWidth="1.5" />
        <text x="62" y="7" fontSize="7" fill="#9ca3af">influenced (excluded)</text>
      </g>
    </svg>
  )
}


// ── Body Composition Section ──────────────────────────────────────────────────
function BodyCompositionSection() {
  const [log, setLog] = useState<BodyCompositionEntry[]>(() => loadBodyCompositionLog())
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    weight: "", fatMassKg: "", fatPct: "", muscleMassKg: "",
    skeletalMusclePct: "", visceralFat: "", bodyAge: "", bmr: "",
    source: "Samso scale", note: "",
  })

  function persist(updated: BodyCompositionEntry[]) {
    setLog(updated)
    saveBodyCompositionLog(updated)
  }

  function addEntry() {
    if (!form.weight) return
    const entry: BodyCompositionEntry = {
      date: form.date,
      weight: parseFloat(form.weight),
      fatMassKg:         form.fatMassKg        ? parseFloat(form.fatMassKg)        : undefined,
      fatPct:            form.fatPct            ? parseFloat(form.fatPct)            : undefined,
      muscleMassKg:      form.muscleMassKg      ? parseFloat(form.muscleMassKg)      : undefined,
      skeletalMusclePct: form.skeletalMusclePct ? parseFloat(form.skeletalMusclePct) : undefined,
      visceralFat:       form.visceralFat       ? parseFloat(form.visceralFat)       : undefined,
      bodyAge:           form.bodyAge           ? parseFloat(form.bodyAge)           : undefined,
      bmr:               form.bmr               ? parseFloat(form.bmr)               : undefined,
      source: form.source || undefined,
      note:   form.note   || undefined,
    }
    const updated = [entry, ...log].sort((a, b) => b.date.localeCompare(a.date))
    persist(updated)
    setAdding(false)
    setForm({ date: new Date().toISOString().slice(0,10), weight: "", fatMassKg: "", fatPct: "",
      muscleMassKg: "", skeletalMusclePct: "", visceralFat: "", bodyAge: "", bmr: "", source: "Samso scale", note: "" })
  }

  const latest = log[0]
  const prev   = log[1]

  function delta(key: keyof BodyCompositionEntry): string | null {
    if (!latest || !prev) return null
    const a = latest[key] as number | undefined
    const b = prev[key]   as number | undefined
    if (a === undefined || b === undefined) return null
    const d = +(a - b).toFixed(1)
    return (d > 0 ? "+" : "") + d
  }

  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
      <div className="flex justify-between items-center mb-1">
        <div className="text-sm font-bold text-gray-800">🧬 Body Composition</div>
        <button onClick={() => setAdding(s => !s)}
          className={`text-xs px-3 py-1.5 rounded-lg font-bold border transition-colors
            ${adding ? "bg-gray-100 text-gray-500 border-gray-200" : "bg-teal-600 text-white border-teal-600"}`}>
          {adding ? "✕ Cancel" : "+ Log Scan"}
        </button>
      </div>
      <div className="text-xs text-gray-400 mb-3">
        {latest ? `Last scan: ${new Date(latest.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}${latest.source ? ` · ${latest.source}` : ""}` : "No scans logged yet — log your smart scale or DEXA results"}
      </div>

      {/* Latest scan summary */}
      {latest && !adding && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          {[
            { label: "Fat Mass",      val: latest.fatMassKg,        unit: "kg",  key: "fatMassKg",        good: false },
            { label: "Fat %",         val: latest.fatPct,           unit: "%",   key: "fatPct",           good: false },
            { label: "Muscle Mass",   val: latest.muscleMassKg,     unit: "kg",  key: "muscleMassKg",     good: true  },
            { label: "Visceral Fat",  val: latest.visceralFat,      unit: "",    key: "visceralFat",      good: false },
            { label: "Body Age",      val: latest.bodyAge,          unit: "yrs", key: "bodyAge",          good: false },
            { label: "BMR",           val: latest.bmr,              unit: "kcal",key: "bmr",              good: true  },
          ].map(({ label, val, unit, key, good }) => {
            if (val === undefined) return null
            const d = delta(key as keyof BodyCompositionEntry)
            const dNum = d ? parseFloat(d) : null
            const improved = dNum !== null && (good ? dNum > 0 : dNum < 0)
            const worsened = dNum !== null && (good ? dNum < 0 : dNum > 0)
            return (
              <div key={label} className="bg-gray-50 rounded-xl p-2.5">
                <div className="text-[10px] text-gray-400 mb-0.5">{label}</div>
                <div className="text-sm font-bold text-gray-800">{val}{unit}</div>
                {d && (
                  <div className={`text-[10px] font-bold ${improved ? "text-green-600" : worsened ? "text-red-500" : "text-gray-400"}`}>
                    {d}{unit} vs prev
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add form */}
      {adding && (
        <div className="bg-gray-50 rounded-xl p-3 mb-2">
          <div className="text-xs font-bold text-gray-600 mb-3">Log body composition scan</div>

          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">Date</label>
              <input className={inputCls} type="date" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">Weight (kg) *</label>
              <input className={inputCls} type="number" step="0.1" placeholder="114.5"
                value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">Fat Mass (kg)</label>
              <input className={inputCls} type="number" step="0.1" placeholder="59.8"
                value={form.fatMassKg} onChange={e => setForm(f => ({ ...f, fatMassKg: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">Fat %</label>
              <input className={inputCls} type="number" step="0.1" placeholder="52.2"
                value={form.fatPct} onChange={e => setForm(f => ({ ...f, fatPct: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">Muscle Mass (kg)</label>
              <input className={inputCls} type="number" step="0.1" placeholder="50.9"
                value={form.muscleMassKg} onChange={e => setForm(f => ({ ...f, muscleMassKg: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">Visceral Fat</label>
              <input className={inputCls} type="number" step="1" placeholder="25"
                value={form.visceralFat} onChange={e => setForm(f => ({ ...f, visceralFat: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">Body Age</label>
              <input className={inputCls} type="number" placeholder="28"
                value={form.bodyAge} onChange={e => setForm(f => ({ ...f, bodyAge: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">BMR (kcal)</label>
              <input className={inputCls} type="number" placeholder="1551"
                value={form.bmr} onChange={e => setForm(f => ({ ...f, bmr: e.target.value }))} />
            </div>
          </div>

          <div className="mb-2">
            <label className="text-[10px] text-gray-500 block mb-1">Source</label>
            <input className={inputCls} type="text" placeholder="Samso scale, DEXA, etc"
              value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} />
          </div>

          <input className={inputCls + " mb-3"} type="text" placeholder="Note (optional)"
            value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />

          <button onClick={addEntry}
            className="w-full py-2.5 bg-teal-600 text-white rounded-xl font-bold text-sm">
            Save Scan
          </button>
        </div>
      )}

      {/* History */}
      {log.length > 1 && !adding && (
        <div className="mt-2">
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-2">History</div>
          <div className="max-h-40 overflow-y-auto">
            {log.slice(1, 6).map((entry, i) => (
              <div key={i} className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
                <div className="text-xs text-gray-500">
                  {new Date(entry.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  {entry.source && <span className="text-gray-300 ml-1">· {entry.source}</span>}
                </div>
                <div className="flex gap-3 text-xs">
                  <span className="text-gray-700 font-bold">{entry.weight}kg</span>
                  {entry.fatPct && <span className="text-orange-500">{entry.fatPct}% fat</span>}
                  {entry.visceralFat && <span className="text-red-400">VF:{entry.visceralFat}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function WeightLog() {
  const { profile, goals } = useHealthStore()
  const today = getISTDate()

  const [day, setDay] = useState(() => loadDayData(today))
  const [history, setHistory] = useState<HistoryRow[]>(() => loadHistory())
  const [weightInput, setWeightInput] = useState("")
  const [selectedEvent, setSelectedEvent] = useState<WeightEventTag | null>(null)
  const [weightNote, setWeightNote] = useState("")
  const [showEventPicker, setShowEventPicker] = useState(false)
  const [measureLog, setMeasureLog] = useState<MeasureEntry[]>(() => loadMeasureLog())
  const [showMeasForm, setShowMeasForm] = useState(false)
  const [measInputs, setMeasInputs] = useState<Partial<Record<MeasureId, string>>>({})

  const startWeight = Number(profile.weightKg) || 100
  const goalWeight  = Number(goals.targetWeightKg) || 80

  const persistWeight = useCallback((w: number, event: WeightEventTag | null, note: string) => {
    const updated = { ...day, weight: w }
    setDay(updated)
    saveDayData(updated)

    const hist = loadHistory()
    const idx  = hist.findIndex(h => h.date === today)
    const row: HistoryRow = {
      date: today, cal: 0, protein: 0, carbs: 0, fat: 0,
      weight: w, water: day.water, workoutDone: false, fastBest: day.fastBest,
      weightEvent: event,
      weightNote: note || undefined,
    }
    if (idx >= 0) hist[idx] = { ...hist[idx], weight: w, weightEvent: event, weightNote: note || undefined }
    else hist.unshift(row)
    hist.sort((a, b) => b.date.localeCompare(a.date))
    saveHistory(hist.slice(0, 180))
    setHistory(loadHistory())
  }, [day, today])

  function handleLogWeight() {
    const w = parseFloat(weightInput)
    if (!w || w < 20 || w > 400) return
    persistWeight(w, selectedEvent, weightNote)
    setWeightInput("")
    setSelectedEvent(null)
    setWeightNote("")
    setShowEventPicker(false)
  }

  function handleClearWeight() {
    const updated = { ...day, weight: null }
    setDay(updated)
    saveDayData(updated)
    const hist = loadHistory()
    const idx  = hist.findIndex(h => h.date === today)
    if (idx >= 0) hist[idx] = { ...hist[idx], weight: null, weightEvent: null, weightNote: undefined }
    saveHistory(hist)
    setHistory(loadHistory())
  }

  function handleSaveMeasurements() {
    const vals: Partial<Record<MeasureId, number>> = {}
    let any = false
    MEASURES.forEach(m => {
      const v = parseFloat(measInputs[m.id] || "")
      if (!isNaN(v) && v > 0) { vals[m.id] = v; any = true }
    })
    if (!any) return
    const log = loadMeasureLog()
    const idx  = log.findIndex(e => e.date === today)
    const entry: MeasureEntry = { date: today, ...vals }
    if (idx >= 0) log[idx] = entry; else log.unshift(entry)
    saveMeasureLog(log)
    setMeasureLog(loadMeasureLog())
    setShowMeasForm(false)
    setMeasInputs({})
  }

  // Build chart points — last 30 with weight, oldest first
  // Exclude flagged from trend but show them as hollow points
  const weightPoints = history
    .filter(h => h.weight !== null)
    .slice(0, 30)
    .reverse()
    .map(h => ({
      y: h.weight as number,
      date: h.date,
      flagged: !!h.weightEvent,
      event: h.weightEvent,
      note: h.weightNote,
    }))

  // Stats from unflagged points only
  const cleanPoints = weightPoints.filter(p => !p.flagged)
  const currentWeight = day.weight ?? cleanPoints[cleanPoints.length - 1]?.y ?? startWeight
  const totalLost     = startWeight - currentWeight
  const toGoal        = Math.max(0, currentWeight - goalWeight)
  const journeyTotal  = Math.max(startWeight - goalWeight, 0.1)
  const progressPct   = Math.min(100, Math.round((totalLost / journeyTotal) * 100))

  // Rate from clean points last 14 days
  const last14clean = cleanPoints.slice(-14)
  let ratePerWeek: number | null = null
  if (last14clean.length >= 7) {
    const days = last14clean.length
    ratePerWeek = +((last14clean[0].y - last14clean[days - 1].y) / days * 7).toFixed(2)
  }

  let goalDateStr: string | null = null
  if (ratePerWeek && ratePerWeek > 0.01 && toGoal > 0) {
    const weeksLeft = toGoal / ratePerWeek
    const gd = new Date(); gd.setDate(gd.getDate() + Math.round(weeksLeft * 7))
    goalDateStr = gd.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
  }

  const flaggedCount = weightPoints.filter(p => p.flagged).length
  const latestMeas = measureLog[0] || null
  const prevMeas   = measureLog[1] || null

  return (
    <div className="p-3 pb-24">

      {/* Header */}
      <div className="bg-gradient-to-br from-gray-900 to-teal-800 rounded-2xl p-4 mb-3 text-white">
        <div className="text-xs opacity-70 mb-0.5">Weight Tracker</div>
        <div className="text-2xl font-bold">{currentWeight} kg</div>
        <div className="text-xs opacity-70 mt-0.5">
          Goal: {goalWeight} kg · {toGoal > 0 ? `${toGoal.toFixed(1)} kg to go` : "🎉 Goal reached!"}
        </div>
        {flaggedCount > 0 && (
          <div className="text-[10px] opacity-60 mt-1">
            ⚠️ {flaggedCount} influenced reading{flaggedCount > 1 ? "s" : ""} excluded from trend
          </div>
        )}
      </div>

      {/* Log Weight */}
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
        <div className="text-sm font-bold text-gray-800 mb-3">⚖️ Today's Weight</div>

        {day.weight ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-teal-700">{day.weight} kg</span>
                  {history.find(h => h.date === today)?.weightEvent && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">
                      {WEIGHT_EVENT_LABELS[history.find(h => h.date === today)!.weightEvent!].icon} influenced
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {totalLost > 0 ? `↓ ${totalLost.toFixed(1)} kg from start` : `Start: ${startWeight} kg`}
                </div>
                {history.find(h => h.date === today)?.weightNote && (
                  <div className="text-xs text-gray-400 mt-0.5 italic">
                    "{history.find(h => h.date === today)?.weightNote}"
                  </div>
                )}
              </div>
              <button onClick={handleClearWeight}
                className="text-xs text-gray-400 border border-gray-200 px-3 py-1.5 rounded-lg">
                Clear
              </button>
            </div>
            {history.find(h => h.date === today)?.weightEvent && (
              <div className="text-[10px] text-amber-600 bg-amber-50 rounded-lg p-2">
                This reading is flagged as influenced by {WEIGHT_EVENT_LABELS[history.find(h => h.date === today)!.weightEvent!].label.toLowerCase()} and excluded from trend calculations.
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="text-xs text-gray-400 mb-2">Log before eating for most accurate reading</div>
            <div className="flex gap-2 mb-2">
              <input
                type="number" step="0.1" min="30" max="400"
                value={weightInput}
                onChange={e => setWeightInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogWeight()}
                placeholder="e.g. 113.5"
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-teal-500"
              />
              <button onClick={handleLogWeight}
                className="px-5 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-bold">
                Log
              </button>
            </div>

            {/* Event flag toggle */}
            <button onClick={() => setShowEventPicker(s => !s)}
              className={`text-xs px-3 py-1.5 rounded-lg border mb-2 transition-colors
                ${showEventPicker ? "bg-amber-50 border-amber-300 text-amber-700" : "bg-gray-50 border-gray-200 text-gray-500"}`}>
              {showEventPicker ? "▲ Hide event flag" : "⚠️ Flag this reading (medication, poor sleep, etc.)"}
            </button>

            {showEventPicker && (
              <div className="mb-2">
                <EventTagPicker selected={selectedEvent} onSelect={setSelectedEvent} />
                <input type="text" placeholder="Optional note (e.g. Combiflam for headache)"
                  value={weightNote} onChange={e => setWeightNote(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs mt-2 focus:outline-none focus:border-teal-500" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Goal Progress */}
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
        <div className="flex justify-between items-center mb-2">
          <div className="text-sm font-bold text-gray-800">Goal Progress</div>
          <div className={`text-sm font-bold ${progressPct >= 50 ? "text-teal-600" : "text-gray-500"}`}>{progressPct}%</div>
        </div>
        <div className="h-4 bg-gray-100 rounded-full overflow-hidden mb-2">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${progressPct}%`, background: "linear-gradient(90deg, #0d9488, #14b8a6)" }} />
        </div>
        <div className="flex justify-between text-xs text-gray-400 mb-3">
          <span>Start: {startWeight} kg</span>
          {totalLost > 0 && <span className="text-green-600 font-bold">↓ {totalLost.toFixed(1)} kg lost</span>}
          <span>Goal: {goalWeight} kg</span>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          {[
            { label: "Rate",      val: ratePerWeek !== null ? `${ratePerWeek > 0 ? "↓ " : "↑ "}${Math.abs(ratePerWeek)} kg/wk` : "—", color: "bg-teal-50 text-teal-700" },
            { label: "Goal date", val: goalDateStr || "—", color: "bg-purple-50 text-purple-700" },
            { label: "Remaining", val: `${toGoal.toFixed(1)} kg`, color: "bg-blue-50 text-blue-700" },
            { label: "Lost",      val: `${totalLost > 0 ? totalLost.toFixed(1) : "0"} kg`, color: "bg-green-50 text-green-700" },
          ].map(({ label, val, color }) => (
            <div key={label} className={`rounded-xl p-3 text-center ${color}`}>
              <div className="text-sm font-bold">{val}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {ratePerWeek !== null && (
          <div className={`p-2.5 rounded-xl border-l-4 text-xs
            ${ratePerWeek >= 0.3 && ratePerWeek <= 1.0 ? "bg-green-50 border-green-500 text-green-800"
              : ratePerWeek > 1.5 ? "bg-red-50 border-red-500 text-red-800"
              : ratePerWeek > 1.0 ? "bg-blue-50 border-blue-500 text-blue-800"
              : ratePerWeek > 0 ? "bg-amber-50 border-amber-500 text-amber-800"
              : "bg-red-50 border-red-500 text-red-800"}`}>
            {ratePerWeek >= 0.3 && ratePerWeek <= 1.0 ? `✅ On track — steady loss of ${ratePerWeek} kg/week`
              : ratePerWeek > 1.5 ? `⚡ ${ratePerWeek} kg/week — increase calories by ~200 to protect muscle`
              : ratePerWeek > 1.0 ? `✅ Good pace — ${ratePerWeek} kg/week`
              : ratePerWeek > 0 ? `🐌 Only ${ratePerWeek} kg/week — tighten carbs or add fasted walk`
              : `⚠️ Weight not moving — check portions and reduce carbs`}
          </div>
        )}

        {flaggedCount > 0 && (
          <div className="text-[10px] text-amber-600 bg-amber-50 rounded-lg p-2 mt-2">
            ⚠️ Rate and trend calculated from clean readings only — {flaggedCount} influenced point{flaggedCount > 1 ? "s" : ""} excluded.
          </div>
        )}
      </div>

      {/* Weight Chart */}
      {weightPoints.length >= 2 && (
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
          <div className="text-sm font-bold text-gray-800 mb-1">📈 Weight Trend</div>
          <div className="text-xs text-gray-400 mb-3">
            Solid = clean · Hollow orange = influenced (excluded from trend) · Dashed line = goal
          </div>
          <WeightSparkline points={weightPoints} goalY={goalWeight} />
        </div>
      )}

      {/* Weight History */}
      {weightPoints.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
          <div className="text-sm font-bold text-gray-800 mb-3">📋 Weight History</div>
          <div className="max-h-56 overflow-y-auto">
            {history.filter(h => h.weight !== null).slice(0, 20).map((h, i, arr) => {
              const prev = arr[i + 1]
              const delta = prev?.weight && h.weight
                ? +(h.weight - prev.weight).toFixed(1) : null
              const flagged = !!h.weightEvent
              return (
                <div key={h.date} className={`flex justify-between items-center py-2 border-b border-gray-50 last:border-0
                  ${flagged ? "opacity-60" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-600 flex items-center gap-1">
                      {new Date(h.date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                      {flagged && (
                        <span className="text-[9px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full">
                          {WEIGHT_EVENT_LABELS[h.weightEvent!].icon} excluded
                        </span>
                      )}
                    </div>
                    {h.weightNote && (
                      <div className="text-[9px] text-gray-400 italic truncate">{h.weightNote}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {delta !== null && (
                      <span className={`text-[10px] font-bold ${delta < 0 ? "text-green-600" : delta > 0 ? "text-red-500" : "text-gray-400"}`}>
                        {delta < 0 ? "↓" : delta > 0 ? "↑" : "→"}{Math.abs(delta)}
                      </span>
                    )}
                    <span className={`text-sm font-bold ${flagged ? "text-amber-500" : "text-gray-800"}`}>{h.weight} kg</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Body Measurements */}
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
        <div className="flex justify-between items-center mb-1">
          <div className="text-sm font-bold text-gray-800">📐 Body Measurements</div>
          <button onClick={() => setShowMeasForm(s => !s)}
            className={`text-xs px-3 py-1.5 rounded-lg font-bold border transition-colors
              ${showMeasForm ? "bg-gray-100 text-gray-500 border-gray-200" : "bg-teal-600 text-white border-teal-600"}`}>
            {showMeasForm ? "✕ Cancel" : "+ Log"}
          </button>
        </div>
        <div className="text-xs text-gray-400 mb-3">
          {latestMeas
            ? `Last: ${new Date(latestMeas.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
            : "No measurements logged yet"}
        </div>

        {showMeasForm && (
          <div className="bg-teal-50 rounded-xl p-3 mb-3">
            <div className="text-xs font-bold text-teal-700 mb-3">Enter measurements — leave blank to skip</div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {MEASURES.map(m => (
                <div key={m.id}>
                  <div className="text-[10px] text-gray-500 mb-1">{m.icon} {m.label} <span className="text-gray-400">({m.note})</span></div>
                  <input type="number" inputMode="numeric" step="0.1" min="20" max="200"
                    placeholder={latestMeas?.[m.id]?.toString() || "cm"}
                    value={measInputs[m.id] || ""}
                    onChange={e => setMeasInputs(prev => ({ ...prev, [m.id]: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-bold focus:outline-none focus:border-teal-500" />
                </div>
              ))}
            </div>
            <button onClick={handleSaveMeasurements}
              className="w-full py-2.5 bg-teal-600 text-white rounded-xl font-bold text-sm">
              Save Measurements
            </button>
          </div>
        )}

        {latestMeas && !showMeasForm && (
          <div>
            {MEASURES.map(m => {
              const val = latestMeas[m.id]
              if (!val) return null
              const prev  = prevMeas?.[m.id]
              const delta = prev ? +(val - prev).toFixed(1) : null
              return (
                <div key={m.id} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                  <span className="text-xs font-semibold text-gray-700">{m.icon} {m.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-800">{val} cm</span>
                    {delta !== null && (
                      <span className={`text-[10px] font-bold ${delta < 0 ? "text-green-600" : delta > 0 ? "text-red-500" : "text-gray-400"}`}>
                        {delta < 0 ? "↓" : delta > 0 ? "↑" : "→"}{Math.abs(delta)}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {!latestMeas && !showMeasForm && (
          <div className="text-center text-gray-400 text-xs py-4">Tap + Log to record your first measurements</div>
        )}
      </div>

    </div>
  )
}
