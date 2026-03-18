/**
 * Onboarding.tsx — Redesigned for simplicity
 *
 * Design principles:
 *   1. Max one real decision per screen
 *   2. Plain English — no fitness jargon on first encounter
 *   3. Smart defaults — the app picks sensible settings, not the user
 *   4. Advanced options exist but are never shown unless needed
 *   5. Total flow: 4 screens for most users, 5 for anyone needing a target
 *   6. Everything is editable in Settings later — say this clearly
 *
 * Flow:
 *   Screen 1  — Who is this for? (You / Child / Family member) + your name
 *   Screen 2  — What do you want? (4 plain-English options)
 *   Screen 3  — About you (age, sex, height, weight, activity)
 *   Screen 4  — Food preferences (diet type — just 3 options)
 *   Screen 5  — Done — preview and start (auto-populates everything else)
 *
 * Special modes (geriatric, maternal, child, teen) are reached through
 * the "Who is this for?" branching on Screen 1, keeping the main flow clean.
 */

import { useState } from "react"
import {
  useHealthStore, ActivityLevel,
  loadOnboarding, saveOnboarding,
  FitnessLevel,
  EatingStyle,
  DietTag, DIET_TAG_LABELS,
  saveWorkoutPlan, saveMealPlan, saveDietConfig,
} from "../store/useHealthStore"
import {
  getWorkoutPlanForLevel, getMealPresetForDiet,
  getMaternalWorkoutPlan, getGeriatricWorkoutPlan,
} from "../services/onboardingPresets"
import {
  GoalMode, GOAL_MODE_INFO, saveGoalMode,
  isMaternalMode,
} from "../services/goalModeConfig"

// ── Constants ─────────────────────────────────────────────────────────────────

const inputCls = "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-500 bg-white"

// Plain-English goal descriptions — no jargon
const MAIN_GOALS = [
  {
    id: "fat_loss" as GoalMode,
    emoji: "🎯",
    title: "Lose weight",
    subtitle: "Track food, build habits, lose fat steadily",
  },
  {
    id: "maintenance" as GoalMode,
    emoji: "⚖️",
    title: "Stay at my current weight",
    subtitle: "Build healthy habits without a strict deficit",
  },
  {
    id: "recomposition" as GoalMode,
    emoji: "💪",
    title: "Get fitter and stronger",
    subtitle: "Lose some fat while building muscle",
  },
  {
    id: "_advanced" as any,
    emoji: "⚙️",
    title: "Other / Advanced",
    subtitle: "Geriatric, pregnancy, child, teen, or custom goals",
  },
]

const ADVANCED_GOALS: { id: GoalMode; label: string }[] = [
  { id: "geriatric",    label: "🧓 Healthy Ageing (60+)" },
  { id: "child",        label: "🧒 Child (2–12)" },
  { id: "teen_early",   label: "🧑 Early Teen (13–16)" },
  { id: "teen_older",   label: "👦 Older Teen (17–19)" },
  { id: "pre_conception",  label: "🌱 Planning pregnancy" },
  { id: "pregnancy_t1",    label: "🤰 Pregnant — 1st trimester" },
  { id: "pregnancy_t2",    label: "🤰 Pregnant — 2nd trimester" },
  { id: "pregnancy_t3",    label: "🤰 Pregnant — 3rd trimester" },
  { id: "postpartum",      label: "👶 Just had a baby (0–6 weeks)" },
  { id: "breastfeeding",   label: "🍼 Breastfeeding" },
]

// Smart defaults by goal mode
const DEFAULT_WEEKLY_RATE: Record<string, number> = {
  fat_loss: 0.5,
  recomposition: 0.25,
  maintenance: 0,
  geriatric: 0.25,
  child: 0,
  teen_early: 0,
  teen_older: 0.25,
}

const DEFAULT_FITNESS_LEVEL: FitnessLevel = "intermediate"
const DEFAULT_EATING_STYLE: EatingStyle   = "late_eater"

// ── Small components ──────────────────────────────────────────────────────────

function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex gap-2 justify-center mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`rounded-full transition-all
          ${i === step ? "w-6 h-2.5 bg-teal-600" : i < step ? "w-2.5 h-2.5 bg-teal-300" : "w-2.5 h-2.5 bg-gray-200"}`} />
      ))}
    </div>
  )
}

function GoalCard({
  emoji, title, subtitle, selected, onClick,
}: {
  emoji: string; title: string; subtitle: string; selected: boolean; onClick: () => void
}) {
  return (
    <button onClick={onClick}
      className={`w-full text-left p-4 rounded-2xl border-2 transition-all mb-3
        ${selected ? "border-teal-500 bg-teal-50" : "border-gray-200 bg-white hover:border-gray-300"}`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl shrink-0">{emoji}</span>
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-bold ${selected ? "text-teal-800" : "text-gray-800"}`}>{title}</div>
          <div className="text-xs text-gray-400 mt-0.5 leading-snug">{subtitle}</div>
        </div>
        {selected && <span className="text-teal-500 text-lg shrink-0">✓</span>}
      </div>
    </button>
  )
}

function DietCard({
  tag, selected, onClick,
}: {
  tag: DietTag; selected: boolean; onClick: () => void
}) {
  const info = {
    veg:        { emoji: "🌱", label: "Vegetarian",   sub: "No meat or eggs" },
    eggetarian: { emoji: "🥚", label: "Eggetarian",   sub: "Veg + eggs, no meat" },
    non_veg:    { emoji: "🍗", label: "Non-vegetarian", sub: "Includes meat and fish" },
  }[tag]

  return (
    <button onClick={onClick}
      className={`w-full text-left p-4 rounded-2xl border-2 transition-all mb-3
        ${selected ? "border-teal-500 bg-teal-50" : "border-gray-200 bg-white hover:border-gray-300"}`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl shrink-0">{info.emoji}</span>
        <div>
          <div className={`text-sm font-bold ${selected ? "text-teal-800" : "text-gray-800"}`}>{info.label}</div>
          <div className="text-xs text-gray-400 mt-0.5">{info.sub}</div>
        </div>
        {selected && <span className="ml-auto text-teal-500 text-lg shrink-0">✓</span>}
      </div>
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Onboarding({ onComplete }: { onComplete: () => void }) {
  const { profile, goals, updateProfile, updateGoals, updateIFProtocol } = useHealthStore()

  const [step, setStep]       = useState(0)
  const [goalMode, setGoal]   = useState<GoalMode>("fat_loss")
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [dietTag, setDietTag] = useState<DietTag>("eggetarian")

  const TOTAL_STEPS = 5
  const isMaternal  = isMaternalMode(goalMode)
  const isChild     = goalMode === "child" || goalMode === "teen_early"
  const isGeriatric = goalMode === "geriatric"
  const isSpecial   = isMaternal || isChild || isGeriatric || goalMode === "teen_older"

  function next() { setStep(s => Math.min(s + 1, TOTAL_STEPS - 1)) }
  function back() { setStep(s => Math.max(s - 1, 0)) }

  function complete() {
    // Save goal mode
    saveGoalMode(goalMode)

    // Diet config — auto-pick a sensible diet mode based on goal
    const autoMode =
      goalMode === "fat_loss" ? "keto"
      : goalMode === "recomposition" ? "high_protein"
      : isMaternal ? "balanced"
      : isChild ? "balanced"
      : isGeriatric ? "high_protein"
      : "balanced"
    saveDietConfig({ mode: autoMode, tag: dietTag })

    // IF — set a sensible default for standard fat loss, skip for special modes
    if (!isMaternal && !isChild) {
      updateIFProtocol({ fastingHours: 16, eatingHours: 8, fastStartHour: 20 })
    }

    // Target weight — default to 10% below current if not set
    if (!goals.targetWeightKg && profile.weightKg) {
      const defaultTarget = isChild || isMaternal
        ? Number(profile.weightKg)
        : Math.round(Number(profile.weightKg) * 0.9)
      updateGoals({
        targetWeightKg: defaultTarget,
        weeklyLossKg: (DEFAULT_WEEKLY_RATE[goalMode] ?? 0.5) as any,
      })
    }

    // Workout plan
    const maternalPlan = getMaternalWorkoutPlan(goalMode)
    if (maternalPlan) {
      saveWorkoutPlan(maternalPlan)
    } else if (isGeriatric) {
      saveWorkoutPlan(getGeriatricWorkoutPlan())
    } else if (isChild) {
      saveWorkoutPlan(getWorkoutPlanForLevel("beginner"))
    } else {
      saveWorkoutPlan(getWorkoutPlanForLevel(DEFAULT_FITNESS_LEVEL))
    }

    // Meal plan
    saveMealPlan(getMealPresetForDiet(dietTag, autoMode === "keto"))

    saveOnboarding({ completed: true, step: TOTAL_STEPS, doIF: !isMaternal && !isChild })
    onComplete()
  }

  // ── SCREEN 1: Who is this for? ───────────────────────────────────────────────
  const screen1 = (
    <div>
      <div className="text-4xl mb-3">👋</div>
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Welcome</h2>
      <p className="text-sm text-gray-500 mb-6 leading-relaxed">
        Let's get you set up. Takes about 2 minutes.<br />
        You can change everything later.
      </p>

      <div className="mb-5">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-2">Your name</label>
        <input className={inputCls} type="text" placeholder="e.g. Nitin"
          value={profile.name ?? ""}
          onChange={e => updateProfile({ name: e.target.value })} />
      </div>

      <button onClick={next} disabled={!String(profile.name ?? "").trim()}
        className="w-full py-4 bg-teal-600 text-white rounded-2xl font-bold text-base disabled:opacity-40">
        Let's go →
      </button>
    </div>
  )

  // ── SCREEN 2: What do you want? ──────────────────────────────────────────────
  const screen2 = (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">What's your goal?</h2>
      <p className="text-sm text-gray-400 mb-5">Pick the one that fits best — you can refine it later.</p>

      {MAIN_GOALS.map(g => (
        <GoalCard key={g.id}
          emoji={g.emoji} title={g.title} subtitle={g.subtitle}
          selected={g.id === "_advanced" ? showAdvanced : (goalMode === g.id && !showAdvanced)}
          onClick={() => {
            if (g.id === "_advanced") {
              setShowAdvanced(true)
            } else {
              setGoal(g.id as GoalMode)
              setShowAdvanced(false)
            }
          }}
        />
      ))}

      {/* Advanced dropdown */}
      {showAdvanced && (
        <div className="bg-gray-50 rounded-2xl p-3 mb-3 border border-gray-200">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-2">Select mode</label>
          <select
            value={goalMode}
            onChange={e => setGoal(e.target.value as GoalMode)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:border-teal-500"
          >
            {ADVANCED_GOALS.map(g => (
              <option key={g.id} value={g.id}>{g.label}</option>
            ))}
          </select>
          <p className="text-[11px] text-gray-400 mt-2 leading-snug">
            {GOAL_MODE_INFO[goalMode]?.description}
          </p>
        </div>
      )}

      <div className="flex gap-3 mt-2">
        <button onClick={back} className="flex-1 py-3.5 bg-gray-100 text-gray-500 rounded-2xl font-bold">← Back</button>
        <button onClick={next} className="flex-2 flex-grow py-3.5 bg-teal-600 text-white rounded-2xl font-bold">
          Continue →
        </button>
      </div>
    </div>
  )

  // ── SCREEN 3: About you ──────────────────────────────────────────────────────
  const screen3 = (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">About you</h2>
      <p className="text-sm text-gray-400 mb-5">Used to calculate your daily calorie needs.</p>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-xs font-bold text-gray-500 block mb-1">Age</label>
          <input className={inputCls} type="number" placeholder="e.g. 48" min={2} max={110}
            value={profile.age ?? ""}
            onChange={e => updateProfile({ age: e.target.value === "" ? "" : Number(e.target.value) })} />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 block mb-1">Sex</label>
          <select className={inputCls} value={profile.sex ?? "male"}
            onChange={e => updateProfile({ sex: e.target.value as "male"|"female" })}>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 block mb-1">Height (cm)</label>
          <input className={inputCls} type="number" placeholder="e.g. 168"
            value={profile.heightCm ?? ""}
            onChange={e => updateProfile({ heightCm: e.target.value === "" ? "" : Number(e.target.value) })} />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 block mb-1">Weight (kg)</label>
          <input className={inputCls} type="number" placeholder="e.g. 85" step={0.5}
            value={profile.weightKg ?? ""}
            onChange={e => updateProfile({ weightKg: e.target.value === "" ? "" : Number(e.target.value) })} />
        </div>
      </div>

      <div className="mb-4">
        <label className="text-xs font-bold text-gray-500 block mb-1">How active are you day-to-day?</label>
        <select className={inputCls} value={profile.activityLevel ?? "moderately_active"}
          onChange={e => updateProfile({ activityLevel: e.target.value as ActivityLevel })}>
          <option value="sedentary">Mostly sitting — office job, minimal exercise</option>
          <option value="lightly_active">Light activity — some walking, 1–2 workouts/week</option>
          <option value="moderately_active">Moderately active — regular exercise 3–4x/week</option>
          <option value="very_active">Very active — hard training 6–7x/week</option>
        </select>
      </div>

      {/* Target weight — only for weight-focused modes */}
      {!isMaternal && !isChild && (
        <div className="mb-4">
          <label className="text-xs font-bold text-gray-500 block mb-1">
            Target weight (kg)
            <span className="font-normal text-gray-400"> — leave blank to set later</span>
          </label>
          <input className={inputCls} type="number" placeholder={
            profile.weightKg ? `e.g. ${Math.round(Number(profile.weightKg) * 0.9)}` : "e.g. 75"
          } step={0.5}
            value={goals.targetWeightKg ?? ""}
            onChange={e => updateGoals({ targetWeightKg: e.target.value === "" ? "" : Number(e.target.value) })} />
          {!isMaternal && !isChild && goalMode !== "maintenance" && (
            <p className="text-[11px] text-gray-400 mt-1.5 leading-snug">
              We'll use a steady 0.5 kg/week pace — the most sustainable rate. Change it anytime in Settings.
            </p>
          )}
        </div>
      )}

      <div className="flex gap-3 mt-2">
        <button onClick={back} className="flex-1 py-3.5 bg-gray-100 text-gray-500 rounded-2xl font-bold">← Back</button>
        <button onClick={next}
          disabled={!profile.age || !profile.heightCm || !profile.weightKg}
          className="flex-2 flex-grow py-3.5 bg-teal-600 text-white rounded-2xl font-bold disabled:opacity-40">
          Continue →
        </button>
      </div>
    </div>
  )

  // ── SCREEN 4: Food preferences ───────────────────────────────────────────────
  const screen4 = (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">Your food preferences</h2>
      <p className="text-sm text-gray-400 mb-5">We'll build a starting meal plan around this.</p>

      {(["veg","eggetarian","non_veg"] as DietTag[]).map(tag => (
        <DietCard key={tag} tag={tag} selected={dietTag === tag} onClick={() => setDietTag(tag)} />
      ))}

      <div className="bg-gray-50 rounded-xl p-3 mt-1">
        <p className="text-xs text-gray-500 leading-snug">
          <span className="font-bold">The app will suggest a starting diet style</span> based on your goal
          ({goalMode === "fat_loss" || goalMode === "recomposition" ? "high protein, low carb" : "balanced"}).
          You can change this anytime in Settings → Diet.
        </p>
      </div>

      <div className="flex gap-3 mt-4">
        <button onClick={back} className="flex-1 py-3.5 bg-gray-100 text-gray-500 rounded-2xl font-bold">← Back</button>
        <button onClick={next} className="flex-2 flex-grow py-3.5 bg-teal-600 text-white rounded-2xl font-bold">
          Continue →
        </button>
      </div>
    </div>
  )

  // ── SCREEN 5: Preview + start ────────────────────────────────────────────────
  const autoMode =
    goalMode === "fat_loss" ? "Keto (high protein, very low carb)"
    : goalMode === "recomposition" ? "High protein"
    : isMaternal ? "Balanced (pregnancy nutrition)"
    : isChild ? "Balanced (growth-focused)"
    : isGeriatric ? "High protein (muscle preservation)"
    : "Balanced"

  const screen5 = (
    <div>
      <div className="text-3xl mb-3">✅</div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">You're all set, {String(profile.name ?? "").split(" ")[0]}!</h2>
      <p className="text-sm text-gray-400 mb-5">Here's what we've set up for you. Everything can be edited.</p>

      {/* Summary cards */}
      <div className="space-y-2 mb-5">
        <div className="bg-teal-50 border border-teal-100 rounded-xl p-3 flex items-center gap-3">
          <span className="text-xl shrink-0">{GOAL_MODE_INFO[goalMode]?.icon}</span>
          <div>
            <div className="text-xs font-bold text-teal-700">Goal</div>
            <div className="text-sm text-teal-900">{GOAL_MODE_INFO[goalMode]?.label}</div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-center gap-3">
          <span className="text-xl shrink-0">🍽</span>
          <div>
            <div className="text-xs font-bold text-blue-700">Diet</div>
            <div className="text-sm text-blue-900">{DIET_TAG_LABELS[dietTag]} · {autoMode}</div>
          </div>
        </div>

        {!isMaternal && !isChild && (
          <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 flex items-center gap-3">
            <span className="text-xl shrink-0">⏱</span>
            <div>
              <div className="text-xs font-bold text-purple-700">Fasting</div>
              <div className="text-sm text-purple-900">16:8 — eating window 12pm–8pm · adjust in Settings</div>
            </div>
          </div>
        )}

        {goals.targetWeightKg && (
          <div className="bg-green-50 border border-green-100 rounded-xl p-3 flex items-center gap-3">
            <span className="text-xl shrink-0">🎯</span>
            <div>
              <div className="text-xs font-bold text-green-700">Target</div>
              <div className="text-sm text-green-900">
                {goals.targetWeightKg} kg at 0.5 kg/week
                {profile.weightKg && goals.targetWeightKg
                  ? ` — about ${Math.ceil((Number(profile.weightKg) - Number(goals.targetWeightKg)) / 0.5)} weeks`
                  : ""}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mandatory disclaimer for special modes */}
      {(isMaternal || isChild) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
          <p className="text-xs text-amber-700 leading-snug">
            ⚠️ This app supports nutrition tracking only. Always follow your doctor's specific guidance —
            especially for {isChild ? "children's growth and nutrition" : "pregnancy and postpartum care"}.
          </p>
        </div>
      )}

      <button onClick={complete}
        className="w-full py-4 bg-teal-600 text-white rounded-2xl font-bold text-base">
        🚀 Start tracking
      </button>

      <button onClick={back} className="w-full mt-2 py-3 text-gray-400 text-sm">
        ← Go back and change something
      </button>
    </div>
  )

  const screens = [screen1, screen2, screen3, screen4, screen5]

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center overflow-y-auto">
      <div className="w-full max-w-sm min-h-screen bg-white flex flex-col">
        {/* Header — progress only, no step number */}
        <div className="px-6 pt-12 pb-2">
          <ProgressDots step={step} total={TOTAL_STEPS} />
        </div>

        {/* Content */}
        <div className="flex-1 px-6 pb-10">
          {screens[step]}
        </div>
      </div>
    </div>
  )
}
