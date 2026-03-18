import { useState, useEffect } from "react"
import {
  loadMedications, Medication,
  loadBloodTests, BloodTest,
  loadBloodTestLog, saveBloodTestLog, BloodTestLog,
  loadMedTakenForDate, saveMedTakenForDate,
  loadWeeklyMedLastTaken, saveWeeklyMedLastTaken,
} from "../store/useHealthStore"
import { getISTDate } from "../utils/dateHelpers"
import { loadSavedConditions, getActiveGuidance, CONDITIONS, CONDITION_CATEGORIES, ConditionCategory } from "../services/healthConditions"
import HealthConditions from "./HealthConditions"

// ── Helpers ───────────────────────────────────────────────────────────────────
function daysSince(ts: number): number {
  return Math.floor((Date.now() - ts) / 86_400_000)
}

function daysUntil(ts: number, intervalDays: number): number {
  return Math.max(0, intervalDays - daysSince(ts))
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

function getTodayDayName(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "long" })
}

// ── Medication checklist ──────────────────────────────────────────────────────
function MedicationChecklist() {
  const today = getISTDate()
  const [meds] = useState<Medication[]>(() => loadMedications().filter(m => m.enabled))
  const [taken, setTaken] = useState<Record<string, boolean>>(() => loadMedTakenForDate(today))

  function isDueToday(med: Medication): boolean {
    if (med.frequency === "daily") return true
    if (med.frequency === "weekly") return (med.days || []).includes(getTodayDayName())
    return true
  }

  const dueMeds = meds.filter(isDueToday)

  function toggle(id: string) {
    const updated = { ...taken, [id]: !taken[id] }
    setTaken(updated)
    saveMedTakenForDate(today, updated)
  }

  if (dueMeds.length === 0) return (
    <div className="bg-white rounded-xl shadow-sm p-4 mb-3 text-center text-gray-400 text-sm">
      No medications due today. Add them in Settings → Medications.
    </div>
  )

  const medType = (med: any) => (med as any).type ?? "prescribed"

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 mb-3">
      <div className="text-sm font-bold text-gray-800 mb-3">💊 Today's Medications</div>
      {dueMeds.map(med => {
        const isTaken = !!taken[med.id]
        const type = medType(med)
        const bg = isTaken
          ? type === "supplement" ? "bg-blue-50 border-blue-300"
          : "bg-teal-50 border-teal-300"
          : "bg-gray-50 border-gray-200"
        const textCol = isTaken
          ? type === "supplement" ? "text-blue-700" : "text-teal-700"
          : "text-gray-700"

        return (
          <button key={med.id} onClick={() => toggle(med.id)}
            className={`w-full flex items-center justify-between p-3 rounded-xl mb-2 border transition-colors ${bg}`}>
            <div className="text-left">
              <div className="flex items-center gap-1.5">
                <span className={`text-sm font-semibold ${textCol}`}>{med.name}</span>
                {type === "supplement" && (
                  <span className="text-[9px] bg-blue-100 text-blue-600 font-bold px-1.5 py-0.5 rounded-full">Supplement</span>
                )}
              </div>
              {med.note && <div className="text-xs text-gray-400">{med.note}</div>}
            </div>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold
              ${isTaken ? "bg-teal-600 text-white" : "bg-gray-200 text-gray-400"}`}>
              {isTaken ? "✓" : "○"}
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ── Blood test tracker ────────────────────────────────────────────────────────
function BloodTestTracker() {
  const [tests] = useState<BloodTest[]>(() => loadBloodTests().filter(t => t.enabled))
  const [log, setLog] = useState<BloodTestLog[]>(() => loadBloodTestLog())
  const [logging, setLogging] = useState<string | null>(null)
  const [note, setNote] = useState("")

  function getLastLog(testId: string): BloodTestLog | null {
    return log.filter(l => l.testId === testId).sort((a, b) => b.doneAt - a.doneAt)[0] ?? null
  }

  function markDone(testId: string) {
    const entry: BloodTestLog = { testId, doneAt: Date.now(), note: note.trim() || undefined }
    const updated = [...log, entry]
    setLog(updated)
    saveBloodTestLog(updated)
    setLogging(null)
    setNote("")
  }

  if (tests.length === 0) return (
    <div className="bg-white rounded-xl shadow-sm p-4 mb-3 text-center text-gray-400 text-sm">
      No blood tests configured. Add them in Settings → Blood Tests.
    </div>
  )

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 mb-3">
      <div className="text-sm font-bold text-gray-800 mb-3">🩸 Blood Tests</div>
      {tests.map(test => {
        const last = getLastLog(test.id)
        const overdue = last ? daysUntil(last.doneAt, test.intervalDays) === 0 : true
        const isLogging = logging === test.id
        const neverDone = !last

        return (
          <div key={test.id} className={`mb-3 p-3 rounded-xl border
            ${overdue ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-semibold ${overdue ? "text-amber-800" : "text-green-800"}`}>
                  {test.name}
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">{test.reason}</div>
                <div className={`text-[10px] mt-1 font-medium
                  ${overdue ? "text-amber-600" : "text-green-600"}`}>
                  {neverDone ? "⚠️ Never recorded"
                    : overdue ? `⚠️ Due — last done ${fmtDate(last!.doneAt)}`
                    : `✓ Next in ${daysUntil(last!.doneAt, test.intervalDays)} days · last ${fmtDate(last!.doneAt)}`}
                </div>
              </div>
              {!isLogging && (
                <button onClick={() => setLogging(test.id)}
                  className="text-xs px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg font-semibold text-gray-600 shrink-0">
                  Mark done
                </button>
              )}
            </div>

            {isLogging && (
              <div className="mt-2">
                <input
                  type="text" placeholder="Add note (optional — e.g. HbA1c 6.1)"
                  value={note} onChange={e => setNote(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs mb-2 focus:outline-none" />
                <div className="flex gap-2">
                  <button onClick={() => { setLogging(null); setNote("") }}
                    className="flex-1 py-1.5 bg-gray-100 text-gray-500 rounded-lg text-xs font-bold">Cancel</button>
                  <button onClick={() => markDone(test.id)}
                    className="flex-1 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-bold">Save</button>
                </div>
              </div>
            )}

            {last?.note && !isLogging && (
              <div className="text-[10px] text-gray-400 mt-1 italic">"{last.note}"</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Conditions summary strip ──────────────────────────────────────────────────
function ConditionsSummary({ onManage }: { onManage: () => void }) {
  const saved = loadSavedConditions()
  const guidance = getActiveGuidance(saved.conditions)
  const highCount = guidance.filter(g => g.severity === "high").length
  const modCount  = guidance.filter(g => g.severity === "moderate").length
  const hasAny    = saved.conditions.length > 0

  return (
    <div className={`rounded-xl p-3 mb-3 border flex items-center justify-between gap-3
      ${highCount > 0 ? "bg-red-50 border-red-200"
        : modCount > 0 ? "bg-amber-50 border-amber-200"
        : "bg-gray-50 border-gray-200"}`}>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-bold
          ${highCount > 0 ? "text-red-800" : modCount > 0 ? "text-amber-800" : "text-gray-600"}`}>
          🩺 Health Conditions
        </div>
        <div className={`text-xs mt-0.5
          ${highCount > 0 ? "text-red-600" : modCount > 0 ? "text-amber-600" : "text-gray-400"}`}>
          {!hasAny
            ? "None selected — tap to add for personalised guidance"
            : [
                highCount > 0 ? `${highCount} high caution` : null,
                modCount > 0 ? `${modCount} moderate caution` : null,
                guidance.filter(g => g.severity === "caution").length > 0
                  ? `${guidance.filter(g => g.severity === "caution").length} advisory` : null,
              ].filter(Boolean).join(" · ")}
        </div>
      </div>
      <button onClick={onManage}
        className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold border
          ${highCount > 0 ? "bg-red-600 text-white border-red-600"
            : modCount > 0 ? "bg-amber-500 text-white border-amber-500"
            : "bg-teal-600 text-white border-teal-600"}`}>
        {hasAny ? "View →" : "Set up →"}
      </button>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function HealthMonitor() {
  const [showConditions, setShowConditions] = useState(false)

  if (showConditions) {
    return (
      <div className="p-3 pb-24">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => setShowConditions(false)}
            className="text-sm text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5">
            ← Back
          </button>
          <div className="text-sm font-bold text-gray-800">Health Conditions & Guidance</div>
        </div>
        <HealthConditions onClose={() => setShowConditions(false)} />
      </div>
    )
  }

  return (
    <div className="p-3 pb-24">
      <div className="bg-gradient-to-br from-gray-900 to-teal-800 rounded-2xl p-4 mb-3 text-white">
        <div className="text-xs opacity-70 mb-0.5">Health</div>
        <div className="text-base font-bold">Health Monitor</div>
        <div className="text-xs opacity-60 mt-0.5">Medications · Blood tests · Conditions</div>
      </div>

      <ConditionsSummary onManage={() => setShowConditions(true)} />
      <MedicationChecklist />
      <BloodTestTracker />
    </div>
  )
}
