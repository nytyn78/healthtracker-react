/**
 * SupplementOffer.tsx — Session 12 (fixed: always above nav bar)
 *
 * Key fix: modal uses z-[60] (above nav's z-50).
 * Sheet sits above the nav bar using mb-16 (≈64px nav height) so
 * buttons are never obscured. No pull-down behaviour — sheet is static.
 */

import { useState } from "react"
import { GoalMode, SUPPLEMENT_PRESETS, GOAL_MODE_INFO } from "../services/goalModeConfig"
import { loadMedications, saveMedications, Medication } from "../store/useHealthStore"

interface Props {
  mode: GoalMode
  onDone: () => void
}

export default function SupplementOffer({ mode, onDone }: Props) {
  const presets = SUPPLEMENT_PRESETS[mode] ?? []
  const info    = GOAL_MODE_INFO[mode]
  const [adding, setAdding] = useState(false)

  if (presets.length === 0) { onDone(); return null }

  function handleAdd() {
    setAdding(true)
    const existing = loadMedications()
    const existingNames = new Set(existing.map(m => m.name.toLowerCase()))

    const newSupps: Medication[] = presets
      .filter(p => !existingNames.has(p.name.toLowerCase()))
      .map(p => ({
        id: `supp-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
        name: p.name,
        frequency: "daily" as const,
        note: `${p.dose} · ${p.note}`,
        enabled: true,
        // @ts-ignore
        type: "supplement",
        dose: p.dose,
      }))

    saveMedications([...existing, ...newSupps])
    setAdding(false)
    onDone()
  }

  // Nav bar is ~64px + safe area. Use z-[60] to sit above nav (z-50).
  // mb-16 lifts the sheet clear of the nav bar on all devices.
  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/50">
      {/* Tap backdrop to dismiss */}
      <div className="flex-1" onClick={onDone} />

      <div
        className="bg-white rounded-t-2xl w-full max-w-lg mx-auto flex flex-col shadow-2xl mb-16"
        style={{ maxHeight: "65vh" }}
      >
        {/* Drag handle visual */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="px-5 pb-3 border-b border-gray-100 shrink-0">
          <div className="text-base font-bold text-gray-900">
            {info.icon} {info.shortLabel} supplements
          </div>
          <p className="text-xs text-gray-500 mt-1">
            We've prepared a suggested supplement list for this goal. Add them to your daily reminders — you can edit or remove any of them at any time.
          </p>
        </div>

        {/* Supplement list — scrollable middle section */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2 min-h-0">
          {presets.map((p, i) => (
            <div key={i} className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl p-3">
              <div className="text-blue-500 text-sm mt-0.5 shrink-0">🔵</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-800">{p.name}</div>
                <div className="text-[11px] text-blue-700 font-medium">{p.dose}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{p.note}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <div className="px-5 py-2 bg-gray-50 border-t border-gray-100 shrink-0">
          <p className="text-[10px] text-gray-400 leading-snug">
            General guidelines only — not personalised medical advice. Always check with your doctor before starting any supplement.
          </p>
        </div>

        {/* Action buttons — always visible */}
        <div className="px-5 py-4 flex gap-3 shrink-0">
          <button
            onClick={onDone}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold bg-white"
          >
            Skip
          </button>
          <button
            onClick={handleAdd}
            disabled={adding}
            className="flex-1 py-3 rounded-xl bg-teal-600 text-white text-sm font-bold shadow-sm"
          >
            {adding ? "Adding…" : "Add supplements"}
          </button>
        </div>
      </div>
    </div>
  )
}
