import { useHealthStore, loadHistory, loadAISettings } from "../store/useHealthStore"
import { computeMacros } from "../services/adaptiveTDEE"
import { useState } from "react"
import { KEYS } from "../services/storageKeys"

function buildPrompt(history: ReturnType<typeof loadHistory>, profile: any, goals: any, macros: any): string {
  const last7 = history.slice(0, 7).reverse()
  const avgCal     = last7.length ? Math.round(last7.reduce((a, h) => a + h.cal, 0) / last7.length) : 0
  const avgProtein = last7.length ? Math.round(last7.reduce((a, h) => a + h.protein, 0) / last7.length) : 0
  const avgCarbs   = last7.length ? Math.round(last7.reduce((a, h) => a + h.carbs, 0) / last7.length) : 0
  const avgWater   = last7.length ? +(last7.reduce((a, h) => a + (h.water || 0), 0) / last7.length).toFixed(1) : 0
  const workoutDays = last7.filter(h => h.workoutDone).length
  const fastingDays = last7.filter(h => h.fastBest && h.fastBest >= 14 * 3600).length
  const weights    = last7.filter(h => h.weight !== null).map(h => h.weight!)
  const weightStart = weights[0], weightEnd = weights[weights.length - 1]

  return `You are a supportive health coach reviewing a client's week. Be honest, specific, and encouraging. Keep response concise (under 200 words).

PROFILE: ${profile.sex === "male" ? "Male" : "Female"}, age ${profile.age}, ${profile.heightCm}cm, ${profile.weightKg}kg → goal ${goals.targetWeightKg}kg

TARGETS: ${macros?.targetCalories ?? "—"} kcal · ${macros?.proteinG ?? "—"}g protein · ${macros?.carbsG ?? "—"}g carbs

LAST 7 DAYS:
- Avg calories: ${avgCal} kcal/day
- Avg protein: ${avgProtein}g · Avg carbs: ${avgCarbs}g
- Avg water: ${avgWater}L/day
- Workouts: ${workoutDays}/7 days · Fasting: ${fastingDays}/7 days
${weights.length >= 2 ? `- Weight: ${weightStart}kg → ${weightEnd}kg (${weightEnd > weightStart ? "+" : ""}${(weightEnd - weightStart).toFixed(1)}kg)` : "- Weight: insufficient data"}

Give: 1 thing going well, 1 biggest gap, and 3 specific action items for next week. Format clearly.`
}

export default function AIWeeklyReport() {
  const { profile, goals, settings } = useHealthStore()
  const [report, setReport] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const aiSettings = loadAISettings()
  const macros = computeMacros(profile, goals, settings)

  async function generateReport() {
    const apiKey = aiSettings?.apiKey
    if (!apiKey) {
      setError("Add your Claude API key in Settings → AI & Voice to use this feature.")
      return
    }

    setLoading(true)
    setError("")

    try {
      const history = loadHistory()
      const prompt = buildPrompt(history, profile, goals, macros)

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 600,
          messages: [{ role: "user", content: prompt }],
        }),
      })

      if (!res.ok) throw new Error(`API error ${res.status}`)
      const data = await res.json()
      const text = data.content?.find((b: any) => b.type === "text")?.text ?? "No response"
      setReport(text)

      // Cache report with timestamp
      try {
        localStorage.setItem(KEYS.WEEKLY_FEEDBACK, JSON.stringify({ text, date: new Date().toISOString() }))
      } catch {}
    } catch (e: any) {
      setError("Failed to generate report. Check your API key in Settings.")
    } finally {
      setLoading(false)
    }
  }

  // Load cached report on mount
  const cached = (() => {
    try {
      const raw = localStorage.getItem(KEYS.WEEKLY_FEEDBACK)
      if (!raw) return null
      const { text, date } = JSON.parse(raw)
      const age = (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60)
      return age < 168 ? { text, date } : null // 7 days
    } catch { return null }
  })()

  const displayReport = report || cached?.text

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
      <div className="flex justify-between items-start mb-3">
        <div className="text-sm font-bold text-gray-800">📊 AI Weekly Report</div>
        {cached && !report && (
          <span className="text-[10px] text-gray-400">
            {new Date(cached.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
          </span>
        )}
      </div>

      {displayReport ? (
        <div className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap mb-3">
          {displayReport}
        </div>
      ) : (
        <p className="text-xs text-gray-400 mb-3">
          Get a personalised weekly review of your food, weight, fasting, and workouts.
        </p>
      )}

      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

      <button
        onClick={generateReport}
        disabled={loading}
        className="w-full py-2.5 bg-teal-600 text-white rounded-xl text-sm font-bold disabled:opacity-40"
      >
        {loading ? "Generating..." : displayReport ? "Regenerate Report" : "Generate Report"}
      </button>
    </div>
  )
}
