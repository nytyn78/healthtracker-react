// ── shareUtils.ts ──────────────────────────────────────────────────────────────
// Sharing utilities. Primary channel: WhatsApp.
// Falls back to Web Share API (mobile) then clipboard (desktop).

export type DailySummary = {
  date:       string   // YYYY-MM-DD
  calories:   number
  calTarget:  number
  protein:    number
  proteinTarget: number
  carbs:      number
  fat:        number
  water:      number
  waterTarget: number
  weight?:    number
  fastHours?: number
  medsAllTaken: boolean
}

export function formatDailySummaryForShare(s: DailySummary): string {
  const date = new Date(s.date).toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short"
  })
  const calPct   = Math.round(s.calories   / s.calTarget     * 100)
  const protPct  = Math.round(s.protein    / s.proteinTarget * 100)
  const waterPct = Math.round(s.water      / s.waterTarget   * 100)

  const lines: string[] = [
    `📊 *HealthTracker — ${date}*`,
    ``,
    `🔥 Calories: ${Math.round(s.calories)} / ${s.calTarget} kcal (${calPct}%)`,
    `🥩 Protein:  ${Math.round(s.protein)}g / ${s.proteinTarget}g (${protPct}%)`,
    `🌾 Carbs:    ${Math.round(s.carbs)}g`,
    `🧈 Fat:      ${Math.round(s.fat)}g`,
    `💧 Water:    ${s.water.toFixed(1)}L / ${s.waterTarget}L (${waterPct}%)`,
  ]

  if (s.weight) {
    lines.push(`⚖️  Weight:   ${s.weight} kg`)
  }

  if (s.fastHours && s.fastHours > 0) {
    const h = Math.floor(s.fastHours / 3600)
    const m = Math.floor((s.fastHours % 3600) / 60)
    lines.push(`⏱️  Fast:     ${h}h ${m}m`)
  }

  lines.push(`💊 Meds:     ${s.medsAllTaken ? "✅ All taken" : "⚠️ Pending"}`)

  // Summary line
  const onTrack = calPct >= 85 && calPct <= 115 && protPct >= 85
  lines.push(``)
  lines.push(onTrack ? `✅ On track today!` : `📌 Keep going — log the rest of the day`)
  lines.push(`_Sent from HealthTracker_`)

  return lines.join("\n")
}

export function shareViaWhatsApp(text: string) {
  const encoded = encodeURIComponent(text)
  window.open(`https://wa.me/?text=${encoded}`, "_blank")
}

export async function shareOrCopy(text: string, title = "HealthTracker Summary"): Promise<"whatsapp" | "native" | "clipboard"> {
  // Try Web Share API first (shows native share sheet on mobile)
  if (navigator.share) {
    try {
      await navigator.share({ title, text })
      return "native"
    } catch {}
  }
  // Fall back to clipboard
  try {
    await navigator.clipboard.writeText(text)
    return "clipboard"
  } catch {}
  // Last resort — open WhatsApp directly
  shareViaWhatsApp(text)
  return "whatsapp"
}
