/**
 * PregnancyModeDisclaimer.tsx — Session 12
 * One-time modal shown the first time a user enters any maternal goal mode.
 * Stored dismissed state per mode in localStorage — never shows again once dismissed.
 */

import { GoalMode, GOAL_MODE_INFO, hasShownDisclaimer, markDisclaimerShown } from "../services/goalModeConfig"

interface Props {
  mode: GoalMode
  onDismiss: () => void
}

export default function PregnancyModeDisclaimer({ mode, onDismiss }: Props) {
  const info = GOAL_MODE_INFO[mode]

  function dismiss() {
    markDisclaimerShown(mode)
    onDismiss()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-rose-50 px-5 pt-6 pb-4 text-center">
          <div className="text-3xl mb-2">{info.icon}</div>
          <div className="text-base font-bold text-rose-900">{info.label}</div>
          <div className="text-xs text-rose-600 mt-1">Nutritional awareness mode</div>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <p className="text-sm text-gray-700 leading-relaxed">
            This app supports nutritional tracking during this phase of life.
            The information shown is based on general public health guidelines (WHO/ACOG/ICMR)
            and is <strong>not a substitute for personalised medical advice</strong>.
          </p>

          <ul className="mt-3 space-y-1.5">
            {[
              "Always follow your doctor's or midwife's specific guidance",
              "Your individual needs may differ from general recommendations",
              "The app tracks and informs — it never diagnoses or prescribes",
              "Contact your healthcare provider about any concerns",
            ].map((point, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                <span className="text-teal-500 mt-0.5 shrink-0">✓</span>
                {point}
              </li>
            ))}
          </ul>
        </div>

        {/* CTA */}
        <div className="px-5 pb-5">
          <button
            onClick={dismiss}
            className="w-full py-3 bg-teal-600 text-white rounded-xl font-bold text-sm shadow-sm"
          >
            Understood — I'll follow my doctor's advice
          </button>
        </div>
      </div>
    </div>
  )
}
