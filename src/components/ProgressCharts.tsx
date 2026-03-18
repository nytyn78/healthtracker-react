import { useState, useEffect } from "react"
import { useHealthStore, loadHistory, HistoryRow } from "../store/useHealthStore"
import { computeAdaptiveTDEE } from "../services/adaptiveTDEE"
import { computeMacros } from "../services/adaptiveTDEE"
import { detectPlateau } from "../services/plateauDetection"
import { detectAdaptation, AdaptationProfile } from "../services/metabolicAdaptation"
import { computeNudges } from "../services/nudgeEngine"
import { getISTDate } from "../utils/dateHelpers"
import { GoalMode, getFlags, isMaternalMode, loadGoalMode, loadPregnancySettings } from "../services/goalModeConfig"
import GestationalWeightCurve from "./GestationalWeightCurve"

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ data, color, goalY, height = 70 }: {
  data: { x: number; y: number; label: string; date: string }[]
  color: string; goalY?: number; height?: number
}) {
  if (data.length < 2) return <div className="text-xs text-gray-400 text-center py-4">Not enough data yet</div>
  const W = 320, H = height, PAD = 12
  const ys = data.map(d => d.y)
  const minY = Math.min(...ys) - 0.5, maxY = Math.max(...ys) + 0.5
  const toX = (i: number) => PAD + (i / Math.max(data.length - 1, 1)) * (W - PAD * 2)
  const toY = (y: number) => PAD + ((maxY - y) / (maxY - minY)) * (H - PAD * 2)
  const path = data.map((d, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(d.y).toFixed(1)}`).join(" ")
  const goalSy = goalY !== undefined ? toY(goalY) : null

  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full overflow-visible">
      {goalSy !== null && goalSy > 0 && goalSy < H && (
        <line x1={PAD} y1={goalSy} x2={W - PAD} y2={goalSy} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 3" />
      )}
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={toX(i)} cy={toY(d.y)} r="3" fill={color} />
          {(i === 0 || i === data.length - 1 || i % Math.ceil(data.length / 6) === 0) && (
            <>
              <text x={toX(i)} y={toY(d.y) - 6} textAnchor="middle" fontSize="8" fill="#6b7280">{d.label}</text>
              <text x={toX(i)} y={H + 14} textAnchor="middle" fontSize="7" fill="#9ca3af">{d.date}</text>
            </>
          )}
        </g>
      ))}
    </svg>
  )
}

// ── Bar Chart ─────────────────────────────────────────────────────────────────
function BarChart({ data, target, color, unit }: {
  data: { date: string; value: number }[]
  target: number; color: string; unit: string
}) {
  const max = Math.max(...data.map(d => d.value), target)
  return (
    <div className="flex gap-1 items-end h-16">
      {data.map((d, i) => {
        const pct = Math.min(d.value / max * 100, 100)
        const onTarget = d.value >= target * 0.9 && d.value <= target * 1.15
        const over = d.value > target * 1.15
        const barColor = over ? "#ef4444" : onTarget ? "#4ade80" : color
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
            <div className="w-full rounded-t-sm transition-all" style={{ height: `${Math.max(pct, 3)}%`, background: barColor }} />
            <div className="text-[7px] text-gray-400">{d.date.slice(5)}</div>
          </div>
        )
      })}
      {/* Target line visual indication */}
    </div>
  )
}

// ── Nudge Card ────────────────────────────────────────────────────────────────
const nudgeColors = {
  teal:  "bg-teal-50 border-teal-200 text-teal-800",
  amber: "bg-amber-50 border-amber-200 text-amber-800",
  red:   "bg-red-50 border-red-200 text-red-800",
  blue:  "bg-blue-50 border-blue-200 text-blue-800",
  green: "bg-green-50 border-green-200 text-green-800",
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ProgressCharts({ goalMode: propGoalMode }: { goalMode?: GoalMode }) {
  const { profile, goals, settings } = useHealthStore()
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [activeSection, setActiveSection] = useState<"overview" | "nutrition" | "analytics">("overview")
  const goalMode = propGoalMode ?? loadGoalMode()
  const flags = getFlags(goalMode)
  const isMaternal = isMaternalMode(goalMode)
  const pregSettings = loadPregnancySettings()

  useEffect(() => {
    setHistory(loadHistory())
  }, [])

  const macros = computeMacros(profile, goals, settings)
  const calTarget     = macros?.targetCalories ?? 1350
  const proteinTarget = macros?.proteinG ?? 110
  const carbTarget    = macros?.carbsG ?? 22
  const goalWeight    = Number(goals.targetWeightKg) || 80
  const fastingTarget = settings.ifProtocol.fastingHours

  // Analytics engines
  const tdeeResult = computeAdaptiveTDEE(history.map(h => ({
    date: h.date, cal: h.cal, weight: h.weight
  })))

  const plateauResult = detectPlateau(
    history.map(h => ({ date: h.date, weight: h.weight, cal: h.cal, carbs: h.carbs, workoutDone: h.workoutDone })),
    calTarget
  )

  const adaptationProfile: AdaptationProfile = {
    age: Number(profile.age) || 40,
    heightCm: Number(profile.heightCm) || 170,
    weightKg: history.find(h => h.weight !== null)?.weight ?? Number(profile.weightKg) ?? 80,
    isMale: profile.sex === "male",
    activityLevel: profile.activityLevel === "sedentary" ? "sedentary"
      : profile.activityLevel === "lightly_active" ? "light"
      : profile.activityLevel === "moderately_active" ? "moderate"
      : "active",
  }

  const adaptationResult = detectAdaptation(
    history.map(h => ({ date: h.date, cal: h.cal, weight: h.weight })),
    adaptationProfile
  )

  const nudges = computeNudges({
    history,
    calTarget, proteinTarget, carbTarget,
    waterTarget: 2.5,
    fastingTarget,
    weightGoal: goalWeight,
    goalMode,
  })

  // Chart data
  const weightPoints = history.filter(h => h.weight !== null).slice(0, 30).reverse()
    .map((h, i) => ({ x: i, y: h.weight!, label: String(h.weight), date: h.date }))

  const last14cal = history.slice(0, 14).reverse()
    .map(h => ({ date: h.date, value: h.cal }))

  const last14protein = history.slice(0, 14).reverse()
    .map(h => ({ date: h.date, value: h.protein }))

  const last14carbs = history.slice(0, 14).reverse()
    .map(h => ({ date: h.date, value: h.carbs }))

  const PLATEAU_ADVICE: Record<string, string> = {
    calorie_audit:   "🔍 Average intake seems very low. Are you logging everything? Oils, ghee and dairy add calories quickly.",
    refeed_day:      "🔄 You've been compliant but weight has stalled. A planned refeed day (higher carbs, maintenance calories) can reset leptin and break the plateau.",
    diet_break:      `🛑 Over 3 weeks without progress. A 7–14 day diet break at ~${tdeeResult.tdee ?? "maintenance"} kcal can restore hormones before resuming deficit.`,
    reduce_carbs:    "🌾 Carbs may have crept up. Try strict low-carb (≤20g) for 5 days to drop water retention and restart loss.",
    add_cardio:      "🚶 No workouts logged recently. A daily 30-minute fasted walk improves insulin sensitivity and fat oxidation.",
    increase_protein:"🥩 Protein intake appears low. Hitting your protein target helps preserve muscle and improves satiety during a stall.",
  }

  return (
    <div className="p-3 pb-24">

      {/* Header */}
      <div className="bg-gradient-to-br from-gray-900 to-teal-800 rounded-2xl p-4 mb-3 text-white">
        <div className="text-xs opacity-70 mb-0.5">Analytics</div>
        <div className="text-base font-bold">Progress & Insights</div>
        <div className="text-xs opacity-60 mt-0.5">{history.length} days tracked</div>
      </div>

      {/* Section tabs */}
      <div className="flex bg-white rounded-xl shadow-sm p-1 mb-3 gap-1">
        {(["overview","nutrition","analytics"] as const).map(s => (
          <button key={s} onClick={() => setActiveSection(s)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors
              ${activeSection === s ? "bg-teal-600 text-white" : "text-gray-500"}`}>
            {s}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {activeSection === "overview" && (
        <div>
          {/* Gestational weight gain curve — pregnancy modes only */}
          {flags.showWeightGainCurve && (
            <GestationalWeightCurve
              mode={goalMode}
              settings={pregSettings}
              history={history}
            />
          )}

          {/* Nudges */}
          {nudges.length > 0 && (
            <div className="mb-3">
              <div className="text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">💡 This Week's Insights</div>
              {nudges.slice(0, 3).map(n => (
                <div key={n.id} className={`rounded-xl border p-3 mb-2 text-xs leading-relaxed ${nudgeColors[n.color]}`}>
                  {n.icon} {n.message}
                </div>
              ))}
            </div>
          )}

          {/* Weight trend */}
          <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
            <div className="text-sm font-bold text-gray-800 mb-1">📈 Weight Trend</div>
            <div className="text-xs text-gray-400 mb-3">Last {weightPoints.length} entries · dashed = goal</div>
            {weightPoints.length >= 2
              ? <Sparkline data={weightPoints} color="#0d9488" goalY={goalWeight} />
              : <div className="text-xs text-gray-400 text-center py-4">Log weight daily to see trend</div>
            }
          </div>

          {/* Stats grid */}
          {history.length >= 7 && (
            <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
              <div className="text-sm font-bold text-gray-800 mb-3">📊 7-Day Averages</div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Calories",  val: Math.round(history.slice(0,7).reduce((a,h)=>a+h.cal,0)/7),    target: calTarget,     unit: "kcal", color: "text-teal-700" },
                  { label: "Protein",   val: Math.round(history.slice(0,7).reduce((a,h)=>a+h.protein,0)/7), target: proteinTarget, unit: "g",    color: "text-blue-700" },
                  { label: "Carbs",     val: Math.round(history.slice(0,7).reduce((a,h)=>a+h.carbs,0)/7),   target: carbTarget,    unit: "g",    color: "text-green-700" },
                  { label: "Water",     val: +(history.slice(0,7).reduce((a,h)=>a+(h.water||0),0)/7).toFixed(1), target: 2.5, unit: "L", color: "text-blue-500" },
                ].map(({ label, val, target, unit, color }) => {
                  const pct = Math.round(val / target * 100)
                  const ok = pct >= 85 && pct <= 115
                  return (
                    <div key={label} className={`rounded-xl p-3 ${ok ? "bg-green-50" : pct > 115 ? "bg-red-50" : "bg-amber-50"}`}>
                      <div className="text-[10px] text-gray-500 mb-0.5">{label}</div>
                      <div className={`text-lg font-bold ${color}`}>{val} <span className="text-xs font-normal">{unit}</span></div>
                      <div className={`text-[10px] ${ok ? "text-green-600" : pct > 115 ? "text-red-500" : "text-amber-600"}`}>
                        {pct}% of target {ok ? "✓" : pct > 115 ? "↑" : "↓"}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── NUTRITION ── */}
      {activeSection === "nutrition" && (
        <div>
          <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
            <div className="text-sm font-bold text-gray-800 mb-3">🔥 Calories — Last 14 Days</div>
            <div className="text-xs text-gray-400 mb-2">Green = on target · Red = over · Blue = under</div>
            {last14cal.length >= 3
              ? <BarChart data={last14cal} target={calTarget} color="#60a5fa" unit="kcal" />
              : <div className="text-xs text-gray-400 text-center py-4">Log food for 3+ days to see chart</div>}
            <div className="flex justify-between text-[10px] text-gray-400 mt-2">
              <span>Target: {calTarget} kcal</span>
              <span>Avg: {last14cal.length ? Math.round(last14cal.reduce((a,d)=>a+d.value,0)/last14cal.length) : "—"} kcal</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
            <div className="text-sm font-bold text-gray-800 mb-3">🥩 Protein — Last 14 Days</div>
            {last14protein.length >= 3
              ? <BarChart data={last14protein} target={proteinTarget} color="#60a5fa" unit="g" />
              : <div className="text-xs text-gray-400 text-center py-4">Not enough data yet</div>}
            <div className="flex justify-between text-[10px] text-gray-400 mt-2">
              <span>Target: {proteinTarget}g</span>
              <span>Avg: {last14protein.length ? Math.round(last14protein.reduce((a,d)=>a+d.value,0)/last14protein.length) : "—"}g</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
            <div className="text-sm font-bold text-gray-800 mb-3">🌾 Carbs — Last 14 Days</div>
            {last14carbs.length >= 3
              ? <BarChart data={last14carbs} target={carbTarget} color="#34d399" unit="g" />
              : <div className="text-xs text-gray-400 text-center py-4">Not enough data yet</div>}
            <div className="flex justify-between text-[10px] text-gray-400 mt-2">
              <span>Target: {carbTarget}g</span>
              <span>Avg: {last14carbs.length ? Math.round(last14carbs.reduce((a,d)=>a+d.value,0)/last14carbs.length) : "—"}g</span>
            </div>
          </div>
        </div>
      )}

      {/* ── ANALYTICS ── */}
      {activeSection === "analytics" && (
        <div>
          {/* Adaptive TDEE */}
          <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
            <div className="flex justify-between items-start mb-3">
              <div className="text-sm font-bold text-gray-800">🧠 Adaptive TDEE</div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold
                ${tdeeResult.confidence === "high" ? "bg-green-100 text-green-700"
                  : tdeeResult.confidence === "medium" ? "bg-amber-100 text-amber-700"
                  : tdeeResult.confidence === "low" ? "bg-orange-100 text-orange-700"
                  : "bg-gray-100 text-gray-500"}`}>
                {tdeeResult.confidence === "none" ? "Not enough data"
                  : tdeeResult.confidence === "low" ? "🔴 Early estimate"
                  : tdeeResult.confidence === "medium" ? "🟡 Building"
                  : "🟢 Reliable"} · {tdeeResult.daysUsed} days
              </span>
            </div>
            {tdeeResult.tdee ? (
              <div>
                <div className="text-3xl font-bold text-purple-700 mb-1">{tdeeResult.tdee} <span className="text-sm font-normal text-gray-500">kcal/day</span></div>
                <div className="text-xs text-gray-500 mb-3">{tdeeResult.message}</div>
                {tdeeResult.slopeKgPerWeek !== null && (
                  <div className="text-xs text-gray-500 mb-3">
                    Weight trend: <span className="font-bold">{tdeeResult.slopeKgPerWeek! <= 0 ? "" : "+"}{tdeeResult.slopeKgPerWeek} kg/week</span>
                    {" · "}Avg intake: <span className="font-bold">{tdeeResult.avgCalories} kcal/day</span>
                  </div>
                )}
                {tdeeResult.confidence !== "none" && tdeeResult.confidence !== "low" && !isMaternal && (
                  <div className="bg-purple-50 rounded-xl p-3 text-xs text-purple-800">
                    To lose 0.5 kg/week → eat <span className="font-bold">{Math.round(tdeeResult.tdee! - 550)} kcal/day</span><br/>
                    To lose 1 kg/week → eat <span className="font-bold">{Math.round(tdeeResult.tdee! - 1100)} kcal/day</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-gray-400">
                {tdeeResult.daysUsed < 5
                  ? `Log weight + food for ${5 - tdeeResult.daysUsed} more day${5 - tdeeResult.daysUsed !== 1 ? "s" : ""} to see adaptive TDEE`
                  : tdeeResult.message}
              </div>
            )}
          </div>

          {/* Plateau Advisor — suppressed in pregnancy/postpartum/breastfeeding */}
          {!isMaternal && (plateauResult.isInPlateau || plateauResult.plateauDays >= 5) && plateauResult.recommendation !== "none" && (
            <div className={`bg-white rounded-2xl shadow-sm p-4 mb-3 border-l-4
              ${plateauResult.plateauDays >= 21 ? "border-red-500"
                : plateauResult.plateauDays >= 10 ? "border-orange-500"
                : "border-amber-400"}`}>
              <div className="text-sm font-bold text-gray-800 mb-2">⚠️ Plateau Detected — {plateauResult.plateauDays} days</div>
              {plateauResult.avgWeightLast7 !== null && plateauResult.avgWeightPrev7 !== null && (
                <div className="text-xs text-gray-500 mb-2 space-y-0.5">
                  <div>Last 7 days avg: <span className="font-bold">{plateauResult.avgWeightLast7} kg</span></div>
                  <div>Prev 7 days avg: <span className="font-bold">{plateauResult.avgWeightPrev7} kg</span></div>
                  {plateauResult.weightDeltaKg !== null && (
                    <div>Change: <span className="font-bold">{plateauResult.weightDeltaKg >= 0 ? "↓" : "↑"} {Math.abs(plateauResult.weightDeltaKg)} kg</span></div>
                  )}
                </div>
              )}
              <div className="text-xs text-gray-500 mb-3">
                Calorie compliance: {plateauResult.calCompliantDays}/14 days on target
                {plateauResult.avgCalLast14 !== null && <span className="ml-2">· Avg: {plateauResult.avgCalLast14} kcal/day</span>}
              </div>
              {PLATEAU_ADVICE[plateauResult.recommendation] && (
                <div className="bg-amber-50 rounded-xl p-3 text-xs text-gray-700">
                  {PLATEAU_ADVICE[plateauResult.recommendation]}
                </div>
              )}
            </div>
          )}

          {/* Metabolic Adaptation — suppressed in pregnancy/postpartum/breastfeeding */}
          {!isMaternal && adaptationResult.tdeeConfidence !== "none" && (
            <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
              <div className="flex justify-between items-start mb-3">
                <div className="text-sm font-bold text-gray-800">🧬 Metabolic Adaptation</div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold text-white
                  ${adaptationResult.severity === "none" ? "bg-green-500"
                    : adaptationResult.severity === "mild" ? "bg-yellow-400"
                    : adaptationResult.severity === "moderate" ? "bg-orange-500"
                    : "bg-red-500"}`}>
                  {adaptationResult.severity === "none" ? "Adapting Normally"
                    : adaptationResult.severity === "mild" ? "Mild Adaptation"
                    : adaptationResult.severity === "moderate" ? "Moderate Adaptation"
                    : "Significant Adaptation"}
                </span>
              </div>

              <div className="flex justify-between mb-3">
                <div className="text-center">
                  <div className="text-[10px] text-gray-400 mb-1">Predicted TDEE</div>
                  <div className="text-lg font-bold text-gray-600">{adaptationResult.predictedTDEE ?? "—"}</div>
                  <div className="text-[10px] text-gray-400">kcal</div>
                </div>
                <div className="text-2xl text-gray-200 self-center">→</div>
                <div className="text-center">
                  <div className="text-[10px] text-gray-400 mb-1">Observed TDEE</div>
                  <div className={`text-lg font-bold
                    ${!adaptationResult.adaptationGap || adaptationResult.adaptationGap < 150 ? "text-green-600"
                      : adaptationResult.adaptationGap < 300 ? "text-amber-500" : "text-red-500"}`}>
                    {adaptationResult.observedTDEE ?? "—"}
                  </div>
                  <div className="text-[10px] text-gray-400">kcal</div>
                </div>
              </div>

              {adaptationResult.isAdapted && adaptationResult.adaptationGap && (
                <div className={`text-xs font-medium mb-2
                  ${adaptationResult.severity === "severe" ? "text-red-600"
                    : adaptationResult.severity === "moderate" ? "text-orange-500" : "text-amber-500"}`}>
                  ↓ {adaptationResult.adaptationGap} kcal suppression ({adaptationResult.adaptationPercent}% below predicted)
                </div>
              )}

              <div className="text-xs text-gray-500 mb-3">{adaptationResult.message}</div>

              {(adaptationResult.severity === "moderate" || adaptationResult.severity === "severe") && (
                <div className="bg-amber-50 rounded-xl p-3 text-xs text-gray-700">
                  {adaptationResult.severity === "moderate"
                    ? `💡 Your metabolism has adapted to the deficit. A 7–14 day diet break at ~${adaptationResult.predictedTDEE} kcal will help restore metabolic rate before resuming fat loss.`
                    : `💡 Consider a structured reverse diet: increase calories by 50–100 kcal per week over 4–6 weeks until reaching ~${adaptationResult.predictedTDEE} kcal, then restart deficit.`}
                </div>
              )}
            </div>
          )}

          {/* All nudges */}
          {nudges.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
              <div className="text-sm font-bold text-gray-800 mb-3">💡 All Insights</div>
              {nudges.map(n => (
                <div key={n.id} className={`rounded-xl border p-3 mb-2 text-xs leading-relaxed ${nudgeColors[n.color]}`}>
                  {n.icon} {n.message}
                </div>
              ))}
            </div>
          )}

          {history.length < 7 && (
            <div className="bg-gray-50 rounded-2xl p-6 text-center text-gray-400">
              <div className="text-3xl mb-3">📊</div>
              <div className="text-sm font-medium text-gray-500 mb-1">Keep logging</div>
              <div className="text-xs">Analytics unlock after 7 days of data. {Math.max(0, 7 - history.length)} more days to go.</div>
            </div>
          )}
        </div>
      )}

    </div>
  )
}
