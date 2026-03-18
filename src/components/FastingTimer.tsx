import { useState, useEffect, useRef, useCallback } from "react"
import { useHealthStore } from "../store/useHealthStore"
import { loadDayData, saveDayData, DayData, makeDayData, loadHistory } from "../store/useHealthStore"
import { getISTDate } from "../utils/dateHelpers"
import { GoalMode, getFlags } from "../services/goalModeConfig"

function hms(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:true})
}

function getPastDate(daysAgo: number): string {
  const d = new Date(); d.setDate(d.getDate() - daysAgo)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`
}

function shortDay(dateStr: string): string {
  return new Date(dateStr+"T12:00:00").toLocaleDateString("en-IN",{weekday:"short"})
}

// Carry a fast that started yesterday across midnight into today
function carryFastOverMidnight(today: string): DayData | null {
  const todayRaw = localStorage.getItem(`hlog_${today}`)
  if (todayRaw) {
    try {
      const d: DayData = JSON.parse(todayRaw)
      if (d.fasting && d.fastStart) {
        const el = Math.floor((Date.now() - d.fastStart) / 1000)
        if (el > 0 && el < 48*3600) return d
      }
    } catch {}
  }
  const yStr = getPastDate(1)
  const yRaw = localStorage.getItem(`hlog_${yStr}`)
  if (!yRaw) return null
  try {
    const yDay: DayData = JSON.parse(yRaw)
    if (yDay.fasting && yDay.fastStart) {
      const el = Math.floor((Date.now() - yDay.fastStart) / 1000)
      if (el > 0 && el < 48*3600) {
        const originalStart = yDay.fastStart
        const midnight = new Date(today+"T00:00:00").getTime()
        const ySecs = Math.floor((midnight - originalStart) / 1000)
        yDay.fastBest = Math.max(yDay.fastBest||0, ySecs)
        yDay.fasting = false; yDay.fastStart = null
        localStorage.setItem(`hlog_${yStr}`, JSON.stringify(yDay))
        const newToday: DayData = { ...makeDayData(today), fasting: true, fastStart: originalStart }
        localStorage.setItem(`hlog_${today}`, JSON.stringify(newToday))
        return newToday
      }
    }
  } catch {}
  return null
}

type HistBar = { date: string; fastBest: number }

function buildHistoryBars(): HistBar[] {
  const hist = loadHistory()
  const bars: HistBar[] = []
  for (let i = 1; i <= 7; i++) {
    const date = getPastDate(i)
    let fastBest = 0
    const raw = localStorage.getItem(`hlog_${date}`)
    if (raw) { try { fastBest = (JSON.parse(raw) as DayData).fastBest||0 } catch {} }
    if (!fastBest) fastBest = hist.find(h=>h.date===date)?.fastBest||0
    bars.push({ date, fastBest })
  }
  return bars.reverse()
}

function FastingRing({ elapsed, target, fasting, best }: {
  elapsed: number; target: number; fasting: boolean; best: number
}) {
  const R=85, C=2*Math.PI*R
  const display = fasting ? elapsed : best
  const pct = Math.min(display/target, 1)
  const dashOffset = C*(1-pct)
  const reached = display >= target
  return (
    <svg width="210" height="210" viewBox="0 0 210 210" className="block mx-auto">
      <circle cx="105" cy="105" r={R} fill="none" stroke="#e5e7eb" strokeWidth="14"/>
      <circle cx="105" cy="105" r={R} fill="none"
        stroke={reached?"#4ade80":"#0d9488"} strokeWidth="14"
        strokeDasharray={C} strokeDashoffset={dashOffset}
        strokeLinecap="round" transform="rotate(-90 105 105)"
        style={{transition: fasting?"stroke-dashoffset 1s linear":"none"}}/>
      <text x="105" y="95" textAnchor="middle" fill="#1f2937" fontSize="26" fontWeight="700" fontFamily="Georgia,serif">
        {hms(display)}
      </text>
      <text x="105" y="115" textAnchor="middle" fill="#9ca3af" fontSize="11" fontFamily="Georgia,serif">
        {fasting?"current session":best>0?"best session today":`of ${Math.round(target/3600)}h target`}
      </text>
      <text x="105" y="130" textAnchor="middle" fill={fasting?"#0d9488":"#d1d5db"} fontSize="10" fontFamily="Georgia,serif">
        {fasting?"fasting — tap to stop":best>0?"tap to start new session":"tap to start"}
      </text>
    </svg>
  )
}

interface FastingTimerProps {
  goalMode?: import("../services/goalModeConfig").GoalMode
}

export default function FastingTimer({ goalMode = "fat_loss" }: FastingTimerProps) {
  const { settings } = useHealthStore()
  const { fastingHours, fastStartHour } = settings.ifProtocol

  // Pre-conception: show caveat note but allow fasting
  // (Pregnancy/postpartum/breastfeeding: tab is hidden at Nav level, but guard here too)
  const flags = getFlags(goalMode)

  if (!flags.showFasting) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-64 text-center">
        <div className="text-4xl mb-3">🤰</div>
        <div className="text-base font-bold text-gray-800 mb-2">Fasting paused</div>
        <div className="text-sm text-gray-500 max-w-xs leading-relaxed">
          Intermittent fasting is not recommended during pregnancy. Eating regular meals ensures your baby
          receives nutrients during critical developmental windows.
        </div>
        <div className="mt-4 text-xs text-gray-400">
          The Fast tab will return when you switch to a non-pregnancy goal mode.
        </div>
      </div>
    )
  }
  const TARGET_SECS = fastingHours * 3600
  const today = getISTDate()

  const [day, setDay] = useState<DayData>(() => carryFastOverMidnight(today) || loadDayData(today))
  const [elapsed, setElapsed] = useState(0)
  const [customTime, setCustomTime] = useState("")
  const [showCustom, setShowCustom] = useState(false)
  const [histBars, setHistBars] = useState<HistBar[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null)

  const persist = useCallback((updated: DayData) => { setDay(updated); saveDayData(updated) }, [])

  const startTick = useCallback((fastStart: number) => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now()-fastStart)/1000)), 1000)
  }, [])

  const stopTick = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  useEffect(() => {
    if (day.fasting && day.fastStart) {
      setElapsed(Math.floor((Date.now()-day.fastStart)/1000))
      startTick(day.fastStart)
    }
    setHistBars(buildHistoryBars())
    return () => stopTick()
  }, []) // eslint-disable-line

  function toggleFast() {
    if (day.fasting && day.fastStart) {
      const sessionSecs = Math.floor((Date.now()-day.fastStart)/1000)
      stopTick(); setElapsed(0)
      persist({...day, fastBest:Math.max(day.fastBest||0,sessionSecs), fasting:false, fastStart:null})
      setHistBars(buildHistoryBars())
    } else {
      const now = Date.now()
      setElapsed(0); startTick(now)
      persist({...day, fasting:true, fastStart:now})
    }
  }

  function resetFast() {
    if (!confirm("Reset all fasting data for today?")) return
    stopTick(); setElapsed(0)
    persist({...day, fasting:false, fastStart:null, fastBest:0, fastAccum:0})
    setHistBars(buildHistoryBars())
  }

  function autoStartFromLastEntry() {
    const sig = (day.entries||[]).filter(e=>e.timestamp&&e.calories>=20)
    if (!sig.length) return
    const lastTs = Math.max(...sig.map(e=>e.timestamp))
    const el = Math.floor((Date.now()-lastTs)/1000)
    if (el<0||el>48*3600) return
    if (!confirm(`Start fast from last meal at ${fmtTime(lastTs)}?`)) return
    if (day.fasting) stopTick()
    setElapsed(el); startTick(lastTs)
    persist({...day, fasting:true, fastStart:lastTs})
  }

  function startCustomTime() {
    if (!customTime) return
    const [h,m] = customTime.split(":").map(Number)
    const now = new Date()
    let start = new Date(now.getFullYear(),now.getMonth(),now.getDate(),h,m,0,0)
    if (start.getTime()>Date.now()) start.setDate(start.getDate()-1)
    const startTs = start.getTime()
    const el = Math.floor((Date.now()-startTs)/1000)
    if (el<0||el>48*3600) return
    if (day.fasting) stopTick()
    setElapsed(el); startTick(startTs)
    persist({...day, fasting:true, fastStart:startTs})
    setShowCustom(false); setCustomTime("")
  }

  const display = day.fasting ? elapsed : (day.fastBest||0)
  const reached = display >= TARGET_SECS
  const bestReached = (day.fastBest||0) >= TARGET_SECS
  const hasLastEntry = (day.entries||[]).some(e=>e.timestamp&&e.calories>=20)
  const lastEntryTs = hasLastEntry ? Math.max(...(day.entries||[]).filter(e=>e.timestamp&&e.calories>=20).map(e=>e.timestamp)) : 0
  const withData = histBars.filter(b=>b.fastBest>0)
  const avg7 = withData.length ? withData.reduce((a,b)=>a+b.fastBest,0)/withData.length : 0
  const yesterday = histBars[histBars.length-2]
  const maxBarSecs = Math.max(...histBars.map(b=>b.fastBest), TARGET_SECS, 1)
  const defaultFastLabel = (() => {
    const h=fastStartHour, period=h>=12?"PM":"AM", hour=h%12===0?12:h%12
    return `${hour}:00 ${period}`
  })()

  return (
    <div className="p-3 pb-24">

      {/* Pre-conception caveat — shown once, informational only */}
      {flags.showFastingCaveat && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3 text-xs text-amber-800 leading-snug">
          <span className="font-bold">🌱 Pre-conception note: </span>
          Extended fasting may affect hormone levels and ovulation in some women. If you're actively trying to conceive,
          discuss your fasting protocol with your doctor before continuing.
        </div>
      )}

      <div className="bg-gradient-to-br from-gray-900 to-teal-800 rounded-2xl p-4 mb-3 text-white">
        <div className="text-xs opacity-70 mb-0.5">Intermittent Fasting</div>
        <div className="text-base font-bold">{fastingHours}:{24-fastingHours} Protocol</div>
        <div className="text-xs opacity-60 mt-0.5">Target: {fastingHours}h · Default start: {defaultFastLabel}</div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-4 mb-3 text-center">
        <FastingRing elapsed={elapsed} target={TARGET_SECS} fasting={day.fasting} best={day.fastBest||0}/>

        {reached && <div className="text-green-600 font-bold text-sm mb-3">🎉 {fastingHours}-hour target reached!</div>}

        <div className="flex gap-3 justify-center mb-3">
          <button onClick={toggleFast}
            className={`px-8 py-3 rounded-full text-white font-bold text-sm shadow-md
              ${day.fasting?"bg-red-500":"bg-teal-600"}`}>
            {day.fasting?"⏹ Stop Fast":(day.fastBest||0)>0?"▶ New Session":"▶ Start Fast"}
          </button>
          {((day.fastBest||0)>0||day.fasting) && (
            <button onClick={resetFast} className="px-4 py-3 rounded-full bg-gray-100 text-gray-400 font-bold text-sm">↺</button>
          )}
        </div>

        {!day.fasting && hasLastEntry && (
          <button onClick={autoStartFromLastEntry}
            className="mx-auto flex items-center gap-2 px-4 py-2 border border-teal-500 text-teal-600 rounded-full text-xs font-bold mb-3">
            ⏱ Start from last meal ({fmtTime(lastEntryTs)})
          </button>
        )}

        {!day.fasting && (
          <div>
            <button onClick={()=>setShowCustom(s=>!s)} className="text-xs text-gray-400 underline mb-2">
              Set custom start time
            </button>
            {showCustom && (
              <div className="bg-gray-900 rounded-xl p-3 mt-2">
                <div className="text-xs text-gray-400 mb-2 text-center">Use yesterday's time if fast started before midnight</div>
                <div className="flex gap-2 justify-center">
                  <input type="time" value={customTime} onChange={e=>setCustomTime(e.target.value)}
                    className="border border-teal-500 rounded-lg px-3 py-2 text-sm font-bold bg-gray-800 text-white"/>
                  <button onClick={startCustomTime} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-bold">Start</button>
                </div>
              </div>
            )}
          </div>
        )}

        {(day.fastBest||0)>0 && (
          <div className="flex gap-3 justify-center mt-4 flex-wrap">
            <div className={`px-4 py-2 rounded-xl border text-center ${bestReached?"bg-green-50 border-green-200":"bg-teal-50 border-teal-200"}`}>
              <div className="text-[10px] text-gray-500 mb-1">Best today</div>
              <div className={`text-base font-bold ${bestReached?"text-green-600":"text-teal-600"}`}>{hms(day.fastBest||0)} {bestReached?"✓":""}</div>
            </div>
            {day.fasting && (
              <div className="px-4 py-2 rounded-xl border border-amber-200 bg-amber-50 text-center">
                <div className="text-[10px] text-gray-500 mb-1">This session</div>
                <div className="text-base font-bold text-amber-600">{hms(elapsed)}</div>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 p-3 bg-gray-50 rounded-xl text-xs text-gray-500 leading-relaxed text-left">
          Fat burn ~12h · Autophagy ~16h · Peak ~{fastingHours}h<br/>
          <span className="text-red-400 font-semibold">Breaking the fast resets the clock</span> — only continuous time counts
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
        <div className="text-sm font-bold text-gray-800 mb-3">⏱ Fasting History</div>
        <div className="flex gap-3 mb-4">
          <div className={`flex-1 p-3 rounded-xl border text-center ${yesterday?.fastBest>0?(yesterday.fastBest>=TARGET_SECS?"bg-green-50 border-green-200":"bg-teal-50 border-teal-200"):"bg-gray-50 border-gray-200"}`}>
            <div className="text-[10px] text-gray-500 mb-1">Yesterday</div>
            <div className={`text-lg font-bold ${yesterday?.fastBest>=TARGET_SECS?"text-green-600":yesterday?.fastBest>0?"text-teal-600":"text-gray-300"}`}>
              {yesterday?.fastBest?(yesterday.fastBest/3600).toFixed(1)+"h":"—"}
            </div>
            <div className="text-[10px] text-gray-400">
              {yesterday?.fastBest>=TARGET_SECS?"✓ Target met":yesterday?.fastBest>0?`Target: ${fastingHours}h`:"No data"}
            </div>
          </div>
          <div className={`flex-1 p-3 rounded-xl border text-center ${avg7>0?"bg-teal-50 border-teal-200":"bg-gray-50 border-gray-200"}`}>
            <div className="text-[10px] text-gray-500 mb-1">7-day avg</div>
            <div className={`text-lg font-bold ${avg7>0?"text-teal-600":"text-gray-300"}`}>{avg7>0?(avg7/3600).toFixed(1)+"h":"—"}</div>
            <div className="text-[10px] text-gray-400">{withData.length} day{withData.length!==1?"s":""} tracked</div>
          </div>
        </div>

        {histBars.some(b=>b.fastBest>0) ? (
          <div>
            <div className="text-xs text-gray-400 mb-2">Last 7 days</div>
            <div className="flex gap-1 items-end h-20 mb-1">
              {histBars.map(b => {
                const pct = b.fastBest ? Math.round(b.fastBest/maxBarSecs*100) : 0
                const color = b.fastBest>=TARGET_SECS?"#4ade80":b.fastBest>=16*3600?"#0d9488":b.fastBest>=12*3600?"#f59e0b":b.fastBest>0?"#ef4444":"#f3f4f6"
                return (
                  <div key={b.date} className="flex-1 flex flex-col items-center gap-0.5">
                    <div className="text-[8px] text-gray-400">{b.fastBest?(b.fastBest/3600).toFixed(1)+"h":""}</div>
                    <div className="w-full rounded-t-sm" style={{height:`${Math.max(pct,b.fastBest?4:0)}%`,background:color,minHeight:b.fastBest?3:0}}/>
                    <div className="text-[8px] text-gray-400">{shortDay(b.date)}</div>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-3 mt-1">
              <span className="text-[10px] text-gray-400">🟢 ≥{fastingHours}h</span>
              <span className="text-[10px] text-gray-400">🔵 ≥16h</span>
              <span className="text-[10px] text-gray-400">🟡 ≥12h</span>
              <span className="text-[10px] text-gray-400">🔴 &lt;12h</span>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-gray-400 text-sm">No fasting history yet — data builds up over time</div>
        )}
      </div>

    </div>
  )
}
