import { useHealthStore, loadHistory } from "../store/useHealthStore"
import { detectAdaptation, AdaptationProfile } from "../services/metabolicAdaptation"
import { useState, useEffect } from "react"

export default function MetabolicAdaptationCard() {
  const { profile } = useHealthStore()
  const [result, setResult] = useState(() => {
    const history = loadHistory()
    const ap: AdaptationProfile = {
      age: Number(profile.age) || 40,
      heightCm: Number(profile.heightCm) || 170,
      weightKg: history.find(h => h.weight !== null)?.weight ?? Number(profile.weightKg) ?? 80,
      isMale: profile.sex === "male",
      activityLevel:
        profile.activityLevel === "sedentary" ? "sedentary"
        : profile.activityLevel === "lightly_active" ? "light"
        : profile.activityLevel === "moderately_active" ? "moderate"
        : "active",
    }
    return detectAdaptation(history.map(h => ({ date: h.date, cal: h.cal, weight: h.weight })), ap)
  })

  useEffect(() => {
    const history = loadHistory()
    const ap: AdaptationProfile = {
      age: Number(profile.age) || 40,
      heightCm: Number(profile.heightCm) || 170,
      weightKg: history.find(h => h.weight !== null)?.weight ?? Number(profile.weightKg) ?? 80,
      isMale: profile.sex === "male",
      activityLevel:
        profile.activityLevel === "sedentary" ? "sedentary"
        : profile.activityLevel === "lightly_active" ? "light"
        : profile.activityLevel === "moderately_active" ? "moderate"
        : "active",
    }
    setResult(detectAdaptation(history.map(h => ({ date: h.date, cal: h.cal, weight: h.weight })), ap))
  }, [profile])

  if (result.tdeeConfidence === "none") {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
        <div className="text-sm font-bold text-gray-800 mb-2">🧬 Metabolic Adaptation</div>
        <p className="text-xs text-gray-400">Log weight + calories for 14+ days to detect metabolic adaptation.</p>
      </div>
    )
  }

  const severityConfig = {
    none:     { label: "Adapting Normally",     bg: "bg-green-500",  textColor: "text-green-600" },
    mild:     { label: "Mild Adaptation",        bg: "bg-yellow-400", textColor: "text-yellow-600" },
    moderate: { label: "Moderate Adaptation",    bg: "bg-orange-500", textColor: "text-orange-600" },
    severe:   { label: "Significant Adaptation", bg: "bg-red-500",    textColor: "text-red-600" },
  }[result.severity]

  const TIPS: Record<string, string> = {
    none:     "Your metabolism is responding well. Keep your current approach.",
    mild:     "Minor slowdown — normal after extended dieting. Consider a refeed day every 10–14 days.",
    moderate: "Metabolism has slowed noticeably. Take a 1–2 week diet break at maintenance calories.",
    severe:   "Significant metabolic adaptation. A structured diet break of 2–4 weeks is strongly advised before resuming deficit.",
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
      <div className="flex justify-between items-start mb-3">
        <div className="text-sm font-bold text-gray-800">🧬 Metabolic Adaptation</div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold text-white ${severityConfig.bg}`}>
          {severityConfig.label}
        </span>
      </div>

      <div className="flex justify-between items-center mb-3">
        <div className="flex-1 text-center">
          <div className="text-[10px] text-gray-400 mb-1">Predicted TDEE</div>
          <div className="text-xl font-bold text-gray-500">{result.predictedTDEE ?? "—"}</div>
          <div className="text-[10px] text-gray-400">kcal</div>
        </div>
        <div className="text-2xl text-gray-200">→</div>
        <div className="flex-1 text-center">
          <div className="text-[10px] text-gray-400 mb-1">Observed TDEE</div>
          <div className={`text-xl font-bold ${severityConfig.textColor}`}>{result.observedTDEE ?? "—"}</div>
          <div className="text-[10px] text-gray-400">kcal</div>
        </div>
        {result.adaptationGap !== null && (
          <>
            <div className="text-2xl text-gray-200">→</div>
            <div className="flex-1 text-center">
              <div className="text-[10px] text-gray-400 mb-1">Gap</div>
              <div className={`text-xl font-bold ${result.adaptationGap >= 300 ? "text-red-500" : result.adaptationGap >= 150 ? "text-amber-500" : "text-green-600"}`}>
                {result.adaptationGap}
              </div>
              <div className="text-[10px] text-gray-400">kcal</div>
            </div>
          </>
        )}
      </div>

      <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-600 leading-relaxed">
        {TIPS[result.severity]}
      </div>

      <p className="text-[10px] text-gray-300 mt-2">{result.message}</p>
    </div>
  )
}
