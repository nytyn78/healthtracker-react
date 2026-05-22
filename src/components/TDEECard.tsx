import { useHealthStore, loadHistory } from "../store/useHealthStore"
import { computeAdaptiveTDEE } from "../services/adaptiveTDEE"
import { calcTDEE } from "../services/adaptiveTDEE"
import { useState, useEffect } from "react"

export default function TDEECard() {
  const { profile, goals } = useHealthStore()
  const [result, setResult] = useState(() =>
    computeAdaptiveTDEE(loadHistory().map(h => ({ date: h.date, cal: h.cal, weight: h.weight })))
  )

  useEffect(() => {
    const history = loadHistory()
    setResult(computeAdaptiveTDEE(history.map(h => ({ date: h.date, cal: h.cal, weight: h.weight }))))
  }, [])

  const staticTDEE = calcTDEE(profile)
  const confidenceColor = {
    none:   "bg-gray-100 text-gray-500",
    low:    "bg-yellow-100 text-yellow-700",
    medium: "bg-blue-100 text-blue-700",
    high:   "bg-green-100 text-green-700",
  }[result.confidence]

  const confidenceLabel = {
    none:   "No data yet",
    low:    "Low confidence",
    medium: "Medium confidence",
    high:   "High confidence",
  }[result.confidence]

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
      <div className="flex justify-between items-start mb-3">
        <div className="text-sm font-bold text-gray-800">🔥 Adaptive TDEE</div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${confidenceColor}`}>
          {confidenceLabel}
        </span>
      </div>

      <div className="flex gap-3 mb-3">
        <div className="flex-1 bg-teal-50 rounded-xl p-3 text-center">
          <div className="text-[10px] text-gray-400 mb-1">Observed TDEE</div>
          <div className="text-xl font-bold text-teal-600">
            {result.tdee ?? "—"}
          </div>
          <div className="text-[10px] text-gray-400">kcal/day</div>
        </div>
        <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
          <div className="text-[10px] text-gray-400 mb-1">Formula TDEE</div>
          <div className="text-xl font-bold text-gray-600">
            {staticTDEE ?? "—"}
          </div>
          <div className="text-[10px] text-gray-400">kcal/day</div>
        </div>
      </div>

      {result.tdee && (
        <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-600 space-y-1">
          <div>📉 To lose 0.5 kg/week → eat <span className="font-bold text-teal-700">{Math.round(result.tdee - 550)} kcal/day</span></div>
          <div>📉 To lose 1 kg/week → eat <span className="font-bold text-teal-700">{Math.round(result.tdee - 1100)} kcal/day</span></div>
          {result.slopeKgPerWeek !== null && (
            <div className="text-gray-400 pt-1 border-t border-gray-200">
              Current trend: <span className={`font-bold ${result.slopeKgPerWeek < 0 ? "text-green-600" : "text-red-500"}`}>
                {result.slopeKgPerWeek > 0 ? "+" : ""}{result.slopeKgPerWeek} kg/week
              </span>
            </div>
          )}
        </div>
      )}

      {result.confidence === "none" && (
        <p className="text-xs text-gray-400 text-center mt-2">
          Log weight + calories for 5+ days to see your adaptive TDEE
        </p>
      )}

      <div className="text-[10px] text-gray-300 mt-2 text-right">
        Based on {result.daysUsed} day{result.daysUsed !== 1 ? "s" : ""} of data
      </div>
    </div>
  )
}
