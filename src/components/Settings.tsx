import { useState } from "react"
import {
  useHealthStore, ACTIVITY_LABELS, ActivityLevel, WeightLossRate,
  loadTheme, saveTheme, Theme,
  loadWorkoutPlan, saveWorkoutPlan, WorkoutPlan, ExerciseConfig,
  loadBreakPeriods, saveBreakPeriods, BreakPeriod, isInBreakPeriod,
  loadAISettings, saveAISettings, AISettings,
  Medication, MedFrequency, BloodTest, TaskConfig, TaskId,
  loadMedications, saveMedications, loadBloodTests, saveBloodTests,
  loadTaskConfig, saveTaskConfig, loadWaterTarget, saveWaterTarget,
} from "../store/useHealthStore"
import { computeMacros, formatHour } from "../services/adaptiveTDEE"
import GoalModeSelector from "./GoalModeSelector"

// ── Shared UI ─────────────────────────────────────────────────────────────────
const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
const selectCls = inputCls

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
      <h2 className="text-sm font-semibold text-teal-700 uppercase tracking-wide mb-3">{title}</h2>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="block text-sm text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

const LOSS_RATE_LABELS: Record<string, string> = {
  "0.25": "0.25 kg/week — very gentle",
  "0.5":  "0.5 kg/week — steady (recommended)",
  "0.75": "0.75 kg/week — moderate",
  "1":    "1.0 kg/week — aggressive",
}

const DAYS_OF_WEEK = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]

const TASK_LABELS: Record<TaskId, string> = {
  meds:    "💊 Medications",
  walk:    "🚶 Walk",
  protein: "🥩 Protein target",
  meals:   "🍽 Meals logged",
  water:   "💧 Water intake",
  carbs:   "🌾 Carbs on track",
  fast:    "⏱ Fasting",
  workout: "🏋 Workout",
  weight:  "⚖️ Weight logged",
}

// ── Medications Section ───────────────────────────────────────────────────────
function MedicationsSection() {
  const [meds, setMeds] = useState<Medication[]>(() => loadMedications())
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({
    name: "", frequency: "daily" as MedFrequency,
    days: [] as string[], note: "",
  })

  function persist(updated: Medication[]) {
    setMeds(updated)
    saveMedications(updated)
  }

  function addMed() {
    if (!form.name.trim()) return
    const med: Medication = {
      id: `med-${Date.now()}`,
      name: form.name.trim(),
      frequency: form.frequency,
      days: form.frequency === "weekly" ? form.days : undefined,
      note: form.note.trim(),
      enabled: true,
    }
    persist([...meds, med])
    setForm({ name: "", frequency: "daily", days: [], note: "" })
    setAdding(false)
  }

  function toggleMed(id: string) {
    persist(meds.map(m => m.id === id ? { ...m, enabled: !m.enabled } : m))
  }

  function removeMed(id: string) {
    persist(meds.filter(m => m.id !== id))
  }

  function toggleDay(day: string) {
    setForm(f => ({
      ...f,
      days: f.days.includes(day) ? f.days.filter(d => d !== day) : [...f.days, day]
    }))
  }

  return (
    <Section title="Medications & Supplements">
      <p className="text-xs text-gray-500 mb-3">
        Add any medications, supplements, or recurring health reminders. These appear as checkboxes in Today's task list.
      </p>

      {meds.map(med => (
        <div key={med.id} className={`flex items-start justify-between p-3 rounded-xl mb-2 border
          ${med.enabled ? "bg-teal-50 border-teal-200" : "bg-gray-50 border-gray-200"}`}>
          <div className="flex-1 min-w-0">
            <div className={`text-sm font-semibold ${med.enabled ? "text-teal-800" : "text-gray-500"}`}>
              {med.name}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">
              {med.frequency === "daily" ? "Daily"
                : med.frequency === "weekly" ? `Weekly · ${(med.days || []).join(", ")}`
                : "Custom"}
              {med.note ? ` · ${med.note}` : ""}
            </div>
          </div>
          <div className="flex gap-2 items-center ml-2 shrink-0">
            <button onClick={() => toggleMed(med.id)}
              className={`text-[10px] px-2 py-1 rounded-lg border font-bold
                ${med.enabled ? "bg-teal-600 text-white border-teal-600" : "bg-gray-100 text-gray-400 border-gray-200"}`}>
              {med.enabled ? "On" : "Off"}
            </button>
            <button onClick={() => removeMed(med.id)}
              className="text-red-300 text-xs px-1.5 py-1 border border-red-100 rounded-lg">✕</button>
          </div>
        </div>
      ))}

      {meds.length === 0 && !adding && (
        <p className="text-xs text-gray-400 text-center py-3">No medications added yet</p>
      )}

      {adding && (
        <div className="bg-gray-50 rounded-xl p-3 mb-3">
          <input className={inputCls + " mb-2"} type="text"
            placeholder="Name (e.g. Metformin 500mg, Vitamin D3)"
            value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />

          <div className="mb-2">
            <label className="text-xs text-gray-500 mb-1 block">Frequency</label>
            <div className="flex gap-2">
              {(["daily","weekly","custom"] as MedFrequency[]).map(freq => (
                <button key={freq} onClick={() => setForm(f => ({ ...f, frequency: freq }))}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border capitalize
                    ${form.frequency === freq ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-500 border-gray-200"}`}>
                  {freq}
                </button>
              ))}
            </div>
          </div>

          {form.frequency === "weekly" && (
            <div className="mb-2">
              <label className="text-xs text-gray-500 mb-1 block">Days</label>
              <div className="flex flex-wrap gap-1">
                {DAYS_OF_WEEK.map(d => (
                  <button key={d} onClick={() => toggleDay(d)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold border
                      ${form.days.includes(d) ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-500 border-gray-200"}`}>
                    {d.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <input className={inputCls + " mb-3"} type="text"
            placeholder="Note (e.g. Take with Meal 1, Before bed)"
            value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />

          <div className="flex gap-2">
            <button onClick={() => setAdding(false)}
              className="flex-1 py-2 bg-gray-100 text-gray-500 rounded-lg text-sm font-bold">Cancel</button>
            <button onClick={addMed}
              className="flex-1 py-2 bg-teal-600 text-white rounded-lg text-sm font-bold">Add</button>
          </div>
        </div>
      )}

      {!adding && (
        <button onClick={() => setAdding(true)}
          className="w-full py-2 border border-teal-500 text-teal-600 rounded-xl text-sm font-bold mt-1">
          + Add Medication / Supplement
        </button>
      )}
    </Section>
  )
}

// ── Blood Tests Section ───────────────────────────────────────────────────────
function BloodTestsSection() {
  const [tests, setTests] = useState<BloodTest[]>(() => loadBloodTests())
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: "", reason: "", intervalDays: "90" })

  function persist(updated: BloodTest[]) {
    setTests(updated)
    saveBloodTests(updated)
  }

  function addTest() {
    if (!form.name.trim()) return
    const test: BloodTest = {
      id: `test-${Date.now()}`,
      name: form.name.trim(),
      reason: form.reason.trim(),
      intervalDays: parseInt(form.intervalDays) || 90,
      enabled: true,
    }
    persist([...tests, test])
    setForm({ name: "", reason: "", intervalDays: "90" })
    setAdding(false)
  }

  function removeTest(id: string) {
    persist(tests.filter(t => t.id !== id))
  }

  function toggleTest(id: string) {
    persist(tests.map(t => t.id === id ? { ...t, enabled: !t.enabled } : t))
  }

  const INTERVAL_PRESETS = [
    { label: "Monthly", days: 30 },
    { label: "3 months", days: 90 },
    { label: "6 months", days: 180 },
    { label: "Yearly", days: 365 },
  ]

  return (
    <Section title="Blood Tests & Lab Work">
      <p className="text-xs text-gray-500 mb-3">
        Track when you're due for lab tests. The app reminds you based on your set interval.
      </p>

      {tests.map(test => (
        <div key={test.id} className={`flex items-start justify-between p-3 rounded-xl mb-2 border
          ${test.enabled ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-200"}`}>
          <div className="flex-1 min-w-0">
            <div className={`text-sm font-semibold ${test.enabled ? "text-blue-800" : "text-gray-500"}`}>
              🩸 {test.name}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">
              Every {test.intervalDays} days
              {test.reason ? ` · ${test.reason}` : ""}
            </div>
          </div>
          <div className="flex gap-2 items-center ml-2 shrink-0">
            <button onClick={() => toggleTest(test.id)}
              className={`text-[10px] px-2 py-1 rounded-lg border font-bold
                ${test.enabled ? "bg-blue-600 text-white border-blue-600" : "bg-gray-100 text-gray-400 border-gray-200"}`}>
              {test.enabled ? "On" : "Off"}
            </button>
            <button onClick={() => removeTest(test.id)}
              className="text-red-300 text-xs px-1.5 py-1 border border-red-100 rounded-lg">✕</button>
          </div>
        </div>
      ))}

      {tests.length === 0 && !adding && (
        <p className="text-xs text-gray-400 text-center py-3">No blood tests added yet</p>
      )}

      {adding && (
        <div className="bg-gray-50 rounded-xl p-3 mb-3">
          <input className={inputCls + " mb-2"} type="text"
            placeholder="Test name (e.g. HbA1c, Lipid Profile, LFT)"
            value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <input className={inputCls + " mb-2"} type="text"
            placeholder="Reason / note (optional)"
            value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />

          <div className="mb-3">
            <label className="text-xs text-gray-500 mb-1 block">Repeat interval</label>
            <div className="flex gap-1.5 mb-2 flex-wrap">
              {INTERVAL_PRESETS.map(p => (
                <button key={p.days} onClick={() => setForm(f => ({ ...f, intervalDays: String(p.days) }))}
                  className={`px-3 py-1 rounded-lg text-xs font-bold border
                    ${form.intervalDays === String(p.days) ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-500 border-gray-200"}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input className={inputCls} type="number" min="7" max="730"
                value={form.intervalDays}
                onChange={e => setForm(f => ({ ...f, intervalDays: e.target.value }))} />
              <span className="text-xs text-gray-500 whitespace-nowrap">days</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setAdding(false)}
              className="flex-1 py-2 bg-gray-100 text-gray-500 rounded-lg text-sm font-bold">Cancel</button>
            <button onClick={addTest}
              className="flex-1 py-2 bg-teal-600 text-white rounded-lg text-sm font-bold">Add</button>
          </div>
        </div>
      )}

      {!adding && (
        <button onClick={() => setAdding(true)}
          className="w-full py-2 border border-teal-500 text-teal-600 rounded-xl text-sm font-bold mt-1">
          + Add Blood Test
        </button>
      )}
    </Section>
  )
}

// ── Today Tasks Section ───────────────────────────────────────────────────────
function TodayTasksSection() {
  const [tasks, setTasks] = useState<TaskConfig[]>(() => loadTaskConfig())
  const [waterTarget, setWaterTargetState] = useState(() => loadWaterTarget())

  function toggleTask(id: TaskId) {
    const updated = tasks.map(t => t.id === id ? { ...t, enabled: !t.enabled } : t)
    setTasks(updated)
    saveTaskConfig(updated)
  }

  function handleWaterTarget(v: number) {
    setWaterTargetState(v)
    saveWaterTarget(v)
  }

  return (
    <Section title="Today Tab — Task Bubbles">
      <p className="text-xs text-gray-500 mb-3">
        Choose which tasks appear in your daily dashboard. Turn off anything not relevant to your routine.
      </p>
      {tasks.map(task => (
        <div key={task.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
          <span className="text-sm text-gray-700">{TASK_LABELS[task.id]}</span>
          <button onClick={() => toggleTask(task.id)}
            className={`w-11 h-6 rounded-full transition-colors relative
              ${task.enabled ? "bg-teal-600" : "bg-gray-200"}`}>
            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform
              ${task.enabled ? "translate-x-5" : "translate-x-0.5"}`} />
          </button>
        </div>
      ))}

      {tasks.find(t => t.id === "water")?.enabled && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <Field label={`Daily water target: ${waterTarget}L`}>
            <input type="range" min={1} max={5} step={0.25}
              value={waterTarget} className="w-full accent-teal-600"
              onChange={e => handleWaterTarget(Number(e.target.value))} />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>1L</span><span>2L</span><span>3L</span><span>4L</span><span>5L</span>
            </div>
          </Field>
        </div>
      )}
    </Section>
  )
}




// ── AI & Voice Section ────────────────────────────────────────────────────────
function AISettingsSection() {
  const [ai, setAI] = useState<AISettings>(() => loadAISettings())
  const [showKeys, setShowKeys] = useState(false)

  function update(patch: Partial<AISettings>) {
    const updated = { ...ai, ...patch }
    setAI(updated)
    saveAISettings(updated)
  }

  return (
    <Section title="AI & Voice">
      <p className="text-xs text-gray-500 mb-3">
        Optional — the app works fully without these. Keys are stored locally and never leave your device.
      </p>

      <div className="mb-3">
        <label className="text-xs font-bold text-gray-600 block mb-1">Voice input mode</label>
        <div className="flex gap-2">
          {([["webspeech","🎤 Browser (free)"],["whisper","🎙 Whisper (better)"]] as const).map(([val, label]) => (
            <button key={val} onClick={() => update({ voiceMode: val })}
              className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors
                ${ai.voiceMode === val ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-500 border-gray-200"}`}>
              {label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-gray-400 mt-1">
          {ai.voiceMode === "webspeech"
            ? "Uses your browser's built-in speech recognition. Works on Android Chrome. May not work on iOS."
            : "Uses OpenAI Whisper. Works on all devices including iOS. Requires OpenAI API key."}
        </p>
      </div>

      <button onClick={() => setShowKeys(s => !s)}
        className="text-xs text-teal-600 border border-teal-200 px-3 py-1.5 rounded-lg mb-3 font-bold">
        {showKeys ? "Hide API keys" : "🔑 Set up API keys"}
      </button>

      {showKeys && (
        <div className="bg-gray-50 rounded-xl p-3 space-y-3">
          <div>
            <label className="text-[10px] font-bold text-gray-600 block mb-1">Anthropic API key (for in-app chat)</label>
            <input type="password" placeholder="sk-ant-..."
              value={ai.anthropicKey}
              onChange={e => update({ anthropicKey: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-teal-500" />
            <p className="text-[9px] text-gray-400 mt-1">Get at console.anthropic.com · ~$0.003 per weekly report</p>
          </div>
          {ai.voiceMode === "whisper" && (
            <div>
              <label className="text-[10px] font-bold text-gray-600 block mb-1">OpenAI API key (for Whisper voice)</label>
              <input type="password" placeholder="sk-..."
                value={ai.openaiKey}
                onChange={e => update({ openaiKey: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-teal-500" />
              <p className="text-[9px] text-gray-400 mt-1">Get at platform.openai.com · ~$0.006 per minute of audio</p>
            </div>
          )}
        </div>
      )}
    </Section>
  )
}

// ── Break Periods Section ─────────────────────────────────────────────────────
const BREAK_TYPES = [
  { value: "vacation",  label: "✈️ Vacation" },
  { value: "wedding",   label: "💒 Wedding" },
  { value: "festival",  label: "🎉 Festival" },
  { value: "illness",   label: "🤒 Illness" },
  { value: "travel",    label: "🚗 Travel" },
  { value: "other",     label: "📅 Other" },
]

function BreakPeriodsSection() {
  const [periods, setPeriods] = useState<BreakPeriod[]>(() => loadBreakPeriods())
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ label: "", startDate: "", endDate: "", type: "vacation" as BreakPeriod["type"] })

  function persist(updated: BreakPeriod[]) { setPeriods(updated); saveBreakPeriods(updated) }

  function addPeriod() {
    if (!form.label.trim() || !form.startDate || !form.endDate) return
    const period: BreakPeriod = { id: `break-${Date.now()}`, ...form }
    persist([...periods, period].sort((a,b) => a.startDate.localeCompare(b.startDate)))
    setForm({ label: "", startDate: "", endDate: "", type: "vacation" })
    setAdding(false)
  }

  return (
    <Section title="Break Periods">
      <p className="text-xs text-gray-500 mb-3">
        During a break, workout targets are suspended, weight fluctuations are expected, and the plateau detector is paused.
      </p>
      {periods.map(p => {
        const active = isInBreakPeriod(new Date().toISOString().slice(0,10))?.id === p.id
        return (
          <div key={p.id} className={`flex items-start justify-between p-3 rounded-xl mb-2 border
            ${active ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-200"}`}>
            <div>
              <div className="text-sm font-semibold text-gray-700">{BREAK_TYPES.find(t=>t.value===p.type)?.label} {p.label}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{p.startDate} → {p.endDate}</div>
              {active && <div className="text-[10px] text-amber-600 font-bold mt-0.5">● Active now</div>}
            </div>
            <button onClick={() => persist(periods.filter(x => x.id !== p.id))}
              className="text-red-300 text-xs px-1.5 py-1 border border-red-100 rounded-lg ml-2">✕</button>
          </div>
        )
      })}
      {periods.length === 0 && !adding && (
        <p className="text-xs text-gray-400 text-center py-2">No break periods added</p>
      )}
      {adding && (
        <div className="bg-gray-50 rounded-xl p-3 mb-2">
          <input className={inputCls + " mb-2"} type="text" placeholder="Label (e.g. Goa vacation, Rahul wedding)"
            value={form.label} onChange={e => setForm(f => ({...f, label: e.target.value}))} />
          <div className="mb-2">
            <label className="text-[10px] text-gray-500 block mb-1">Type</label>
            <div className="flex flex-wrap gap-1.5">
              {BREAK_TYPES.map(t => (
                <button key={t.value} onClick={() => setForm(f => ({...f, type: t.value as BreakPeriod["type"]}))}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold border
                    ${form.type === t.value ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-500 border-gray-200"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">Start date</label>
              <input className={inputCls} type="date" value={form.startDate}
                onChange={e => setForm(f => ({...f, startDate: e.target.value}))} />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">End date</label>
              <input className={inputCls} type="date" value={form.endDate}
                onChange={e => setForm(f => ({...f, endDate: e.target.value}))} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setAdding(false)} className="flex-1 py-2 bg-gray-100 text-gray-500 rounded-lg text-sm font-bold">Cancel</button>
            <button onClick={addPeriod} className="flex-1 py-2 bg-teal-600 text-white rounded-lg text-sm font-bold">Add</button>
          </div>
        </div>
      )}
      {!adding && (
        <button onClick={() => setAdding(true)} className="w-full py-2 border border-teal-500 text-teal-600 rounded-xl text-sm font-bold mt-1">
          + Add Break Period
        </button>
      )}
    </Section>
  )
}

// ── Workout Plan Section ──────────────────────────────────────────────────────
function WorkoutPlanSection() {
  const [plan, setPlan] = useState<WorkoutPlan>(() => loadWorkoutPlan())
  const [addingEx, setAddingEx] = useState(false)
  const [exForm, setExForm] = useState({ name: "", sets: "3", reps: "12", isTimed: false, note: "" })

  function persistPlan(updated: WorkoutPlan) {
    setPlan(updated)
    saveWorkoutPlan(updated)
  }

  function addExercise() {
    if (!exForm.name.trim()) return
    const ex: ExerciseConfig = {
      id: `ex-${Date.now()}`,
      name: exForm.name.trim(),
      sets: exForm.sets,
      reps: exForm.reps,
      isTimed: exForm.isTimed,
      note: exForm.note.trim(),
    }
    persistPlan({ ...plan, exercises: [...plan.exercises, ex] })
    setExForm({ name: "", sets: "3", reps: "12", isTimed: false, note: "" })
    setAddingEx(false)
  }

  function removeExercise(id: string) {
    persistPlan({ ...plan, exercises: plan.exercises.filter(e => e.id !== id) })
  }

  function updateScheduleDay(day: string, field: string, value: any) {
    const updated = plan.schedule.map(s => s.day === day ? { ...s, [field]: value } : s)
    persistPlan({ ...plan, schedule: updated })
  }

  function toggleDayType(day: string, type: string) {
    const sched = plan.schedule.find(s => s.day === day)
    if (!sched) return
    let types = [...sched.types]
    if (type === "rest") {
      types = types.includes("rest") ? ["walk"] : ["rest"]
    } else {
      types = types.filter(t => t !== "rest")
      if (types.includes(type as any)) types = types.filter(t => t !== type)
      else types = [...types, type as any]
      if (types.length === 0) types = ["walk"]
    }
    updateScheduleDay(day, "types", types)
  }

  const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]

  return (
    <Section title="Workout Plan">
      {/* Circuit settings */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1">
          <label className="text-xs text-gray-500 block mb-1">Rounds per session</label>
          <select className={selectCls} value={plan.circuitRounds}
            onChange={e => persistPlan({ ...plan, circuitRounds: Number(e.target.value) })}>
            {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} rounds</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-xs text-gray-500 block mb-1">Rest between rounds</label>
          <select className={selectCls} value={plan.restBetweenRounds}
            onChange={e => persistPlan({ ...plan, restBetweenRounds: Number(e.target.value) })}>
            {[30,60,90,120,180].map(n => <option key={n} value={n}>{n}s</option>)}
          </select>
        </div>
      </div>

      {/* Weekly schedule */}
      <div className="text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">Weekly Schedule</div>
      {DAYS.map(day => {
        const sched = plan.schedule.find(s => s.day === day)!
        const isRest = sched.types.includes("rest")
        return (
          <div key={day} className="mb-3 p-3 bg-gray-50 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-700">{day}</span>
              <div className="flex gap-1">
                {["walk","circuit","rest"].map(t => (
                  <button key={t} onClick={() => toggleDayType(day, t)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border capitalize
                      ${sched.types.includes(t as any)
                        ? t === "rest" ? "bg-gray-500 text-white border-gray-500"
                          : "bg-teal-600 text-white border-teal-600"
                        : "bg-white text-gray-400 border-gray-200"}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            {!isRest && sched.types.includes("walk") && (
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] text-gray-500">Walk target:</span>
                <input type="number" min="0" max="180" step="5"
                  value={sched.walkTarget}
                  onChange={e => updateScheduleDay(day, "walkTarget", Number(e.target.value))}
                  className="w-16 border border-gray-200 rounded px-2 py-0.5 text-xs" />
                <span className="text-[10px] text-gray-400">min</span>
              </div>
            )}
            <input type="text" placeholder="Day note (optional)"
              value={sched.note}
              onChange={e => updateScheduleDay(day, "note", e.target.value)}
              className="w-full border border-gray-200 rounded px-2 py-1 text-[10px] text-gray-600" />
          </div>
        )
      })}

      {/* Exercise list */}
      <div className="text-xs font-bold text-gray-600 mb-2 mt-2 uppercase tracking-wide">Circuit Exercises</div>
      <p className="text-[10px] text-gray-400 mb-2">These appear in your circuit timer in order.</p>
      {plan.exercises.map((ex, i) => (
        <div key={ex.id} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl mb-1.5">
          <span className="text-[10px] text-gray-400 w-4 shrink-0">{i + 1}</span>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-gray-700">{ex.name}</div>
            <div className="text-[10px] text-gray-400">{ex.sets} sets · {ex.reps}{ex.isTimed ? " (timed)" : ""}</div>
          </div>
          <button onClick={() => removeExercise(ex.id)}
            className="text-red-300 text-xs px-1.5 py-0.5 border border-red-100 rounded-lg shrink-0">✕</button>
        </div>
      ))}
      {plan.exercises.length === 0 && !addingEx && (
        <p className="text-xs text-gray-400 text-center py-2">No exercises added yet</p>
      )}
      {addingEx && (
        <div className="bg-gray-50 rounded-xl p-3 mb-2">
          <input className={inputCls + " mb-2"} type="text" placeholder="Exercise name"
            value={exForm.name} onChange={e => setExForm(f => ({ ...f, name: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">Sets</label>
              <input className={inputCls} type="text" placeholder="e.g. 3-4"
                value={exForm.sets} onChange={e => setExForm(f => ({ ...f, sets: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">{exForm.isTimed ? "Duration (sec)" : "Reps"}</label>
              <input className={inputCls} type="text" placeholder={exForm.isTimed ? "30" : "12"}
                value={exForm.reps} onChange={e => setExForm(f => ({ ...f, reps: e.target.value }))} />
            </div>
          </div>
          <label className="flex items-center gap-2 mb-2 cursor-pointer">
            <input type="checkbox" checked={exForm.isTimed}
              onChange={e => setExForm(f => ({ ...f, isTimed: e.target.checked }))} />
            <span className="text-xs text-gray-600">Timed exercise (countdown timer)</span>
          </label>
          <input className={inputCls + " mb-3"} type="text" placeholder="Tip / note (optional)"
            value={exForm.note} onChange={e => setExForm(f => ({ ...f, note: e.target.value }))} />
          <div className="flex gap-2">
            <button onClick={() => setAddingEx(false)}
              className="flex-1 py-2 bg-gray-100 text-gray-500 rounded-lg text-sm font-bold">Cancel</button>
            <button onClick={addExercise}
              className="flex-1 py-2 bg-teal-600 text-white rounded-lg text-sm font-bold">Add</button>
          </div>
        </div>
      )}
      {!addingEx && (
        <button onClick={() => setAddingEx(true)}
          className="w-full py-2 border border-teal-500 text-teal-600 rounded-xl text-sm font-bold mt-1">
          + Add Exercise
        </button>
      )}
    </Section>
  )
}



// ── Theme Toggle ──────────────────────────────────────────────────────────────
function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>(() => loadTheme())
  function toggle() {
    const next: Theme = theme === "light" ? "dark" : "light"
    setThemeState(next)
    saveTheme(next)
  }
  return (
    <button onClick={toggle}
      className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 bg-gray-50">
      {theme === "light" ? "🌙 Dark" : "☀️ Light"}
    </button>
  )
}

// ── Macro Split Section ───────────────────────────────────────────────────────
const MACRO_PRESETS = [
  { label: "Keto",         fat: 70, protein: 25, carbs: 5  },
  { label: "Low-carb",     fat: 50, protein: 30, carbs: 20 },
  { label: "Balanced",     fat: 35, protein: 30, carbs: 35 },
  { label: "High-protein", fat: 30, protein: 40, carbs: 30 },
  { label: "Custom",       fat: 0,  protein: 0,  carbs: 0  },
]

function MacroSplitSection({ macroSplit, updateMacroSplit }: {
  macroSplit: { fatPct: number; proteinPct: number; carbsPct: number }
  updateMacroSplit: (patch: any) => void
}) {
  const [unlocked, setUnlocked] = useState(false)
  const totalPct = macroSplit.fatPct + macroSplit.proteinPct + macroSplit.carbsPct
  const pctOk = totalPct === 100

  const activePreset = MACRO_PRESETS.find(p =>
    p.fat === macroSplit.fatPct && p.protein === macroSplit.proteinPct && p.carbs === macroSplit.carbsPct
  )?.label ?? "Custom"

  function applyPreset(preset: typeof MACRO_PRESETS[0]) {
    if (preset.label === "Custom") return
    updateMacroSplit({ fatPct: preset.fat, proteinPct: preset.protein, carbsPct: preset.carbs })
  }

  return (
    <Section title="Macro Split">
      <div className="flex flex-wrap gap-1.5 mb-3">
        {MACRO_PRESETS.filter(p => p.label !== "Custom").map(preset => (
          <button key={preset.label} onClick={() => applyPreset(preset)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors
              ${activePreset === preset.label
                ? "bg-teal-600 text-white border-teal-600"
                : "bg-white text-gray-500 border-gray-200"}`}>
            {preset.label}
          </button>
        ))}
      </div>

      <div className="flex rounded-full overflow-hidden h-3 mb-2">
        <div className="bg-yellow-400 transition-all" style={{ width: `${macroSplit.fatPct}%` }} />
        <div className="bg-blue-400 transition-all"   style={{ width: `${macroSplit.proteinPct}%` }} />
        <div className="bg-green-400 transition-all"  style={{ width: `${macroSplit.carbsPct}%` }} />
      </div>

      <div className="flex justify-between text-xs text-gray-500 mb-3">
        <span>🟡 Fat {macroSplit.fatPct}%</span>
        <span>🔵 Protein {macroSplit.proteinPct}%</span>
        <span>🟢 Carbs {macroSplit.carbsPct}%</span>
      </div>

      <button onClick={() => setUnlocked(u => !u)}
        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors w-full
          ${unlocked ? "bg-amber-50 border-amber-300 text-amber-700" : "bg-gray-50 border-gray-200 text-gray-500"}`}>
        {unlocked ? "🔓 Custom mode — tap a preset to lock" : "✏️ Customise manually"}
      </button>

      {unlocked && (
        <div className="mt-3">
          <p className="text-xs text-gray-400 mb-2">Adjust sliders — must total 100%</p>
          {[
            { key: "fatPct",     label: "Fat %" },
            { key: "proteinPct", label: "Protein %" },
            { key: "carbsPct",   label: "Carbs %" },
          ].map(({ key, label }) => (
            <div key={key} className="mb-3">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">{label}</span>
                <span className="font-mono font-semibold">{macroSplit[key as keyof typeof macroSplit]}%</span>
              </div>
              <input type="range" min={0} max={100}
                value={macroSplit[key as keyof typeof macroSplit]}
                className="w-full accent-teal-600"
                onChange={e => updateMacroSplit({ [key]: Number(e.target.value) })} />
            </div>
          ))}
          {!pctOk && <p className="text-xs text-red-500">Total is {totalPct}% — adjust to reach 100%</p>}
          {pctOk  && <p className="text-xs text-teal-600">✓ Valid</p>}
        </div>
      )}
    </Section>
  )
}

// ── Main Settings Component ───────────────────────────────────────────────────
export default function Settings({ onGoalModeChange }: { onGoalModeChange?: (mode: import("../services/goalModeConfig").GoalMode) => void }) {
  const { profile, goals, settings, updateProfile, updateGoals, updateMacroSplit, updateIFProtocol } = useHealthStore()
  const macros = computeMacros(profile, goals, settings)
  const { macroSplit, ifProtocol } = settings

  const totalPct = macroSplit.fatPct + macroSplit.proteinPct + macroSplit.carbsPct
  const pctOk = totalPct === 100

  const fastEnd = (ifProtocol.fastStartHour + ifProtocol.fastingHours) % 24
  const eatStart = fastEnd
  const eatEnd = (eatStart + ifProtocol.eatingHours) % 24

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">Settings</h1>
        <ThemeToggle />
      </div>

      {/* ── Profile ── */}
      <Section title="Your Profile">
        <Field label="Name (optional)">
          <input className={inputCls} type="text" placeholder="e.g. Nitin"
            value={profile.name} onChange={e => updateProfile({ name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Age">
            <input className={inputCls} type="number" placeholder="years" min={10} max={100}
              value={profile.age}
              onChange={e => updateProfile({ age: e.target.value === "" ? "" : Number(e.target.value) })} />
          </Field>
          <Field label="Sex">
            <select className={selectCls} value={profile.sex}
              onChange={e => updateProfile({ sex: e.target.value as "male" | "female" })}>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </Field>
          <Field label="Height (cm)">
            <input className={inputCls} type="number" placeholder="cm" min={100} max={250}
              value={profile.heightCm}
              onChange={e => updateProfile({ heightCm: e.target.value === "" ? "" : Number(e.target.value) })} />
          </Field>
          <Field label="Current weight (kg)">
            <input className={inputCls} type="number" placeholder="kg" step={0.1} min={30} max={300}
              value={profile.weightKg}
              onChange={e => updateProfile({ weightKg: e.target.value === "" ? "" : Number(e.target.value) })} />
          </Field>
        </div>
        <Field label="Activity level">
          <select className={selectCls} value={profile.activityLevel}
            onChange={e => updateProfile({ activityLevel: e.target.value as ActivityLevel })}>
            {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map(k => (
              <option key={k} value={k}>{ACTIVITY_LABELS[k]}</option>
            ))}
          </select>
        </Field>
      </Section>

      {/* ── Goals ── */}
      <Section title="Goals">
        <Field label="Target weight (kg)">
          <input className={inputCls} type="number" placeholder="kg" step={0.5} min={30} max={300}
            value={goals.targetWeightKg}
            onChange={e => updateGoals({ targetWeightKg: e.target.value === "" ? "" : Number(e.target.value) })} />
        </Field>
        <Field label="Weight loss rate">
          <select className={selectCls} value={String(goals.weeklyLossKg)}
            onChange={e => updateGoals({ weeklyLossKg: Number(e.target.value) as WeightLossRate })}>
            {Object.entries(LOSS_RATE_LABELS).map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
        </Field>
      </Section>

      {/* ── Macro Split ── */}
      <MacroSplitSection macroSplit={macroSplit} updateMacroSplit={updateMacroSplit} />

      {/* ── IF Protocol ── */}
      <Section title="Intermittent Fasting Protocol">
        <Field label={`Fasting window: ${ifProtocol.fastingHours}h fast / ${ifProtocol.eatingHours}h eat`}>
          <input type="range" min={12} max={23} value={ifProtocol.fastingHours}
            className="w-full accent-teal-600"
            onChange={e => updateIFProtocol({ fastingHours: Number(e.target.value) })} />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>12:12</span><span>16:8</span><span>18:6</span><span>19:5</span><span>20:4</span><span>23:1</span>
          </div>
        </Field>
        <Field label={`Fast starts at: ${formatHour(ifProtocol.fastStartHour)}`}>
          <input type="range" min={0} max={23} value={ifProtocol.fastStartHour}
            className="w-full accent-teal-600"
            onChange={e => updateIFProtocol({ fastStartHour: Number(e.target.value) })} />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>11 PM</span>
          </div>
        </Field>
        <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 mt-1">
          <p>🍽 Eating window: <span className="font-semibold">{formatHour(eatStart)} → {formatHour(eatEnd)}</span></p>
          <p className="mt-1">🚫 Fasting: <span className="font-semibold">{formatHour(ifProtocol.fastStartHour)} → {formatHour(eatStart)}</span></p>
        </div>
      </Section>

      {/* ── Calculated Targets ── */}
      <Section title="Calculated Targets">
        <div className="mb-3">
          <label className="text-xs text-gray-500 block mb-1">BMR override (optional — from smart scale or DEXA)</label>
          <div className="flex gap-2 items-center">
            <input type="number" placeholder={`Auto: ${computeMacros(profile, goals, settings)?.bmr ?? "—"} kcal`}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
              value={profile.bmrOverride ?? ""}
              onChange={e => updateProfile({ bmrOverride: e.target.value === "" ? undefined : Number(e.target.value) })} />
            <span className="text-xs text-gray-400 whitespace-nowrap">kcal</span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">Leave blank to use calculated BMR. Enter your scale&apos;s reading for more accuracy.</p>
        </div>
        {!macros ? (
          <p className="text-sm text-gray-500">Fill in your profile above to see calculated targets.</p>
        ) : (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">BMR (base metabolism)</span>
              <span className="font-semibold">{macros.bmr} kcal</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">TDEE (maintenance)</span>
              <span className="font-semibold">{macros.tdee} kcal</span>
            </div>
            <div className="flex justify-between text-sm border-t pt-2 mt-2">
              <span className="text-gray-700 font-medium">Daily target</span>
              <span className="font-bold text-teal-700">{macros.targetCalories} kcal</span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              {[
                { label: "Fat",     g: macros.fatG,     color: "bg-yellow-50 border-yellow-200 text-yellow-800" },
                { label: "Protein", g: macros.proteinG, color: "bg-blue-50 border-blue-200 text-blue-800" },
                { label: "Carbs",   g: macros.carbsG,   color: "bg-green-50 border-green-200 text-green-800" },
              ].map(({ label, g, color }) => (
                <div key={label} className={`rounded-lg border p-2 text-center ${color}`}>
                  <div className="text-lg font-bold">{g}g</div>
                  <div className="text-xs">{label}</div>
                </div>
              ))}
            </div>
            {goals.targetWeightKg !== "" && profile.weightKg !== "" && (
              <p className="text-xs text-gray-500 mt-3 text-center">
                {Number(profile.weightKg) > Number(goals.targetWeightKg)
                  ? `${(Number(profile.weightKg) - Number(goals.targetWeightKg)).toFixed(1)} kg to goal · ~${Math.ceil((Number(profile.weightKg) - Number(goals.targetWeightKg)) / goals.weeklyLossKg)} weeks at current rate`
                  : "✓ At or below target weight"}
              </p>
            )}
          </div>
        )}
      </Section>

      {/* ── Goal Mode ── */}
      <GoalModeSelector onModeChange={onGoalModeChange} />

      {/* ── Medications ── */}
      <MedicationsSection />

      {/* ── Blood Tests ── */}
      <BloodTestsSection />

      {/* ── Today Tasks ── */}
      <TodayTasksSection />

      {/* ── AI & Voice ── */}
      <AISettingsSection />

      {/* ── Break Periods ── */}
      <BreakPeriodsSection />

      {/* ── Workout Plan ── */}
      <WorkoutPlanSection />

    </div>
  )
}
