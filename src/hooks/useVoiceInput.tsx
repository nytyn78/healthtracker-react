// ── Voice Input Hook ──────────────────────────────────────────────────────────
// Default: Web Speech API (Android Chrome, zero setup)
// Upgrade: OpenAI Whisper (iOS + better accuracy, needs API key)

import { useState, useRef, useCallback } from "react"
import { loadAISettings } from "../store/useHealthStore"

export type VoiceState = "idle" | "listening" | "processing" | "done" | "error" | "unsupported"

export type VoiceInputResult = {
  state: VoiceState
  transcript: string
  error: string
  startListening: () => void
  stopListening: () => void
  reset: () => void
  isSupported: boolean
}

export function useVoiceInput(onResult?: (text: string) => void): VoiceInputResult {
  const [state, setState] = useState<VoiceState>("idle")
  const [transcript, setTranscript] = useState("")
  const [error, setError] = useState("")
  const recognitionRef = useRef<any>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const aiSettings = loadAISettings()
  const useWhisper = aiSettings.voiceMode === "whisper" && !!aiSettings.openaiKey

  // Check Web Speech API support
  const hasSpeechAPI = typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
  const isSupported = hasSpeechAPI || useWhisper

  // ── Web Speech API ────────────────────────────────────────────────────────
  const startWebSpeech = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setState("unsupported")
      setError("Voice input not supported in this browser. Try Chrome on Android.")
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = "en-IN"  // Indian English

    recognition.onstart = () => setState("listening")
    recognition.onresult = (event: any) => {
      const text = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join("")
      setTranscript(text)
      if (event.results[0].isFinal) {
        setState("done")
        onResult?.(text)
      }
    }
    recognition.onerror = (event: any) => {
      setState("error")
      setError(event.error === "not-allowed"
        ? "Microphone permission denied. Allow mic access and try again."
        : `Voice error: ${event.error}`)
    }
    recognition.onend = () => {
      if (state === "listening") setState("idle")
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [onResult, state])

  // ── Whisper via MediaRecorder ─────────────────────────────────────────────
  const startWhisper = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []

      recorder.ondataavailable = (e) => chunksRef.current.push(e.data)
      recorder.onstop = async () => {
        setState("processing")
        stream.getTracks().forEach(t => t.stop())

        const blob = new Blob(chunksRef.current, { type: "audio/webm" })
        const formData = new FormData()
        formData.append("file", blob, "recording.webm")
        formData.append("model", "whisper-1")
        formData.append("language", "en")

        try {
          const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${aiSettings.openaiKey}` },
            body: formData,
          })
          const data = await resp.json()
          const text = data.text || ""
          setTranscript(text)
          setState("done")
          onResult?.(text)
        } catch {
          setState("error")
          setError("Whisper transcription failed. Check your OpenAI API key.")
        }
      }

      mediaRecorderRef.current = recorder
      recorder.start()
      setState("listening")
    } catch {
      setState("error")
      setError("Microphone access denied. Allow mic permissions and try again.")
    }
  }, [onResult, aiSettings.openaiKey])

  function startListening() {
    setTranscript("")
    setError("")
    if (useWhisper) startWhisper()
    else startWebSpeech()
  }

  function stopListening() {
    recognitionRef.current?.stop()
    mediaRecorderRef.current?.stop()
    setState("idle")
  }

  function reset() {
    setTranscript("")
    setError("")
    setState("idle")
  }

  return { state, transcript, error, startListening, stopListening, reset, isSupported }
}

// ── Mic Button Component (used across multiple tabs) ──────────────────────────
export function MicButton({ onResult, className }: {
  onResult: (text: string) => void
  className?: string
}) {
  const { state, error, startListening, stopListening, isSupported } = useVoiceInput(onResult)

  if (!isSupported) return null

  const isActive = state === "listening" || state === "processing"

  return (
    <button
      onClick={isActive ? stopListening : startListening}
      title={error || (isActive ? "Tap to stop" : "Tap to speak")}
      className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors
        ${isActive
          ? "bg-red-500 text-white animate-pulse"
          : state === "error"
          ? "bg-red-100 text-red-500"
          : "bg-gray-100 text-gray-500 hover:bg-teal-50 hover:text-teal-600"}
        ${className ?? ""}`}>
      {state === "processing" ? (
        <span className="text-xs">⏳</span>
      ) : isActive ? (
        <span className="text-base">⏹</span>
      ) : (
        <span className="text-base">🎤</span>
      )}
    </button>
  )
}
