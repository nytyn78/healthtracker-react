import { useEffect, useState } from "react"
import { useHealthStore, loadDayData } from "../store/useHealthStore"
import { computeMacros } from "../services/adaptiveTDEE"
import { getISTDate } from "../utils/dateHelpers"

export type MacroTotals = {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export type MacroTargets = {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export function useMacros(): { totals: MacroTotals; targets: MacroTargets | null } {
  const { profile, goals, settings } = useHealthStore()
  const [totals, setTotals] = useState<MacroTotals>({ calories: 0, protein: 0, carbs: 0, fat: 0 })

  useEffect(() => {
    const day = loadDayData(getISTDate())
    const t = day.entries.reduce(
      (a, e) => ({
        calories: a.calories + e.calories,
        protein:  a.protein  + e.protein,
        carbs:    a.carbs    + e.carbs,
        fat:      a.fat      + e.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    )
    setTotals(t)
  }, [])

  const macros = computeMacros(profile, goals, settings)
  const targets: MacroTargets | null = macros
    ? {
        calories: macros.targetCalories,
        protein:  macros.proteinG,
        carbs:    macros.carbsG,
        fat:      macros.fatG,
      }
    : null

  return { totals, targets }
}
