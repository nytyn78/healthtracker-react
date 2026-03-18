import { useState, useEffect, useRef, useCallback } from "react"
import {
  loadDayData, saveDayData, DayData, loadHistory, saveHistory,
  loadWorkoutPlan, WorkoutPlan, DaySchedule, ExerciseConfig, WorkoutType,
  getTodaySchedule,
} from "../store/useHealthStore"
import { getISTDate } from "../utils/dateHelpers"
import { loadGoalMode, isMaternalMode, isPregnancyMode, isGeriatricMode } from "../services/goalModeConfig"
import ExerciseEditor from "./ExerciseEditor"
import { loadSavedConditions, getActiveGuidance, CONDITIONS } from "../services/healthConditions"

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtSecs(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

function getDayName(offset = 0): string {
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]
  const d = new Date(); d.setDate(d.getDate() + offset)
  return days[d.getDay()]
}

// ── Recovery suggestion engine ────────────────────────────────────────────────
function getRecoverySuggestion(history: ReturnType<typeof loadHistory>, todaySched: DaySchedule): string | null {
  const last7 = history.slice(0, 7)
  const workoutDays = last7.filter(h => h.workoutDone).length
  const lastWorkout = last7.findIndex(h => h.workoutDone)

  if (todaySched.types.includes("rest")) return null

  if (lastWorkout === 0) {
    // Worked out yesterday
    if (todaySched.types.includes("circuit")) {
      return "💡 You trained yesterday — listen to your body. Reduce circuit intensity if feeling sore."
    }
  }
  if (lastWorkout > 2 && !todaySched.types.includes("rest")) {
    return "💡 No workout logged in " + (lastWorkout + 1) + " days — today's a great day to get back on track."
  }
  if (workoutDays >= 5) {
    return "💡 5+ workout days this week — good work. Make sure you're getting enough recovery sleep."
  }
  return null
}

// ── Circuit Timer ─────────────────────────────────────────────────────────────
type CircuitState = {
  active: boolean
  round: number
  exIdx: number
  phase: "exercise" | "rest"
  timerSecs: number
  restSecs: number
}

function CircuitTimer({ exercises, rounds, restBetweenRounds, doneExIds, onExDone, onAllDone }: {
  exercises: ExerciseConfig[]
  rounds: number
  restBetweenRounds: number
  doneExIds: string[]
  onExDone: (id: string) => void
  onAllDone: () => void
}) {
  const [circuit, setCircuit] = useState<CircuitState>({
    active: false, round: 1, exIdx: 0, phase: "exercise", timerSecs: 0, restSecs: 0
  })
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  useEffect(() => () => stopTimer(), [stopTimer])

  function startTimer(secs: number, isRest: boolean) {
    stopTimer()
    timerRef.current = setInterval(() => {
      setCircuit(prev => {
        const next = { ...prev }
        if (isRest) {
          next.restSecs = Math.max(0, prev.restSecs - 1)
          if (next.restSecs <= 0) {
            stopTimer()
            next.phase = "exercise"
            next.exIdx = 0
            next.timerSecs = exercises[0]?.isTimed ? parseInt(exercises[0].reps) : 0
          }
        } else {
          next.timerSecs = Math.max(0, prev.timerSecs - 1)
          if (next.timerSecs <= 0) { stopTimer() }
        }
        return next
      })
    }, 1000)
  }

  function start() {
    const firstEx = exercises[0]
    const timerSecs = firstEx?.isTimed ? parseInt(firstEx.reps) : 0
    setCircuit({ active: true, round: 1, exIdx: 0, phase: "exercise", timerSecs, restSecs: 0 })
    if (timerSecs > 0) startTimer(timerSecs, false)
  }

  function stop() {
    stopTimer()
    setCircuit(c => ({ ...c, active: false }))
  }

  function next() {
    stopTimer()
    const curEx = exercises[circuit.exIdx]
    if (curEx) onExDone(curEx.id)

    const nextIdx = circuit.exIdx + 1
    if (nextIdx >= exercises.length) {
      if (circuit.round >= rounds) {
        stop()
        onAllDone()
        return
      }
      // Start rest between rounds
      setCircuit(c => ({ ...c, phase: "rest", restSecs: restBetweenRounds, round: c.round + 1 }))
      startTimer(restBetweenRounds, true)
    } else {
      const nextEx = exercises[nextIdx]
      const timerSecs = nextEx?.isTimed ? parseInt(nextEx.reps) : 0
      setCircuit(c => ({ ...c, exIdx: nextIdx, phase: "exercise", timerSecs }))
      if (timerSecs > 0) startTimer(timerSecs, false)
    }
  }

  if (!circuit.active) {
    return (
      <button onClick={start}
        className="w-full py-3 rounded-xl font-bold text-sm text-white mb-3"
        style={{ background: "linear-gradient(135deg, #1f2937, #0d9488)" }}>
        ⚡ Start Circuit ({rounds} rounds)
      </button>
    )
  }

  const curEx = exercises[circuit.exIdx]
  const progress = ((circuit.round - 1) * exercises.length + circuit.exIdx) / (rounds * exercises.length) * 100

  return (
    <div className="bg-gray-900 rounded-2xl p-4 mb-3 text-white">
      {/* Progress bar */}
      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden mb-3">
        <div className="h-full bg-teal-400 rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className="flex justify-between items-center mb-3 text-xs text-gray-400">
        <span>Round {circuit.round} / {rounds}</span>
        <span>{circuit.exIdx + 1} / {exercises.length} exercises</span>
      </div>

      {circuit.phase === "rest" ? (
        <div className="text-center py-4">
          <div className="text-xs text-gray-400 mb-1">Rest between rounds</div>
          <div className="text-4xl font-bold text-amber-400 font-mono">{fmtSecs(circuit.restSecs)}</div>
          <div className="text-xs text-gray-500 mt-2">Next round starts automatically</div>
          <button onClick={next} className="mt-3 px-4 py-1.5 border border-gray-600 text-gray-400 rounded-lg text-xs">Skip rest</button>
        </div>
      ) : curEx ? (
        <div>
          <div className="text-lg font-bold mb-1">{curEx.name}</div>
          <div className="text-sm text-teal-400 mb-1">{curEx.sets} sets · {curEx.reps}</div>
          {curEx.note && <div className="text-xs text-gray-400 mb-3">{curEx.note}</div>}
          {curEx.isTimed && circuit.timerSecs > 0 && (
            <div className="text-3xl font-bold text-teal-400 font-mono text-center mb-3">{fmtSecs(circuit.timerSecs)}</div>
          )}
          <div className="flex gap-2">
            <button onClick={next}
              className="flex-1 py-3 bg-teal-600 text-white rounded-xl font-bold text-sm">
              {curEx.isTimed ? "Done ✓" : "Next →"}
            </button>
            <button onClick={stop}
              className="px-4 py-3 bg-gray-700 text-gray-300 rounded-xl text-sm font-bold">
              Stop
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function WorkoutLog() {
  const today = getISTDate()
  const [day, setDay] = useState<DayData>(() => loadDayData(today))
  const [plan, setPlan] = useState<WorkoutPlan>(() => loadWorkoutPlan())
  const [activeTab, setActiveTab] = useState<"today" | "schedule">("today")
  const [walkDur, setWalkDur] = useState("")
  const [walkDist, setWalkDist] = useState("")
  const [walkNote, setWalkNote] = useState("")
  const [customName, setCustomName] = useState("")
  const [customDur, setCustomDur] = useState("")
  const [customNote, setCustomNote] = useState("")
  const [doneExIds, setDoneExIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(`done_ex_${today}`) || "[]") } catch { return [] }
  })
  const [override, setOverride] = useState(false)
  const goalMode = loadGoalMode()
  const isMaternal  = isMaternalMode(goalMode)
  const isPreg      = isPregnancyMode(goalMode)
  const isGeriatric = isGeriatricMode(goalMode)
  const [showEditor, setShowEditor] = useState(false)

  // Load active condition guidance for warnings
  const savedConditions = loadSavedConditions()
  const conditionGuidance = getActiveGuidance(savedConditions.conditions)
  const highSeverityConditions = conditionGuidance.filter(g => g.severity === "high")
  const needsClearance = conditionGuidance.some(g => g.exerciseGuidance.clearanceNeeded)
  const cardioConditions = conditionGuidance.filter(g =>
    ["hypertension","heart_disease","arrhythmia"].includes(g.conditionId)
  )

  const history = loadHistory()
  const todaySched = getTodaySchedule(plan)
  const isRest = todaySched.types.includes("rest") && !override
  const suggestion = getRecoverySuggestion(history, todaySched)

  const persist = useCallback((updated: DayData) => {
    setDay(updated)
    saveDayData(updated)
    const hist = loadHistory()
    const idx = hist.findIndex(h => h.date === updated.date)
    const workoutDone = updated.workouts.length > 0
    if (idx >= 0) hist[idx] = { ...hist[idx], workoutDone }
    saveHistory(hist)
  }, [])

  function markExDone(id: string) {
    const updated = [...doneExIds, id]
    setDoneExIds(updated)
    localStorage.setItem(`done_ex_${today}`, JSON.stringify(updated))
  }

  function handleAllDone() {
    const updated: DayData = {
      ...day,
      workouts: [...(day.workouts || []), {
        id: `circuit-${Date.now()}`,
        type: "circuit",
        duration: 0,
        exercises: plan.exercises.map(e => e.name),
      }]
    }
    persist(updated)
  }

  function logWalk() {
    const dur = parseInt(walkDur)
    if (!dur || dur <= 0) return
    const workout = {
      id: `walk-${Date.now()}`,
      type: "walk" as const,
      duration: dur,
      dist: walkDist || undefined,
      note: walkNote || undefined,
    }
    persist({ ...day, workouts: [...(day.workouts || []), workout] })
    setWalkDur(""); setWalkDist(""); setWalkNote("")
  }

  function logCustom() {
    if (!customName.trim()) return
    const workout = {
      id: `custom-${Date.now()}`,
      type: "other" as const,
      duration: parseInt(customDur) || 0,
      note: `${customName}${customNote ? " — " + customNote : ""}`,
    }
    persist({ ...day, workouts: [...(day.workouts || []), workout] })
    setCustomName(""); setCustomDur(""); setCustomNote("")
  }

  function markRestDay() {
    const workout = {
      id: `rest-${Date.now()}`,
      type: "other" as const,
      duration: 0,
      note: "Rest day ✓",
    }
    persist({ ...day, workouts: [...(day.workouts || []), workout] })
  }

  function removeWorkout(id: string) {
    persist({ ...day, workouts: (day.workouts || []).filter(w => w.id !== id) })
  }

  const walks = (day.workouts || []).filter(w => w.type === "walk")
  const totalWalkMins = walks.reduce((a, w) => a + w.duration, 0)
  const hasCircuit = (day.workouts || []).some(w => w.type === "circuit")
  const hasRest = (day.workouts || []).some(w => w.note === "Rest day ✓")
  const hasAnyWorkout = (day.workouts || []).length > 0

  const showWalk = todaySched.types.includes("walk") || todaySched.types.includes("custom") || override
  const showCircuit = (todaySched.types.includes("circuit") || override) && plan.exercises.length > 0

  return (
    <div className="p-3 pb-24">

      {/* Maternal mode advisory */}
      {isMaternal && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 mb-3 text-xs text-rose-800 leading-snug">
          <span className="font-bold">
            {isPreg ? "🤰 Pregnancy exercise — " : "👶 Postnatal exercise — "}
          </span>
          Always check with your doctor or midwife before starting or continuing any exercise routine.
          The exercises shown have been selected with your current phase in mind — listen to your body and stop if anything feels uncomfortable.
        </div>
      )}

      {/* Geriatric mode advisory */}
      {isGeriatric && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3 text-xs text-amber-800 leading-snug">
          <span className="font-bold">🧓 Healthy ageing exercise — </span>
          Start gently and build gradually. If you have any cardiovascular, joint, or bone conditions, check with your doctor before starting a new programme. Stop if you feel pain, dizziness, or shortness of breath.
        </div>
      )}

      {/* Cardiovascular condition warnings — shown prominently before any exercise */}
      {cardioConditions.length > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-3 mb-3">
          <div className="text-sm font-bold text-red-800 mb-1.5">
            🫀 Cardiovascular condition — exercise precautions
          </div>
          {cardioConditions.map(g => {
            const cond = CONDITIONS.find(c => c.id === g.conditionId)
            return (
              <div key={g.conditionId} className="mb-2 last:mb-0">
                <div className="text-xs font-semibold text-red-700 mb-0.5">{cond?.label}</div>
                {g.exerciseGuidance.warning && (
                  <div className="text-xs text-red-600 leading-snug mb-1">{g.exerciseGuidance.warning}</div>
                )}
                {g.exerciseGuidance.avoid.length > 0 && (
                  <div className="text-[10px] text-red-500 leading-snug">
                    <span className="font-bold">Avoid: </span>
                    {g.exerciseGuidance.avoid.slice(0, 2).join(" · ")}
                  </div>
                )}
              </div>
            )
          })}
          <div className="mt-2 text-[10px] text-red-500 border-t border-red-200 pt-1.5">
            Tap Health tab → Health Conditions for full guidance
          </div>
        </div>
      )}

      {/* Other high-severity condition warnings */}
      {highSeverityConditions.filter(g => !["hypertension","heart_disease","arrhythmia"].includes(g.conditionId)).map(g => {
        const cond = CONDITIONS.find(c => c.id === g.conditionId)
        if (!g.exerciseGuidance.warning) return null
        return (
          <div key={g.conditionId} className="bg-red-50 border border-red-200 rounded-xl p-3 mb-2">
            <div className="text-xs font-bold text-red-700">{cond?.icon} {cond?.label}</div>
            <div className="text-xs text-red-600 leading-snug mt-0.5">{g.exerciseGuidance.warning}</div>
          </div>
        )
      })}

      {/* Doctor clearance reminder */}
      {needsClearance && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 mb-3 flex items-start gap-2">
          <span className="text-amber-500 shrink-0">⚠️</span>
          <p className="text-[11px] text-amber-700 leading-snug">
            One or more of your health conditions requires doctor clearance before exercise. Confirm this with your doctor before starting the circuit timer.
          </p>
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-br from-gray-900 to-teal-800 rounded-2xl p-4 mb-3 text-white">
        <div className="text-xs opacity-70 mb-0.5">{getDayName()}</div>
        <div className="text-base font-bold">
          {isRest ? "🛌 Rest Day"
            : todaySched.types.filter(t => t !== "rest").map(t =>
                t === "walk" ? "🚶 Walk" : t === "circuit" ? "💪 Circuit" : "🏃 Workout"
              ).join(" + ")}
        </div>
        <div className="text-xs opacity-60 mt-0.5">{todaySched.note}</div>
      </div>

      {/* Tabs */}
      <div className="flex bg-white rounded-xl shadow-sm p-1 mb-3 gap-1">
        {(["today","schedule"] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors
              ${activeTab === t ? "bg-teal-600 text-white" : "text-gray-500"}`}>
            {t === "today" ? "Today" : "Schedule"}
          </button>
        ))}
      </div>

      {activeTab === "today" && (
        <div>
          {/* Recovery suggestion */}
          {suggestion && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3 text-xs text-amber-800">
              {suggestion}
            </div>
          )}

          {/* Rest day */}
          {isRest && (
            <div className="bg-white rounded-2xl shadow-sm p-6 mb-3 text-center">
              <div className="text-4xl mb-3">🛌</div>
              <div className="text-sm font-bold text-gray-700 mb-1">Scheduled Rest Day</div>
              <div className="text-xs text-gray-400 mb-4">Recovery is when muscle is built and fat is lost.</div>
              {!hasRest ? (
                <div className="flex gap-2 justify-center">
                  <button onClick={markRestDay}
                    className="px-5 py-2 bg-teal-600 text-white rounded-xl text-sm font-bold">
                    ✓ Mark Rest Day Done
                  </button>
                  <button onClick={() => setOverride(true)}
                    className="px-5 py-2 border border-teal-500 text-teal-600 rounded-xl text-sm font-bold">
                    Override — Log Workout
                  </button>
                </div>
              ) : (
                <div className="text-sm text-green-600 font-bold">✓ Rest day logged</div>
              )}
            </div>
          )}

          {/* Walk section */}
          {showWalk && (
            <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
              <div className="flex justify-between items-center mb-3">
                <div className="text-sm font-bold text-gray-800">🚶 Walk</div>
                {todaySched.walkTarget > 0 && (
                  <div className={`text-sm font-bold ${totalWalkMins >= todaySched.walkTarget ? "text-green-600" : "text-amber-500"}`}>
                    {totalWalkMins} / {todaySched.walkTarget} min {totalWalkMins >= todaySched.walkTarget ? "✓" : ""}
                  </div>
                )}
              </div>
              {todaySched.walkTarget > 0 && (
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
                  <div className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(totalWalkMins / todaySched.walkTarget * 100, 100)}%`,
                      background: totalWalkMins >= todaySched.walkTarget ? "#4ade80" : "#0d9488"
                    }} />
                </div>
              )}
              <div className="flex gap-2 mb-2">
                <input type="number" placeholder="Duration (min)" value={walkDur}
                  onChange={e => setWalkDur(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
                <input type="number" placeholder="km" value={walkDist}
                  onChange={e => setWalkDist(e.target.value)}
                  className="w-20 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
              </div>
              <input type="text" placeholder="Note (optional)" value={walkNote}
                onChange={e => setWalkNote(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:border-teal-500" />
              <button onClick={logWalk}
                className="w-full py-2.5 bg-teal-600 text-white rounded-xl font-bold text-sm">
                Log Walk
              </button>
              {walks.map(w => (
                <div key={w.id} className="flex justify-between items-center mt-2 pt-2 border-t border-gray-50">
                  <span className="text-xs text-gray-600">🚶 {w.duration} min{w.dist ? ` · ${w.dist} km` : ""}{w.note ? ` · ${w.note}` : ""}</span>
                  <button onClick={() => removeWorkout(w.id)} className="text-gray-300 text-sm px-1">×</button>
                </div>
              ))}
            </div>
          )}

          {/* Circuit section */}
          {showCircuit && (
            <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
              <div className="flex justify-between items-center mb-3">
                <div className="text-sm font-bold text-gray-800">💪 Circuit Training</div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowEditor(true)}
                    className="text-[10px] text-teal-600 border border-teal-300 rounded-lg px-2 py-1 font-semibold">
                    ✏️ Edit
                  </button>
                  <div className={`text-xs font-bold ${hasCircuit ? "text-green-600" : "text-gray-400"}`}>
                    {hasCircuit ? "✓ Done" : `${plan.circuitRounds} rounds`}
                  </div>
                </div>
              </div>
              {!hasCircuit && (
                <CircuitTimer
                  exercises={plan.exercises}
                  rounds={plan.circuitRounds}
                  restBetweenRounds={plan.restBetweenRounds}
                  doneExIds={doneExIds}
                  onExDone={markExDone}
                  onAllDone={handleAllDone}
                />
              )}
              {/* Exercise list */}
              <div className="space-y-2">
                {plan.exercises.map(ex => {
                  const done = doneExIds.includes(ex.id) || hasCircuit
                  return (
                    <div key={ex.id}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border
                        ${done ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-100"}`}>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0
                        ${done ? "bg-green-500 border-green-500 text-white" : "border-gray-300"}`}>
                        {done && <span className="text-[10px]">✓</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-xs font-semibold ${done ? "text-green-700 line-through" : "text-gray-700"}`}>
                          {ex.name}
                        </div>
                        <div className="text-[10px] text-gray-400">{ex.sets} sets · {ex.reps}</div>
                      </div>
                      {!hasCircuit && (
                        <button onClick={() => markExDone(ex.id)}
                          className="text-[10px] px-2 py-1 border border-gray-200 rounded-lg text-gray-500">
                          Done
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
              {hasCircuit && (
                <div className="mt-3 text-center text-sm text-green-600 font-bold">🎉 Circuit complete!</div>
              )}
            </div>
          )}

          {/* Custom workout */}
          <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
            <div className="text-sm font-bold text-gray-800 mb-3">➕ Log Any Workout</div>
            <input type="text" placeholder="Workout name (e.g. Yoga, Swimming, Cycling)"
              value={customName} onChange={e => setCustomName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:border-teal-500" />
            <div className="flex gap-2 mb-2">
              <input type="number" placeholder="Duration (min)" value={customDur}
                onChange={e => setCustomDur(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
              <input type="text" placeholder="Note (optional)" value={customNote}
                onChange={e => setCustomNote(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
            </div>
            <button onClick={logCustom}
              className="w-full py-2.5 bg-gray-800 text-white rounded-xl font-bold text-sm">
              Log Workout
            </button>
          </div>

          {/* Today's log */}
          {hasAnyWorkout && (
            <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
              <div className="text-sm font-bold text-gray-800 mb-2">📋 Today's Activity</div>
              {(day.workouts || []).map(w => (
                <div key={w.id} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <div className="text-xs font-medium text-gray-700">
                      {w.type === "walk" ? "🚶" : w.type === "circuit" ? "💪" : "🏃"} {w.note || w.type}
                    </div>
                    {w.duration > 0 && <div className="text-[10px] text-gray-400">{w.duration} min</div>}
                  </div>
                  <button onClick={() => removeWorkout(w.id)} className="text-gray-300 text-sm px-1">×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "schedule" && (
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
          <div className="flex justify-between items-center mb-1">
            <div className="text-sm font-bold text-gray-800">Weekly Schedule</div>
            <button onClick={() => setShowEditor(true)}
              className="text-[10px] text-teal-600 border border-teal-300 rounded-lg px-2 py-1 font-semibold">
              ✏️ Edit exercises
            </button>
          </div>
          <p className="text-xs text-gray-400 mb-3">
            Your current weekly workout schedule.
          </p>
          {plan.schedule.map(s => {
            const isToday = s.day === getDayName()
            const isRest = s.types.includes("rest")
            return (
              <div key={s.day} className={`flex items-start gap-3 py-3 border-b border-gray-50 last:border-0`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                  ${isToday ? "bg-teal-600 text-white" : isRest ? "bg-gray-100 text-gray-400" : "bg-green-50 text-green-700"}`}>
                  {s.day.slice(0, 3)}
                </div>
                <div className="flex-1">
                  <div className="flex gap-1.5 flex-wrap mb-0.5">
                    {s.types.map(t => (
                      <span key={t} className={`text-xs font-bold
                        ${isToday ? "text-teal-600" : isRest ? "text-gray-400" : "text-gray-700"}`}>
                        {t === "walk" ? "🚶 Walk" : t === "circuit" ? "💪 Circuit" : t === "rest" ? "🛌 Rest" : `🏃 ${t}`}
                        {t === "walk" && s.walkTarget > 0 ? ` ${s.walkTarget}min` : ""}
                      </span>
                    ))}
                  </div>
                  <div className="text-[10px] text-gray-400">{s.note}</div>
                </div>
                {isToday && (
                  <span className="text-[10px] bg-teal-600 text-white px-2 py-0.5 rounded-full shrink-0">Today</span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* "Add exercises" prompt when no circuit exercises exist */}
      {plan.exercises.length === 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-3 text-center">
          <div className="text-3xl mb-2">🏋</div>
          <div className="text-sm font-semibold text-gray-700 mb-1">No exercises configured</div>
          <div className="text-xs text-gray-400 mb-3">Add exercises to enable the circuit timer</div>
          <button onClick={() => setShowEditor(true)}
            className="px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-bold">
            + Add Exercises
          </button>
        </div>
      )}

      {/* Exercise editor modal */}
      {showEditor && (
        <ExerciseEditor
          onClose={() => {
            setShowEditor(false)
            setPlan(loadWorkoutPlan())
          }}
        />
      )}
    </div>
  )
}
