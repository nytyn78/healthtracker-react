/**
 * HealthConditions.tsx
 * Two views:
 *   1. Questionnaire — select pre-existing conditions by category
 *   2. Guidance panel — exercise and diet recommendations + warnings
 * Accessible from the Health tab and the Workout tab.
 */

import { useState } from "react"
import {
  CONDITIONS, CONDITION_CATEGORIES, ConditionId, ConditionCategory,
  loadSavedConditions, saveConditions, getActiveGuidance,
  ConditionGuidance,
} from "../services/healthConditions"

type View = "questionnaire" | "guidance"

interface Props {
  onClose?: () => void
  initialView?: View
}

export default function HealthConditions({ onClose, initialView = "questionnaire" }: Props) {
  const saved = loadSavedConditions()
  const [view, setView] = useState<View>(
    saved.conditions.length > 0 && saved.completedAt > 0 ? "guidance" : initialView
  )
  const [selected, setSelected] = useState<Set<ConditionId>>(new Set(saved.conditions))
  const [expandedCategory, setExpandedCategory] = useState<ConditionCategory | null>("cardiovascular")
  const [expandedGuidance, setExpandedGuidance] = useState<ConditionId | null>(null)
  const [activeTab, setActiveTab] = useState<"exercise" | "diet">("exercise")

  const categories = Object.keys(CONDITION_CATEGORIES) as ConditionCategory[]

  function toggleCondition(id: ConditionId) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function saveAndShowGuidance() {
    saveConditions({ conditions: Array.from(selected), completedAt: Date.now(), dismissed: false })
    setView("guidance")
  }

  function clearAll() {
    setSelected(new Set())
    saveConditions({ conditions: [], completedAt: Date.now(), dismissed: false })
    setView("questionnaire")
  }

  const guidance = getActiveGuidance(Array.from(selected))
  const highSeverity = guidance.filter(g => g.severity === "high")
  const hasClearanceNeeded = guidance.some(g => g.exerciseGuidance.clearanceNeeded)

  // ── QUESTIONNAIRE VIEW ───────────────────────────────────────────────────────
  if (view === "questionnaire") {
    return (
      <div className="p-3 pb-24">
        <div className="bg-gradient-to-br from-gray-900 to-teal-800 rounded-2xl p-4 mb-3 text-white">
          <div className="text-base font-bold">🩺 Health Conditions</div>
          <div className="text-xs opacity-70 mt-0.5">Select any pre-existing conditions for personalised exercise and diet recommendations</div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3 text-xs text-blue-800 leading-snug">
          <span className="font-bold">ℹ️ How this works: </span>
          Select conditions you have been diagnosed with. The app will show tailored exercise modifications, diet guidance and safety warnings. This does not replace your doctor's advice.
        </div>

        {selected.size > 0 && (
          <div className="bg-teal-50 border border-teal-200 rounded-xl px-3 py-2 mb-3 flex items-center justify-between">
            <span className="text-xs text-teal-700 font-semibold">{selected.size} condition{selected.size !== 1 ? "s" : ""} selected</span>
            <button onClick={clearAll} className="text-[10px] text-gray-400 underline">Clear all</button>
          </div>
        )}

        {categories.map(cat => {
          const catConditions = CONDITIONS.filter(c => c.category === cat)
          const catSelected = catConditions.filter(c => selected.has(c.id)).length
          const expanded = expandedCategory === cat

          return (
            <div key={cat} className="mb-2">
              <button
                onClick={() => setExpandedCategory(expanded ? null : cat)}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-colors
                  ${catSelected > 0 ? "bg-teal-50 border-teal-200" : "bg-white border-gray-200"}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{CONDITION_CATEGORIES[cat].split(" ")[0]}</span>
                  <span className={`text-sm font-semibold ${catSelected > 0 ? "text-teal-700" : "text-gray-700"}`}>
                    {CONDITION_CATEGORIES[cat].replace(/^[^ ]+ /, "")}
                  </span>
                  {catSelected > 0 && (
                    <span className="text-[10px] bg-teal-600 text-white rounded-full px-1.5 py-0.5 font-bold">
                      {catSelected}
                    </span>
                  )}
                </div>
                <span className="text-gray-400 text-xs">{expanded ? "▲" : "▼"}</span>
              </button>

              {expanded && (
                <div className="mt-1 ml-2 border-l-2 border-gray-100 pl-3 space-y-1">
                  {catConditions.map(condition => {
                    const isSelected = selected.has(condition.id)
                    return (
                      <button
                        key={condition.id}
                        onClick={() => toggleCondition(condition.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors
                          ${isSelected ? "bg-teal-50 border-teal-400" : "bg-gray-50 border-gray-100"}`}
                      >
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0
                          ${isSelected ? "bg-teal-600 border-teal-600 text-white" : "border-gray-300"}`}>
                          {isSelected && <span className="text-xs font-bold">✓</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm ${isSelected ? "font-semibold text-teal-700" : "text-gray-700"}`}>
                            {condition.label}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        <div className="mt-4 flex gap-3">
          {onClose && (
            <button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-500 rounded-xl font-bold text-sm">
              Cancel
            </button>
          )}
          <button
            onClick={saveAndShowGuidance}
            className="flex-2 flex-grow py-3 bg-teal-600 text-white rounded-xl font-bold text-sm"
          >
            {selected.size === 0 ? "Continue with no conditions →" : `See guidance for ${selected.size} condition${selected.size !== 1 ? "s" : ""} →`}
          </button>
        </div>
      </div>
    )
  }

  // ── GUIDANCE VIEW ────────────────────────────────────────────────────────────
  return (
    <div className="p-3 pb-24">
      <div className="bg-gradient-to-br from-gray-900 to-teal-800 rounded-2xl p-4 mb-3 text-white">
        <div className="text-base font-bold">🩺 Your Health Guidance</div>
        <div className="text-xs opacity-70 mt-0.5">
          {selected.size === 0
            ? "No conditions selected — standard recommendations apply"
            : `Personalised for ${selected.size} condition${selected.size !== 1 ? "s" : ""}`}
        </div>
      </div>

      {/* Edit / add conditions */}
      <button
        onClick={() => setView("questionnaire")}
        className="w-full mb-3 py-2.5 border border-teal-500 text-teal-600 rounded-xl text-sm font-semibold"
      >
        ✏️ Edit conditions ({selected.size} selected)
      </button>

      {/* Doctor clearance banner */}
      {hasClearanceNeeded && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-3 mb-3">
          <div className="text-sm font-bold text-red-800 mb-1">⚠️ Doctor clearance recommended</div>
          <p className="text-xs text-red-700 leading-snug">
            One or more of your conditions requires clearance from your doctor before starting or changing your exercise programme. Please confirm this before using the circuit timer.
          </p>
        </div>
      )}

      {/* High severity warnings */}
      {highSeverity.map(g => (
        g.exerciseGuidance.warning ? (
          <div key={g.conditionId} className="bg-red-50 border border-red-200 rounded-xl p-3 mb-2">
            <div className="text-xs font-bold text-red-700 mb-0.5">
              {CONDITIONS.find(c => c.id === g.conditionId)?.label}
            </div>
            <div className="text-xs text-red-600 leading-snug">{g.exerciseGuidance.warning}</div>
          </div>
        ) : null
      ))}

      {/* No conditions */}
      {selected.size === 0 && (
        <div className="bg-gray-50 rounded-xl p-4 text-center text-gray-500 mb-3">
          <div className="text-2xl mb-2">✅</div>
          <div className="text-sm font-semibold mb-1">No conditions selected</div>
          <div className="text-xs">Standard exercise and diet recommendations apply. Tap "Edit conditions" to add any pre-existing health conditions.</div>
        </div>
      )}

      {/* Exercise / Diet tab switcher */}
      {selected.size > 0 && (
        <>
          <div className="flex bg-white rounded-xl shadow-sm p-1 mb-3 gap-1">
            {(["exercise", "diet"] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`flex-1 py-2 rounded-lg text-sm font-bold capitalize transition-colors
                  ${activeTab === t ? "bg-teal-600 text-white" : "text-gray-500"}`}>
                {t === "exercise" ? "💪 Exercise" : "🥗 Diet"}
              </button>
            ))}
          </div>

          {/* Per-condition guidance cards */}
          {guidance.map(g => {
            const condition = CONDITIONS.find(c => c.id === g.conditionId)!
            const isExpanded = expandedGuidance === g.conditionId
            const eg = g.exerciseGuidance
            const dg = g.dietGuidance

            return (
              <div key={g.conditionId} className="mb-3">
                <button
                  onClick={() => setExpandedGuidance(isExpanded ? null : g.conditionId)}
                  className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left
                    ${g.severity === "high" ? "bg-red-50 border-red-200"
                      : g.severity === "moderate" ? "bg-amber-50 border-amber-200"
                      : "bg-teal-50 border-teal-200"}`}
                >
                  <div className="flex items-center gap-2">
                    <span>{condition.icon}</span>
                    <div>
                      <div className={`text-sm font-bold
                        ${g.severity === "high" ? "text-red-800"
                          : g.severity === "moderate" ? "text-amber-800"
                          : "text-teal-800"}`}>
                        {condition.label}
                      </div>
                      <div className={`text-[10px] font-semibold uppercase tracking-wide
                        ${g.severity === "high" ? "text-red-500"
                          : g.severity === "moderate" ? "text-amber-500"
                          : "text-teal-500"}`}>
                        {g.severity === "high" ? "⚠️ High caution"
                          : g.severity === "moderate" ? "⚡ Moderate caution"
                          : "ℹ️ Advisory"}
                      </div>
                    </div>
                  </div>
                  <span className="text-gray-400 text-xs">{isExpanded ? "▲" : "▼"}</span>
                </button>

                {isExpanded && (
                  <div className="mt-1 ml-1 border border-gray-100 rounded-xl overflow-hidden">
                    {activeTab === "exercise" ? (
                      <div className="p-3 space-y-3">
                        {eg.warning && (
                          <div className="bg-red-50 rounded-lg p-2.5 text-xs text-red-700 font-medium leading-snug">
                            {eg.warning}
                          </div>
                        )}
                        {eg.avoid.length > 0 && (
                          <div>
                            <div className="text-[10px] font-bold text-red-600 uppercase tracking-wide mb-1.5">❌ Avoid</div>
                            {eg.avoid.map((item, i) => (
                              <div key={i} className="flex items-start gap-2 mb-1">
                                <span className="text-red-400 text-xs shrink-0 mt-0.5">•</span>
                                <span className="text-xs text-gray-700 leading-snug">{item}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {eg.preferred.length > 0 && (
                          <div>
                            <div className="text-[10px] font-bold text-green-600 uppercase tracking-wide mb-1.5">✅ Recommended</div>
                            {eg.preferred.map((item, i) => (
                              <div key={i} className="flex items-start gap-2 mb-1">
                                <span className="text-green-400 text-xs shrink-0 mt-0.5">•</span>
                                <span className="text-xs text-gray-700 leading-snug">{item}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {eg.modifications.length > 0 && (
                          <div>
                            <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wide mb-1.5">🔧 Modifications</div>
                            {eg.modifications.map((item, i) => (
                              <div key={i} className="flex items-start gap-2 mb-1">
                                <span className="text-blue-400 text-xs shrink-0 mt-0.5">•</span>
                                <span className="text-xs text-gray-700 leading-snug">{item}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-3 space-y-3">
                        {dg.warnings.map((w, i) => (
                          <div key={i} className="bg-amber-50 rounded-lg p-2.5 text-xs text-amber-700 font-medium leading-snug">
                            ⚠️ {w}
                          </div>
                        ))}
                        {dg.avoid.length > 0 && (
                          <div>
                            <div className="text-[10px] font-bold text-red-600 uppercase tracking-wide mb-1.5">❌ Avoid</div>
                            {dg.avoid.map((item, i) => (
                              <div key={i} className="flex items-start gap-2 mb-1">
                                <span className="text-red-400 text-xs shrink-0 mt-0.5">•</span>
                                <span className="text-xs text-gray-700 leading-snug">{item}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {dg.prioritise.length > 0 && (
                          <div>
                            <div className="text-[10px] font-bold text-green-600 uppercase tracking-wide mb-1.5">✅ Prioritise</div>
                            {dg.prioritise.map((item, i) => (
                              <div key={i} className="flex items-start gap-2 mb-1">
                                <span className="text-green-400 text-xs shrink-0 mt-0.5">•</span>
                                <span className="text-xs text-gray-700 leading-snug">{item}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {dg.notes && (
                          <div className="bg-blue-50 rounded-lg p-2.5">
                            <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wide mb-1">📝 Notes</div>
                            <div className="text-xs text-blue-800 leading-snug">{dg.notes}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}

      {/* Disclaimer */}
      <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-3">
        <p className="text-[10px] text-gray-500 leading-snug text-center">
          These recommendations are general guidelines based on established exercise and nutrition science.
          They do not replace personalised advice from your doctor, physiotherapist or dietitian.
          Always consult your healthcare provider before making significant changes to your exercise or diet.
        </p>
      </div>
    </div>
  )
}
