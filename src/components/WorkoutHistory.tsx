import { loadHistory, loadDayData } from "../store/useHealthStore"
import { KEYS } from "../services/storageKeys"
import { useState, useEffect } from "react"

type WorkoutEntry = {
  id: string
  type: "walk" | "circuit" | "other"
  duration: number
  dist?: string
  note?: string
  exercises?: string[]
}

type DayWorkouts = {
  date: string
  label: string
  workouts: WorkoutEntry[]
}

function getPastDate(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = getPastDate(1)
  if (dateStr === today) return "Today"
  if (dateStr === yesterday) return "Yesterday"
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })
}

const TYPE_ICONS: Record<string, string> = {
  walk: "🚶",
  circuit: "💪",
  other: "⚡",
}

const TYPE_LABELS: Record<string, string> = {
  walk: "Walk",
  circuit: "Circuit",
  other: "Workout",
}

export default function WorkoutHistory() {
  const [days, setDays] = useState<DayWorkouts[]>([])
  const [totalDays, setTotalDays] = useState(0)
  const [totalMinutes, setTotalMinutes] = useState(0)

  useEffect(() => {
    const results: DayWorkouts[] = []
    let tDays = 0, tMins = 0

    for (let i = 0; i < 14; i++) {
      const date = getPastDate(i)
      try {
        const raw = localStorage.getItem(KEYS.DAY_LOG(date))
        if (raw) {
          const day = JSON.parse(raw)
          const workouts: WorkoutEntry[] = day.workouts || []
          if (workouts.length > 0) {
            results.push({ date, label: formatDate(date), workouts })
            tDays++
            tMins += workouts.reduce((a, w) => a + (w.duration || 0), 0)
          }
        }
      } catch {}
    }

    setDays(results)
    setTotalDays(tDays)
    setTotalMinutes(tMins)
  }, [])

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
      <div className="text-sm font-bold text-gray-800 mb-3">📜 Workout History</div>

      {/* Summary */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 bg-teal-50 rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-teal-600">{totalDays}</div>
          <div className="text-[10px] text-gray-400">active days</div>
          <div className="text-[10px] text-gray-300">last 14 days</div>
        </div>
        <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-gray-600">{totalMinutes}</div>
          <div className="text-[10px] text-gray-400">total minutes</div>
          <div className="text-[10px] text-gray-300">last 14 days</div>
        </div>
        <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-gray-600">{14 - totalDays}</div>
          <div className="text-[10px] text-gray-400">rest days</div>
          <div className="text-[10px] text-gray-300">last 14 days</div>
        </div>
      </div>

      {/* Day list */}
      {days.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-2">No workouts logged in the last 14 days.</p>
      ) : (
        <div className="space-y-3">
          {days.map(day => (
            <div key={day.date}>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">{day.label}</div>
              {day.workouts.map(w => (
                <div key={w.id} className="flex items-start gap-2 bg-gray-50 rounded-xl px-3 py-2.5 mb-1.5">
                  <span className="text-lg shrink-0">{TYPE_ICONS[w.type] ?? "⚡"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-gray-700">
                      {TYPE_LABELS[w.type] ?? "Workout"}
                      {w.dist && <span className="text-gray-400 font-normal ml-1">· {w.dist}</span>}
                    </div>
                    {w.duration > 0 && (
                      <div className="text-[10px] text-gray-400">{w.duration} min</div>
                    )}
                    {w.exercises && w.exercises.length > 0 && (
                      <div className="text-[10px] text-teal-600 mt-0.5">
                        {w.exercises.slice(0, 3).join(" · ")}{w.exercises.length > 3 ? ` +${w.exercises.length - 3}` : ""}
                      </div>
                    )}
                    {w.note && (
                      <div className="text-[10px] text-gray-400 italic">{w.note}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
