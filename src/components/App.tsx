import { KEYS } from "../services/storageKeys"
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
import DisclaimerModal, { hasAcceptedDisclaimer } from "./DisclaimerModal"
import GuidanceTool from "./GuidanceTool"

export default function App() {
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(() => !hasAcceptedDisclaimer())
  const [showOnboarding, setShowOnboarding]       = useState(() => needsOnboarding())
  const [goalMode, setGoalMode]                   = useState<GoalMode>(loadGoalMode)
  const [showDisclaimer, setShowDisclaimer]        = useState(false)
  const [disclaimerMode, setDisclaimerMode]        = useState<GoalMode>("pregnancy_t1")

  const [tab, setTab] = useState<Tab>(() => {
    const saved = localStorage.getItem(KEYS.ACTIVE_TAB) as Tab | null
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
    localStorage.setItem(KEYS.ACTIVE_TAB, t)
  }

  if (showDisclaimerModal) {
    return <DisclaimerModal onAccept={() => setShowDisclaimerModal(false)} />
  }

  if (showOnboarding) {
    // On onboarding completion: re-read goalMode from storage immediately.
    // Onboarding writes the user's chosen goal mode via saveGoalMode() in its
    // complete() function, but App's goalMode React state was initialised at
    // app start when storage may have held a stale (or default fat_loss)
    // value. Without this explicit sync, the user sees the wrong goal-mode
    // header for ~0-2 seconds after onboarding finishes — until the existing
    // 2-second polling useEffect re-reads storage. The poll remains as a
    // safety net for cross-tab changes; this handler covers the same-tab
    // onboarding-finish case directly.
    return <Onboarding onComplete={() => {
      setGoalMode(loadGoalMode())
      setShowOnboarding(false)
    }} />
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
      <GuidanceTool tab={tab} />
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
