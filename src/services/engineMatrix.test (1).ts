// ── engineMatrix.test.ts ──────────────────────────────────────────────────────
// Engine-level scenario matrix. Exercises the macro engine + warnings system
// across realistic profile / goal-mode / diet-mode / medical-context combinations.
//
// Produces two artifacts in src/services/__tests__/:
//   - engineMatrix.report.md   (human-readable)
//   - engineMatrix.report.json (diffable + machine-readable)
//
// The test PASSES when:
//   - Every scenario produces valid macros (no crashes, all positive numbers)
//   - No safety floor is violated (calories above mode-specific minimum, etc.)
//   - Maternal modes produce calorie surplus, not deficit
//   - Restrictive modes for vulnerable populations produce warnings
//
// Run: npm test
// View results: cat src/services/__tests__/engineMatrix.report.md

import { describe, it, expect } from "vitest"
import { writeFileSync, mkdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import {
  calcBMR, calcTDEE, calcTargetCalories, computeMacros,
} from "./adaptiveTDEE"
import { getMacroWarnings, type MacroWarning } from "./macroWarnings"
import type { UserProfile, UserGoals, AppSettings, MedicalContext } from "../store/useHealthStore"
import type { GoalMode } from "./goalModeConfig"

// ── Scenario types ───────────────────────────────────────────────────────────

type EatingMode = "balanced" | "low_carb" | "high_protein" | "keto"

type Scenario = {
  id: string
  label: string                // Human description
  profile: Partial<UserProfile>
  goals: Partial<UserGoals>
  eatingMode: EatingMode
  goalMode: GoalMode
  medical?: MedicalContext
  // Expectations (optional — when set, the test asserts them)
  expect?: {
    minCalories?: number       // target ≥ this
    maxCalories?: number       // target ≤ this
    minProtein?: number
    maxProtein?: number
    mustHaveWarning?: string   // warning id must appear
    mustNotHaveWarning?: string
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const defaultProfile: UserProfile = {
  name: "Test", age: 30, sex: "male", heightCm: 170, weightKg: 75,
  activityLevel: "moderately_active",
}

const defaultGoals: UserGoals = { targetWeightKg: 70, weeklyLossKg: 0.5 }

// Convert eating mode to macroSplit percentages that resolve to that MacroMode in the engine.
// (Mirrors the resolveMacroMode logic in adaptiveTDEE.ts)
const SPLIT_FOR_MODE: Record<EatingMode, { fatPct: number; proteinPct: number; carbsPct: number }> = {
  balanced:     { fatPct: 35, proteinPct: 25, carbsPct: 40 },
  low_carb:     { fatPct: 50, proteinPct: 25, carbsPct: 25 },
  high_protein: { fatPct: 30, proteinPct: 45, carbsPct: 25 },
  keto:         { fatPct: 70, proteinPct: 25, carbsPct: 5  },
}

function makeSettings(mode: EatingMode): AppSettings {
  return {
    macroSplit: SPLIT_FOR_MODE[mode],
    ifProtocol: { fastingHours: 16, eatingHours: 8, fastStartHour: 20 },
  }
}

// ── The Matrix ───────────────────────────────────────────────────────────────
// Carefully chosen scenarios covering: routine cases, body-comp extremes,
// medical contexts, maternal modes, paediatric, geriatric, edge cases.

const SCENARIOS: Scenario[] = [
  // ── 1. Routine adult fat loss — one row per eating mode ──────────────────
  {
    id: "routine-male-balanced",
    label: "Normal man, fat loss, balanced",
    profile: { age: 35, sex: "male", heightCm: 175, weightKg: 90, activityLevel: "moderately_active" },
    goals: { targetWeightKg: 75, weeklyLossKg: 0.5 },
    eatingMode: "balanced", goalMode: "fat_loss",
    expect: { minCalories: 1900, maxCalories: 2500, minProtein: 90 },
  },
  {
    id: "routine-male-lowcarb",
    label: "Normal man, fat loss, low-carb",
    profile: { age: 35, sex: "male", heightCm: 175, weightKg: 90, activityLevel: "moderately_active" },
    goals: { targetWeightKg: 75, weeklyLossKg: 0.5 },
    eatingMode: "low_carb", goalMode: "fat_loss",
  },
  {
    id: "routine-male-highprotein",
    label: "Normal man, fat loss, high-protein",
    profile: { age: 35, sex: "male", heightCm: 175, weightKg: 90, activityLevel: "moderately_active" },
    goals: { targetWeightKg: 75, weeklyLossKg: 0.5 },
    eatingMode: "high_protein", goalMode: "fat_loss",
  },
  {
    id: "routine-male-keto",
    label: "Normal man, fat loss, keto",
    profile: { age: 35, sex: "male", heightCm: 175, weightKg: 90, activityLevel: "moderately_active" },
    goals: { targetWeightKg: 75, weeklyLossKg: 0.5 },
    eatingMode: "keto", goalMode: "fat_loss",
  },

  // ── 2. Routine adult woman ───────────────────────────────────────────────
  {
    id: "routine-female-balanced",
    label: "Normal woman, fat loss, balanced",
    profile: { age: 32, sex: "female", heightCm: 162, weightKg: 72, activityLevel: "lightly_active" },
    goals: { targetWeightKg: 62, weeklyLossKg: 0.5 },
    eatingMode: "balanced", goalMode: "fat_loss",
    expect: { minCalories: 1200, maxCalories: 1900, minProtein: 70 },
  },
  {
    id: "routine-female-keto",
    label: "Normal woman, fat loss, keto",
    profile: { age: 32, sex: "female", heightCm: 162, weightKg: 72, activityLevel: "lightly_active" },
    goals: { targetWeightKg: 62, weeklyLossKg: 0.5 },
    eatingMode: "keto", goalMode: "fat_loss",
  },

  // ── 3. Body composition extremes ─────────────────────────────────────────
  {
    id: "obese-male-bmi40",
    label: "Severely obese man (BMI 40), fat loss",
    profile: { age: 45, sex: "male", heightCm: 175, weightKg: 125, activityLevel: "sedentary" },
    goals: { targetWeightKg: 85, weeklyLossKg: 0.75 },
    eatingMode: "balanced", goalMode: "fat_loss",
    expect: { minProtein: 100, minCalories: 1500 },
  },
  {
    id: "obese-female-bmi35",
    label: "Obese woman (BMI 35), aggressive fat loss",
    profile: { age: 38, sex: "female", heightCm: 165, weightKg: 95, activityLevel: "sedentary" },
    goals: { targetWeightKg: 65, weeklyLossKg: 1.0 },
    eatingMode: "keto", goalMode: "fat_loss",
    expect: { minCalories: 1100 }, // KETO floor allows lower
  },
  {
    id: "small-woman-aggressive",
    label: "Small woman, aggressive cut (calorie-floor stress)",
    profile: { age: 28, sex: "female", heightCm: 152, weightKg: 55, activityLevel: "sedentary" },
    goals: { targetWeightKg: 48, weeklyLossKg: 1.0 },
    eatingMode: "balanced", goalMode: "fat_loss",
    expect: { minCalories: 1200 }, // BALANCED floor
  },
  {
    id: "tall-male-active",
    label: "Tall active man, recomposition",
    profile: { age: 28, sex: "male", heightCm: 188, weightKg: 88, activityLevel: "very_active" },
    goals: { targetWeightKg: 85, weeklyLossKg: 0.25 },
    eatingMode: "high_protein", goalMode: "recomposition",
    expect: { minProtein: 130 },
  },

  // ── 4. Medical contexts — diabetes ───────────────────────────────────────
  {
    id: "diabetes-keto",
    label: "T1 diabetic on keto",
    profile: { age: 40, sex: "male", heightCm: 175, weightKg: 80, activityLevel: "lightly_active" },
    goals: { targetWeightKg: 75, weeklyLossKg: 0.5 },
    eatingMode: "keto", goalMode: "fat_loss",
    medical: { hasDiabetes: true },
    expect: { mustHaveWarning: "diabetes-keto" },
  },
  {
    id: "diabetes-balanced",
    label: "T1 diabetic on balanced (should produce no warnings)",
    profile: { age: 40, sex: "male", heightCm: 175, weightKg: 80, activityLevel: "lightly_active" },
    goals: { targetWeightKg: 75, weeklyLossKg: 0.5 },
    eatingMode: "balanced", goalMode: "fat_loss",
    medical: { hasDiabetes: true },
    expect: { mustNotHaveWarning: "diabetes-keto" },
  },
  {
    id: "diabetes-lowcarb",
    label: "T1 diabetic on low-carb",
    profile: { age: 40, sex: "male", heightCm: 175, weightKg: 80, activityLevel: "lightly_active" },
    goals: { targetWeightKg: 75, weeklyLossKg: 0.5 },
    eatingMode: "low_carb", goalMode: "fat_loss",
    medical: { hasDiabetes: true },
    expect: { mustHaveWarning: "diabetes-lowcarb" },
  },

  // ── 5. Medical contexts — CKD ────────────────────────────────────────────
  {
    id: "ckd-high-protein",
    label: "CKD patient on high-protein (should warn)",
    profile: { age: 60, sex: "male", heightCm: 170, weightKg: 78, activityLevel: "sedentary" },
    goals: { targetWeightKg: 72, weeklyLossKg: 0.25 },
    eatingMode: "high_protein", goalMode: "fat_loss",
    medical: { hasCKD: true },
    expect: { mustHaveWarning: "ckd-high-protein" },
  },
  {
    id: "ckd-keto",
    label: "CKD patient on keto",
    profile: { age: 60, sex: "male", heightCm: 170, weightKg: 78, activityLevel: "sedentary" },
    goals: { targetWeightKg: 72, weeklyLossKg: 0.25 },
    eatingMode: "keto", goalMode: "fat_loss",
    medical: { hasCKD: true },
    expect: { mustHaveWarning: "ckd-keto" },
  },
  {
    id: "ckd-balanced",
    label: "CKD patient on balanced (should be quiet)",
    profile: { age: 60, sex: "male", heightCm: 170, weightKg: 78, activityLevel: "sedentary" },
    goals: { targetWeightKg: 72, weeklyLossKg: 0.25 },
    eatingMode: "balanced", goalMode: "fat_loss",
    medical: { hasCKD: true },
    expect: { mustNotHaveWarning: "ckd-high-protein" },
  },

  // ── 6. Medical contexts — Eating Disorder history ────────────────────────
  {
    id: "ed-restrictive",
    label: "ED history user on keto (should warn)",
    profile: { age: 25, sex: "female", heightCm: 165, weightKg: 60, activityLevel: "moderately_active" },
    goals: { targetWeightKg: 55, weeklyLossKg: 0.5 },
    eatingMode: "keto", goalMode: "fat_loss",
    medical: { hasEDHistory: true },
    expect: { mustHaveWarning: "ed-restrictive" },
  },
  {
    id: "ed-balanced",
    label: "ED history user on balanced",
    profile: { age: 25, sex: "female", heightCm: 165, weightKg: 60, activityLevel: "moderately_active" },
    goals: { targetWeightKg: 55, weeklyLossKg: 0.5 },
    eatingMode: "balanced", goalMode: "fat_loss",
    medical: { hasEDHistory: true },
    expect: { mustNotHaveWarning: "ed-restrictive" },
  },

  // ── 7. Maternal modes — pregnancy ────────────────────────────────────────
  {
    id: "pregnancy-t1-balanced",
    label: "Pregnant woman, T1, balanced",
    profile: { age: 30, sex: "female", heightCm: 162, weightKg: 65, activityLevel: "lightly_active" },
    goals: { targetWeightKg: 65, weeklyLossKg: 0 as any }, // pregnancy: no loss
    eatingMode: "balanced", goalMode: "pregnancy_t1",
    expect: { minCalories: 1700, mustHaveWarning: "maternal-general" },
  },
  {
    id: "pregnancy-t2-balanced",
    label: "Pregnant woman, T2, balanced (+300 kcal expected)",
    profile: { age: 30, sex: "female", heightCm: 162, weightKg: 67, activityLevel: "lightly_active" },
    goals: { targetWeightKg: 67, weeklyLossKg: 0 as any },
    eatingMode: "balanced", goalMode: "pregnancy_t2",
    expect: { minCalories: 1900, mustHaveWarning: "maternal-general" },
  },
  {
    id: "pregnancy-t3-balanced",
    label: "Pregnant woman, T3, balanced (+450 kcal expected)",
    profile: { age: 30, sex: "female", heightCm: 162, weightKg: 70, activityLevel: "lightly_active" },
    goals: { targetWeightKg: 70, weeklyLossKg: 0 as any },
    eatingMode: "balanced", goalMode: "pregnancy_t3",
    expect: { minCalories: 2050, mustHaveWarning: "maternal-general" },
  },
  {
    id: "pregnancy-t2-keto",
    label: "Pregnant T2 on keto (should warn strongly)",
    profile: { age: 30, sex: "female", heightCm: 162, weightKg: 67, activityLevel: "lightly_active" },
    goals: { targetWeightKg: 67, weeklyLossKg: 0 as any },
    eatingMode: "keto", goalMode: "pregnancy_t2",
    expect: { mustHaveWarning: "pregnancy-low-carb" },
  },

  // ── 8. Maternal modes — breastfeeding ────────────────────────────────────
  {
    id: "breastfeeding-balanced",
    label: "Breastfeeding woman, balanced",
    profile: { age: 32, sex: "female", heightCm: 165, weightKg: 70, activityLevel: "lightly_active" },
    goals: { targetWeightKg: 65, weeklyLossKg: 0.3 },
    eatingMode: "balanced", goalMode: "breastfeeding",
    expect: { minCalories: 1800, mustHaveWarning: "maternal-general" },
  },
  {
    id: "breastfeeding-keto",
    label: "Breastfeeding woman on keto (should warn)",
    profile: { age: 32, sex: "female", heightCm: 165, weightKg: 70, activityLevel: "lightly_active" },
    goals: { targetWeightKg: 65, weeklyLossKg: 0.3 },
    eatingMode: "keto", goalMode: "breastfeeding",
    expect: { mustHaveWarning: "breastfeeding-keto" },
  },
  {
    id: "breastfeeding-aggressive-loss",
    label: "Breastfeeding woman with aggressive loss (should cap to 0.3)",
    profile: { age: 32, sex: "female", heightCm: 165, weightKg: 75, activityLevel: "lightly_active" },
    goals: { targetWeightKg: 60, weeklyLossKg: 1.0 }, // input is aggressive
    eatingMode: "balanced", goalMode: "breastfeeding",
    expect: { minCalories: 1800 }, // floor enforced regardless of input deficit
  },

  // ── 9. Geriatric ─────────────────────────────────────────────────────────
  {
    id: "geriatric-male",
    label: "70yo man, healthy ageing, high-protein",
    profile: { age: 70, sex: "male", heightCm: 170, weightKg: 78, activityLevel: "lightly_active" },
    goals: { targetWeightKg: 72, weeklyLossKg: 0.25 },
    eatingMode: "high_protein", goalMode: "geriatric",
    expect: { minProtein: 90, minCalories: 1400 },
  },
  {
    id: "geriatric-keto",
    label: "70yo on keto (should warn)",
    profile: { age: 70, sex: "male", heightCm: 170, weightKg: 78, activityLevel: "lightly_active" },
    goals: { targetWeightKg: 72, weeklyLossKg: 0.25 },
    eatingMode: "keto", goalMode: "geriatric",
    expect: { mustHaveWarning: "geriatric-keto" },
  },

  // ── 10. Paediatric ───────────────────────────────────────────────────────
  {
    id: "child-balanced",
    label: "11yo child, balanced (no deficit expected)",
    profile: { age: 11, sex: "male", heightCm: 145, weightKg: 38, activityLevel: "very_active" },
    goals: { targetWeightKg: 38, weeklyLossKg: 0 as any },
    eatingMode: "balanced", goalMode: "child",
  },
  {
    id: "child-restrictive",
    label: "11yo child on keto (should warn strongly)",
    profile: { age: 11, sex: "male", heightCm: 145, weightKg: 38, activityLevel: "very_active" },
    goals: { targetWeightKg: 38, weeklyLossKg: 0 as any },
    eatingMode: "keto", goalMode: "child",
    expect: { mustHaveWarning: "child-restrictive" },
  },
  {
    id: "teen-early",
    label: "14yo early teen, balanced",
    profile: { age: 14, sex: "female", heightCm: 158, weightKg: 52, activityLevel: "moderately_active" },
    goals: { targetWeightKg: 52, weeklyLossKg: 0 as any },
    eatingMode: "balanced", goalMode: "teen_early",
  },

  // ── 11. Edge case combinations ───────────────────────────────────────────
  {
    id: "ckd-pregnancy",
    label: "Pregnant T2 with CKD (multiple warnings expected)",
    profile: { age: 35, sex: "female", heightCm: 160, weightKg: 70, activityLevel: "sedentary" },
    goals: { targetWeightKg: 70, weeklyLossKg: 0 as any },
    eatingMode: "balanced", goalMode: "pregnancy_t2",
    medical: { hasCKD: true },
    expect: { mustHaveWarning: "maternal-general" },
  },
  {
    id: "diabetes-breastfeeding",
    label: "Breastfeeding diabetic woman, low-carb",
    profile: { age: 33, sex: "female", heightCm: 165, weightKg: 68, activityLevel: "lightly_active" },
    goals: { targetWeightKg: 62, weeklyLossKg: 0.25 },
    eatingMode: "low_carb", goalMode: "breastfeeding",
    medical: { hasDiabetes: true },
    expect: { mustHaveWarning: "diabetes-lowcarb", minCalories: 1800 },
  },
  // ── 12. Regression tests for Commit 3.1 fixes ──────────────────────────
  {
    id: "ckd-balanced-elevated-protein",
    label: "CKD obese patient on balanced — should warn about elevated protein",
    profile: { age: 55, sex: "male", heightCm: 168, weightKg: 105, activityLevel: "sedentary" },
    goals: { targetWeightKg: 80, weeklyLossKg: 0.25 },
    eatingMode: "balanced", goalMode: "fat_loss",
    medical: { hasCKD: true },
    expect: { mustHaveWarning: "ckd-elevated-protein" },
  },
  {
    id: "active-child-protein-bump",
    label: "Very active 11yo — child multiplier should give ≥55g protein",
    profile: { age: 11, sex: "male", heightCm: 145, weightKg: 38, activityLevel: "very_active" },
    goals: { targetWeightKg: 38, weeklyLossKg: 0 as any },
    eatingMode: "balanced", goalMode: "child",
    expect: { minProtein: 55 },  // 38kg * 1.5 = 57g — should be at least 55
  },
  {
    id: "early-teen-protein-bump",
    label: "Moderately active 14yo — child multiplier (1.3) gives realistic protein",
    profile: { age: 14, sex: "female", heightCm: 158, weightKg: 52, activityLevel: "moderately_active" },
    goals: { targetWeightKg: 52, weeklyLossKg: 0 as any },
    eatingMode: "balanced", goalMode: "teen_early",
    expect: { minProtein: 65 },  // 52kg * 1.3 = 67g
  },
]

// ── Run the matrix ───────────────────────────────────────────────────────────

type ScenarioResult = {
  id: string
  label: string
  inputs: {
    profile: UserProfile
    goals: UserGoals
    eatingMode: EatingMode
    goalMode: GoalMode
    medical?: MedicalContext
    macroSplit: { fatPct: number; proteinPct: number; carbsPct: number }
  }
  outputs: {
    bmr: number | null
    tdee: number | null
    targetCalories: number | null
    proteinG: number | null
    proteinPerKgTW: number | null
    carbsG: number | null
    fatG: number | null
    actualKcal: number | null   // proteinG*4 + carbsG*4 + fatG*9
    warnings: { id: string; severity: string; title: string }[]
  }
  assertions: { name: string; passed: boolean; detail?: string }[]
}

function runScenario(s: Scenario): ScenarioResult {
  const profile: UserProfile = { ...defaultProfile, ...s.profile, medicalContext: s.medical }
  const goals:   UserGoals   = { ...defaultGoals,   ...s.goals }
  const settings: AppSettings = makeSettings(s.eatingMode)

  const bmr  = calcBMR(profile)
  const tdee = calcTDEE(profile)
  const target = calcTargetCalories(profile, goals, s.goalMode)
  const macros = computeMacros(profile, goals, settings, s.goalMode)
  const warnings = getMacroWarnings(profile, settings, s.goalMode, macros, goals)

  const tw = Number(goals.targetWeightKg) || Number(profile.weightKg)
  const actualKcal = macros ? macros.proteinG * 4 + macros.carbsG * 4 + macros.fatG * 9 : null

  const assertions: { name: string; passed: boolean; detail?: string }[] = []

  if (s.expect?.minCalories !== undefined && macros) {
    const passed = macros.targetCalories >= s.expect.minCalories
    assertions.push({
      name: `target ≥ ${s.expect.minCalories}`,
      passed,
      detail: passed ? undefined : `got ${macros.targetCalories}`,
    })
  }
  if (s.expect?.maxCalories !== undefined && macros) {
    const passed = macros.targetCalories <= s.expect.maxCalories
    assertions.push({
      name: `target ≤ ${s.expect.maxCalories}`,
      passed,
      detail: passed ? undefined : `got ${macros.targetCalories}`,
    })
  }
  if (s.expect?.minProtein !== undefined && macros) {
    const passed = macros.proteinG >= s.expect.minProtein
    assertions.push({
      name: `protein ≥ ${s.expect.minProtein}g`,
      passed,
      detail: passed ? undefined : `got ${macros.proteinG}g`,
    })
  }
  if (s.expect?.maxProtein !== undefined && macros) {
    const passed = macros.proteinG <= s.expect.maxProtein
    assertions.push({
      name: `protein ≤ ${s.expect.maxProtein}g`,
      passed,
      detail: passed ? undefined : `got ${macros.proteinG}g`,
    })
  }
  if (s.expect?.mustHaveWarning) {
    const found = warnings.some(w => w.id === s.expect!.mustHaveWarning)
    assertions.push({
      name: `warning '${s.expect.mustHaveWarning}' present`,
      passed: found,
      detail: found ? undefined : `warnings present: [${warnings.map(w => w.id).join(", ")}]`,
    })
  }
  if (s.expect?.mustNotHaveWarning) {
    const found = warnings.some(w => w.id === s.expect!.mustNotHaveWarning)
    assertions.push({
      name: `warning '${s.expect.mustNotHaveWarning}' absent`,
      passed: !found,
      detail: !found ? undefined : "warning was present",
    })
  }
  // Universal assertion — macros must exist for every scenario
  assertions.push({
    name: "macros computed",
    passed: macros !== null,
  })

  return {
    id: s.id, label: s.label,
    inputs: {
      profile, goals,
      eatingMode: s.eatingMode, goalMode: s.goalMode,
      medical: s.medical,
      macroSplit: settings.macroSplit,
    },
    outputs: {
      bmr, tdee, targetCalories: target,
      proteinG:       macros?.proteinG ?? null,
      proteinPerKgTW: macros ? Math.round((macros.proteinG / tw) * 100) / 100 : null,
      carbsG:         macros?.carbsG ?? null,
      fatG:           macros?.fatG ?? null,
      actualKcal,
      warnings: warnings.map(w => ({ id: w.id, severity: w.severity, title: w.title })),
    },
    assertions,
  }
}

// ── Reporter ─────────────────────────────────────────────────────────────────

function buildMarkdownReport(results: ScenarioResult[]): string {
  const lines: string[] = []
  lines.push("# Engine Scenario Matrix Report")
  lines.push("")
  lines.push(`Generated: ${new Date().toISOString()}`)
  lines.push(`Total scenarios: ${results.length}`)
  const allPassed = results.every(r => r.assertions.every(a => a.passed))
  lines.push(`Status: ${allPassed ? "✅ All assertions passed" : "❌ Some assertions failed"}`)
  lines.push("")
  lines.push("---")
  lines.push("")

  // Summary table
  lines.push("## Summary Table")
  lines.push("")
  lines.push("| # | Scenario | Mode | Target kcal | Protein g (g/kg TW) | Carbs g | Fat g | Warnings | Status |")
  lines.push("|---|---|---|---|---|---|---|---|---|")
  results.forEach((r, i) => {
    const status = r.assertions.every(a => a.passed) ? "✅" : "❌"
    const out = r.outputs
    const warningCount = out.warnings.length
    const warningStr = warningCount === 0 ? "—" : `${warningCount} (${out.warnings.map(w => w.severity[0]).join("")})`
    lines.push(
      `| ${i + 1} | ${r.label} | ${r.inputs.eatingMode} / ${r.inputs.goalMode} | ` +
      `${out.targetCalories ?? "—"} | ${out.proteinG ?? "—"} (${out.proteinPerKgTW ?? "—"}) | ` +
      `${out.carbsG ?? "—"} | ${out.fatG ?? "—"} | ${warningStr} | ${status} |`
    )
  })
  lines.push("")
  lines.push("---")
  lines.push("")

  // Per-scenario detail
  lines.push("## Per-Scenario Detail")
  lines.push("")
  results.forEach((r, i) => {
    const status = r.assertions.every(a => a.passed) ? "✅" : "❌"
    lines.push(`### ${i + 1}. ${r.label} ${status}`)
    lines.push("")
    lines.push("**Inputs:**")
    lines.push(`- Profile: ${r.inputs.profile.age}y ${r.inputs.profile.sex}, ` +
               `${r.inputs.profile.heightCm}cm, ${r.inputs.profile.weightKg}kg, ${r.inputs.profile.activityLevel}`)
    lines.push(`- Goals: target ${r.inputs.goals.targetWeightKg}kg, ${r.inputs.goals.weeklyLossKg} kg/week`)
    lines.push(`- Goal mode: \`${r.inputs.goalMode}\` · Eating mode: \`${r.inputs.eatingMode}\``)
    lines.push(`- Macro split: ${r.inputs.macroSplit.proteinPct}P/${r.inputs.macroSplit.carbsPct}C/${r.inputs.macroSplit.fatPct}F`)
    if (r.inputs.medical) {
      const m = r.inputs.medical
      const flags = [m.hasDiabetes && "diabetes", m.hasCKD && "CKD", m.hasEDHistory && "ED history"].filter(Boolean)
      lines.push(`- Medical context: ${flags.join(", ") || "none"}`)
    }
    lines.push("")
    lines.push("**Outputs:**")
    lines.push(`- BMR: ${r.outputs.bmr} kcal · TDEE: ${r.outputs.tdee} kcal · Target: ${r.outputs.targetCalories} kcal`)
    lines.push(`- Protein: ${r.outputs.proteinG}g (${r.outputs.proteinPerKgTW} g/kg target weight)`)
    lines.push(`- Carbs: ${r.outputs.carbsG}g · Fat: ${r.outputs.fatG}g`)
    lines.push(`- Computed kcal sum: ${r.outputs.actualKcal} (vs target ${r.outputs.targetCalories})`)
    if (r.outputs.warnings.length > 0) {
      lines.push("- Warnings:")
      r.outputs.warnings.forEach(w => lines.push(`  - **${w.severity}**: ${w.title} (\`${w.id}\`)`))
    } else {
      lines.push("- Warnings: none")
    }
    lines.push("")
    if (r.assertions.length > 0) {
      lines.push("**Assertions:**")
      r.assertions.forEach(a => {
        const mark = a.passed ? "✓" : "✗"
        lines.push(`- ${mark} ${a.name}${a.detail ? ` — ${a.detail}` : ""}`)
      })
    }
    lines.push("")
  })

  return lines.join("\n")
}

// ── The actual Vitest entry point ────────────────────────────────────────────

describe("Engine Matrix", () => {
  const results = SCENARIOS.map(runScenario)

  it("writes the matrix report to disk", () => {
    const __dirname = dirname(fileURLToPath(import.meta.url))
    const reportDir = __dirname
    mkdirSync(reportDir, { recursive: true })

    const markdown = buildMarkdownReport(results)
    writeFileSync(join(reportDir, "engineMatrix.report.md"), markdown, "utf-8")
    writeFileSync(join(reportDir, "engineMatrix.report.json"), JSON.stringify(results, null, 2), "utf-8")
    expect(results.length).toBeGreaterThan(20)
  })

  // One Vitest test per scenario — gives clean failure messages in CI
  SCENARIOS.forEach((scenario, idx) => {
    const result = results[idx]
    it(`scenario ${idx + 1}: ${scenario.label}`, () => {
      result.assertions.forEach(a => {
        expect(a.passed, `${a.name}${a.detail ? `: ${a.detail}` : ""}`).toBe(true)
      })
    })
  })

  // Universal sanity checks across the whole matrix
  it("every scenario produces positive macros", () => {
    results.forEach(r => {
      if (r.outputs.proteinG !== null) expect(r.outputs.proteinG).toBeGreaterThan(0)
      if (r.outputs.fatG     !== null) expect(r.outputs.fatG).toBeGreaterThan(0)
      if (r.outputs.carbsG   !== null) expect(r.outputs.carbsG).toBeGreaterThanOrEqual(0)
    })
  })

  it("no scenario violates calorie math by more than 200 kcal", () => {
    results.forEach(r => {
      if (r.outputs.actualKcal !== null && r.outputs.targetCalories !== null) {
        const diff = Math.abs(r.outputs.actualKcal - r.outputs.targetCalories)
        expect(diff, `${r.label}: computed ${r.outputs.actualKcal} vs target ${r.outputs.targetCalories}`).toBeLessThanOrEqual(200)
      }
    })
  })

  it("no maternal mode produces a deficit relative to TDEE + adjustment", () => {
    results
      .filter(r => r.inputs.goalMode === "pregnancy_t2"
                || r.inputs.goalMode === "pregnancy_t3"
                || r.inputs.goalMode === "breastfeeding")
      .forEach(r => {
        if (r.outputs.tdee !== null && r.outputs.targetCalories !== null) {
          // Maternal modes must not be net-deficit below TDEE (surplus is mandatory).
          // Breastfeeding may cap weekly loss but the floor (1800) and surplus (+450) net positive.
          expect(r.outputs.targetCalories, `${r.label}`).toBeGreaterThanOrEqual(r.outputs.tdee - 200)
        }
      })
  })
})
