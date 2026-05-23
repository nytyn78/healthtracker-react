// ── Meal Card ─────────────────────────────────────────────────────────────────
// Replace the existing MealCard function in src/components/MealPlanBuilder.tsx
// This version has a more prominent share button inside the expanded recipe view

function MealCard({ meal, onDelete, onShare }: {
  meal: MealPlanEntry
  onDelete: () => void
  onShare: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden mb-2 bg-white">
      {/* Header row — always visible */}
      <button onClick={() => setExpanded(e => !e)}
        className="w-full flex items-start justify-between p-3 text-left">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${TAG_COLORS[meal.tag]}`}>
              {DIET_TAG_LABELS[meal.tag]}
            </span>
            {meal.day && meal.day !== "Any day" && (
              <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{meal.day}</span>
            )}
            {meal.time && (
              <span className="text-[9px] text-gray-400">{meal.time}</span>
            )}
          </div>
          <div className="text-xs font-semibold text-gray-800 leading-tight">{meal.name}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">
            P {meal.protein}g · C {meal.carbs}g · F {meal.fat}g · {meal.cal} kcal
          </div>
        </div>
        <div className="flex items-center gap-1 ml-2 shrink-0">
          <button onClick={e => { e.stopPropagation(); onDelete() }}
            className="text-red-300 text-xs px-1.5 py-0.5 border border-red-100 rounded-lg hover:bg-red-50">✕</button>
          <span className="text-gray-400 text-xs">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {/* Expanded content — ingredients, steps, share button */}
      {expanded && (
        <div className="bg-gray-50 px-3 pb-3 border-t border-gray-100">
          {/* Ingredients */}
          {meal.ingredients.length > 0 && (
            <>
              <div className="text-[10px] font-bold text-gray-500 mt-3 mb-1.5 uppercase tracking-wide">
                🧾 Ingredients
              </div>
              <div className="bg-white rounded-lg p-2 mb-2">
                {meal.ingredients.map((ing, i) => (
                  <div key={i} className="text-[11px] text-gray-700 py-0.5 flex items-start gap-1.5">
                    <span className="text-teal-500 shrink-0">•</span>
                    <span>{ing}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Steps */}
          {meal.steps.length > 0 && (
            <>
              <div className="text-[10px] font-bold text-gray-500 mt-2 mb-1.5 uppercase tracking-wide">
                👨‍🍳 Method
              </div>
              <div className="bg-white rounded-lg p-2 mb-3">
                {meal.steps.map((s, i) => (
                  <div key={i} className="text-[11px] text-gray-700 py-1 flex items-start gap-2">
                    <span className="bg-teal-100 text-teal-700 text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{s}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Share button — prominent, at the bottom */}
          <button 
            onClick={onShare}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xs font-bold transition-colors"
          >
            <span>📲</span>
            <span>Share Recipe via WhatsApp</span>
          </button>
        </div>
      )}
    </div>
  )
}
