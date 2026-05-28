// ── MealSwapPicker.tsx ────────────────────────────────────────────────────────
// Bottom-sheet picker for swap-as-substitution (commit 13).
//
// Shows the OTHER days' meals that occupy the same slot (from getSwapCandidates),
// filtered to the user's diet tag. Picking one calls onPick; the parent writes
// the override via saveSwap and re-renders. Styling matches the app idiom
// (white cards, rounded-2xl, teal accents) rather than introducing a new look.

import type { MealPlanEntry } from "../store/useHealthStore"

export default function MealSwapPicker({
  open,
  slotLabel,
  candidates,
  onPick,
  onClose,
}: {
  open:       boolean
  slotLabel:  string                 // e.g. "Meal 1 · 1:00 PM"
  candidates: MealPlanEntry[]
  onPick:     (meal: MealPlanEntry) => void
  onClose:    () => void
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-t-2xl p-4 max-h-[75vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-bold text-gray-900">Swap meal</div>
            <div className="text-[11px] text-gray-500">{slotLabel}</div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 text-xl leading-none px-2"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {candidates.length === 0 ? (
          <p className="text-xs text-gray-500 py-6 text-center">
            No other meals available for this slot. Swap pulls from your other
            days' plan — generate a fuller plan to get more options.
          </p>
        ) : (
          <div className="space-y-2">
            {candidates.map((meal, i) => (
              <button
                key={`${meal.name}-${i}`}
                onClick={() => onPick(meal)}
                className="w-full text-left border border-gray-200 rounded-xl p-3 bg-white hover:bg-gray-50 active:bg-gray-100"
              >
                <div className="text-sm font-semibold text-gray-900 leading-tight">
                  {meal.name}
                </div>
                <div className="text-[11px] text-gray-600 mt-1">
                  {Math.round(meal.protein)}P · {Math.round(meal.carbs)}C ·{" "}
                  {Math.round(meal.fat)}F · {Math.round(meal.cal)} kcal
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
