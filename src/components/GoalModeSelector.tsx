/**
 * GoalModeSelector.tsx — Session 12
 * Settings section for selecting goal mode + pregnancy sub-settings.
 * Rendered inside Settings.tsx.
 */

import { useState, useEffect } from "react"
import {
  GoalMode, GOAL_MODE_INFO, PregnancySettings,
  loadGoalMode, saveGoalMode, loadPregnancySettings, savePregnancySettings,
  isPregnancyMode, isPostBirthMode, isMaternalMode,
  hasShownSupplementOffer, markSupplementOfferShown, SUPPLEMENT_PRESETS,
  BLOOD_TEST_PRESETS,
} from "../services/goalModeConfig"
import { loadBloodTests, saveBloodTests, BloodTest, saveWorkoutPlan } from "../store/useHealthStore"
import { getMaternalWorkoutPlan, getGeriatricWorkoutPlan } from "../services/onboardingPresets"
import SupplementOffer from "./SupplementOffer"

const ALL_MODES: GoalMode[] = [
  "fat_loss", "recomposition", "maintenance",
  "geriatric",
  "child", "teen_early", "teen_older",
  "pre_conception", "pregnancy_t1", "pregnancy_t2", "pregnancy_t3",
  "postpartum", "breastfeeding",
]

const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"

interface Props {
  onModeChange?: (mode: GoalMode) => void
}

export default function GoalModeSelector({ onModeChange }: Props) {
  const [mode, setMode]               = useState<GoalMode>(loadGoalMode)
  const [pregSettings, setPregSettings] = useState<PregnancySettings>(loadPregnancySettings)
  const [showOffer, setShowOffer]     = useState(false)
  const [pendingMode, setPendingMode] = useState<GoalMode | null>(null)

  function handleModeChange(newMode: GoalMode) {
    const prev = mode
    saveGoalMode(newMode)
    setMode(newMode)
    onModeChange?.(newMode)

    // Auto-load maternal or geriatric workout plan if switching to those modes
    const maternalPlan = getMaternalWorkoutPlan(newMode)
    if (maternalPlan) {
      saveWorkoutPlan(maternalPlan)
    } else if (newMode === "geriatric") {
      saveWorkoutPlan(getGeriatricWorkoutPlan())
    }

    // Auto-populate blood tests on first entry into pregnancy / pre-conception
    const presets = BLOOD_TEST_PRESETS[newMode]
    if (presets && presets.length > 0) {
      const existing = loadBloodTests()
      const existingNames = new Set(existing.map(t => t.name.toLowerCase()))
      const toAdd: BloodTest[] = presets
        .filter(p => !existingNames.has(p.name.toLowerCase()))
        .map(p => ({
          id: `bt-preset-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
          name: p.name,
          reason: p.reason,
          intervalDays: p.intervalDays,
          enabled: true,
        }))
      if (toAdd.length > 0) {
        saveBloodTests([...existing, ...toAdd])
      }
    }

    // Show supplement offer if mode has presets and hasn't been offered yet
    const hasSupps = SUPPLEMENT_PRESETS[newMode]?.length > 0
    if (hasSupps && !hasShownSupplementOffer(newMode) && newMode !== prev) {
      setPendingMode(newMode)
      setShowOffer(true)
    }
  }

  function handlePregChange(patch: Partial<PregnancySettings>) {
    const updated = { ...pregSettings, ...patch }
    setPregSettings(updated)
    savePregnancySettings(updated)
  }

  function handleSupplementOfferDone() {
    if (pendingMode) markSupplementOfferShown(pendingMode)
    setShowOffer(false)
    setPendingMode(null)
  }

  const info = GOAL_MODE_INFO[mode]
  const showPregSub = isPregnancyMode(mode) || isPostBirthMode(mode) || mode === "pre_conception"
  const isCurrentlyMaternal = isMaternalMode(mode)

  const standardModes = ALL_MODES.filter(m => GOAL_MODE_INFO[m].group === "standard")
  const maternalModes = ALL_MODES.filter(m => GOAL_MODE_INFO[m].group === "pregnancy")

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <h2 className="text-sm font-semibold text-teal-700 uppercase tracking-wide mb-1">Goal Mode</h2>
        <p className="text-xs text-gray-500 mb-3">
          Your goal mode shapes calorie targets, feature visibility and nudges throughout the app.
        </p>

        {/* Standard Modes */}
        <div className="mb-2">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Standard</div>
          <div className="flex flex-col gap-2">
            {standardModes.map(m => (
              <ModeCard key={m} mode={m} selected={mode === m} onSelect={handleModeChange} />
            ))}
          </div>
        </div>

        {/* Healthy Ageing */}
        <div className="mt-4">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Healthy Ageing</div>
          <ModeCard mode="geriatric" selected={mode === "geriatric"} onSelect={handleModeChange} />
        </div>

        {/* Maternal Health — single card with dropdown */}
        <div className="mt-4">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Maternal Health</div>
          <div className={`p-3.5 rounded-xl border-2 transition-all
            ${isCurrentlyMaternal ? "border-rose-400 bg-rose-50" : "border-gray-200 bg-white"}`}>
            <div className="flex items-center gap-2 mb-0">
              <span className="text-lg">🌸</span>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-bold ${isCurrentlyMaternal ? "text-rose-700" : "text-gray-700"}`}>
                  Maternal Health
                </div>
                <div className="text-xs text-gray-400">Pregnancy, postpartum & breastfeeding</div>
              </div>
              {/* Toggle */}
              <button
                onClick={() => {
                  if (isCurrentlyMaternal) {
                    handleModeChange("fat_loss")
                  } else {
                    handleModeChange("pre_conception")
                  }
                }}
                className={`shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                  ${isCurrentlyMaternal ? "bg-rose-500" : "bg-gray-200"}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
                  ${isCurrentlyMaternal ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>

            {/* Dropdown — visible when maternal is active */}
            {isCurrentlyMaternal && (
              <div className="mt-3">
                <label className="text-[10px] font-bold text-rose-600 uppercase tracking-wide block mb-1.5">
                  Current phase
                </label>
                <select
                  value={mode}
                  onChange={e => handleModeChange(e.target.value as GoalMode)}
                  className="w-full border-2 border-rose-300 rounded-xl px-3 py-2.5 text-sm font-semibold
                             text-rose-800 bg-white focus:outline-none focus:border-rose-500"
                >
                  {maternalModes.map(m => (
                    <option key={m} value={m}>
                      {GOAL_MODE_INFO[m].icon} {GOAL_MODE_INFO[m].label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-rose-600 mt-1.5 leading-snug">
                  {GOAL_MODE_INFO[mode]?.description}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Active mode summary */}
        <div className="mt-4 bg-teal-50 border border-teal-100 rounded-xl p-3">
          <div className="text-xs font-semibold text-teal-800">{info.icon} Active: {info.label}</div>
          <div className="text-[11px] text-teal-600 mt-0.5">{info.description}</div>
        </div>
      </div>

      {/* Pregnancy sub-settings */}
      {showPregSub && (
        <PregnancySubSettings
          mode={mode}
          settings={pregSettings}
          onChange={handlePregChange}
        />
      )}

      {/* Supplement offer modal */}
      {showOffer && pendingMode && (
        <SupplementOffer
          mode={pendingMode}
          onDone={handleSupplementOfferDone}
        />
      )}
    </>
  )
}

// ── Mode Card ─────────────────────────────────────────────────────────────────

function ModeCard({ mode, selected, onSelect }: {
  mode: GoalMode; selected: boolean; onSelect: (m: GoalMode) => void
}) {
  const info = GOAL_MODE_INFO[mode]
  return (
    <button
      onClick={() => onSelect(mode)}
      className={`w-full text-left p-3 rounded-xl border transition-all
        ${selected
          ? "bg-teal-600 border-teal-600 text-white shadow-sm"
          : "bg-gray-50 border-gray-200 text-gray-700 hover:border-teal-300"}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg">{info.icon}</span>
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-semibold ${selected ? "text-white" : "text-gray-800"}`}>
            {info.label}
          </div>
          <div className={`text-[11px] mt-0.5 leading-snug ${selected ? "text-teal-100" : "text-gray-500"}`}>
            {info.description}
          </div>
        </div>
        {selected && <div className="text-white shrink-0">✓</div>}
      </div>
    </button>
  )
}

// ── Pregnancy Sub-Settings ────────────────────────────────────────────────────

function PregnancySubSettings({ mode, settings, onChange }: {
  mode: GoalMode
  settings: PregnancySettings
  onChange: (patch: Partial<PregnancySettings>) => void
}) {
  const isPreg = isPregnancyMode(mode) || isPostBirthMode(mode)

  return (
    <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 mb-4">
      <div className="text-sm font-semibold text-rose-800 mb-3">
        {mode === "pre_conception" ? "🌱 Pre-Conception Details" : "🤰 Pregnancy & Maternal Details"}
      </div>

      {/* Medical disclaimer */}
      <div className="bg-white border border-rose-200 rounded-lg p-2.5 mb-3">
        <p className="text-[11px] text-rose-700 leading-snug">
          This app supports nutritional tracking and awareness only. Always follow your doctor's or midwife's specific guidance.
          Your individual needs may differ from general recommendations.
        </p>
      </div>

      {/* Pre-pregnancy weight — shown for all maternal modes */}
      <div className="mb-3">
        <label className="block text-xs text-gray-600 mb-1">
          Pre-pregnancy weight (kg)
          <span className="text-gray-400 ml-1">— used for gestational gain tracking</span>
        </label>
        <input
          type="number" min="30" max="200"
          className={inputCls}
          value={settings.prePregnancyWeightKg || ""}
          onChange={e => onChange({ prePregnancyWeightKg: Number(e.target.value) })}
          placeholder="e.g. 65"
        />
      </div>

      {/* Pregnancy-specific fields */}
      {isPreg && (
        <>
          <div className="mb-3">
            <label className="block text-xs text-gray-600 mb-1">Weeks pregnant</label>
            <input
              type="number" min="1" max="42"
              className={inputCls}
              value={settings.weeksPregnant ?? ""}
              onChange={e => onChange({ weeksPregnant: Number(e.target.value) })}
              placeholder="e.g. 14"
            />
          </div>

          <div className="mb-3">
            <label className="block text-xs text-gray-600 mb-1">Estimated due date</label>
            <input
              type="date"
              className={inputCls}
              value={settings.estimatedDueDate ?? ""}
              onChange={e => onChange({ estimatedDueDate: e.target.value })}
            />
          </div>

          {/* GDM flag */}
          <div className="mb-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.gdm}
                onChange={e => onChange({ gdm: e.target.checked })}
                className="rounded text-teal-600"
              />
              <span className="text-xs text-gray-700">
                Gestational diabetes (GDM) diagnosed
              </span>
            </label>
            {settings.gdm && (
              <p className="text-[11px] text-amber-700 mt-1.5 bg-amber-50 border border-amber-200 rounded p-2">
                GDM mode: carbohydrate targets are reduced. Please follow your dietitian's specific carb budget.
              </p>
            )}
          </div>

          {/* Postpartum delivery date */}
          {mode === "postpartum" && (
            <div className="mb-3">
              <label className="block text-xs text-gray-600 mb-1">Delivery date</label>
              <input
                type="date"
                className={inputCls}
                value={settings.deliveryDate ?? ""}
                onChange={e => onChange({ deliveryDate: e.target.value })}
              />
            </div>
          )}
        </>
      )}

      {/* Trimester navigation helpers */}
      {isPregnancyMode(mode) && (
        <div className="mt-3 pt-3 border-t border-rose-200">
          <div className="text-[10px] font-bold text-rose-600 uppercase tracking-widest mb-1.5">
            Change trimester
          </div>
          <p className="text-[11px] text-gray-500 mb-2">
            The app doesn't advance trimesters automatically — update this as your pregnancy progresses.
          </p>
          <div className="flex gap-2">
            {(["pregnancy_t1","pregnancy_t2","pregnancy_t3"] as GoalMode[]).map(t => (
              <div key={t} className={`flex-1 text-center text-[11px] font-bold py-1.5 rounded-lg border
                ${mode === t ? "bg-rose-600 text-white border-rose-600" : "bg-white text-gray-500 border-gray-200"}`}>
                {t === "pregnancy_t1" ? "T1" : t === "pregnancy_t2" ? "T2" : "T3"}
                <div className="font-normal text-[9px]">
                  {t === "pregnancy_t1" ? "Wks 1–12" : t === "pregnancy_t2" ? "Wks 13–26" : "Wks 27–40"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
