import { useState, useRef, useEffect } from "react"
import {
  loadHistory, loadAISettings, saveAISettings, AISettings,
  loadFocusItems, saveFocusItems, addFocusItem, FocusItem,
  useHealthStore,
} from "../store/useHealthStore"
import { computeMacros } from "../services/adaptiveTDEE"

// ── Weekly Report ─────────────────────────────────────────────────────────────
function buildWeeklyPrompt(history: ReturnType<typeof loadHistory>, profile: any, goals: any, macros: any): string {
  const last7 = history.slice(0, 7).reverse()
  const avgCal     = last7.length ? Math.round(last7.reduce((a,h) => a + h.cal, 0) / last7.length) : 0
  const avgProtein = last7.length ? Math.round(last7.reduce((a,h) => a + h.protein, 0) / last7.length) : 0
  const avgCarbs   = last7.length ? Math.round(last7.reduce((a,h) => a + h.carbs, 0) / last7.length) : 0
  const avgWater   = last7.length ? +(last7.reduce((a,h) => a + (h.water||0), 0) / last7.length).toFixed(1) : 0
  const workoutDays = last7.filter(h => h.workoutDone).length
  const weights    = last7.filter(h => h.weight !== null).map(h => h.weight)
  const weightStart = weights[0], weightEnd = weights[weights.length - 1]

  return `You are a health coach reviewing my week. Please give me honest, specific feedback and 2-3 actionable focus items for next week.

MY PROFILE:
- ${profile.sex === "male" ? "Male" : "Female"}, age ${profile.age}, height ${profile.heightCm}cm
- Current weight: ~${profile.weightKg}kg → Goal: ${goals.targetWeightKg}kg
- Diet: Keto / Intermittent Fasting 19:5
- Medications: Saroglitazar, Olmesartan 20mg, Ozempic (weekly)

DAILY TARGETS:
- Calories: ${macros?.targetCalories ?? "—"} kcal
- Protein: ${macros?.proteinG ?? "—"}g, Carbs: ${macros?.carbsG ?? "—"}g, Fat: ${macros?.fatG ?? "—"}g

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
  const [adding, setAdding] = useState(false)
  const [newText, setNewText] = useState("")

  function markDone(id: string) {
    const updated = items.map(i => i.id === id ? { ...i, done: true } : i)
    saveFocusItems(updated)
    setItems(loadFocusItems())
  }

  function addManual() {
    if (!newText.trim()) return
    addFocusItem(newText.trim())
    setItems(loadFocusItems())
    setNewText("")
    setAdding(false)
  }

  function removeItem(id: string) {
    const updated = items.filter(i => i.id !== id)
    saveFocusItems(updated)
    setItems(loadFocusItems())
  }

  const daysLeft = (expiresAt: number) => Math.max(0, Math.ceil((expiresAt - Date.now()) / 86400000))

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
      <div className="flex justify-between items-center mb-3">
        <div className="text-sm font-bold text-gray-800">📌 This Week's Focus</div>
        <button onClick={() => setAdding(a => !a)}
          className="text-xs text-teal-600 border border-teal-200 px-2.5 py-1 rounded-lg font-bold">
          {adding ? "Cancel" : "+ Add"}
        </button>
      </div>

      {items.length === 0 && !adding && (
        <p className="text-xs text-gray-400 text-center py-3">
          No focus items yet. Generate a weekly report or add manually.
        </p>
      )}

      {items.map(item => (
        <div key={item.id} className="flex items-start gap-2 py-2.5 border-b border-gray-50 last:border-0">
          <button onClick={() => markDone(item.id)}
            className="w-5 h-5 rounded-full border-2 border-teal-400 flex items-center justify-center shrink-0 mt-0.5">
            <div className="w-2.5 h-2.5 rounded-full bg-teal-400 opacity-0 hover:opacity-100 transition-opacity" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-gray-700 leading-relaxed">{item.text}</div>
            <div className="text-[9px] text-gray-300 mt-0.5">{daysLeft(item.expiresAt)} days left</div>
          </div>
          <button onClick={() => removeItem(item.id)} className="text-gray-200 text-sm px-1 shrink-0">×</button>
        </div>
      ))}

      {adding && (
        <div className="mt-2">
          <input type="text" placeholder="e.g. Hit 110g protein every day this week"
            value={newText} onChange={e => setNewText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addManual()}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs mb-2 focus:outline-none focus:border-teal-500" />
          <button onClick={addManual}
            className="w-full py-2 bg-teal-600 text-white rounded-lg text-xs font-bold">Add Focus Item</button>
        </div>
      )}
    </div>
  )
}

// ── Weekly Report ─────────────────────────────────────────────────────────────
function WeeklyReport() {
  const { profile, goals, settings } = useHealthStore()
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState("")
  const [savingFeedback, setSavingFeedback] = useState(false)
  const [savedFeedback, setSavedFeedback] = useState(false)
  const [focusText, setFocusText] = useState("")
  const [showFocusInput, setShowFocusInput] = useState(false)

  const history = loadHistory()
  const macros  = computeMacros(profile, goals, settings)

  function generateAndCopy() {
    const prompt = buildWeeklyPrompt(history, profile, goals, macros)
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
      // Try to open claude.ai
      window.open("https://claude.ai", "_blank")
    }).catch(() => {
      // Fallback — show the prompt
      alert("Copy failed. Open claude.ai and paste this:\n\n" + prompt.slice(0, 500) + "...")
    })
  }

  function saveFeedback() {
    if (!feedback.trim()) return
    const existing = JSON.parse(localStorage.getItem("weekly_feedback") || "[]")
    existing.unshift({ date: new Date().toISOString().slice(0, 10), text: feedback.trim() })
    localStorage.setItem("weekly_feedback", JSON.stringify(existing.slice(0, 52)))
    setSavedFeedback(true)
    setSavingFeedback(false)
    setTimeout(() => setSavedFeedback(false), 2000)
  }

  function addFocus() {
    if (!focusText.trim()) return
    addFocusItem(focusText.trim())
    setFocusText("")
    setShowFocusInput(false)
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
      <div className="text-sm font-bold text-gray-800 mb-1">📊 AI Weekly Report</div>
      <p className="text-xs text-gray-400 mb-3">
        Your last 7 days packaged as a coaching prompt. Opens claude.ai — paste and get personalised feedback.
      </p>

      <button onClick={generateAndCopy}
        className={`w-full py-3 rounded-xl font-bold text-sm mb-3 transition-colors
          ${copied ? "bg-green-500 text-white" : "bg-teal-600 text-white"}`}>
        {copied ? "✓ Copied! claude.ai is opening..." : "📋 Generate & Copy Report"}
      </button>

      {history.length < 3 && (
        <div className="text-[10px] text-amber-600 bg-amber-50 rounded-lg p-2 mb-3">
          ⚠️ Log at least 3 days of food + weight for a meaningful report. You have {history.length} day{history.length !== 1 ? "s" : ""} so far.
        </div>
      )}

      <div className="border-t border-gray-50 pt-3">
        <div className="text-xs font-bold text-gray-600 mb-2">After reading Claude's feedback:</div>
        <button onClick={() => setSavingFeedback(s => !s)}
          className="w-full py-2.5 border border-gray-200 text-gray-600 rounded-xl text-xs font-bold mb-2">
          💬 Save this week's feedback
        </button>
        {savingFeedback && (
          <div className="mb-2">
            <textarea rows={3} placeholder="Paste or type the key points from Claude's coaching..."
              value={feedback} onChange={e => setFeedback(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs mb-2 focus:outline-none" />
            <button onClick={saveFeedback}
              className="w-full py-2 bg-gray-700 text-white rounded-lg text-xs font-bold">
              {savedFeedback ? "✓ Saved!" : "Save Feedback"}
            </button>
          </div>
        )}
        <button onClick={() => setShowFocusInput(s => !s)}
          className="w-full py-2.5 border border-teal-200 text-teal-600 rounded-xl text-xs font-bold">
          📌 Add a focus item for next week
        </button>
        {showFocusInput && (
          <div className="mt-2">
            <input type="text" placeholder="e.g. Walk every morning before breaking fast"
              value={focusText} onChange={e => setFocusText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addFocus()}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs mb-2 focus:outline-none" />
            <button onClick={addFocus}
              className="w-full py-2 bg-teal-600 text-white rounded-lg text-xs font-bold">Add Focus Item</button>
          </div>
        )}
      </div>
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
  const history = loadHistory().slice(0, 7)

  const systemPrompt = `You are a personal health coach integrated into a health tracking app. You have access to the user's data.

User profile: ${profile.sex === "male" ? "Male" : "Female"}, age ${profile.age}, height ${profile.heightCm}cm, current weight ${profile.weightKg}kg, goal ${goals.targetWeightKg}kg.
Diet: Keto + IF 19:5. Medications: Saroglitazar, Olmesartan 20mg, Ozempic.
Daily targets: ${macros?.targetCalories ?? "—"} kcal, ${macros?.proteinG ?? "—"}g protein, ${macros?.carbsG ?? "—"}g carbs.

Recent 7-day averages: ${history.length > 0
  ? `${Math.round(history.reduce((a,h)=>a+h.cal,0)/history.length)} kcal, ${Math.round(history.reduce((a,h)=>a+h.protein,0)/history.length)}g protein`
  : "Not enough data yet"}.

Answer concisely and specifically based on the user's actual data. When you suggest a focus item, end your message with "FOCUS: [specific action]" so the user can save it.`

  async function sendMessage() {
    if (!input.trim() || loading) return
    if (!aiSettings.anthropicKey) {
      setError("Add your Anthropic API key in Settings → AI & Voice to use in-app chat.")
      return
    }

    const userMsg: Message = { role: "user", content: input.trim() }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput("")
    setLoading(true)
    setError("")

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": aiSettings.anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 500,
          system: systemPrompt,
          messages: updatedMessages,
        }),
      })

      if (!response.ok) throw new Error(`API error ${response.status}`)
      const data = await response.json()
      const reply = data.content[0]?.text ?? "No response"
      setMessages(prev => [...prev, { role: "assistant", content: reply }])
    } catch (err: any) {
      setError("Failed to connect to Claude. Check your API key in Settings.")
    } finally {
      setLoading(false)
    }
  }

  function saveFocusFromMessage(msg: string) {
    const match = msg.match(/FOCUS:\s*(.+)/i)
    if (match) {
      addFocusItem(match[1].trim())
      alert("Focus item saved to This Week's Focus!")
    }
  }

  if (!aiSettings.anthropicKey) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
        <div className="text-sm font-bold text-gray-800 mb-2">🤖 In-app AI Chat</div>
        <div className="bg-gray-50 rounded-xl p-4 text-center">
          <div className="text-2xl mb-2">🔑</div>
          <div className="text-xs text-gray-600 mb-3">
            Add your Anthropic API key in Settings → AI & Voice to chat with Claude directly inside the app.
          </div>
          <div className="text-[10px] text-gray-400">
            Get your key at console.anthropic.com · Stored locally, never shared
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
      <div className="text-sm font-bold text-gray-800 mb-3">🤖 Chat with your Health Coach</div>

      {/* Message history */}
      <div className="h-64 overflow-y-auto mb-3 space-y-2">
        {messages.length === 0 && (
          <div className="text-center text-xs text-gray-400 py-8">
            Ask anything about your health data.<br/>
            e.g. "Why am I not losing weight?" or "What should I focus on this week?"
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed
              ${msg.role === "user"
                ? "bg-teal-600 text-white rounded-tr-sm"
                : "bg-gray-100 text-gray-700 rounded-tl-sm"}`}>
              {msg.content}
              {msg.role === "assistant" && msg.content.includes("FOCUS:") && (
                <button onClick={() => saveFocusFromMessage(msg.content)}
                  className="block mt-2 text-[10px] bg-teal-600 text-white px-2 py-1 rounded-lg font-bold">
                  📌 Save as focus item
                </button>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-3 py-2 text-xs text-gray-400">
              Thinking...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <div className="text-[10px] text-red-500 mb-2">{error}</div>}

      <div className="flex gap-2">
        <input type="text" placeholder="Ask your health coach..."
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && sendMessage()}
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-teal-500" />
        <button onClick={sendMessage} disabled={loading}
          className="px-4 py-2.5 bg-teal-600 text-white rounded-xl font-bold text-sm disabled:opacity-40">
          →
        </button>
      </div>
    </div>
  )
}

// ── Main AICoach component ────────────────────────────────────────────────────
export default function AICoach() {
  return (
    <div className="p-3 pb-24">
      <div className="bg-gradient-to-br from-gray-900 to-teal-800 rounded-2xl p-4 mb-3 text-white">
        <div className="text-xs opacity-70 mb-0.5">AI Coach</div>
        <div className="text-base font-bold">Weekly Report & Chat</div>
        <div className="text-xs opacity-60 mt-0.5">Powered by Claude · Your data stays on your device</div>
      </div>

      <FocusItemsList />
      <WeeklyReport />
      <InAppChat />
    </div>
  )
}
