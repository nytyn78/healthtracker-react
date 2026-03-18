import { useState, useEffect } from "react"
import BottomNav, { Tab } from "./BottomNav"
import Settings from "./Settings"
import TodayTab from "./TodayTab"
import FastingTimer from "./FastingTimer"
import FoodLog from "./FoodLog"
import WeightLog from "./WeightLog"
import WorkoutLog from "./WorkoutLog"
import ProgressCharts from "./ProgressCharts"
import HealthMonitor from "./HealthMonitor"
import MealPlanBuilder from "./MealPlanBuilder"
import AICoach from "./AICoach"
import Onboarding from "./Onboarding"
import { needsOnboarding } from "../store/useHealthStore"
import { loadGoalMode, GoalMode, getFlags, isMaternalMode, hasShownDisclaimer } from "../services/goalModeConfig"
import PregnancyModeDisclaimer from "./PregnancyModeDisclaimer"

export default function App() {
  const [showOnboarding, setShowOnboarding]       = useState(() => needsOnboarding())
  const [goalMode, setGoalMode]                   = useState<GoalMode>(loadGoalMode)
  const [showDisclaimer, setShowDisclaimer]        = useState(false)
  const [disclaimerMode, setDisclaimerMode]        = useState<GoalMode>("pregnancy_t1")

  const [tab, setTab] = useState<Tab>(() => {
    const saved = localStorage.getItem("active_tab") as Tab | null
    const valid: Tab[] = ["today","food","fasting","workout","meals","health","analytics","ai","settings"]
    return saved && valid.includes(saved) ? saved : "today"
  })

  // Listen for goal mode changes (Settings writes to localStorage; App re-reads on focus)
  useEffect(() => {
    function syncMode() {
      const m = loadGoalMode()
      if (m !== goalMode) {
        // If switching into a maternal mode for the first time, show disclaimer
        if (isMaternalMode(m) && !hasShownDisclaimer(m)) {
          setDisclaimerMode(m)
          setShowDisclaimer(true)
        }
        setGoalMode(m)
        // If fasting tab is active but hidden in new mode, redirect to today
        const flags = getFlags(m)
        if (!flags.showFasting && tab === "fasting") {
          handleTabChange("today")
        }
      }
    }
    window.addEventListener("focus", syncMode)
    // Also poll every 2s to catch Settings changes without page focus
    const interval = setInterval(syncMode, 2000)
    return () => { window.removeEventListener("focus", syncMode); clearInterval(interval) }
  }, [goalMode, tab])

  function handleTabChange(t: Tab) {
    // Block navigation to fasting tab in pregnancy/postpartum/breastfeeding
    const flags = getFlags(goalMode)
    if (t === "fasting" && !flags.showFasting) return
    setTab(t)
    localStorage.setItem("active_tab", t)
  }

  if (showOnboarding) {
    return <Onboarding onComplete={() => setShowOnboarding(false)} />
  }

  const flags = getFlags(goalMode)

  const screen: Record<Tab, React.ReactNode> = {
    today:     <TodayTab onNavigate={(t) => handleTabChange(t as Tab)} goalMode={goalMode} />,
    food:      <FoodLog />,
    fasting:   <FastingTimer goalMode={goalMode} />,
    workout:   <WorkoutLog />,
    meals:     <MealPlanBuilder />,
    health:    <HealthMonitor />,
    analytics: <ProgressCharts goalMode={goalMode} />,
    ai:        <AICoach />,
    settings:  <Settings onGoalModeChange={setGoalMode} />,
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-lg mx-auto">
        {screen[tab]}
      </main>
      <BottomNav active={tab} onChange={handleTabChange} goalMode={goalMode} />

      {/* One-time disclaimer for maternal modes */}
      {showDisclaimer && (
        <PregnancyModeDisclaimer
          mode={disclaimerMode}
          onDismiss={() => setShowDisclaimer(false)}
        />
      )}
    </div>
  )
}
