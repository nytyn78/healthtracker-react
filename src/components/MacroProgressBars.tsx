import { useHealthStore, loadDayData } from "../store/useHealthStore"
import { computeMacros } from "../services/adaptiveTDEE"
import { getISTDate } from "../utils/dateHelpers"
import { useState, useEffect } from "react"

type MacroBarProps = {
  label: string
  val: number
  target: number
  color: string
  unit?: string
}

function MacroBar({ label, val, target, color, unit = "g" }: MacroBarProps) {
  const pct = target > 0 ? Math.min((val / target) * 100, 100) : 0
  const over = target > 0 && val > target * 1.15
  const ok   = target > 0 && val >= target * 0.85 && val <= target * 1.15
  const barColor = over ? "#ef4444" : ok ? "#4ade80" : color

  return (
    <div className="mb-2">
      <div className="flex justify-between items-center mb-0.5">
        <span className="text-xs font-semibold text-gray-700">{label}</span>
        <span className="text-xs text-gray-500">
          <span className={over ? "text-red-500 font-bold" : ok ? "text-green-600 font-bold" : "text-gray-700 font-bold"}>
            {Math.round(val)}
          </span>
          {" / "}{target}{unit}
        </span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
      <div className="text-[10px] text-right mt-0.5">
        <span className={over ? "text-red-400" : ok ? "text-green-500" : "text-gray-400"}>
          {over ? `${Math.round(val - target)}${unit} over` : ok ? "✓ on target" : `${Math.round(target - val)}${unit} to go`}
        </span>
      </div>
    </div>
  )
}

export default function MacroProgressBars() {
  const { profile, goals, settings } = useHealthStore()
  const [totals, setTotals] = useState({ cal: 0, protein: 0, carbs: 0, fat: 0 })

  useEffect(() => {
    const day = loadDayData(getISTDate())
    const t = day.entries.reduce(
      (a, e) => ({ cal: a.cal + e.calories, protein: a.protein + e.protein, carbs: a.carbs + e.carbs, fat: a.fat + e.fat }),
      { cal: 0, protein: 0, carbs: 0, fat: 0 }
    )
    setTotals(t)
  }, [])

  const macros = computeMacros(profile, goals, settings)
  if (!macros) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <p className="text-xs text-gray-400 text-center">Complete your profile in Settings to see macro targets.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4">
      <div className="text-sm font-bold text-gray-800 mb-3">📊 Today's Macros</div>
      <MacroBar label="Calories" val={totals.cal}     target={macros.targetCalories} color="#0d9488" unit=" kcal" />
      <MacroBar label="Protein"  val={totals.protein} target={macros.proteinG}       color="#3b82f6" />
      <MacroBar label="Carbs"    val={totals.carbs}   target={macros.carbsG}         color="#22c55e" />
      <MacroBar label="Fat"      val={totals.fat}     target={macros.fatG}           color="#f59e0b" />
    </div>
  )
}
