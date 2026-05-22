// ── DisclaimerModal.tsx ────────────────────────────────────────────────────────
// Shows once on first ever launch, before onboarding.
// User must explicitly accept. Acceptance is stored in localStorage.

import { useState } from "react"
import { KEYS } from "../services/storageKeys"

export function hasAcceptedDisclaimer(): boolean {
  try { return localStorage.getItem(KEYS.DISCLAIMER_ACCEPTED) === "true" } catch { return false }
}

export function setDisclaimerAccepted() {
  try { localStorage.setItem(KEYS.DISCLAIMER_ACCEPTED, "true") } catch {}
}

export default function DisclaimerModal({ onAccept }: { onAccept: () => void }) {
  const [checked, setChecked] = useState(false)

  function accept() {
    if (!checked) return
    setDisclaimerAccepted()
    onAccept()
  }

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto">
      <div className="max-w-lg mx-auto px-5 pt-10 pb-8">

        <div className="text-5xl mb-3 text-center">⚕️</div>
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-1">Before we begin</h1>
        <p className="text-sm text-gray-500 text-center mb-6">Please read this carefully.</p>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
          <div className="text-sm font-bold text-amber-900 mb-2">⚠️ This is not medical advice</div>
          <p className="text-xs text-amber-800 leading-relaxed">
            This app helps you track food, weight, fasting, and workouts.
            It does not diagnose, treat, or prescribe anything.
            For medical decisions — including changing your diet, starting fasting,
            adjusting medications, or interpreting blood tests —
            <span className="font-bold"> always consult your doctor.</span>
          </p>
        </div>

        <div className="bg-white rounded-2xl p-4 mb-4 border border-gray-100">
          <div className="text-sm font-bold text-gray-800 mb-2">📊 Calorie & macro estimates are approximate</div>
          <p className="text-xs text-gray-600 leading-relaxed">
            Food databases vary. Branded products change recipes. Cooking changes nutrition.
            Treat numbers as <span className="font-bold">directional, not exact</span>.
            Trends over weeks matter more than any single day.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-4 mb-4 border border-gray-100">
          <div className="text-sm font-bold text-gray-800 mb-2">🔒 Your data stays on your device</div>
          <p className="text-xs text-gray-600 leading-relaxed">
            Everything is stored locally in your browser. Nothing is sent to anyone unless
            you enable Firebase sync (optional). If you clear browser data or uninstall,
            your data is gone — there is no account recovery.
            <span className="font-bold"> Export periodically</span> via Settings if you want backups.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-4 mb-5 border border-gray-100">
          <div className="text-sm font-bold text-gray-800 mb-2">🚫 Don't use if</div>
          <ul className="text-xs text-gray-600 leading-relaxed space-y-1.5">
            <li>• You have or have had an eating disorder</li>
            <li>• You're under 18 (without parental supervision)</li>
            <li>• You're pregnant and haven't discussed dieting with your obstetrician</li>
            <li>• You're on insulin or sulfonylureas without endocrinologist guidance</li>
            <li>• You have type 1 diabetes (calorie restriction needs medical oversight)</li>
          </ul>
        </div>

        <label className="flex items-start gap-3 mb-5 px-1">
          <input
            type="checkbox"
            checked={checked}
            onChange={e => setChecked(e.target.checked)}
            className="mt-0.5 w-5 h-5 accent-teal-600 shrink-0"
          />
          <span className="text-sm text-gray-700 leading-relaxed">
            I understand this app is not medical advice and I'll talk to my doctor about anything that matters.
          </span>
        </label>

        <button
          onClick={accept}
          disabled={!checked}
          className="w-full py-4 bg-teal-600 text-white rounded-2xl font-bold text-base
                     disabled:opacity-30 disabled:cursor-not-allowed transition">
          {checked ? "I understand — continue" : "Tick the box to continue"}
        </button>

        <p className="text-[10px] text-gray-400 text-center mt-4">
          You can view this again in Settings → About.
        </p>
      </div>
    </div>
  )
}
