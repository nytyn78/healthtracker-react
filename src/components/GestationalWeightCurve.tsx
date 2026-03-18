/**
 * GestationalWeightCurve.tsx — Session 12
 * Shows gestational weight gain reference band on top of the weight sparkline.
 * Context-only — not a pass/fail. Flagging logic for sustained trends above/below
 * is handled separately via the nudge engine.
 */

import { HistoryRow } from "../store/useHealthStore"
import {
  PregnancySettings, getGestationalGainRange, GoalMode, isPregnancyMode,
} from "../services/goalModeConfig"

interface Props {
  mode: GoalMode
  settings: PregnancySettings
  history: HistoryRow[]   // newest first
}

interface GainFlagResult {
  type: "above" | "below" | "sudden_jump" | null
  message: string
}

// ── Flagging Logic ────────────────────────────────────────────────────────────

export function checkGestationalFlags(
  history: HistoryRow[],
  settings: PregnancySettings,
): GainFlagResult {
  if (!settings.prePregnancyWeightKg) return { type: null, message: "" }

  const range = getGestationalGainRange(settings.prePregnancyBMI || 25)
  const withWeight = history.filter(h => h.weight !== null).slice(0, 21) // 3 weeks

  if (withWeight.length < 7) return { type: null, message: "" }

  // Group by week and compute average weight per week
  const byWeek: number[][] = [[], [], []]
  withWeight.forEach((h, i) => {
    const weekIdx = Math.floor(i / 7)
    if (weekIdx < 3) byWeek[weekIdx].push(h.weight!)
  })
  const weekAvgs = byWeek.map(w => w.length ? w.reduce((a, b) => a + b, 0) / w.length : null)

  // Check sudden jump (single week > 1.5 kg)
  if (weekAvgs[0] !== null && weekAvgs[1] !== null) {
    const weeklyChange = weekAvgs[1] - weekAvgs[0]
    if (weeklyChange > 1.5) {
      return {
        type: "sudden_jump",
        message: "A large weight increase this week could be related to water retention. Keep an eye on it and mention it to your doctor if it continues or you notice swelling in hands or feet.",
      }
    }
  }

  // Check 3-week sustained trend above/below range
  if (weekAvgs[0] !== null && weekAvgs[2] !== null) {
    const gainPerWeek = (weekAvgs[0] - weekAvgs[2]) / 2
    if (gainPerWeek > range.weeklyHigh) {
      return {
        type: "above",
        message: "Your weight gain is tracking above the recommended range. This is worth mentioning to your doctor or midwife at your next visit.",
      }
    }
    if (gainPerWeek < range.weeklyLow) {
      return {
        type: "below",
        message: "Your weight gain is tracking below the recommended range. Please discuss this with your doctor or midwife.",
      }
    }
  }

  return { type: null, message: "" }
}

// ── Gain Curve Chart ──────────────────────────────────────────────────────────

export default function GestationalWeightCurve({ mode, settings, history }: Props) {
  if (!isPregnancyMode(mode)) return null
  if (!settings.prePregnancyWeightKg) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 mb-3 text-xs text-rose-700 text-center">
        Enter your pre-pregnancy weight in Settings → Goal Mode to see your gestational gain curve.
      </div>
    )
  }

  const range = getGestationalGainRange(settings.prePregnancyBMI || 25)
  const baseWeight = settings.prePregnancyWeightKg
  const weeks = settings.weeksPregnant ?? 1

  // Build guideline band data points (T1: flat, T2/T3: weekly gain)
  const totalWeeks = 40
  const bandPoints: { week: number; low: number; high: number }[] = []
  for (let w = 0; w <= totalWeeks; w++) {
    const gain = w <= 12
      ? range.totalLow * (w / 40)   // distribute T1 gain linearly (small)
      : range.totalLow + (range.weeklyLow * (w - 12))
    const gainHigh = w <= 12
      ? range.totalHigh * (w / 40)
      : range.totalHigh + (range.weeklyHigh * (w - 12))
    bandPoints.push({ week: w, low: baseWeight + gain, high: baseWeight + gainHigh })
  }

  // Weight data from history, mapped to gestational week
  const weightEntries = history
    .filter(h => h.weight !== null)
    .slice(0, 60)
    .reverse()
    .map((h, i) => ({
      weekOffset: i / 7,
      weight: h.weight!,
      date: h.date,
    }))

  // SVG geometry
  const W = 320, H = 120, PAD = 14
  const maxWeek = totalWeeks
  const allWeights = [
    ...bandPoints.map(p => p.low),
    ...bandPoints.map(p => p.high),
    ...weightEntries.map(e => e.weight),
  ]
  const minW = Math.min(...allWeights) - 1
  const maxW = Math.max(...allWeights) + 1

  const toX = (week: number) => PAD + (week / maxWeek) * (W - PAD * 2)
  const toY = (w: number) => PAD + ((maxW - w) / (maxW - minW)) * (H - PAD * 2)

  // Build SVG band paths
  const lowPath  = bandPoints.map((p, i) => `${i === 0 ? "M" : "L"}${toX(p.week).toFixed(1)},${toY(p.low).toFixed(1)}`).join(" ")
  const highPath = bandPoints.map((p, i) => `${i === 0 ? "M" : "L"}${toX(p.week).toFixed(1)},${toY(p.high).toFixed(1)}`).join(" ")
  const bandFill = [
    ...bandPoints.map(p => `${toX(p.week).toFixed(1)},${toY(p.high).toFixed(1)}`),
    ...bandPoints.slice().reverse().map(p => `${toX(p.week).toFixed(1)},${toY(p.low).toFixed(1)}`),
  ].join(" ")

  // Current week marker
  const currentX = toX(weeks)

  // Flag check
  const flag = checkGestationalFlags(history, settings)

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-800">🤰 Gestational weight gain</h3>
        <span className="text-xs text-gray-400">{range.bmiCategory} BMI range</span>
      </div>

      <p className="text-[10px] text-gray-400 mb-3 leading-snug">
        Shaded band shows the recommended gain range for your pre-pregnancy BMI (WHO/ACOG guidelines).
        This is context — not a pass/fail target.
      </p>

      <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full overflow-visible">
        {/* Guide band fill */}
        <polygon points={bandFill} fill="#fce7f3" opacity="0.6" />

        {/* Band boundaries */}
        <path d={lowPath}  fill="none" stroke="#f9a8d4" strokeWidth="1.5" strokeDasharray="4 2" />
        <path d={highPath} fill="none" stroke="#f9a8d4" strokeWidth="1.5" strokeDasharray="4 2" />

        {/* Actual weight line */}
        {weightEntries.length >= 2 && (() => {
          const path = weightEntries
            .map((e, i) => `${i === 0 ? "M" : "L"}${toX(weeks - (weightEntries.length - 1 - i) / 7).toFixed(1)},${toY(e.weight).toFixed(1)}`)
            .join(" ")
          return <path d={path} fill="none" stroke="#14b8a6" strokeWidth="2" strokeLinecap="round" />
        })()}

        {/* Current week marker */}
        <line x1={currentX} y1={PAD} x2={currentX} y2={H - PAD} stroke="#6b7280" strokeWidth="1" strokeDasharray="3 2" />
        <text x={currentX} y={H + 14} textAnchor="middle" fontSize="8" fill="#6b7280">Wk {weeks}</text>

        {/* X axis labels */}
        {[0, 12, 26, 40].map(w => (
          <text key={w} x={toX(w)} y={H + 14} textAnchor="middle" fontSize="7" fill="#d1d5db">
            {w === 0 ? "Start" : `${w}w`}
          </text>
        ))}

        {/* Legend */}
        <rect x={PAD} y={H - 2} width="8" height="4" fill="#f9a8d4" rx="1" />
        <text x={PAD + 10} y={H + 2} fontSize="7" fill="#9ca3af">Guideline band</text>
        <rect x={PAD + 70} y={H - 2} width="8" height="4" fill="#14b8a6" rx="1" />
        <text x={PAD + 80} y={H + 2} fontSize="7" fill="#9ca3af">Your weight</text>
      </svg>

      {/* Range summary */}
      <div className="grid grid-cols-3 gap-2 mt-2">
        <div className="text-center bg-rose-50 rounded-lg p-2">
          <div className="text-xs font-bold text-rose-700">{range.totalLow}–{range.totalHigh} kg</div>
          <div className="text-[9px] text-gray-400">Total gain</div>
        </div>
        <div className="text-center bg-rose-50 rounded-lg p-2">
          <div className="text-xs font-bold text-rose-700">{range.weeklyLow}–{range.weeklyHigh} kg/wk</div>
          <div className="text-[9px] text-gray-400">T2/T3 rate</div>
        </div>
        <div className="text-center bg-rose-50 rounded-lg p-2">
          <div className="text-xs font-bold text-rose-700">Wk {weeks}</div>
          <div className="text-[9px] text-gray-400">Currently</div>
        </div>
      </div>

      {/* Flag card — appears once, informational only */}
      {flag.type && (
        <div className={`mt-3 p-3 rounded-xl border text-xs leading-snug
          ${flag.type === "sudden_jump"
            ? "bg-amber-50 border-amber-200 text-amber-800"
            : "bg-blue-50 border-blue-200 text-blue-800"}`}
        >
          <div className="font-semibold mb-0.5">
            {flag.type === "above"       ? "📈 Tracking above range"
            : flag.type === "below"     ? "📉 Tracking below range"
            :                             "⚠️ Large weekly change"}
          </div>
          {flag.message}
        </div>
      )}
    </div>
  )
}
