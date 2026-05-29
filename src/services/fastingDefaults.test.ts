// ── fastingDefaults.test.ts ───────────────────────────────────────────────────
// Locks in the opt-in-with-defaults fasting model (commit: fasting opt-in).
//
// Three concepts are intentionally separate:
//   showFasting       — is fasting OFFERED for this mode (hard gate)
//   fastingDefaultOn  — does the onboarding toggle START on (only if offered)
//   fastingEnabled    — the runtime master switch (on IFProtocol)
//
// These tests pin the policy decisions so a future flag edit can't silently
// re-introduce "fasting forced on an elderly user".

import { describe, it, expect } from "vitest"
import { getFlags, GOAL_MODE_FLAGS } from "./goalModeConfig"
import type { GoalMode } from "./goalModeConfig"

describe("fasting default-on policy per goal mode", () => {
  it("defaults ON for active fat-loss / recomposition users", () => {
    expect(getFlags("fat_loss").fastingDefaultOn).toBe(true)
    expect(getFlags("recomposition").fastingDefaultOn).toBe(true)
  })

  it("defaults OFF for geriatric and maintenance (deliberate opt-in)", () => {
    expect(getFlags("geriatric").fastingDefaultOn).toBe(false)
    expect(getFlags("maintenance").fastingDefaultOn).toBe(false)
  })

  it("defaults OFF for pre-conception (caveat applies)", () => {
    expect(getFlags("pre_conception").fastingDefaultOn).toBe(false)
  })

  it("geriatric still OFFERS fasting (opt-in, not hidden)", () => {
    // The key fix: elderly users can choose fasting, but it isn't forced.
    expect(getFlags("geriatric").showFasting).toBe(true)
    expect(getFlags("geriatric").fastingDefaultOn).toBe(false)
  })

  it("child and early-teen never offer fasting at all", () => {
    expect(getFlags("child").showFasting).toBe(false)
    expect(getFlags("teen_early").showFasting).toBe(false)
  })
})

describe("fastingDefaultOn is never true where fasting isn't offered", () => {
  it("any mode with showFasting=false must not default fasting on", () => {
    for (const mode of Object.keys(GOAL_MODE_FLAGS) as GoalMode[]) {
      const f = getFlags(mode)
      if (!f.showFasting) {
        expect(f.fastingDefaultOn, `${mode} hides fasting but defaults it on`).toBe(false)
      }
    }
  })
})

describe("elderly opt-in carries a caveat", () => {
  it("geriatric flags surface a fasting caveat when enabled", () => {
    // The onboarding toggle and FastingTimer off-state both show the caveat
    // when showFastingCaveat is true. Geriatric should warn before opt-in.
    // (If this fails, the elderly opt-in lost its doctor-discussion note.)
    expect(getFlags("geriatric").showFastingCaveat).toBe(true)
  })
})
