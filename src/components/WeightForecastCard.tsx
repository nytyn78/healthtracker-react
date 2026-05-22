import { useHealthStore, loadHistory } from "../store/useHealthStore"
import { computeAdaptiveTDEE } from "../services/adaptiveTDEE"
import { useState, useEffect } from "react"

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

export default function WeightForecastCard() {
  const { profile, goals } = useHealthStore()
  const [forecast, setForecast] = useState<{
    weeksToGoal: number | null
    forecastDate: string | null
    kgToGo: number | null
    weeklyRate: number | null
    confidence: string
  }>({ weeksToGoal: null, forecastDate: null, kgToGo: null, weeklyRate: null, confidence: "none" })

  useEffect(() => {
    const history = loadHistory()
    const result = computeAdaptiveTDEE(
      history.map(h => ({ date: h.date, cal: h.cal, weight: h.weight }))
    )

    const currentWeight = history.find(h => h.weight !== null)?.weight ?? Number(profile.weightKg)
    const goalWeight = Number(goals.targetWeightKg)

    if (!currentWeight || !goalWeight || currentWeight <= goalWeight) {
      setForecast({ weeksToGoal: null, forecastDate: null, kgToGo: null, weeklyRate: null, confidence: result.confidence })
      return
    }

    const kgToGo = Math.round((currentWeight - goalWeight) * 10) / 10

    // Use adaptive slope if available, else fall back to goal rate
    const weeklyRate = result.slopeKgPerWeek !== null && result.slopeKgPerWeek < 0
      ? Math.abs(result.slopeKgPerWeek)
      : goals.weeklyLossKg

    if (!weeklyRate || weeklyRate <= 0) {
      setForecast({ weeksToGoal: null, forecastDate: null, kgToGo, weeklyRate: null, confidence: result.confidence })
      return
    }

    const weeksToGoal = Math.ceil(kgToGo / weeklyRate)
    const forecastDate = formatDate(addDays(new Date(), weeksToGoal * 7))

    setForecast({ weeksToGoal, forecastDate, kgToGo, weeklyRate, confidence: result.confidence })
  }, [profile.weightKg, goals.targetWeightKg, goals.weeklyLossKg])

  const currentWeight = Number(profile.weightKg)
  const goalWeight = Number(goals.targetWeightKg)
  const atGoal = currentWeight > 0 && goalWeight > 0 && currentWeight <= goalWeight

  if (atGoal) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
        <div className="text-sm font-bold text-gray-800 mb-2">🎯 Weight Forecast</div>
        <div className="text-center py-2">
          <div className="text-3xl mb-1">🏆</div>
          <div className="text-sm font-bold text-green-600">Goal reached!</div>
          <div className="text-xs text-gray-400 mt-1">You're at or below your target weight</div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
      <div className="flex justify-between items-start mb-3">
        <div className="text-sm font-bold text-gray-800">🎯 Weight Forecast</div>
        {forecast.confidence !== "none" && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold
            ${forecast.confidence === "high" ? "bg-green-100 text-green-700"
            : forecast.confidence === "medium" ? "bg-blue-100 text-blue-700"
            : "bg-yellow-100 text-yellow-700"}`}>
            {forecast.confidence} confidence
          </span>
        )}
      </div>

      {forecast.kgToGo !== null && (
        <div className="flex gap-3 mb-3">
          <div className="flex-1 bg-teal-50 rounded-xl p-3 text-center">
            <div className="text-[10px] text-gray-400 mb-1">Still to lose</div>
            <div className="text-xl font-bold text-teal-600">{forecast.kgToGo} kg</div>
          </div>
          {forecast.weeksToGoal !== null && (
            <div className="flex-1 bg-blue-50 rounded-xl p-3 text-center">
              <div className="text-[10px] text-gray-400 mb-1">Estimated time</div>
              <div className="text-xl font-bold text-blue-600">{forecast.weeksToGoal}w</div>
            </div>
          )}
        </div>
      )}

      {forecast.forecastDate && (
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <div className="text-[10px] text-gray-400 mb-0.5">Projected goal date</div>
          <div className="text-sm font-bold text-gray-700">📅 {forecast.forecastDate}</div>
          {forecast.weeklyRate && (
            <div className="text-[10px] text-gray-400 mt-1">
              At {forecast.weeklyRate} kg/week
              {forecast.confidence !== "none" ? " (from your actual trend)" : " (from your target rate)"}
            </div>
          )}
        </div>
      )}

      {forecast.confidence === "none" && !forecast.kgToGo && (
        <p className="text-xs text-gray-400 text-center">
          Set your goal weight in Settings and log weight daily to see your forecast.
        </p>
      )}
    </div>
  )
}
