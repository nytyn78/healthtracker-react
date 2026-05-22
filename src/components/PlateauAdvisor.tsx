import { useHealthStore, loadHistory } from "../store/useHealthStore"
import { detectPlateau } from "../services/plateauDetection"
import { computeMacros } from "../services/adaptiveTDEE"
import { useState, useEffect } from "react"

const ADVICE: Record<string, { title: string; body: string; emoji: string }> = {
  calorie_audit: {
    emoji: "🔍",
    title: "Check your calorie logging",
    body: "Your average intake looks very low. Are you logging everything? Oils, ghee, and dairy add up quickly and are easy to miss.",
  },
  refeed_day: {
    emoji: "🔄",
    title: "Try a refeed day",
    body: "You've been compliant but weight has stalled. A planned refeed day (higher carbs, maintenance calories) can reset leptin and restart fat loss.",
  },
  diet_break: {
    emoji: "🛑",
    title: "Take a diet break",
    body: "Over 3 weeks without progress. A 7–14 day break at maintenance calories can restore hormones and metabolism before resuming your deficit.",
  },
  reduce_carbs: {
    emoji: "🌾",
    title: "Tighten carbs",
    body: "Carbs may have crept up. Try strict low-carb (≤20g) for 5 days to drop water retention and restart weight loss.",
  },
  add_cardio: {
    emoji: "🚶",
    title: "Add a daily walk",
    body: "No workouts logged recently. A 30-minute fasted walk each morning improves insulin sensitivity and fat oxidation.",
  },
  increase_protein: {
    emoji: "🥩",
    title: "Increase protein intake",
    body: "Protein appears low. Hitting your protein target preserves muscle and improves satiety, both of which help break a stall.",
  },
}

export default function PlateauAdvisor() {
  const { profile, goals, settings } = useHealthStore()
  const macros = computeMacros(profile, goals, settings)
  const calTarget = macros?.targetCalories ?? 1350

  const [result, setResult] = useState(() =>
    detectPlateau(
      loadHistory().map(h => ({ date: h.date, weight: h.weight, cal: h.cal, carbs: h.carbs, workoutDone: h.workoutDone })),
      calTarget
    )
  )

  useEffect(() => {
    const history = loadHistory()
    setResult(detectPlateau(
      history.map(h => ({ date: h.date, weight: h.weight, cal: h.cal, carbs: h.carbs, workoutDone: h.workoutDone })),
      calTarget
    ))
  }, [calTarget])

  if (!result.isInPlateau && result.plateauDays < 5) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
        <div className="text-sm font-bold text-gray-800 mb-2">⚖️ Plateau Advisor</div>
        <div className="flex items-center gap-2">
          <span className="text-2xl">✅</span>
          <p className="text-xs text-gray-500">No plateau detected. Weight is moving — keep it up!</p>
        </div>
      </div>
    )
  }

  const advice = result.recommendation !== "none" ? ADVICE[result.recommendation] : null
  const severity = result.plateauDays >= 21 ? "border-red-500" : result.plateauDays >= 10 ? "border-orange-500" : "border-amber-400"

  return (
    <div className={`bg-white rounded-2xl shadow-sm p-4 mb-3 border-l-4 ${severity}`}>
      <div className="flex justify-between items-start mb-2">
        <div className="text-sm font-bold text-gray-800">⚠️ Plateau Detected</div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold text-white
          ${result.plateauDays >= 21 ? "bg-red-500" : result.plateauDays >= 10 ? "bg-orange-500" : "bg-amber-400"}`}>
          {result.plateauDays} days
        </span>
      </div>

      <div className="text-xs text-gray-500 mb-3 space-y-0.5">
        {result.avgWeightLast7 !== null && (
          <div>Last 7 days avg: <span className="font-bold text-gray-700">{result.avgWeightLast7} kg</span></div>
        )}
        {result.avgWeightPrev7 !== null && (
          <div>Prev 7 days avg: <span className="font-bold text-gray-700">{result.avgWeightPrev7} kg</span></div>
        )}
        <div>Calorie compliance: <span className="font-bold text-gray-700">{result.calCompliantDays}/14 days</span></div>
        {result.avgCalLast14 !== null && (
          <div>Avg intake: <span className="font-bold text-gray-700">{result.avgCalLast14} kcal/day</span></div>
        )}
      </div>

      {advice && (
        <div className="bg-amber-50 rounded-xl p-3">
          <div className="text-xs font-bold text-gray-800 mb-1">{advice.emoji} {advice.title}</div>
          <div className="text-xs text-gray-600 leading-relaxed">{advice.body}</div>
        </div>
      )}
    </div>
  )
}
