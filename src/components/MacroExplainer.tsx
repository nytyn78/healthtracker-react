// ── MacroExplainer.tsx ─────────────────────────────────────────────────────────
// "Why is my target this number?" — a tap-and-learn modal explainer.
// Shows the math behind BMR, TDEE, target calories, protein, fat, carbs.
// Educational, transparent, builds user trust in the numbers.

import { useState } from "react"
import { useHealthStore, loadDietConfig } from "../store/useHealthStore"
import { computeMacros, calcBMR, calcTDEE } from "../services/adaptiveTDEE"
import { ACTIVITY_MULTIPLIERS } from "../store/useHealthStore"
import { loadGoalMode } from "../services/goalModeConfig"

type MetricKey = "calories" | "protein" | "carbs" | "fat" | "bmr" | "tdee" | null

export default function MacroExplainer() {
  const [active, setActive] = useState<MetricKey>(null)
  const { profile, goals, settings } = useHealthStore()
  const macros = computeMacros(profile, goals, settings, loadGoalMode())
  if (!macros) return null

  return (
    <>
      {/* Trigger row — tap any metric to see explanation */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-3">
        <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wide mb-2">
          🤔 Why these numbers? Tap to learn
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          <Metric label="kcal"    value={macros.targetCalories} unit=""  onClick={() => setActive("calories")} />
          <Metric label="Protein" value={macros.proteinG}       unit="g" onClick={() => setActive("protein")}  />
          <Metric label="Carbs"   value={macros.carbsG}         unit="g" onClick={() => setActive("carbs")}    />
          <Metric label="Fat"     value={macros.fatG}           unit="g" onClick={() => setActive("fat")}      />
        </div>
      </div>

      {active && (
        <ExplainerModal metric={active} onClose={() => setActive(null)} />
      )}
    </>
  )
}

function Metric({ label, value, unit, onClick }: { label: string; value: number; unit: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="bg-white rounded-lg py-2 px-1 hover:bg-blue-100 transition-colors">
      <div className="text-sm font-bold text-blue-800">{value}<span className="text-[10px] font-normal">{unit}</span></div>
      <div className="text-[9px] text-blue-600 uppercase tracking-wide">{label}</div>
    </button>
  )
}

// ── Modal with the math ───────────────────────────────────────────────────────
function ExplainerModal({ metric, onClose }: { metric: NonNullable<MetricKey>; onClose: () => void }) {
  const { profile, goals, settings } = useHealthStore()
  const macros = computeMacros(profile, goals, settings, loadGoalMode())!
  const bmr = calcBMR(profile)!
  const tdee = calcTDEE(profile)!
  const w = Number(profile.weightKg)
  const h = Number(profile.heightCm)
  const a = Number(profile.age)
  const bmi = w && h ? w / ((h / 100) ** 2) : 0
  const heightIn = h / 2.54
  const ibw = (profile.sex === "female" ? 45.5 : 50) + 2.3 * Math.max(0, heightIn - 60)
  const usingABW = bmi > 30
  const abw = usingABW ? ibw + 0.4 * (w - ibw) : w

  const dietTag = (() => {
    try { return JSON.parse(localStorage.getItem("diet_config") || "{}").tag || "non_veg" }
    catch { return "non_veg" }
  })()
  const proteinMultiplier = dietTag === "veg" ? 1.4 : 1.6
  const targetWeight = goals.targetWeightKg || w
  const activityLabel: Record<string, string> = {
    sedentary: "Sedentary (×1.2)",
    lightly_active: "Lightly active (×1.375)",
    moderately_active: "Moderately active (×1.55)",
    very_active: "Very active (×1.725)",
    extra_active: "Extra active (×1.9)",
  }

  const content = (() => {
    switch (metric) {
      case "calories":
        return {
          title: "Daily Calorie Target",
          value: `${macros.targetCalories} kcal/day`,
          steps: [
            { label: "BMR (Basal Metabolic Rate)", value: `${bmr} kcal`, note: "What your body burns at rest" },
            { label: `× Activity (${activityLabel[profile.activityLevel] ?? profile.activityLevel})`, value: `${tdee} kcal`, note: "Total Daily Energy Expenditure (TDEE)" },
            { label: `− Deficit (${goals.weeklyLossKg} kg/week × 7700 ÷ 7)`, value: `${Math.round(goals.weeklyLossKg * 7700 / 7)} kcal/day`, note: "For weight loss" },
            { label: "= Target", value: `${macros.targetCalories} kcal/day`, note: macros.targetCalories === 1200 ? "Floored at 1200 (minimum healthy intake)" : null },
          ],
          summary: `Your TDEE is ${tdee} kcal. A ${goals.weeklyLossKg}kg/week loss requires a daily deficit of ~${Math.round(goals.weeklyLossKg * 7700 / 7)} kcal, giving ${macros.targetCalories} kcal/day as your target.`,
        }

      case "protein":
        return {
          title: "Protein Target",
          value: `${macros.proteinG}g/day`,
          steps: [
            { label: `Target weight × ${proteinMultiplier}g/kg`, value: `${targetWeight} × ${proteinMultiplier} = ${Math.round(targetWeight * proteinMultiplier)}g`, note: dietTag === "veg" ? "1.4× because vegetarian Indian eating struggles past this without supplements" : "1.6× standard athletic recommendation" },
            usingABW
              ? { label: "Floor (ABW × 1.2g/kg)", value: `${Math.round(abw)} × 1.2 = ${Math.round(abw * 1.2)}g`, note: "Minimum for muscle preservation (BMI > 30 uses ABW)" }
              : null,
            { label: "Capped at", value: "130g/day", note: macros.proteinG >= 130 ? "You've hit the cap" : "Doesn't apply to you" },
            { label: "= Your target", value: `${macros.proteinG}g/day`, note: null },
          ].filter(Boolean) as any,
          summary: `Protein supports muscle preservation during weight loss. Your target is based on goal weight (${targetWeight}kg) × ${proteinMultiplier}, with a 130g cap for practicality.`,
        }

      case "fat":
        return {
          title: "Fat Target",
          value: `${macros.fatG}g/day`,
          steps: [
            { label: `Target weight × 0.8g/kg`, value: `${targetWeight} × 0.8 = ${Math.round(targetWeight * 0.8)}g`, note: "Minimum for hormone health" },
            { label: "= Your target", value: `${macros.fatG}g/day`, note: null },
          ],
          summary: `Fat is essential for hormones, vitamin absorption, and satiety. 0.8g/kg of target weight is the lower end of healthy intake.`,
        }

      case "carbs":
        const proteinCals = macros.proteinG * 4
        const fatCals = macros.fatG * 9
        const remaining = macros.targetCalories - proteinCals - fatCals
        return {
          title: "Carbs Target",
          value: `${macros.carbsG}g/day`,
          steps: [
            { label: "Total calories", value: `${macros.targetCalories} kcal`, note: null },
            { label: "− Protein × 4 kcal/g", value: `−${proteinCals} kcal`, note: `${macros.proteinG}g × 4` },
            { label: "− Fat × 9 kcal/g", value: `−${fatCals} kcal`, note: `${macros.fatG}g × 9` },
            { label: "÷ 4 kcal/g", value: `${Math.max(75, Math.round(remaining / 4))}g`, note: macros.carbsG === 75 ? "Floored at 75g (minimum for brain function)" : "Whatever calories remain after protein and fat" },
          ],
          summary: `Carbs fill the calorie remainder after protein and fat targets are met. Floored at 75g minimum for brain glucose needs.`,
        }

      case "bmr":
        return {
          title: "BMR (Basal Metabolic Rate)",
          value: `${bmr} kcal/day`,
          steps: [
            { label: "Formula", value: "Mifflin-St Jeor", note: "Most accurate for general population" },
            usingABW
              ? { label: "Weight used", value: `${Math.round(abw)}kg (ABW)`, note: `Your BMI is ${bmi.toFixed(1)}. For BMI > 30, we use Adjusted Body Weight to avoid overestimating BMR.` }
              : { label: "Weight used", value: `${w}kg`, note: `Your BMI is ${bmi.toFixed(1)} — uses actual weight` },
            { label: "Height", value: `${h}cm`, note: null },
            { label: "Age", value: `${a} years`, note: null },
            { label: "Sex", value: profile.sex, note: profile.sex === "male" ? "+5 constant" : "−161 constant" },
          ],
          summary: `BMR is what your body burns to keep you alive at rest — heart beating, lungs breathing, brain working. Doesn't include any activity.`,
        }

      case "tdee":
        return {
          title: "TDEE (Total Daily Energy Expenditure)",
          value: `${tdee} kcal/day`,
          steps: [
            { label: "BMR", value: `${bmr} kcal`, note: null },
            { label: `× Activity multiplier`, value: `× ${ACTIVITY_MULTIPLIERS[profile.activityLevel]}`, note: activityLabel[profile.activityLevel] },
            { label: "= TDEE", value: `${tdee} kcal/day`, note: "Calories burned in a typical day" },
          ],
          summary: `TDEE estimates total calories burned daily, including exercise. Eat this much to maintain weight, less to lose, more to gain.`,
        }
    }
  })()

  if (!content) return null

  return (
    <div onClick={onClose}
      className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-3">
      <div onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl w-full max-w-md p-4 max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-3">
          <div>
            <div className="text-xs font-bold text-teal-600 uppercase tracking-wide">{content.title}</div>
            <div className="text-2xl font-bold text-gray-900 mt-0.5">{content.value}</div>
          </div>
          <button onClick={onClose} className="text-gray-400 text-2xl leading-none">×</button>
        </div>

        <p className="text-xs text-gray-600 leading-relaxed mb-3">{content.summary}</p>

        <div className="bg-gray-50 rounded-xl p-3 space-y-2">
          {content.steps.map((step: any, i: number) => (
            <div key={i} className="text-xs">
              <div className="flex justify-between items-baseline">
                <span className="text-gray-700">{step.label}</span>
                <span className="font-mono font-bold text-gray-900 ml-2">{step.value}</span>
              </div>
              {step.note && <div className="text-[10px] text-gray-400 mt-0.5">{step.note}</div>}
            </div>
          ))}
        </div>

        <button onClick={onClose}
          className="w-full mt-3 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-bold">
          Got it
        </button>
      </div>
    </div>
  )
}
