// ── GuidanceTool.tsx ───────────────────────────────────────────────────────────
// A combined first-launch tour + persistent help button.
//
// Usage:
//   <GuidanceTool tab="today" />                  ← shows floating ? button + tour
//   <GuidanceTool tab="today" showTourOnLoad />   ← also auto-opens tour first time
//
// Tour state is stored in localStorage so each tab's tour only shows once.
// Users can re-trigger via the ? button anytime.

import { useState, useEffect } from "react"
import { KEYS } from "../services/storageKeys"

// ── Per-tab content ──────────────────────────────────────────────────────────

type TipSection = {
  title: string
  body: string
  emoji?: string
}

type TabGuide = {
  tourTitle: string
  tourIntro: string
  sections: TipSection[]
}

const GUIDES: Record<string, TabGuide> = {
  today: {
    tourTitle: "Today Tab — Your Daily Dashboard",
    tourIntro: "This is where you'll spend most of your time. Here's how it works:",
    sections: [
      { emoji: "🍽", title: "Log food fast",
        body: "Tap 'Log Food' or use the Food tab. Search foods, scan barcodes, or pick from your custom list." },
      { emoji: "⚖️", title: "Log weight",
        body: "Log it in the morning, same conditions each day (after bathroom, before food). Daily fluctuations are normal — trends matter." },
      { emoji: "📊", title: "Macro progress bars",
        body: "Bars turn green when you're within 15% of your target. Red means over." },
      { emoji: "💧", title: "Water + tasks",
        body: "Tap the water icon to add 250ml. Daily tasks appear when set up in Settings." },
      { emoji: "⚙️", title: "Setup chip",
        body: "If you see a yellow/red setup chip at the top, tap it — it shows what's missing from your profile." },
    ],
  },
  food: {
    tourTitle: "Food Tab — Logging Made Easy",
    tourIntro: "Three ways to log food:",
    sections: [
      { emoji: "🔍", title: "Search",
        body: "Type any food name. The app searches your custom foods first, then a built-in Indian + global database." },
      { emoji: "📷", title: "Barcode",
        body: "Tap the barcode icon for packaged foods. Works best on Android Chrome." },
      { emoji: "✋", title: "Manual entry",
        body: "Add custom foods with your own macros. Useful for home-cooked items — they'll appear in future searches." },
      { emoji: "📝", title: "Today's entries",
        body: "Tap any entry to edit or delete. Long-press to duplicate it." },
    ],
  },
  fasting: {
    tourTitle: "Fasting Timer",
    tourIntro: "Intermittent fasting made simple:",
    sections: [
      { emoji: "▶️", title: "Start a fast",
        body: "Tap 'Start Fast' when you finish your last meal. The timer runs in the background — no need to keep the app open." },
      { emoji: "⏱", title: "Best so far",
        body: "Your longest fast today shows under the timer. The streak counts consecutive days hitting 14+ hours." },
      { emoji: "🍽", title: "Breaking your fast",
        body: "Logging any food in the Food tab automatically ends the fast and saves your duration." },
    ],
  },
  workout: {
    tourTitle: "Workout Tab",
    tourIntro: "Strength training preserves muscle while you lose fat:",
    sections: [
      { emoji: "📋", title: "Your plan",
        body: "Pre-built routines for beginner/intermediate/active. Customise in Settings → Workout." },
      { emoji: "🏃", title: "Log a walk",
        body: "Use the walk button — just duration + optional distance. Walking is the most underrated fat loss tool." },
      { emoji: "✓", title: "Check off exercises",
        body: "Tap each exercise as you complete it. Workout counts as 'done' as soon as you tick anything." },
    ],
  },
  meals: {
    tourTitle: "Meal Plan Builder",
    tourIntro: "Plan ahead — fewer decisions = better compliance:",
    sections: [
      { emoji: "🍳", title: "Pre-built templates",
        body: "Pick a diet style (keto / balanced / high-protein) and the app gives you a starting menu." },
      { emoji: "🔄", title: "Swap meals",
        body: "Don't like a meal? Swap it for an alternative. Your changes are saved." },
      { emoji: "🛒", title: "Grocery list",
        body: "Export a grocery list to WhatsApp or copy to clipboard. (Coming soon)" },
    ],
  },
  health: {
    tourTitle: "Health Monitor",
    tourIntro: "Track the medical side, not just calories:",
    sections: [
      { emoji: "💊", title: "Medications",
        body: "Add your meds in Settings. Tick them off here daily. Weekly meds (like Ozempic) auto-schedule." },
      { emoji: "🩸", title: "Blood tests",
        body: "Log LFT, kidney function, lipids, HbA1c. App reminds you when each is due." },
      { emoji: "📏", title: "Body measurements",
        body: "Tape measurements show changes the scale misses, especially during recomposition." },
    ],
  },
  analytics: {
    tourTitle: "Analytics",
    tourIntro: "What's actually happening, not just what should:",
    sections: [
      { emoji: "🔥", title: "Adaptive TDEE",
        body: "Your real maintenance calories based on actual weight + intake data. More accurate than formulas after 2 weeks." },
      { emoji: "🎯", title: "Weight forecast",
        body: "Projects your goal date from your current trend, not your target rate. Realistic, not aspirational." },
      { emoji: "⚠️", title: "Plateau advisor",
        body: "Flags 7/14/21-day stalls with specific actions: refeed, diet break, audit calories." },
      { emoji: "🧬", title: "Metabolic adaptation",
        body: "Compares predicted vs observed TDEE. A growing gap = your metabolism is slowing — time for a break." },
    ],
  },
  ai: {
    tourTitle: "AI Coach",
    tourIntro: "Optional. App works fully without these.",
    sections: [
      { emoji: "🔑", title: "API keys",
        body: "AI features need your own key from console.anthropic.com. Stored locally on your device, never shared." },
      { emoji: "📊", title: "Weekly report",
        body: "Generates a personalised summary of your week — wins, gaps, and 3 action items." },
      { emoji: "💬", title: "Chat coach",
        body: "Ask any question — 'why am I stalled?', 'should I take a diet break?'. Uses your real data for context." },
    ],
  },
  settings: {
    tourTitle: "Settings",
    tourIntro: "All your personal data lives here:",
    sections: [
      { emoji: "👤", title: "Profile",
        body: "Age, height, weight, sex, activity level. Used for TDEE + macro targets." },
      { emoji: "🎯", title: "Goal",
        body: "Target weight + rate (0.25–1 kg/week). Slower = more sustainable." },
      { emoji: "💊", title: "Medications + blood tests",
        body: "Add what you take and what you monitor. The app reminds you when each is due." },
      { emoji: "☁️", title: "Sync",
        body: "Firebase sync (optional) lets you use the same data across devices." },
    ],
  },
}

// Generic fallback for tabs without specific guidance
const FALLBACK_GUIDE: TabGuide = {
  tourTitle: "Quick Guide",
  tourIntro: "Tap any section below for help:",
  sections: [
    { emoji: "💡", title: "Tip",
      body: "Every screen has a ? button for help. Settings has a 'Reset' option if you want to start over." },
  ],
}

// ── Tour state helpers ──────────────────────────────────────────────────────

type TourState = { shown: Record<string, boolean> }

function loadTourState(): TourState {
  try {
    const raw = localStorage.getItem(KEYS.GUIDANCE_TOUR_STATE)
    return raw ? JSON.parse(raw) : { shown: {} }
  } catch { return { shown: {} } }
}

function saveTourState(s: TourState) {
  try { localStorage.setItem(KEYS.GUIDANCE_TOUR_STATE, JSON.stringify(s)) } catch {}
}

function hasSeenTour(tab: string): boolean {
  return !!loadTourState().shown[tab]
}

function markTourSeen(tab: string) {
  const s = loadTourState()
  s.shown[tab] = true
  saveTourState(s)
}

// ── Component ───────────────────────────────────────────────────────────────

type Props = {
  tab: string
  showTourOnLoad?: boolean  // when true, opens automatically on first visit
}

export default function GuidanceTool({ tab, showTourOnLoad = true }: Props) {
  const [open, setOpen] = useState(false)
  const guide = GUIDES[tab] ?? FALLBACK_GUIDE

  // Auto-open on first visit to this tab
  useEffect(() => {
    if (showTourOnLoad && !hasSeenTour(tab)) {
      const timer = setTimeout(() => {
        setOpen(true)
        markTourSeen(tab)
      }, 600)  // small delay so user sees the tab first
      return () => clearTimeout(timer)
    }
  }, [tab, showTourOnLoad])

  return (
    <>
      {/* Floating help button — bottom right, above bottom nav */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Help"
        className="fixed bottom-20 right-4 w-11 h-11 rounded-full bg-white shadow-md
                   border border-gray-200 flex items-center justify-center
                   text-teal-600 text-lg font-bold z-30 hover:bg-gray-50 active:scale-95 transition">
        ?
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
             onClick={() => setOpen(false)}>
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[85vh] overflow-hidden flex flex-col"
               onClick={e => e.stopPropagation()}>

            {/* Drag handle */}
            <div className="sm:hidden pt-2 pb-1 flex justify-center">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

            {/* Header */}
            <div className="px-5 pt-3 pb-2 border-b border-gray-100 flex justify-between items-start">
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Help</div>
                <h2 className="text-base font-bold text-gray-900">{guide.tourTitle}</h2>
              </div>
              <button onClick={() => setOpen(false)}
                className="text-gray-400 text-2xl leading-none -mt-1 -mr-1 px-2">×</button>
            </div>

            {/* Scrollable content */}
            <div className="px-5 py-4 overflow-y-auto flex-1">
              <p className="text-sm text-gray-500 mb-4 leading-relaxed">{guide.tourIntro}</p>

              <div className="space-y-3">
                {guide.sections.map((sec, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-start gap-2.5">
                      {sec.emoji && <span className="text-xl shrink-0">{sec.emoji}</span>}
                      <div className="flex-1">
                        <div className="text-sm font-bold text-gray-800 mb-1">{sec.title}</div>
                        <div className="text-xs text-gray-600 leading-relaxed">{sec.body}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100">
                <p className="text-[10px] text-gray-400 text-center">
                  Need more help? Tap the ? button on any screen.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-100">
              <button onClick={() => setOpen(false)}
                className="w-full py-3 bg-teal-600 text-white rounded-xl font-bold text-sm">
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
