// ── Nudge Engine — Session 12 update ──────────────────────────────────────────
// Rule-based contextual observations derived from recent history.
// Now fully goal-mode aware:
//   - Pregnancy/postpartum/breastfeeding modes get specialist nudge sets
//   - Fat loss / deficit nudges suppressed in maternal modes
//   - Breastfeeding rapid weight loss alert added
//   - Pre-conception specific nudges added

import { HistoryRow } from "../store/useHealthStore"
import {
  GoalMode, getFlags, isPregnancyMode, isPostBirthMode,
  getPregnancyMacroTargets,
} from "./goalModeConfig"
import { loadSavedConditions, getActiveGuidance } from "./healthConditions"

export type Nudge = {
  id: string
  priority: number       // lower = higher priority
  icon: string
  message: string
  color: "teal" | "amber" | "red" | "blue" | "green"
}

type NudgeContext = {
  history: HistoryRow[]      // newest first
  calTarget: number
  proteinTarget: number
  carbTarget: number
  waterTarget: number
  fastingTarget: number      // hours
  weightGoal: number | null
  goalMode?: GoalMode        // NEW — defaults to fat_loss if not provided
}

function avg(arr: number[]): number | null {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null
}

export function computeNudges(ctx: NudgeContext): Nudge[] {
  const {
    history, calTarget, proteinTarget, carbTarget,
    waterTarget, fastingTarget, goalMode = "fat_loss",
  } = ctx

  const flags = getFlags(goalMode)
  const nudges: Nudge[] = []
  const last7  = history.slice(0, 7)
  const last14 = history.slice(0, 14)

  const isMaternalMode = isPregnancyMode(goalMode) || isPostBirthMode(goalMode) || goalMode === "pre_conception"

  // ── Maternal modes: specialist nudge set ──────────────────────────────────
  if (isMaternalMode) {
    const maternalTargets = getPregnancyMacroTargets(goalMode)

    // Protein nudge — maternal version
    const avgProtein = avg(last7.map(h => h.protein))
    if (avgProtein !== null && avgProtein < maternalTargets.proteinG * 0.85) {
      const foods = isPregnancyMode(goalMode)
        ? "dal, paneer, curd, eggs or tofu"
        : goalMode === "breastfeeding"
        ? "dal, paneer, eggs, curd or pulses"
        : "dal, paneer, curd or eggs"
      nudges.push({
        id: "maternal_protein", priority: 1, icon: "🥚", color: "amber",
        message: `Protein is below the recommended ${maternalTargets.proteinG}g for this stage — averaging ${Math.round(avgProtein)}g. Try adding ${foods} to your next meal.`,
      })
    }

    // Water nudge — higher target in pregnancy/breastfeeding
    const avgWater = avg(last7.map(h => h.water))
    const waterFloor = maternalTargets.waterL
    if (avgWater !== null && avgWater < waterFloor * 0.8) {
      const reason = goalMode === "breastfeeding"
        ? "Adequate hydration supports milk production."
        : "Staying well hydrated supports amniotic fluid and reduces constipation."
      nudges.push({
        id: "maternal_water", priority: 2, icon: "💧", color: "blue",
        message: `${reason} Aim for ${waterFloor}L today — you've been averaging ${avgWater.toFixed(1)}L.`,
      })
    }

    // Folate nudge — T1 + pre-conception
    if ((goalMode === "pregnancy_t1" || goalMode === "pre_conception") && last7.length >= 3) {
      nudges.push({
        id: "folate_awareness", priority: 4, icon: "🥬", color: "teal",
        message: goalMode === "pre_conception"
          ? "Folate is critical before conception — neural tube closure happens at weeks 3–4. Leafy greens, lentils, rajma and fortified atta are great sources."
          : "Have you had a folate source today? Leafy greens, lentils, rajma or fortified bread all count.",
      })
    }

    // Iron nudge — T2/T3, postpartum, breastfeeding
    if (["pregnancy_t2","pregnancy_t3","postpartum","breastfeeding"].includes(goalMode)) {
      nudges.push({
        id: "iron_awareness", priority: 5, icon: "🩸", color: "amber",
        message: "Iron needs are higher during this phase. Lentils, spinach, rajma or fortified cereal help — add a squeeze of lemon juice to boost absorption. Avoid tea/coffee within an hour of iron sources.",
      })
    }

    // Breastfeeding: rapid weight loss alert
    if (goalMode === "breastfeeding") {
      const weightEntries = last14.filter(h => h.weight !== null)
      if (weightEntries.length >= 7) {
        const oldest = weightEntries[weightEntries.length - 1].weight!
        const newest = weightEntries[0].weight!
        const ratePerWeek = ((oldest - newest) / weightEntries.length) * 7
        if (ratePerWeek > 0.5) {
          nudges.push({
            id: "bf_rapid_loss", priority: 1, icon: "⚠️", color: "red",
            message: `Rapid weight loss can reduce milk supply. You're losing around ${ratePerWeek.toFixed(1)} kg/week — consider eating a little more to protect milk production.`,
          })
        }
      }
    }

    // Breastfeeding: iodine awareness
    if (goalMode === "breastfeeding") {
      nudges.push({
        id: "iodine_awareness", priority: 6, icon: "🧂", color: "blue",
        message: "Iodine is critical during breastfeeding — it passes to your baby through milk. Use iodised salt and include dairy in your diet daily.",
      })
    }

    // Pre-conception: alcohol note
    if (goalMode === "pre_conception") {
      nudges.push({
        id: "precon_alcohol", priority: 7, icon: "🍷", color: "amber",
        message: "Alcohol is best avoided from now — not just after a positive test. Even light drinking in the weeks before conception may affect early fetal development.",
      })
    }

    // Pre-conception: B12 for vegetarians
    if (goalMode === "pre_conception") {
      nudges.push({
        id: "precon_b12", priority: 8, icon: "💊", color: "blue",
        message: "B12 is critical for vegetarians planning pregnancy. Eggs and dairy help, but a supplement ensures consistent levels.",
      })
    }

    // Calorie over nudge (only in breastfeeding, gentle)
    if (!flags.suppressCalorieOverNudge) {
      const avgCal = avg(last7.map(h => h.cal))
      if (avgCal !== null && calTarget > 0 && avgCal > calTarget + 500) {
        nudges.push({
          id: "bf_over_calories", priority: 9, icon: "🍽", color: "amber",
          message: `Your average intake this week is ${Math.round(avgCal - calTarget)} kcal above your target. If you're experiencing strong hunger that's completely normal — just keep your doctor informed.`,
        })
      }
    }

    // Logging consistency
    const loggedDays = last7.filter(h => h.cal > 0).length
    if (loggedDays < 4) {
      nudges.push({
        id: "inconsistent_logging", priority: 10, icon: "📋", color: "amber",
        message: `Only ${loggedDays} days logged this week. Consistent logging helps you — and your doctor — understand your nutritional patterns.`,
      })
    }

    return nudges.sort((a, b) => a.priority - b.priority)
  }

  // ── Standard modes (fat_loss, recomposition, maintenance) ─────────────────

  // Protein nudges
  const avgProtein = avg(last7.map(h => h.protein))
  if (avgProtein !== null && avgProtein < proteinTarget * 0.8) {
    nudges.push({
      id: "low_protein", priority: 1, icon: "🥩", color: "red",
      message: `Protein has averaged ${Math.round(avgProtein)}g this week — ${Math.round(proteinTarget - avgProtein)}g below your ${proteinTarget}g target. Low protein risks muscle loss during a deficit.`,
    })
  } else if (avgProtein !== null && avgProtein < proteinTarget * 0.9) {
    nudges.push({
      id: "protein_close", priority: 4, icon: "🥩", color: "amber",
      message: `Protein is close but slightly under — averaging ${Math.round(avgProtein)}g vs ${proteinTarget}g target. Add a palm-sized protein source to one meal.`,
    })
  }

  // Calorie nudges
  const avgCal = avg(last7.map(h => h.cal))
  if (flags.showDeficitNudges && avgCal !== null && avgCal > calTarget * 1.15) {
    nudges.push({
      id: "over_calories", priority: 2, icon: "⚡", color: "red",
      message: `Calories have averaged ${Math.round(avgCal)} kcal this week — ${Math.round(avgCal - calTarget)} above your ${calTarget} target. Check oil, ghee and dairy quantities when logging.`,
    })
  } else if (avgCal !== null && avgCal < calTarget * 0.75) {
    nudges.push({
      id: "too_low_calories", priority: 2, icon: "⚠️", color: "red",
      message: `Average intake of ${Math.round(avgCal)} kcal is very low. Extreme restriction slows metabolism and causes muscle loss. Aim closer to ${calTarget} kcal.`,
    })
  }

  // Carb nudges
  const avgCarbs = avg(last7.map(h => h.carbs))
  if (avgCarbs !== null && avgCarbs > carbTarget * 1.5) {
    nudges.push({
      id: "high_carbs", priority: 3, icon: "🌾", color: "amber",
      message: `Carbs have averaged ${Math.round(avgCarbs)}g vs your ${carbTarget}g target. Check sauces, dairy and packaged foods — hidden carbs add up quickly.`,
    })
  }

  // Fasting nudges
  if (flags.showFasting) {
    const fastDays = last7.filter(h => h.fastBest && h.fastBest > 0)
    const avgFast = avg(fastDays.map(h => (h.fastBest || 0) / 3600))
    if (fastDays.length >= 3 && avgFast !== null && avgFast < fastingTarget * 0.8) {
      nudges.push({
        id: "low_fasting", priority: 5, icon: "⏱", color: "amber",
        message: `Fasting average has dropped to ${avgFast.toFixed(1)}h vs your ${fastingTarget}h target. Consistency with the eating window drives most of the IF benefit.`,
      })
    }
  }

  // Workout nudges
  const daysSinceWorkout = history.findIndex(h => h.workoutDone)
  if (daysSinceWorkout > 3) {
    nudges.push({
      id: "no_workout", priority: 6, icon: "🏋", color: "amber",
      message: `No workout logged in ${daysSinceWorkout + 1} days. Even a 30-minute walk improves insulin sensitivity and fat oxidation.`,
    })
  } else if (last7.filter(h => h.workoutDone).length >= 6) {
    nudges.push({
      id: "overtraining", priority: 8, icon: "🛌", color: "blue",
      message: `6+ active days this week — make sure you're taking at least 1 full rest day. Recovery is when adaptation happens.`,
    })
  }

  // Recomposition resistance training reminder
  if (flags.showRecompositionCues) {
    const circuitDays = last7.filter(h => h.workoutDone).length
    if (circuitDays < 3) {
      nudges.push({
        id: "recompo_resistance", priority: 4, icon: "💪", color: "teal",
        message: `Recomposition requires 3+ resistance sessions per week. You've done ${circuitDays} this week. Strength work is what drives the muscle gain side of recomposition.`,
      })
    }
  }

  // Water nudges
  const avgWater = avg(last7.map(h => h.water))
  if (avgWater !== null && avgWater < waterTarget * 0.7) {
    nudges.push({
      id: "low_water", priority: 7, icon: "💧", color: "blue",
      message: `Water intake has averaged ${avgWater.toFixed(1)}L vs your ${waterTarget}L target. Dehydration can cause false hunger and reduce fat oxidation.`,
    })
  }

  // Weight trend — losing too fast
  if (flags.showWeightLossRate) {
    const weightEntries = last14.filter(h => h.weight !== null)
    if (weightEntries.length >= 7) {
      const oldest = weightEntries[weightEntries.length - 1].weight!
      const newest = weightEntries[0].weight!
      const ratePerWeek = ((oldest - newest) / weightEntries.length) * 7
      if (ratePerWeek > 1.5) {
        nudges.push({
          id: "losing_fast", priority: 3, icon: "⚡", color: "red",
          message: `Weight dropping at ${ratePerWeek.toFixed(1)} kg/week — faster than recommended. Increase calories by ~200 to protect muscle mass.`,
        })
      }
    }
  }

  // Logging streak
  const loggedDays = last7.filter(h => h.cal > 0).length
  if (loggedDays < 4) {
    nudges.push({
      id: "inconsistent_logging", priority: 9, icon: "📋", color: "amber",
      message: `Only ${loggedDays} days logged this week. Consistent logging is the biggest predictor of success — the app can only guide what it can see.`,
    })
  }

  // ── Condition-aware nudges ────────────────────────────────────────────────
  const saved = loadSavedConditions()
  if (saved.conditions.length > 0) {
    const guidance = getActiveGuidance(saved.conditions)

    // Hypertension: warn if losing too fast (stress on cardiovascular system)
    if (saved.conditions.includes("hypertension")) {
      const weightEntries2 = last14.filter(h => h.weight !== null)
      if (weightEntries2.length >= 7) {
        const oldest2 = weightEntries2[weightEntries2.length - 1].weight!
        const newest2 = weightEntries2[0].weight!
        const rate2 = ((oldest2 - newest2) / weightEntries2.length) * 7
        if (rate2 > 1.0) {
          nudges.push({
            id: "hypertension_fast_loss", priority: 2, icon: "🫀", color: "red",
            message: `With hypertension, losing more than 0.5–0.75 kg/week adds cardiovascular stress. You're losing ${rate2.toFixed(1)} kg/week — consider a slightly higher calorie target.`,
          })
        }
      }
    }

    // Heart disease / arrhythmia: flag very low calories
    if (saved.conditions.includes("heart_disease") || saved.conditions.includes("arrhythmia")) {
      const avgCal2 = avgCal
      if (avgCal2 !== null && avgCal2 < calTarget * 0.8) {
        nudges.push({
          id: "cardio_low_calories", priority: 2, icon: "🫀", color: "red",
          message: `Very low calorie intake with a cardiovascular condition can cause electrolyte imbalances — a risk factor for arrhythmia. Keep intake above ${Math.round(calTarget * 0.85)} kcal.`,
        })
      }
    }

    // Diabetes: high carbs warning
    if (saved.conditions.includes("type2_diabetes") || saved.conditions.includes("prediabetes")) {
      if (avgCarbs !== null && avgCarbs > carbTarget * 1.3) {
        nudges.push({
          id: "diabetes_high_carbs", priority: 2, icon: "🩺", color: "red",
          message: `Carbs have averaged ${Math.round(avgCarbs)}g — above target for blood sugar management. Focus on low-GI options: dal, vegetables, oats instead of rice or maida.`,
        })
      }
    }

    // High severity condition present: remind to exercise with caution
    const hasHighSeverity = guidance.some(g => g.severity === "high")
    if (hasHighSeverity && last7.filter(h => h.workoutDone).length >= 5) {
      nudges.push({
        id: "high_severity_overtraining", priority: 5, icon: "⚠️", color: "amber",
        message: `5+ active days with a high-caution health condition. Ensure you have doctor clearance for this level of activity and are monitoring your response to exercise.`,
      })
    }
  }

  return nudges.sort((a, b) => a.priority - b.priority)
}

// Returns single highest-priority nudge for Today tab
export function getTopNudge(ctx: NudgeContext): Nudge | null {
  const nudges = computeNudges(ctx)
  return nudges[0] ?? null
}
