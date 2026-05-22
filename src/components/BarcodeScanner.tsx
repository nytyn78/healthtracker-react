import { useState, useRef, useEffect } from "react"
import { searchByBarcode } from "../services/barcodeSearch"
import { loadDayData, saveDayData, loadHistory, saveHistory, FoodEntry } from "../store/useHealthStore"
import { getISTDate } from "../utils/dateHelpers"

function makeId() { return `scan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }

type ScanResult = {
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  barcode: string
}

export default function BarcodeScanner() {
  const [mode, setMode] = useState<"idle" | "camera" | "manual" | "result" | "logged">("idle")
  const [manualCode, setManualCode] = useState("")
  const [result, setResult] = useState<ScanResult | null>(null)
  const [qty, setQty] = useState("100")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Cleanup camera on unmount
  useEffect(() => {
    return () => stopCamera()
  }, [])

  function stopCamera() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  async function startCamera() {
    setError("")
    setMode("camera")
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      // BarcodeDetector API (Chrome Android)
      if ("BarcodeDetector" in window) {
        // @ts-ignore
        const detector = new BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] })
        intervalRef.current = setInterval(async () => {
          if (!videoRef.current) return
          try {
            // @ts-ignore
            const barcodes = await detector.detect(videoRef.current)
            if (barcodes.length > 0) {
              stopCamera()
              await lookupBarcode(barcodes[0].rawValue)
            }
          } catch {}
        }, 500)
      } else {
        setError("Barcode detection not supported on this browser. Enter the code manually below.")
        setMode("manual")
        stopCamera()
      }
    } catch (e) {
      setError("Camera permission denied. Use manual entry instead.")
      setMode("manual")
    }
  }

  async function lookupBarcode(code: string) {
    setLoading(true)
    setError("")
    setMode("result")
    try {
      const food = await searchByBarcode(code)
      if (food) {
        setResult({ ...food, barcode: code })
      } else {
        setError(`No food found for barcode ${code}. Try manual search in the Food tab.`)
        setMode("manual")
        setManualCode(code)
      }
    } catch {
      setError("Lookup failed. Check your connection and try again.")
      setMode("manual")
    } finally {
      setLoading(false)
    }
  }

  function logFood() {
    if (!result) return
    const multiplier = Number(qty) / 100
    const entry: FoodEntry = {
      id: makeId(),
      name: result.name,
      calories: Math.round(result.calories * multiplier),
      protein:  Math.round(result.protein  * multiplier * 10) / 10,
      carbs:    Math.round(result.carbs    * multiplier * 10) / 10,
      fat:      Math.round(result.fat      * multiplier * 10) / 10,
      timestamp: Date.now(),
    }

    const today = getISTDate()
    const day = loadDayData(today)
    const updated = { ...day, entries: [...day.entries, entry] }
    saveDayData(updated)

    // Sync history
    const hist = loadHistory()
    const tots = updated.entries.reduce(
      (a, e) => ({ cal: a.cal + e.calories, protein: a.protein + e.protein, carbs: a.carbs + e.carbs, fat: a.fat + e.fat }),
      { cal: 0, protein: 0, carbs: 0, fat: 0 }
    )
    const idx = hist.findIndex(h => h.date === today)
    if (idx >= 0) hist[idx] = { ...hist[idx], ...tots }
    else hist.unshift({ date: today, ...tots, weight: day.weight, water: day.water, workoutDone: false })
    saveHistory(hist)

    setMode("logged")
  }

  function reset() {
    stopCamera()
    setResult(null)
    setManualCode("")
    setError("")
    setMode("idle")
    setQty("100")
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
      <div className="text-sm font-bold text-gray-800 mb-3">📷 Barcode Scanner</div>

      {mode === "idle" && (
        <div className="space-y-2">
          <button onClick={startCamera}
            className="w-full py-3 bg-teal-600 text-white rounded-xl font-bold text-sm">
            📷 Scan Barcode
          </button>
          <button onClick={() => setMode("manual")}
            className="w-full py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold">
            ⌨️ Enter Code Manually
          </button>
        </div>
      )}

      {mode === "camera" && (
        <div>
          <div className="bg-black rounded-xl overflow-hidden mb-3 aspect-video relative">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="border-2 border-teal-400 w-48 h-24 rounded-lg opacity-70" />
            </div>
          </div>
          <p className="text-xs text-gray-400 text-center mb-2">Point camera at barcode</p>
          <button onClick={() => { stopCamera(); setMode("manual") }}
            className="w-full py-2 bg-gray-100 text-gray-600 rounded-xl text-sm">
            Enter manually instead
          </button>
        </div>
      )}

      {mode === "manual" && (
        <div>
          {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
          <input
            type="text" inputMode="numeric" placeholder="Enter barcode (e.g. 8901234567890)"
            value={manualCode} onChange={e => setManualCode(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-2 focus:outline-none focus:border-teal-500"
          />
          <button onClick={() => lookupBarcode(manualCode)} disabled={!manualCode.trim() || loading}
            className="w-full py-2.5 bg-teal-600 text-white rounded-xl font-bold text-sm disabled:opacity-40">
            {loading ? "Looking up..." : "Look Up"}
          </button>
        </div>
      )}

      {mode === "result" && loading && (
        <div className="text-center py-4 text-sm text-gray-400">Looking up product...</div>
      )}

      {mode === "result" && result && !loading && (
        <div>
          <div className="bg-teal-50 rounded-xl p-3 mb-3">
            <div className="text-xs font-bold text-gray-800 mb-2">{result.name}</div>
            <div className="grid grid-cols-4 gap-1 text-center text-[10px]">
              {[
                { label: "Cal", val: result.calories, color: "text-teal-600" },
                { label: "Protein", val: `${result.protein}g`, color: "text-blue-600" },
                { label: "Carbs", val: `${result.carbs}g`, color: "text-green-600" },
                { label: "Fat", val: `${result.fat}g`, color: "text-amber-600" },
              ].map(m => (
                <div key={m.label} className="bg-white rounded-lg p-1.5">
                  <div className={`font-bold ${m.color}`}>{m.val}</div>
                  <div className="text-gray-400">{m.label}</div>
                </div>
              ))}
            </div>
            <p className="text-[9px] text-gray-400 mt-1 text-right">per 100g</p>
          </div>

          <div className="flex gap-2 items-center mb-3">
            <label className="text-xs text-gray-600 whitespace-nowrap">Qty (g):</label>
            <input type="number" value={qty} onChange={e => setQty(e.target.value)} min="1" max="2000"
              className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-teal-500" />
          </div>

          <div className="flex gap-2">
            <button onClick={logFood}
              className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl font-bold text-sm">
              Log Food
            </button>
            <button onClick={reset}
              className="py-2.5 px-4 bg-gray-100 text-gray-600 rounded-xl text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode === "logged" && (
        <div className="text-center py-3">
          <div className="text-3xl mb-2">✅</div>
          <div className="text-sm font-bold text-green-600 mb-1">Logged!</div>
          <div className="text-xs text-gray-400 mb-3">{result?.name}</div>
          <button onClick={reset}
            className="w-full py-2.5 bg-teal-600 text-white rounded-xl font-bold text-sm">
            Scan Another
          </button>
        </div>
      )}
    </div>
  )
}
