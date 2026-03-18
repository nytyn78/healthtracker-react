/**
 * ExerciseEditor.tsx
 * Inline exercise add/remove/reorder panel shown inside WorkoutLog.
 * Works in all modes — standard and maternal.
 * Can also "reset to recommended" to reload the mode's default template.
 */

import { useState } from "react"
import {
  loadWorkoutPlan, saveWorkoutPlan, WorkoutPlan, ExerciseConfig,
} from "../store/useHealthStore"
import { GoalMode, isMaternalMode, loadGoalMode } from "../services/goalModeConfig"
import { getMaternalWorkoutPlan, getWorkoutPlanForLevel } from "../services/onboardingPresets"

interface Props {
  onClose: () => void
}

const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"

export default function ExerciseEditor({ onClose }: Props) {
  const [plan, setPlan] = useState<WorkoutPlan>(() => loadWorkoutPlan())
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: "", sets: "3", reps: "12", isTimed: false, note: "" })
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const goalMode = loadGoalMode()
  const isMaternal = isMaternalMode(goalMode)

  function persist(updated: WorkoutPlan) {
    setPlan(updated)
    saveWorkoutPlan(updated)
  }

  function addExercise() {
    if (!form.name.trim()) return
    const ex: ExerciseConfig = {
      id: `ex-${Date.now()}`,
      name: form.name.trim(),
      sets: form.sets,
      reps: form.reps,
      isTimed: form.isTimed,
      note: form.note.trim(),
    }
    persist({ ...plan, exercises: [...plan.exercises, ex] })
    setForm({ name: "", sets: "3", reps: "12", isTimed: false, note: "" })
    setAdding(false)
  }

  function removeExercise(id: string) {
    persist({ ...plan, exercises: plan.exercises.filter(e => e.id !== id) })
  }

  function moveUp(i: number) {
    if (i === 0) return
    const exs = [...plan.exercises]
    ;[exs[i - 1], exs[i]] = [exs[i], exs[i - 1]]
    persist({ ...plan, exercises: exs })
  }

  function moveDown(i: number) {
    if (i === plan.exercises.length - 1) return
    const exs = [...plan.exercises]
    ;[exs[i], exs[i + 1]] = [exs[i + 1], exs[i]]
    persist({ ...plan, exercises: exs })
  }

  function resetToRecommended() {
    const recommended = isMaternal
      ? getMaternalWorkoutPlan(goalMode)
      : getWorkoutPlanForLevel("intermediate")
    if (recommended) {
      persist({ ...plan, exercises: recommended.exercises, circuitRounds: recommended.circuitRounds })
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex flex-col justify-end">
      <div className="bg-white rounded-t-2xl w-full max-w-lg mx-auto flex flex-col shadow-2xl mb-16"
           style={{ maxHeight: "80vh" }}>

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="px-5 pb-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base font-bold text-gray-900">💪 Edit Exercises</div>
              <div className="text-xs text-gray-500 mt-0.5">
                {plan.exercises.length} exercise{plan.exercises.length !== 1 ? "s" : ""} in circuit
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 text-sm px-2 py-1 border border-gray-200 rounded-lg">
              Done
            </button>
          </div>
        </div>

        {/* Exercise list — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-3 min-h-0">
          {plan.exercises.length === 0 && !adding && (
            <div className="text-center text-gray-400 py-6">
              <div className="text-3xl mb-2">🏋</div>
              <div className="text-sm">No exercises yet</div>
              <div className="text-xs mt-1">Add exercises below or reset to recommended</div>
            </div>
          )}

          {plan.exercises.map((ex, i) => (
            <div key={ex.id} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl mb-2 border border-gray-100">
              {/* Order controls */}
              <div className="flex flex-col gap-0.5 shrink-0">
                <button onClick={() => moveUp(i)} disabled={i === 0}
                  className="text-gray-300 disabled:opacity-20 text-xs leading-none px-1">▲</button>
                <span className="text-[10px] text-gray-400 text-center">{i + 1}</span>
                <button onClick={() => moveDown(i)} disabled={i === plan.exercises.length - 1}
                  className="text-gray-300 disabled:opacity-20 text-xs leading-none px-1">▼</button>
              </div>

              {/* Exercise info */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-800">{ex.name}</div>
                <div className="text-[10px] text-gray-500">
                  {ex.sets} sets · {ex.reps}{ex.isTimed ? " sec" : " reps"}
                  {ex.note ? ` · ${ex.note}` : ""}
                </div>
              </div>

              {/* Remove */}
              <button onClick={() => removeExercise(ex.id)}
                className="text-red-300 text-xs px-2 py-1 border border-red-100 rounded-lg shrink-0">
                ✕
              </button>
            </div>
          ))}

          {/* Add form */}
          {adding && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-2">
              <input className={inputCls + " mb-2"} type="text" placeholder="Exercise name (e.g. Squats)"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                autoFocus />
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <label className="text-[10px] text-gray-500 block mb-1">Sets</label>
                  <input className={inputCls} type="text" placeholder="e.g. 3"
                    value={form.sets} onChange={e => setForm(f => ({ ...f, sets: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 block mb-1">
                    {form.isTimed ? "Duration (sec)" : "Reps"}
                  </label>
                  <input className={inputCls} type="text" placeholder={form.isTimed ? "30" : "12"}
                    value={form.reps} onChange={e => setForm(f => ({ ...f, reps: e.target.value }))} />
                </div>
              </div>
              <label className="flex items-center gap-2 mb-2 cursor-pointer">
                <input type="checkbox" checked={form.isTimed}
                  onChange={e => setForm(f => ({ ...f, isTimed: e.target.checked }))} />
                <span className="text-xs text-gray-600">Timed exercise (countdown)</span>
              </label>
              <input className={inputCls + " mb-3"} type="text" placeholder="Tip / note (optional)"
                value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
              <div className="flex gap-2">
                <button onClick={() => setAdding(false)}
                  className="flex-1 py-2 bg-gray-100 text-gray-500 rounded-lg text-sm font-bold">
                  Cancel
                </button>
                <button onClick={addExercise} disabled={!form.name.trim()}
                  className="flex-1 py-2 bg-teal-600 text-white rounded-lg text-sm font-bold disabled:opacity-40">
                  Add
                </button>
              </div>
            </div>
          )}

          {/* Circuit settings */}
          <div className="mt-2 flex gap-3">
            <div className="flex-1">
              <label className="text-[10px] text-gray-500 block mb-1">Rounds</label>
              <select className={inputCls} value={plan.circuitRounds}
                onChange={e => persist({ ...plan, circuitRounds: Number(e.target.value) })}>
                {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} round{n !== 1 ? "s" : ""}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-gray-500 block mb-1">Rest between rounds</label>
              <select className={inputCls} value={plan.restBetweenRounds}
                onChange={e => persist({ ...plan, restBetweenRounds: Number(e.target.value) })}>
                {[30,60,90,120,180].map(n => <option key={n} value={n}>{n}s</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Footer buttons */}
        <div className="px-5 pt-2 pb-5 border-t border-gray-100 shrink-0 space-y-2">
          {!adding && (
            <button onClick={() => setAdding(true)}
              className="w-full py-3 border-2 border-teal-500 text-teal-600 rounded-xl text-sm font-bold">
              + Add Exercise
            </button>
          )}
          <button
            onClick={resetToRecommended}
            className="w-full py-2.5 border border-gray-200 text-gray-500 rounded-xl text-xs font-semibold"
          >
            ↺ Reset to recommended {isMaternal ? "maternal" : "intermediate"} template
          </button>
        </div>
      </div>
    </div>
  )
}
