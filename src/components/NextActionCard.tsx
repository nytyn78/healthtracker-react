// ── NextActionCard.tsx ────────────────────────────────────────────────────────
// Single highest-priority "do this next" suggestion shown at top of Today tab.
// Reduces cognitive load — instead of staring at 10 sections, see one clear next step.
//
// Priority logic (highest urgency first):
// 1. No food logged yet today → "Log breakfast"
// 2. Calorie target hit + meals done → "Day complete — enjoy"
// 3. Weight not logged + AM → "Quick weigh-in"
// 4. Meds pending → "Take your meds"
// 5. Water < 50% by afternoon → "Drink water"
// 6. Protein <60% of target by evening → "Add a protein snack"
// 7. Workout not done by 6pm → "Quick walk?"

import { DayData, Medication } from "../store/useHealthStore"

export type NextActionProps = {
  day: DayData
  meds: Medication[]
  tgt: { cal: number; protein: number; carbs: number; fat: number }
  tots: { cal: number; protein: number; carbs: number; fat: number }
  waterTarget: number
  onNavigate: (tab: string) => void
  onScrollTo: (id: string) => void
}

export default function NextActionCard(props: NextActionProps) {
  const action = pickAction(props)
  if (!action) return null

  return (
    <button
      onClick={action.onClick}
      className={`w-full text-left rounded-2xl p-4 mb-3 border transition-all
        ${action.tone === "celebrate" ? "bg-green-50 border-green-200"
        : action.tone === "urgent"    ? "bg-amber-50 border-amber-200"
        : "bg-teal-50 border-teal-200"}`}
    >
      <div className="flex items-center gap-3">
        <div className="text-2xl shrink-0">{action.icon}</div>
        <div className="flex-1 min-w-0">
          <div className={`text-xs font-bold uppercase tracking-wide
            ${action.tone === "celebrate" ? "text-green-700"
            : action.tone === "urgent"    ? "text-amber-700"
            : "text-teal-700"}`}>
            Next up
          </div>
          <div className="text-sm font-bold text-gray-900 mt-0.5">{action.title}</div>
          {action.subtitle && (
            <div className="text-xs text-gray-500 mt-0.5">{action.subtitle}</div>
          )}
        </div>
        <div className="text-gray-400 text-xl">›</div>
      </div>
    </button>
  )
}

// ── Decision logic ────────────────────────────────────────────────────────────
type Action = {
  icon: string
  title: string
  subtitle?: string
  tone: "celebrate" | "urgent" | "neutral"
  onClick: () => void
}

function pickAction({ day, meds, tgt, tots, waterTarget, onNavigate, onScrollTo }: NextActionProps): Action | null {
  const hour = new Date().getHours()
  const calPct = tgt.cal > 0 ? tots.cal / tgt.cal : 0
  const protPct = tgt.protein > 0 ? tots.protein / tgt.protein : 0
  const waterPct = waterTarget > 0 ? (day.water || 0) / waterTarget : 0

  const noFood = day.entries.length === 0
  const dayComplete = calPct >= 0.9 && calPct <= 1.15 && protPct >= 0.8
  const noWeight = !day.weight
  const medsPending = meds.length > 0 && meds.some(m => !day.meds?.[m.id])
  const lowProtein = protPct < 0.6
  const noWorkout = !(day.workouts || []).some(w => w.type === "circuit" || (w.exercises?.length ?? 0) > 0 || w.type === "walk")

  // 1. Morning — log breakfast
  if (noFood && hour < 13) {
    return {
      icon: "🍳",
      title: "Log your breakfast",
      subtitle: "Tap a meal from your plan below, or add manually",
      tone: "neutral",
      onClick: () => onScrollTo("card-meals"),
    }
  }

  // 2. Day complete — celebrate
  if (dayComplete) {
    return {
      icon: "🎉",
      title: "Day complete — well done",
      subtitle: `${Math.round(tots.cal)} kcal · ${Math.round(tots.protein)}g protein`,
      tone: "celebrate",
      onClick: () => onScrollTo("card-macros"),
    }
  }

  // 3. AM weigh-in
  if (noWeight && hour >= 6 && hour < 11) {
    return {
      icon: "⚖️",
      title: "Quick morning weigh-in",
      subtitle: "Best done fasted, before food or water",
      tone: "neutral",
      onClick: () => onScrollTo("card-weight"),
    }
  }

  // 4. Meds pending — escalating urgency
  if (medsPending) {
    return {
      icon: "💊",
      title: "Take your medications",
      subtitle: hour >= 20 ? "It's getting late — please don't skip" : "Tap below to mark them taken",
      tone: hour >= 20 ? "urgent" : "neutral",
      onClick: () => onScrollTo("card-meds"),
    }
  }

  // 5. Low water by afternoon
  if (waterPct < 0.5 && hour >= 14) {
    return {
      icon: "💧",
      title: "Drink some water",
      subtitle: `Only ${(day.water || 0).toFixed(1)}L of ${waterTarget}L so far`,
      tone: "urgent",
      onClick: () => onScrollTo("card-water"),
    }
  }

  // 6. Low protein by evening
  if (lowProtein && hour >= 17 && tots.cal > 0) {
    return {
      icon: "🥩",
      title: "Add a protein snack",
      subtitle: `${Math.round(tots.protein)}g / ${tgt.protein}g — you're falling behind`,
      tone: "urgent",
      onClick: () => onNavigate("food"),
    }
  }

  // 7. No workout by evening
  if (noWorkout && hour >= 17 && hour < 20) {
    return {
      icon: "🚶",
      title: "Squeeze in a quick walk?",
      subtitle: "Even 15 minutes counts",
      tone: "neutral",
      onClick: () => onNavigate("workout"),
    }
  }

  // 8. Mid-day meal nudge
  if (noFood && hour >= 13 && hour < 17) {
    return {
      icon: "🥗",
      title: "Time for lunch",
      subtitle: "You haven't logged anything yet today",
      tone: "neutral",
      onClick: () => onScrollTo("card-meals"),
    }
  }

  return null
}
