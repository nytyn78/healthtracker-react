/**
 * MicronutrientChecklist.tsx — Session 12
 * Today tab section shown in pregnancy, pre-conception and breastfeeding modes.
 * Simple yes/not-yet awareness prompts — not a clinical tracker.
 */

import { useState, useEffect } from "react"
import {
  GoalMode, MICRONUTRIENT_ITEMS, MicronutrientItem,
  loadMicronutrientLog, saveMicronutrientLog,
} from "../services/goalModeConfig"
import { getISTDate } from "../utils/dateHelpers"

interface Props {
  mode: GoalMode
}

export default function MicronutrientChecklist({ mode }: Props) {
  const today = getISTDate()
  const relevantItems = MICRONUTRIENT_ITEMS.filter(item => item.modes.includes(mode))

  const [log, setLog] = useState<Record<string, boolean>>(() => loadMicronutrientLog(today))
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (relevantItems.length === 0) return null

  function toggle(id: string) {
    const updated = { ...log, [id]: !log[id] }
    setLog(updated)
    saveMicronutrientLog(today, updated)
  }

  const doneCount = relevantItems.filter(i => log[i.id]).length
  const totalCount = relevantItems.length

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-rose-700">🌿 Key nutrients today</h3>
        <span className="text-xs text-gray-400">{doneCount}/{totalCount}</span>
      </div>

      <div className="space-y-2">
        {relevantItems.map(item => {
          const done = !!log[item.id]
          const expanded = expandedId === item.id

          return (
            <div key={item.id}>
              <div
                className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-colors
                  ${done
                    ? "bg-green-50 border-green-200"
                    : "bg-gray-50 border-gray-200 hover:border-rose-200"}`}
                onClick={() => toggle(item.id)}
              >
                <span className="text-lg w-7 text-center shrink-0">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold ${done ? "text-green-700" : "text-gray-700"}`}>
                    {item.nutrient}
                  </div>
                  <div className={`text-[11px] ${done ? "text-green-500" : "text-gray-400"}`}>
                    {item.prompt}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Info expand toggle */}
                  <button
                    onClick={e => { e.stopPropagation(); setExpandedId(expanded ? null : item.id) }}
                    className="text-gray-300 hover:text-gray-500 text-xs px-1"
                  >
                    {expanded ? "▲" : "ℹ"}
                  </button>
                  {/* Check indicator */}
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                    ${done ? "bg-green-500 text-white" : "bg-gray-200 text-gray-400"}`}>
                    {done ? "✓" : "–"}
                  </div>
                </div>
              </div>

              {/* Expanded food sources */}
              {expanded && (
                <div className="mx-2 mb-1 px-3 py-2 bg-amber-50 border border-amber-100 rounded-b-xl text-[11px] text-amber-700">
                  <span className="font-semibold">Sources: </span>{item.foods}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-[10px] text-gray-400 mt-2 text-center">
        Tap to mark done · Tap ℹ for food sources · Resets daily
      </p>
    </div>
  )
}
