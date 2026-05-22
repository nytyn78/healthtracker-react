import { loadHistory } from "../store/useHealthStore"
import { KEYS } from "../services/storageKeys"
import { useState, useEffect } from "react"

function getPastDate(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

function getFastHoursForDate(date: string, histFastBest?: number): number {
  try {
    const raw = localStorage.getItem(KEYS.DAY_LOG(date))
    if (raw) {
      const day = JSON.parse(raw)
      return (day.fastBest || 0) / 3600
    }
  } catch {}
  return (histFastBest || 0) / 3600
}

export default function FastingStreak() {
  const [streak, setStreak] = useState(0)
  const [best, setBest] = useState(0)
  const [last7, setLast7] = useState<{ date: string; hours: number; label: string }[]>([])
  const TARGET_H = 19

  useEffect(() => {
    const history = loadHistory()

    // Build last 7 days bar data
    const bars = Array.from({ length: 7 }, (_, i) => {
      const date = getPastDate(6 - i)
      const histRow = history.find(h => h.date === date)
      const hours = getFastHoursForDate(date, histRow?.fastBest)
      const d = new Date(date)
      const label = d.toLocaleDateString("en-IN", { weekday: "short" }).slice(0, 3)
      return { date, hours, label }
    })
    setLast7(bars)

    // Best fast ever
    const allBest = history.reduce((max, h) => Math.max(max, (h.fastBest || 0) / 3600), 0)
    setBest(Math.round(allBest * 10) / 10)

    // Current streak: consecutive days with fast >= 14h
    let s = 0
    for (let i = 0; i < 30; i++) {
      const date = getPastDate(i)
      const histRow = history.find(h => h.date === date)
      const hours = getFastHoursForDate(date, histRow?.fastBest)
      if (hours >= 14) s++
      else if (i > 0) break // allow today to be incomplete
    }
    setStreak(s)
  }, [])

  const maxH = Math.max(...last7.map(d => d.hours), TARGET_H, 1)
  const metTarget = last7.filter(d => d.hours >= TARGET_H).length

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
      <div className="text-sm font-bold text-gray-800 mb-3">🔥 Fasting Streak</div>

      {/* Stats row */}
      <div className="flex gap-2 mb-4">
        <div className={`flex-1 rounded-xl p-3 text-center ${streak >= 3 ? "bg-teal-50" : "bg-gray-50"}`}>
          <div className={`text-2xl font-bold ${streak >= 3 ? "text-teal-600" : "text-gray-600"}`}>{streak}</div>
          <div className="text-[10px] text-gray-400">day streak</div>
        </div>
        <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-gray-600">{best}h</div>
          <div className="text-[10px] text-gray-400">personal best</div>
        </div>
        <div className={`flex-1 rounded-xl p-3 text-center ${metTarget >= 4 ? "bg-green-50" : "bg-gray-50"}`}>
          <div className={`text-2xl font-bold ${metTarget >= 4 ? "text-green-600" : "text-gray-600"}`}>{metTarget}/7</div>
          <div className="text-[10px] text-gray-400">target met</div>
        </div>
      </div>

      {/* Bar chart */}
      <div className="text-[10px] text-gray-400 mb-1">Last 7 days</div>
      <div className="flex gap-1 items-end h-16 mb-1">
        {last7.map((d, i) => {
          const pct = (d.hours / maxH) * 100
          const color = d.hours >= TARGET_H ? "#4ade80" : d.hours >= 16 ? "#0d9488" : d.hours >= 12 ? "#f59e0b" : d.hours > 0 ? "#d1d5db" : "#f3f4f6"
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
              <div className="w-full rounded-t-sm transition-all" style={{ height: `${Math.max(pct, 3)}%`, background: color }} />
              <div className="text-[8px] text-gray-400">{d.label}</div>
            </div>
          )
        })}
      </div>

      {/* Target line legend */}
      <div className="flex gap-3 text-[10px] text-gray-400 mt-2">
        <span><span className="inline-block w-2 h-2 rounded-sm bg-green-400 mr-0.5" />≥{TARGET_H}h goal</span>
        <span><span className="inline-block w-2 h-2 rounded-sm bg-teal-500 mr-0.5" />≥16h</span>
        <span><span className="inline-block w-2 h-2 rounded-sm bg-amber-400 mr-0.5" />≥12h</span>
      </div>
    </div>
  )
}
