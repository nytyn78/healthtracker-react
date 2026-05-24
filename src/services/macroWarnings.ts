// ── macroWarnings.ts ──────────────────────────────────────────────────────────
// Generates clinical advisory messages for the user's current diet + goal +
// medical context combination. Does NOT change macros — only informs.
//
// Philosophy: the app respects the user's choices. If a combination has
// clinical caveats worth knowing about (breastfeeding + keto, T1 diabetes +
// very low carb, CKD + high protein, etc.), we surface the caveat clearly
// so the user can have an informed conversation with their doctor.
//
// Sources cited where appropriate. None of this is medical advice — these are
// flags for the user to discuss with their clinician.

import type { UserProfile, AppSettings } from "../store/useHealthStore"
import type { GoalMode } from "./goalModeConfig"
import { isPregnancyMode, isMaternalMode } from "./goalModeConfig"

export type WarningSeverity = "info" | "caution" | "important"

export type MacroWarning = {
  id: string
  severity: WarningSeverity
  title: string
  body: string
}

// ── Mode resolver (mirrors adaptiveTDEE for warning logic) ───────────────────
function resolveMode(macroSplit: { fatPct: number; proteinPct: number; carbsPct: number }) {
  const { carbsPct, proteinPct } = macroSplit
  if (carbsPct <= 10)                                        return "KETO"
  if (carbsPct <= 20)                                        return "VERY_LOW_CARB"
  if (proteinPct >= 40)                                      return "HIGH_PROTEIN_CUT"
  if (proteinPct >= 30 && carbsPct >= 20 && carbsPct <= 40)  return "RECOMPOSITION"
  if (carbsPct <= 35)                                        return "LOW_CARB"
  return "BALANCED"
}

// ── Main warning generator ───────────────────────────────────────────────────
export function getMacroWarnings(
  profile: UserProfile,
  settings: AppSettings,
  goalMode?: GoalMode,
): MacroWarning[] {
  const warnings: MacroWarning[] = []
  const macroMode = resolveMode(settings.macroSplit)
  const mc = profile.medicalContext

  // ── Maternal mode warnings ─────────────────────────────────────────────────
  if (goalMode && isMaternalMode(goalMode)) {
    // Breastfeeding + restrictive carb modes
    if (goalMode === "breastfeeding" && (macroMode === "KETO" || macroMode === "VERY_LOW_CARB")) {
      warnings.push({
        id: "breastfeeding-keto",
        severity: "important",
        title: "Keto / very-low-carb during breastfeeding",
        body: "Restrictive carb intake while breastfeeding has been associated with reduced milk supply " +
              "and rare cases of ketoacidosis. If you choose this approach, please discuss it with your " +
              "doctor or lactation consultant first, and monitor your supply and energy levels closely.",
      })
    }

    // Pregnancy + low carbs
    if (isPregnancyMode(goalMode) && (macroMode === "KETO" || macroMode === "VERY_LOW_CARB")) {
      warnings.push({
        id: "pregnancy-low-carb",
        severity: "important",
        title: "Very low carb intake during pregnancy",
        body: "Most obstetric guidelines recommend at least 175g carbs/day during pregnancy for fetal " +
              "brain development. If you have gestational diabetes and your doctor has recommended a " +
              "lower-carb approach, please follow their guidance — this app's macros are general.",
      })
    }

    // All maternal modes — universal note
    warnings.push({
      id: "maternal-general",
      severity: "info",
      title: "Pregnancy / breastfeeding nutrition",
      body: "Your calorie target includes the extra energy your body needs (T2: +300, T3: +450, " +
            "breastfeeding: +450 kcal/day). Please review your plan with your obstetrician or RD — " +
            "individual needs vary substantially.",
    })
  }

  // ── Medical context warnings ───────────────────────────────────────────────
  // These were silent clamps in earlier versions. Now they're advisories —
  // the user's choice stands, but they see the relevant clinical context.

  if (mc?.hasDiabetes) {
    if (macroMode === "KETO" || macroMode === "VERY_LOW_CARB") {
      warnings.push({
        id: "diabetes-keto",
        severity: "important",
        title: "Keto with insulin-dependent diabetes",
        body: "Very-low-carb diets can dramatically reduce insulin requirements and risk hypoglycemia " +
              "if doses aren't adjusted. Please work with your endocrinologist before starting — " +
              "and never adjust insulin doses on your own.",
      })
    } else if (macroMode === "LOW_CARB") {
      warnings.push({
        id: "diabetes-lowcarb",
        severity: "caution",
        title: "Low-carb with diabetes",
        body: "Low-carb eating can improve glycemic control but may require insulin / medication " +
              "adjustments. Check in with your doctor about monitoring and dose changes.",
      })
    }
  }

  if (mc?.hasCKD) {
    if (macroMode === "HIGH_PROTEIN_CUT" || macroMode === "RECOMPOSITION") {
      warnings.push({
        id: "ckd-high-protein",
        severity: "important",
        title: "High protein with chronic kidney disease",
        body: "Standard CKD guidance is 0.6–0.8 g/kg protein per day (stages 3–5 non-dialysis). " +
              "This mode targets 1.6+ g/kg, which most nephrologists advise against. Please " +
              "discuss your protein target with your kidney specialist.",
      })
    } else if (macroMode === "KETO" || macroMode === "VERY_LOW_CARB") {
      warnings.push({
        id: "ckd-keto",
        severity: "caution",
        title: "Keto with kidney disease",
        body: "Ketogenic diets are typically high in protein and acid load, both of which can affect " +
              "kidney function. Your doctor should monitor eGFR and electrolytes if you pursue this.",
      })
    }
  }

  if (mc?.hasEDHistory) {
    if (macroMode === "HIGH_PROTEIN_CUT" || macroMode === "KETO" || macroMode === "VERY_LOW_CARB") {
      warnings.push({
        id: "ed-restrictive",
        severity: "important",
        title: "Restrictive diet with eating-disorder history",
        body: "Highly restrictive diets and macro tracking can trigger relapse for many people with " +
              "ED history. Please discuss this with your therapist or RD before starting, and consider " +
              "whether a less restrictive approach would serve you better.",
      })
    }

    // ED + aggressive deficit
    if (settings && macroMode !== "BALANCED") {
      warnings.push({
        id: "ed-tracking",
        severity: "caution",
        title: "A note on tracking",
        body: "If logging calories or macros starts to feel preoccupying or distressing, please pause " +
              "and reach out to your treatment team. This app can be useful or harmful depending on " +
              "context — only you (and your team) can tell which it is for you right now.",
      })
    }
  }

  // ── Geriatric warnings ─────────────────────────────────────────────────────
  if (goalMode === "geriatric" && macroMode === "KETO") {
    warnings.push({
      id: "geriatric-keto",
      severity: "caution",
      title: "Keto in older adults",
      body: "Older adults need more protein per kg (1.2–1.5 g/kg minimum) to prevent sarcopenia. " +
            "Keto can work, but check that your protein target is actually being met — and watch " +
            "for fall risk if energy drops during the initial adaptation period.",
    })
  }

  // ── Paediatric warnings ────────────────────────────────────────────────────
  if (goalMode === "child" || goalMode === "teen_early") {
    if (macroMode !== "BALANCED") {
      warnings.push({
        id: "child-restrictive",
        severity: "important",
        title: "Restrictive diet for a growing child",
        body: "Children and early teens are growing rapidly and need adequate calories and a broad " +
              "range of nutrients. Restrictive diets are not recommended without a paediatrician's " +
              "direct supervision. Please consult their doctor before any structured approach.",
      })
    }
  }

  return warnings
}
