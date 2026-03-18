import { useState } from "react"
import { getSetupCompleteness } from "../store/useHealthStore"

type Props = { onNavigate: (tab: string) => void }

export default function SetupChip({ onNavigate }: Props) {
  const [open, setOpen] = useState(false)
  const { items, pct, level } = getSetupCompleteness()

  if (level === "green") return null  // fully set up — hide chip

  const chipColor = level === "red"
    ? "bg-red-100 text-red-700 border-red-200"
    : "bg-amber-100 text-amber-700 border-amber-200"

  return (
    <div className="mb-3">
      <button onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold ${chipColor}`}>
        ⚙️ Setup {pct}% complete {open ? "▲" : "▼"}
      </button>

      {open && (
        <div className="mt-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <div className="text-xs font-bold text-gray-700">Complete your profile</div>
            <div className="text-[10px] text-gray-400 mt-0.5">The app gets smarter the more you fill in</div>
          </div>
          {items.map(item => (
            <button key={item.id} onClick={() => { onNavigate(item.tab); setOpen(false) }}
              className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 text-left">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0
                ${item.done ? "bg-green-500" : item.priority === "required" ? "bg-red-100" : "bg-amber-100"}`}>
                {item.done
                  ? <span className="text-white text-[10px]">✓</span>
                  : <span className={`text-[10px] font-bold ${item.priority === "required" ? "text-red-500" : "text-amber-500"}`}>!</span>}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-xs font-semibold ${item.done ? "text-gray-400 line-through" : "text-gray-700"}`}>
                  {item.label}
                </div>
                <div className="text-[9px] text-gray-300 capitalize">{item.priority}</div>
              </div>
              {!item.done && <span className="text-gray-300 text-xs shrink-0">→</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
