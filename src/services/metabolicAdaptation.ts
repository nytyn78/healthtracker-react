// ── Metabolic Adaptation Detection ───────────────────────────────────────────
// Compares observed TDEE (from data) vs predicted TDEE (from stats)
// Gap indicates how much metabolism has slowed — common in extended dieting

import { computeAdaptiveTDEE, TDEEResult } from "./adaptiveTDEE"

export type AdaptationInput = { date: string; cal: number; weight: number | null }

export type AdaptationProfile = {
  age: number
  heightCm: number
  weightKg: number
  isMale: boolean
  activityLevel: "sedentary" | "light" | "moderate" | "active"
}

export type AdaptationResult = {
  predictedTDEE: number | null
  observedTDEE: number | null
  adaptationGap: number | null
  adaptationPercent: number | null
  isAdapted: boolean
  severity: "none" | "mild" | "moderate" | "severe"
  tdeeConfidence: TDEEResult["confidence"]
  message: string
}

function activityMultiplier(level: AdaptationProfile["activityLevel"]): number {
  const map = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 }
  return map[level]
}

export function detectAdaptation(
  history: AdaptationInput[],
  profile: AdaptationProfile
): AdaptationResult {
  const empty: AdaptationResult = {
    predictedTDEE: null, observedTDEE: null,
    adaptationGap: null, adaptationPercent: null,
    isAdapted: false, severity: "none",
    tdeeConfidence: "none", message: "Need more data to assess metabolic adaptation.",
  }

  if (!history.length) return empty
  if (!profile.weightKg || !profile.heightCm || !profile.age) return {
    ...empty, message: "Profile data incomplete — fill in Settings to see adaptation analysis.",
  }

  const bmr = profile.isMale
    ? 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age + 5
    : 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age - 161

  const predictedTDEE = Math.round(bmr * activityMultiplier(profile.activityLevel))
  const tdeeResult    = computeAdaptiveTDEE(history)
  const observedTDEE  = tdeeResult.tdee
  const confidence    = tdeeResult.confidence

  if (!observedTDEE) return {
    ...empty, predictedTDEE, tdeeConfidence: confidence,
    message: `Need ${Math.max(0, 14 - tdeeResult.daysUsed)} more days of data to assess metabolic adaptation.`,
  }

  const gap     = predictedTDEE - observedTDEE
  const percent = Math.round((gap / predictedTDEE) * 100)

  let severity: AdaptationResult["severity"] = "none"
  if (confidence === "medium" || confidence === "high") {
    if      (gap >= 500) severity = "severe"
    else if (gap >= 300) severity = "moderate"
    else if (gap >= 150) severity = "mild"
  }

  const isAdapted = gap >= 150 && (confidence === "medium" || confidence === "high")

  const message = {
    none:     "No metabolic adaptation detected. Your metabolism is responding normally.",
    mild:     `Mild metabolic adaptation (~${gap} kcal suppression). Normal for extended dieting — monitor.`,
    moderate: `Moderate adaptation (~${gap} kcal). Your metabolism has slowed. A diet break or refeed cycle is recommended.`,
    severe:   `Significant metabolic adaptation (~${gap} kcal). Consider a structured reverse diet to restore metabolic rate.`,
  }[severity]

  return { predictedTDEE, observedTDEE, adaptationGap: gap, adaptationPercent: percent, isAdapted, severity, tdeeConfidence: confidence, message }
}
