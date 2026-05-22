// ── AICoach.tsx ────────────────────────────────────────────────────────────────
// AI Coach tab — uses the user's actual data, never hardcoded personal info.
// Works without API key (graceful messaging), better with one.

import { KEYS } from "../services/storageKeys"
import { useState, useRef, useEffect } from "react"
import {
  loadHistory, loadAISettings, saveAISettings, AISettings,
  loadFocusItems, saveFocusItems, addFocusItem, FocusItem,
  loadMedications, Medication,
  useHealthStore,
} from "../store/useHealthStore"
import { computeMacros } from "../services/adaptiveTDEE"
import { loadDietConfig } from "../services/goalModeConfig"

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildProfileSummary(profile: any, goals: any, macros: any): string {
  const lines: string[] = []
  if (profile.sex || profile.age || profile.heightCm) {
    const parts: string[] = []
    if (profile.sex) parts.push(profile.sex === "male" ? "Male" : "Female")
    if (profile.age) parts.push(`age ${profile.age}`)
    if (profile.heightCm) parts.push(`height ${profile.heightCm}cm`)
    lines.push("- " + parts.join(", "))
  }
  if (profile.weightKg) {
    let line = `- Current weight: ~${profile.weightKg}kg`
    if (goals.targetWeightKg) line += ` → Goal: ${goals.targetWeightKg}kg`
    lines.push(line)
  }

  // Diet — read from saved config, not hardcoded
  try {
    const diet = loadDietConfig()
    if (diet?.mode) lines.push(`- Diet: ${diet.mode}${diet.tag ? ` (${diet.tag})` : ""}`)
  } catch {}

  // Medications — read from saved list, not hardcoded
  const meds = loadMedications().filter((m: Medication) => m.enabled)
  if (meds.length > 0) {
    const medList = meds.map((m: Medication) => m.name + (m.frequency === "weekly" ? " (weekly)" : ""))
    lines.push(`- Medications: ${medList.join(", ")}`)
  }

  if (macros) {
    lines.push("")
    lines.push("DAILY TARGETS:")
    lines.push(`- Calories: ${macros.targetCalories} kcal`)
    lines.push(`- Protein: ${macros.proteinG}g, Carbs: ${macros.carbsG}g, Fat: ${macros.fatG}g`)
  }
  return lines.join("\n")
}

// ── Weekly Report ─────────────────────────────────────────────────────────────
function buildWeeklyPrompt(history: ReturnType<typeof loadHistory>, profile: any, goals: any, macros: any): string {
  const last7 = history.slice(0, 7).reverse()
  const avgCal     = last7.length ? Math.round(last7.reduce((a, h) => a + h.cal, 0) / last7.length) : 0
  const avgProtein = last7.length ? Math.round(last7.reduce((a, h) => a + h.protein, 0) / last7.length) : 0
  const avgCarbs   = last7.length ? Math.round(last7.reduce((a, h) => a + h.carbs, 0) / last7.length) : 0
  const avgWater   = last7.length ? +(last7.reduce((a, h) => a + (h.water || 0), 0) / last7.length).toFixed(1) : 0
  const workoutDays = last7.filter(h => h.workoutDone).length
  const weights    = last7.filter(h => h.weight !== null).map(h => h.weight)
  const weightStart = weights[0], weightEnd = weights[weights.length - 1]

  const profileSummary = buildProfileSummary(profile, goals, macros)

  return `You are a health coach reviewing my week. Please give me honest, specific feedback and 2-3 actionable focus items for next week.

MY PROFILE:
${profileSummary}

LAST 7 DAYS:
- Avg calories: ${avgCal} kcal/day (target: ${macros?.targetCalories ?? "—"})
- Avg protein: ${avgProtein}g/day (target: ${macros?.proteinG ?? "—"}g)
- Avg carbs: ${avgCarbs}g/day (target: ${macros?.carbsG ?? "—"}g)
- Avg water: ${avgWater}L/day
- Workout days: ${workoutDays}/7
${weights.length >= 2 ? `- Weight: ${weightStart}kg → ${weightEnd}kg (${weightEnd! > weightStart! ? "+" : ""}${(weightEnd! - weightStart!).toFixed(1)}kg this week)` : "- Weight: Not enough data logged"}

Please review:
1. What's going well?
2. What's the biggest gap between targets and reality?
3. Any patterns I should be aware of?
4. Give me exactly 3 specific focus items for next week (each one sentence, actionable).`
}

// ── Focus Items Manager ───────────────────────────────────────────────────────
function FocusItemsList() {
  const [items, setItems] = useState<FocusItem[]>(() => loadFocusItems())

  function markDone(id: string) {
    const updated = items.map(i => i.id === id ? { ...i, done: true } : i)
    saveFocusItems(updated)
    setItems(updated.filter(i => !i.done))
  }

  if (items.length === 0) return null

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
      <div className="text-sm font-bold text-gray-800 mb-3">📌 Current Focus Items</div>
      {items.map(item => (
        <div key={item.id} className="flex items-center gap-2 py-2 border-b border-gray-50 last:border-0">
          <button onClick={() => markDone(item.id)}
            className="w-5 h-5 rounded-full border-2 border-gray-300 hover:border-teal-500 shrink-0" />
          <span className="text-xs text-gray-700 flex-1">{item.text}</span>
          <span className="text-[10px] text-gray-300">
            {Math.ceil((item.expiresAt - Date.now()) / (24 * 60 * 60 * 1000))}d left
          </span>
        </div>
      ))}
    </div>
  )
}

// ── No-key fallback panel ─────────────────────────────────────────────────────
function NoKeyPanel({ feature, onPromptCopied }: { feature: string; onPromptCopied?: () => void }) {
  const { profile, goals, settings } = useHealthStore()
  const macros = computeMacros(profile, goals, settings)
  const history = loadHistory()

  function copyPrompt() {
    const prompt = buildWeeklyPrompt(history, profile, goals, macros)
    navigator.clipboard.writeText(prompt).then(() => {
      onPromptCopied?.()
    }).catch(() => {
      // Fallback: show in a textarea
      const ta = document.createElement("textarea")
      ta.value = prompt
      document.body.appendChild(ta)
      ta.select()
      document.execCommand("copy")
      ta.remove()
      onPromptCopied?.()
    })
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-3">
      <div className="text-sm font-bold text-blue-900 mb-2">💡 {feature} — free option</div>
      <p className="text-xs text-blue-800 mb-3 leading-relaxed">
        No API key? No problem. We'll copy a personalised prompt — paste it into Claude.ai (free)
        or ChatGPT and get the same analysis without paying for an API key.
      </p>
      <button onClick={copyPrompt}
        className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold mb-2">
        📋 Copy Prompt
      </button>
      <a href="https://claude.ai" target="_blank" rel="noopener noreferrer"
        className="block text-center text-xs text-blue-600 font-semibold underline">
        Open Claude.ai →
      </a>
    </div>
  )
}

// ── Weekly Report Section ─────────────────────────────────────────────────────
function WeeklyReportSection() {
  const { profile, goals, settings } = useHealthStore()
  const [aiSettings] = useState<AISettings>(() => loadAISettings())
  const [report, setReport] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)

  const macros = computeMacros(profile, goals, settings)
  const hasKey = !!aiSettings.anthropicKey

  async function generate() {
    if (!hasKey) return
    setLoading(true); setError("")
    try {
      const history = loadHistory()
      const prompt = buildWeeklyPrompt(history, profile, goals, macros)
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": aiSettings.anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 800,
          messages: [{ role: "user", content: prompt }],
        }),
      })
      if (!res.ok) throw new Error(`API error ${res.status}`)
      const data = await res.json()
      const text = data.content?.find((b: any) => b.type === "text")?.text ?? "No response"
      setReport(text)
      try {
        localStorage.setItem(KEYS.WEEKLY_FEEDBACK, JSON.stringify({ text, date: new Date().toISOString() }))
      } catch {}
    } catch {
      setError("Failed to generate report. Check your API key.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
      <div className="text-sm font-bold text-gray-800 mb-3">📊 AI Weekly Report</div>

      {!hasKey && (
        <NoKeyPanel feature="Weekly Report" onPromptCopied={() => { setCopied(true); setTimeout(() => setCopied(false), 3000) }} />
      )}

      {copied && (
        <div className="bg-green-50 text-green-700 text-xs font-bold px-3 py-2 rounded-xl mb-3 text-center">
          ✅ Prompt copied — paste into Claude.ai or ChatGPT
        </div>
      )}

      {report && (
        <div className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap mb-3 bg-gray-50 p-3 rounded-xl">
          {report}
        </div>
      )}

      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

      {hasKey && (
        <button onClick={generate} disabled={loading}
          className="w-full py-2.5 bg-teal-600 text-white rounded-xl text-sm font-bold disabled:opacity-40">
          {loading ? "Generating..." : report ? "Regenerate Report" : "Generate with API"}
        </button>
      )}
    </div>
  )
}

// ── In-app Chat ───────────────────────────────────────────────────────────────
type Message = { role: "user" | "assistant"; content: string }

function InAppChat() {
  const { profile, goals, settings } = useHealthStore()
  const [aiSettings] = useState<AISettings>(() => loadAISettings())
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const macros = computeMacros(profile, goals, settings)
  const hasKey = !!aiSettings.anthropicKey

  const systemPrompt = `You are a personal health coach integrated into a health tracking app. You have access to the user's data.

User profile:
${buildProfileSummary(profile, goals, macros)}

Recent 7-day data: ${(() => {
  const h = loadHistory().slice(0, 7)
  if (h.length === 0) return "Not enough data yet"
  return `Avg ${Math.round(h.reduce((a,r)=>a+r.cal,0)/h.length)} kcal, ${Math.round(h.reduce((a,r)=>a+r.protein,0)/h.length)}g protein/day`
})()}

Answer concisely and specifically based on the user's actual data. When you suggest a focus item, end your message with "FOCUS: [specific action]" so the user can save it.

IMPORTANT: You are a coach, not a doctor. For medical decisions or anything involving medications/dosing, always direct the user to consult their physician.`

  async function sendMessage() {
    if (!input.trim() || loading) return
    if (!hasKey) {
      setError("Add your Anthropic API key in Settings → AI & Voice to use chat. Or use the weekly report prompt above with free Claude.ai.")
      return
    }
    const newMessages: Message[] = [...messages, { role: "user", content: input }]
    setMessages(newMessages)
    setInput("")
    setLoading(true); setError("")

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": aiSettings.anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 600,
          system: systemPrompt,
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      if (!res.ok) throw new Error(`API error ${res.status}`)
      const data = await res.json()
      const text = data.content?.find((b: any) => b.type === "text")?.text ?? "No response"
      setMessages([...newMessages, { role: "assistant", content: text }])

      // Auto-extract FOCUS: items
      const focusMatch = text.match(/FOCUS:\s*(.+?)(?:\n|$)/i)
      if (focusMatch) addFocusItem(focusMatch[1].trim())
    } catch {
      setError("Failed to send. Check your API key and connection.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
      <div className="text-sm font-bold text-gray-800 mb-3">💬 Chat Coach</div>

      {messages.length === 0 && (
        <p className="text-xs text-gray-400 mb-3">
          Ask any health question — "why am I stalled?", "should I take a break?", "what should I eat?".
          {!hasKey && " Needs API key — see Weekly Report above for a free alternative."}
        </p>
      )}

      <div className="max-h-64 overflow-y-auto mb-3 space-y-2">
        {messages.map((m, i) => (
          <div key={i} className={`text-xs p-2.5 rounded-xl ${
            m.role === "user" ? "bg-teal-50 text-gray-800 ml-6" : "bg-gray-50 text-gray-700 mr-6"
          }`}>
            <div className="text-[10px] font-bold text-gray-400 mb-0.5">{m.role === "user" ? "You" : "Coach"}</div>
            <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

      <div className="flex gap-2">
        <input type="text" value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && sendMessage()}
          placeholder={hasKey ? "Ask anything..." : "Add API key in Settings to enable"}
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-teal-500" />
        <button onClick={sendMessage} disabled={loading || !input.trim()}
          className="px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-bold disabled:opacity-40">
          {loading ? "..." : "Send"}
        </button>
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function AICoach() {
  return (
    <div className="p-4 pb-24">
      <h1 className="text-xl font-bold text-gray-900 mb-1">🤖 AI Coach</h1>
      <p className="text-xs text-gray-500 mb-4">Personalised analysis of your data. Works without keys (copy prompt) or with them (in-app).</p>

      <FocusItemsList />
      <WeeklyReportSection />
      <InAppChat />

      <div className="bg-gray-50 rounded-xl p-3 mt-4">
        <p className="text-[10px] text-gray-500 leading-relaxed text-center">
          ⚕️ AI suggestions are not medical advice. Always consult your doctor before making medication or health changes.
        </p>
      </div>
    </div>
  )
}
