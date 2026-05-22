import { loadHistory } from "../store/useHealthStore"
import { useState, useEffect } from "react"

type Feedback = {
  streak: number
  loggedDays: number
  avgCal: number
  avgProtein: number
  workoutDays: number
  fastingDays: number
  bestDay: string | null
  weakestArea: string
}

function analyzeWeek(history: ReturnType<typeof loadHistory>): Feedback {
  const last7 = history.slice(0, 7)
  const loggedDays = last7.filter(h => h.cal > 0).length
  const avgCal = loggedDays > 0 ? Math.round(last7.reduce((a, h) => a + h.cal, 0) / loggedDays) : 0
  const avgProtein = loggedDays > 0 ? Math.round(last7.reduce((a, h) => a + h.protein, 0) / loggedDays) : 0
  const workoutDays = last7.filter(h => h.workoutDone).length
  const fastingDays = last7.filter(h => h.fastBest && h.fastBest >= 14 * 3600).length

  // Streak: consecutive days with any logging
  let streak = 0
  for (const h of history) {
    if (h.cal > 0) streak++
    else break
  }

  // Best day by calorie compliance (closest to target without going over)
  const bestDay = last7.length > 0
    ? last7.reduce((best, h) =>
        h.cal > 0 && (best === null || Math.abs(h.cal - 1350) < Math.abs(best.cal - 1350)) ? h : best
      , null as typeof last7[0] | null)?.date ?? null
    : null

  // Weakest area
  let weakestArea = "Keep logging consistently"
  if (workoutDays === 0) weakestArea = "No workouts logged this week"
  else if (fastingDays < 3) weakestArea = "Fasting consistency could improve"
  else if (avgProtein < 80) weakestArea = "Protein is below target most days"
  else if (loggedDays < 5) weakestArea = "Try to log food every day"

  return { streak, loggedDays, avgCal, avgProtein, workoutDays, fastingDays, bestDay, weakestArea }
}

export default function BehaviorFeedback() {
  const [fb, setFb] = useState<Feedback | null>(null)

  useEffect(() => {
    const history = loadHistory()
    if (history.length > 0) setFb(analyzeWeek(history))
  }, [])

  if (!fb) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
        <div className="text-sm font-bold text-gray-800 mb-2">📋 Behavior Feedback</div>
        <p className="text-xs text-gray-400">Start logging to get your weekly behavior analysis.</p>
      </div>
    )
  }

  const stats = [
    { label: "Days logged",  value: `${fb.loggedDays}/7`,   icon: "📝", ok: fb.loggedDays >= 5 },
    { label: "Workouts",     value: `${fb.workoutDays}/7`,  icon: "💪", ok: fb.workoutDays >= 3 },
    { label: "Fasting days", value: `${fb.fastingDays}/7`,  icon: "⏱",  ok: fb.fastingDays >= 4 },
    { label: "Avg protein",  value: `${fb.avgProtein}g`,    icon: "🥩", ok: fb.avgProtein >= 80 },
    { label: "Avg calories", value: `${fb.avgCal} kcal`,    icon: "🔥", ok: fb.avgCal > 0 && fb.avgCal <= 1500 },
    { label: "Log streak",   value: `${fb.streak} days`,    icon: "🔥", ok: fb.streak >= 5 },
  ]

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
      <div className="text-sm font-bold text-gray-800 mb-3">📋 Weekly Behavior</div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        {stats.map(s => (
          <div key={s.label} className={`rounded-xl p-2.5 text-center ${s.ok ? "bg-green-50" : "bg-gray-50"}`}>
            <div className="text-base">{s.icon}</div>
            <div className={`text-xs font-bold ${s.ok ? "text-green-700" : "text-gray-600"}`}>{s.value}</div>
            <div className="text-[10px] text-gray-400 leading-tight">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
        <div className="text-[10px] font-bold text-amber-800 mb-0.5">💡 Focus this week</div>
        <div className="text-xs text-amber-700">{fb.weakestArea}</div>
      </div>
    </div>
  )
}
