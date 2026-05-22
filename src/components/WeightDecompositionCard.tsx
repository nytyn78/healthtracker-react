import { useHealthStore, loadHistory } from "../store/useHealthStore"
import { useState, useEffect } from "react"

type Decomposition = {
  totalDelta: number
  fatKg: number
  waterKg: number
  muscleKg: number
  confidence: "low" | "medium" | "high"
}

function decomposeWeightChange(
  weightDelta: number,   // kg lost (positive = loss)
  avgProteinG: number,   // average daily protein
  proteinTargetG: number,
  workoutDays: number,   // out of last 14
  calorieDeficit: number // avg daily deficit
): Decomposition {
  // Clinical model:
  // Fat loss: driven by calorie deficit (7700 kcal/kg)
  // Muscle loss: reduced when protein is high + training present
  // Water: remainder — affected by carb intake, sodium, glycogen

  const fatFromDeficit = Math.max(0, (calorieDeficit * 14) / 7700)
  const proteinAdequacy = Math.min(avgProteinG / Math.max(proteinTargetG, 1), 1)
  const trainingFactor = Math.min(workoutDays / 14, 1)

  // Muscle preservation factor (0 = max muscle loss, 1 = no muscle loss)
  const muscleFactor = proteinAdequacy * 0.7 + trainingFactor * 0.3

  // Typical muscle loss without resistance training on deficit: ~15% of deficit
  const maxMuscleLoss = Math.max(0, weightDelta * 0.15)
  const muscleKg = -(maxMuscleLoss * (1 - muscleFactor)) // negative = loss

  const fatKg = -(Math.min(fatFromDeficit, Math.abs(weightDelta) * 0.9)) // negative = loss
  const waterKg = -(weightDelta - Math.abs(fatKg) - Math.abs(muscleKg)) // negative = loss

  const confidence: Decomposition["confidence"] =
    workoutDays >= 3 && avgProteinG > 0 ? "medium" : "low"

  return {
    totalDelta: -weightDelta,
    fatKg:    Math.round(fatKg * 100) / 100,
    waterKg:  Math.round(waterKg * 100) / 100,
    muscleKg: Math.round(muscleKg * 100) / 100,
    confidence,
  }
}

export default function WeightDecompositionCard() {
  const { profile, goals, settings } = useHealthStore()
  const [decomp, setDecomp] = useState<Decomposition | null>(null)
  const [deltaKg, setDeltaKg] = useState<number | null>(null)

  useEffect(() => {
    const history = loadHistory()
    const last14 = history.slice(0, 14)
    const withWeight = last14.filter(h => h.weight !== null)
    if (withWeight.length < 4) return

    const newest = withWeight[0].weight!
    const oldest = withWeight[withWeight.length - 1].weight!
    const delta = oldest - newest // positive = loss

    if (Math.abs(delta) < 0.1) return
    setDeltaKg(delta)

    const avgProtein = last14.reduce((a, h) => a + h.protein, 0) / last14.length
    const workoutDays = last14.filter(h => h.workoutDone).length
    const { macroSplit, ifProtocol } = settings
    const proteinTarget = (Number(profile.weightKg) || 80) * 1.2

    // Estimate avg deficit from stored tdee vs avg calories
    const avgCal = last14.reduce((a, h) => a + h.cal, 0) / last14.length
    const tdeeEstimate = 2000 // fallback — ideally from adaptiveTDEE
    const deficit = Math.max(0, tdeeEstimate - avgCal)

    setDecomp(decomposeWeightChange(delta, avgProtein, proteinTarget, workoutDays, deficit))
  }, [profile, settings])

  if (!decomp || deltaKg === null) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
        <div className="text-sm font-bold text-gray-800 mb-2">⚗️ Weight Decomposition</div>
        <p className="text-xs text-gray-400">Log weight for 4+ days over the last 2 weeks to see what your weight change is made of.</p>
      </div>
    )
  }

  const isLoss = deltaKg > 0
  const components = [
    { label: "Fat", value: decomp.fatKg, color: "#f97316", icon: "🔥" },
    { label: "Water", value: decomp.waterKg, color: "#60a5fa", icon: "💧" },
    { label: "Muscle", value: decomp.muscleKg, color: "#a78bfa", icon: "💪" },
  ]

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
      <div className="flex justify-between items-start mb-3">
        <div className="text-sm font-bold text-gray-800">⚗️ Weight Decomposition</div>
        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-gray-100 text-gray-500">
          {decomp.confidence} confidence · est.
        </span>
      </div>

      <div className="text-xs text-gray-500 mb-3">
        Last 14 days: <span className={`font-bold ${isLoss ? "text-green-600" : "text-red-500"}`}>
          {isLoss ? "−" : "+"}{Math.abs(deltaKg).toFixed(1)} kg
        </span>
      </div>

      <div className="flex gap-2 mb-3">
        {components.map(c => (
          <div key={c.label} className="flex-1 bg-gray-50 rounded-xl p-2.5 text-center">
            <div className="text-base mb-0.5">{c.icon}</div>
            <div className="text-xs font-bold" style={{ color: c.color }}>
              {c.value <= 0 ? "−" : "+"}{Math.abs(c.value).toFixed(2)} kg
            </div>
            <div className="text-[10px] text-gray-400">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 rounded-xl p-3 text-[10px] text-gray-500 leading-relaxed">
        ⚠️ Estimated breakdown based on calories, protein, and workout data. For precise fat/muscle ratio, use DEXA or a smart scale.
      </div>
    </div>
  )
}
