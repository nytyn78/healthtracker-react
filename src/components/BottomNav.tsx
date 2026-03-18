import { GoalMode, getFlags } from "../services/goalModeConfig"

type Tab = "today" | "food" | "fasting" | "workout" | "meals" | "health" | "analytics" | "ai" | "settings"

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: "today",     icon: "🏠",  label: "Today" },
  { id: "food",      icon: "🍽",  label: "Food" },
  { id: "fasting",   icon: "⏱",  label: "Fast" },
  { id: "workout",   icon: "💪",  label: "Workout" },
  { id: "meals",     icon: "📋",  label: "Meals" },
  { id: "health",    icon: "🩺",  label: "Health" },
  { id: "analytics", icon: "📊",  label: "Stats" },
  { id: "ai",        icon: "🤖",  label: "AI" },
  { id: "settings",  icon: "⚙️",  label: "Settings" },
]

interface Props {
  active: Tab
  onChange: (t: Tab) => void
  goalMode?: GoalMode
}

export default function BottomNav({ active, onChange, goalMode = "fat_loss" }: Props) {
  const flags = getFlags(goalMode)

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-50"
         style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      {TABS.map(t => {
        // Hide fasting tab in pregnancy/postpartum/breastfeeding
        if (t.id === "fasting" && !flags.showFasting) return null

        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`flex-1 flex flex-col items-center py-2 text-xs gap-0.5 transition-colors
              ${active === t.id ? "text-teal-600 font-semibold" : "text-gray-400"}`}
          >
            <span className="text-lg leading-none">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

export type { Tab }
