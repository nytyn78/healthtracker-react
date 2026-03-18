// ── Plateau Detection ─────────────────────────────────────────────────────────
// Compares 7-day weight averages to detect stalls
// Bug fixed: uses explicit last14 split rather than slice(0, length-7)

export type PlateauInput = {
  date: string
  weight: number | null
  cal: number
  carbs: number
  workoutDone?: boolean
  weightEvent?: string | null  // flagged entries excluded from plateau detection
}

export type PlateauRecommendation =
  | "none" | "increase_protein" | "calorie_audit"
  | "refeed_day" | "diet_break" | "reduce_carbs" | "add_cardio"

export type PlateauResult = {
  isInPlateau: boolean
  plateauDays: number
  avgWeightLast7: number | null
  avgWeightPrev7: number | null
  weightDeltaKg: number | null
  calCompliantDays: number
  avgCalLast14: number | null
  recommendation: PlateauRecommendation
}

function avg(arr: number[]): number | null {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null
}

export function detectPlateau(history: PlateauInput[], calTarget: number = 1350): PlateauResult {
  const empty: PlateauResult = {
    isInPlateau: false, plateauDays: 0,
    avgWeightLast7: null, avgWeightPrev7: null,
    weightDeltaKg: null, calCompliantDays: 0,
    avgCalLast14: null, recommendation: "none",
  }
  if (!history.length) return empty

  // Last 14 weight entries, oldest first — exclude influenced readings
  const withWeight = history.filter(h => h.weight !== null && !h.weightEvent).slice(0, 14).reverse()
  const recent = withWeight.slice(Math.max(0, withWeight.length - 7))
  const prev7  = withWeight.slice(0, Math.max(0, withWeight.length - 7))

  const avgLast = avg(recent.map(d => d.weight as number))
  const avgPrev = avg(prev7.map(d => d.weight as number))
  const weightDelta = avgLast !== null && avgPrev !== null ? avgPrev - avgLast : null
  const isPlateau = weightDelta !== null && Math.abs(weightDelta) < 0.3
    && recent.length >= 3 && prev7.length >= 3

  // Consecutive days (newest-first) with <0.3kg change
  const allWeights = history.filter(h => h.weight !== null)
  let plateauDays = 0
  for (let i = 1; i < allWeights.length; i++) {
    if (Math.abs((allWeights[i - 1].weight as number) - (allWeights[i].weight as number)) < 0.3) plateauDays++
    else break
  }

  const last14 = history.slice(0, 14)
  const calCompliantDays = last14.filter(d =>
    d.cal >= calTarget * 0.85 && d.cal <= calTarget * 1.15
  ).length
  const avgCal  = avg(last14.map(d => d.cal))
  const avgCarbs = avg(last14.map(d => d.carbs))
  const workoutsLast7 = history.slice(0, 7).some(d => d.workoutDone)

  let recommendation: PlateauRecommendation = "none"
  if (!isPlateau) recommendation = "none"
  else if (avgCal !== null && avgCal < 900) recommendation = "calorie_audit"
  else if (plateauDays > 21 && calCompliantDays >= 10) recommendation = "diet_break"
  else if (plateauDays >= 10 && calCompliantDays >= 8)
    recommendation = avgCarbs !== null && avgCarbs > 30 ? "reduce_carbs" : "refeed_day"
  else if (plateauDays >= 10 && calCompliantDays < 8) recommendation = "calorie_audit"
  else if (plateauDays >= 7 && !workoutsLast7) recommendation = "add_cardio"

  return {
    isInPlateau: isPlateau, plateauDays,
    avgWeightLast7: avgLast ? +avgLast.toFixed(2) : null,
    avgWeightPrev7: avgPrev ? +avgPrev.toFixed(2) : null,
    weightDeltaKg:  weightDelta ? +weightDelta.toFixed(2) : null,
    calCompliantDays,
    avgCalLast14: avgCal ? Math.round(avgCal) : null,
    recommendation,
  }
}
