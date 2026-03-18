/**
 * goalModeConfig.ts — Session 12
 * Central config for all 9 goal modes:
 *   fat_loss | recomposition | maintenance | pre_conception
 *   pregnancy_t1 | pregnancy_t2 | pregnancy_t3 | postpartum | breastfeeding
 *
 * Nothing hardcoded in components — everything reads from here.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type GoalMode =
  | "fat_loss"
  | "recomposition"
  | "maintenance"
  | "geriatric"
  | "child"
  | "teen_early"
  | "teen_older"
  | "pre_conception"
  | "pregnancy_t1"
  | "pregnancy_t2"
  | "pregnancy_t3"
  | "postpartum"
  | "breastfeeding"

export type MedicationItemType = "prescribed" | "supplement" | "reminder"

export interface PregnancySettings {
  prePregnancyWeightKg: number    // anchors gestational gain calculation
  prePregnancyBMI: number         // determines guideline range
  estimatedDueDate?: string       // YYYY-MM-DD
  weeksPregnant?: number          // user-entered, not calculated from LMP
  gdm: boolean                    // gestational diabetes flag
  deliveryDate?: string           // YYYY-MM-DD — set when switching to postpartum
}

export interface GoalModeFeatureFlags {
  showFasting: boolean
  showFastingCaveat: boolean        // pre-conception caveat note
  showPlateauDetector: boolean
  showWeightLossRate: boolean
  showMetabolicAdaptation: boolean
  showDeficitNudges: boolean
  showWeightGainCurve: boolean      // gestational weight gain band
  showMicronutrients: boolean       // micronutrient awareness checklist
  showPositiveTestButton: boolean   // "I got a positive test!" — pre-conception only
  maxWeightLossPerWeekKg: number | null
  suppressCalorieOverNudge: boolean
  suppressFatLossLanguage: boolean
  calorieAdjustment: number         // added to TDEE. negative = deficit.
  showRecompositionCues: boolean
  showBreastfeedingLossAlert: boolean
}

// ─── Feature Flags Per Mode ───────────────────────────────────────────────────

const PREGNANCY_FLAGS: Partial<GoalModeFeatureFlags> = {
  showFasting: false,
  showFastingCaveat: false,
  showPlateauDetector: false,
  showWeightLossRate: false,
  showMetabolicAdaptation: false,
  showDeficitNudges: false,
  showWeightGainCurve: true,
  showMicronutrients: true,
  showPositiveTestButton: false,
  suppressCalorieOverNudge: true,
  suppressFatLossLanguage: true,
  showRecompositionCues: false,
  showBreastfeedingLossAlert: false,
  maxWeightLossPerWeekKg: null,
}

export const GOAL_MODE_FLAGS: Record<GoalMode, GoalModeFeatureFlags> = {
  fat_loss: {
    showFasting: true,
    showFastingCaveat: false,
    showPlateauDetector: true,
    showWeightLossRate: true,
    showMetabolicAdaptation: true,
    showDeficitNudges: true,
    showWeightGainCurve: false,
    showMicronutrients: false,
    showPositiveTestButton: false,
    maxWeightLossPerWeekKg: null,
    suppressCalorieOverNudge: false,
    suppressFatLossLanguage: false,
    calorieAdjustment: 0, // computed dynamically from weeklyLossKg
    showRecompositionCues: false,
    showBreastfeedingLossAlert: false,
  },
  recomposition: {
    showFasting: true,
    showFastingCaveat: false,
    showPlateauDetector: true,
    showWeightLossRate: true,
    showMetabolicAdaptation: true,
    showDeficitNudges: true,
    showWeightGainCurve: false,
    showMicronutrients: false,
    showPositiveTestButton: false,
    maxWeightLossPerWeekKg: null,
    suppressCalorieOverNudge: false,
    suppressFatLossLanguage: false,
    calorieAdjustment: -250,
    showRecompositionCues: true,
    showBreastfeedingLossAlert: false,
  },
  maintenance: {
    showFasting: true,
    showFastingCaveat: false,
    showPlateauDetector: false,
    showWeightLossRate: false,
    showMetabolicAdaptation: false,
    showDeficitNudges: false,
    showWeightGainCurve: false,
    showMicronutrients: false,
    showPositiveTestButton: false,
    maxWeightLossPerWeekKg: null,
    suppressCalorieOverNudge: false,
    suppressFatLossLanguage: false,
    calorieAdjustment: 0,
    showRecompositionCues: false,
    showBreastfeedingLossAlert: false,
  },
  geriatric: {
    showFasting: true,
    showFastingCaveat: true,
    showPlateauDetector: true,
    showWeightLossRate: true,
    showMetabolicAdaptation: true,
    showDeficitNudges: true,
    showWeightGainCurve: false,
    showMicronutrients: true,
    showPositiveTestButton: false,
    maxWeightLossPerWeekKg: 0.25,
    suppressCalorieOverNudge: false,
    suppressFatLossLanguage: false,
    calorieAdjustment: 0,
    showRecompositionCues: true,
    showBreastfeedingLossAlert: false,
  },
  child: {
    showFasting: false,             // Never — dangerous for growing children
    showFastingCaveat: false,
    showPlateauDetector: false,
    showWeightLossRate: false,      // No weight loss framing for children
    showMetabolicAdaptation: false,
    showDeficitNudges: false,       // Never suggest eating less to a child
    showWeightGainCurve: false,
    showMicronutrients: true,       // Calcium, iron, Vit D, protein — growth
    showPositiveTestButton: false,
    maxWeightLossPerWeekKg: null,   // No weight loss targets
    suppressCalorieOverNudge: true, // Children need adequate calories for growth
    suppressFatLossLanguage: true,
    calorieAdjustment: 0,
    showRecompositionCues: false,
    showBreastfeedingLossAlert: false,
  },
  teen_early: {
    showFasting: false,             // Not recommended during puberty (ages 13–16)
    showFastingCaveat: false,
    showPlateauDetector: false,
    showWeightLossRate: false,
    showMetabolicAdaptation: false,
    showDeficitNudges: false,
    showWeightGainCurve: false,
    showMicronutrients: true,       // Iron (especially girls), calcium, protein, Vit D
    showPositiveTestButton: false,
    maxWeightLossPerWeekKg: 0.25,   // Very conservative — growth still happening
    suppressCalorieOverNudge: true,
    suppressFatLossLanguage: true,
    calorieAdjustment: 0,
    showRecompositionCues: false,
    showBreastfeedingLossAlert: false,
  },
  teen_older: {
    showFasting: true,              // 17–19: allowed with education
    showFastingCaveat: true,        // Caveat about growth and bone density
    showPlateauDetector: true,
    showWeightLossRate: true,
    showMetabolicAdaptation: false,
    showDeficitNudges: true,
    showWeightGainCurve: false,
    showMicronutrients: true,
    showPositiveTestButton: false,
    maxWeightLossPerWeekKg: 0.5,    // Conservative
    suppressCalorieOverNudge: false,
    suppressFatLossLanguage: false,
    calorieAdjustment: 0,
    showRecompositionCues: true,
    showBreastfeedingLossAlert: false,
  },
  pre_conception: {
    showFasting: true,
    showFastingCaveat: true,
    showPlateauDetector: false,
    showWeightLossRate: false,
    showMetabolicAdaptation: false,
    showDeficitNudges: false,
    showWeightGainCurve: false,
    showMicronutrients: true,
    showPositiveTestButton: true,
    maxWeightLossPerWeekKg: 0.5,
    suppressCalorieOverNudge: false,
    suppressFatLossLanguage: false,
    calorieAdjustment: -300, // max 0.5 kg/week if BMI>25, else 0
    showRecompositionCues: false,
    showBreastfeedingLossAlert: false,
  },
  pregnancy_t1: {
    ...PREGNANCY_FLAGS,
    calorieAdjustment: 0,
  } as GoalModeFeatureFlags,
  pregnancy_t2: {
    ...PREGNANCY_FLAGS,
    calorieAdjustment: 300,
  } as GoalModeFeatureFlags,
  pregnancy_t3: {
    ...PREGNANCY_FLAGS,
    calorieAdjustment: 450,
  } as GoalModeFeatureFlags,
  postpartum: {
    ...PREGNANCY_FLAGS,
    showWeightGainCurve: false,
    calorieAdjustment: 0,
  } as GoalModeFeatureFlags,
  breastfeeding: {
    ...PREGNANCY_FLAGS,
    showWeightGainCurve: false,
    calorieAdjustment: 450,
    maxWeightLossPerWeekKg: 0.3,
    suppressCalorieOverNudge: false,
    showBreastfeedingLossAlert: true,
  } as GoalModeFeatureFlags,
}

// ─── Mode Metadata ────────────────────────────────────────────────────────────

export interface GoalModeInfo {
  label: string
  shortLabel: string
  description: string
  icon: string
  group: "standard" | "pregnancy" | "geriatric" | "paediatric"
}

export const GOAL_MODE_INFO: Record<GoalMode, GoalModeInfo> = {
  fat_loss: {
    label: "Fat Loss",
    shortLabel: "Fat Loss",
    description: "Calorie deficit to lose fat while preserving muscle",
    icon: "🔥",
    group: "standard",
  },
  recomposition: {
    label: "Recomposition",
    shortLabel: "Recompo",
    description: "Lose fat and build muscle simultaneously — small deficit + high protein + resistance training",
    icon: "💪",
    group: "standard",
  },
  maintenance: {
    label: "Maintenance",
    shortLabel: "Maintain",
    description: "Eat at TDEE — hold weight stable while building habits",
    icon: "⚖️",
    group: "standard",
  },
  geriatric: {
    label: "Healthy Ageing (60+)",
    shortLabel: "Healthy Ageing",
    description: "Tailored for 60+ — preserving muscle, bone density, balance and independence. Conservative deficit, high protein, fall prevention focus.",
    icon: "🧓",
    group: "geriatric",
  },
  child: {
    label: "Child (2–12 years)",
    shortLabel: "Child",
    description: "Growth-focused nutrition. No calorie deficit. Configured by parent. Supports healthy weight and development — never weight loss.",
    icon: "🧒",
    group: "paediatric",
  },
  teen_early: {
    label: "Early Teen (13–16 years)",
    shortLabel: "Early Teen",
    description: "Puberty nutrition — iron, calcium, protein for growth. No fasting. Very gentle deficit only if clinically indicated.",
    icon: "🧑",
    group: "paediatric",
  },
  teen_older: {
    label: "Older Teen (17–19 years)",
    shortLabel: "Older Teen",
    description: "Near-adult nutrition with teen-specific considerations — bone density peak, adequate calories for growth completion.",
    icon: "👦",
    group: "paediatric",
  },
  pre_conception: {
    label: "Pre-Conception",
    shortLabel: "Pre-Conception",
    description: "Planning pregnancy — optimise nutrition and build nutrient stores before conceiving",
    icon: "🌱",
    group: "pregnancy",
  },
  pregnancy_t1: {
    label: "Pregnancy — First Trimester",
    shortLabel: "Pregnancy T1",
    description: "Weeks 1–12. No extra calories needed. Folate, protein and hydration are the focus.",
    icon: "🤰",
    group: "pregnancy",
  },
  pregnancy_t2: {
    label: "Pregnancy — Second Trimester",
    shortLabel: "Pregnancy T2",
    description: "Weeks 13–26. +300 kcal above maintenance. Iron, calcium, DHA and protein.",
    icon: "🤰",
    group: "pregnancy",
  },
  pregnancy_t3: {
    label: "Pregnancy — Third Trimester",
    shortLabel: "Pregnancy T3",
    description: "Weeks 27–40. +450 kcal above maintenance. Iron, DHA, protein and weight monitoring.",
    icon: "🤰",
    group: "pregnancy",
  },
  postpartum: {
    label: "Postpartum (0–6 weeks)",
    shortLabel: "Postpartum",
    description: "First 6 weeks after delivery. Maintenance calories, rest and recovery focus.",
    icon: "👶",
    group: "pregnancy",
  },
  breastfeeding: {
    label: "Breastfeeding",
    shortLabel: "Breastfeeding",
    description: "+400–500 kcal. Iodine, B12, calcium, DHA. Gentle weight loss only.",
    icon: "🍼",
    group: "pregnancy",
  },
}

// ─── Helper Predicates ────────────────────────────────────────────────────────

export function isPregnancyMode(mode: GoalMode): boolean {
  return mode.startsWith("pregnancy")
}

export function isPostBirthMode(mode: GoalMode): boolean {
  return mode === "postpartum" || mode === "breastfeeding"
}

export function isMaternalMode(mode: GoalMode): boolean {
  return isPregnancyMode(mode) || isPostBirthMode(mode) || mode === "pre_conception"
}

export function isGeriatricMode(mode: GoalMode): boolean {
  return mode === "geriatric"
}

export function getFlags(mode: GoalMode): GoalModeFeatureFlags {
  return GOAL_MODE_FLAGS[mode]
}

// ─── Gestational Weight Gain Guidelines (WHO/ACOG) ───────────────────────────

export interface GestationalGainRange {
  bmiCategory: string
  totalLow: number   // kg total gain
  totalHigh: number
  weeklyLow: number  // kg/week in T2/T3
  weeklyHigh: number
}

export function getGestationalGainRange(bmi: number): GestationalGainRange {
  if (bmi < 18.5) return { bmiCategory: "Underweight", totalLow: 12.5, totalHigh: 18,   weeklyLow: 0.5, weeklyHigh: 0.6 }
  if (bmi < 25)   return { bmiCategory: "Normal",      totalLow: 11.5, totalHigh: 16,   weeklyLow: 0.4, weeklyHigh: 0.5 }
  if (bmi < 30)   return { bmiCategory: "Overweight",  totalLow: 7,    totalHigh: 11.5, weeklyLow: 0.2, weeklyHigh: 0.3 }
  return               { bmiCategory: "Obese",         totalLow: 5,    totalHigh: 9,    weeklyLow: 0.2, weeklyHigh: 0.3 }
}

// ─── Pregnancy Macro Targets ──────────────────────────────────────────────────

export interface PregnancyMacroTargets {
  proteinG: number    // minimum
  carbsGMin: number   // brain development floor
  fatPct: number      // 25–35% of calories
  waterL: number      // litres
}

export function getPregnancyMacroTargets(mode: GoalMode): PregnancyMacroTargets {
  switch (mode) {
    case "pregnancy_t1":  return { proteinG: 75,  carbsGMin: 175, fatPct: 30, waterL: 3.0 }
    case "pregnancy_t2":  return { proteinG: 95,  carbsGMin: 175, fatPct: 30, waterL: 3.0 }
    case "pregnancy_t3":  return { proteinG: 105, carbsGMin: 175, fatPct: 30, waterL: 3.0 }
    case "postpartum":    return { proteinG: 95,  carbsGMin: 150, fatPct: 30, waterL: 3.0 }
    case "breastfeeding": return { proteinG: 110, carbsGMin: 175, fatPct: 30, waterL: 3.5 }
    case "pre_conception":return { proteinG: 70,  carbsGMin: 130, fatPct: 28, waterL: 2.5 }
    default:              return { proteinG: 70,  carbsGMin: 130, fatPct: 25, waterL: 2.5 }
  }
}

// ─── Supplement Presets ───────────────────────────────────────────────────────

export interface SupplementPreset {
  name: string
  dose: string
  note: string       // timing / pairing note
}

export const SUPPLEMENT_PRESETS: Record<GoalMode, SupplementPreset[]> = {
  fat_loss: [
    { name: "Magnesium Glycinate", dose: "300–400 mg",   note: "Bedtime · Sleep + muscle recovery" },
    { name: "Vitamin D3",          dose: "1000–2000 IU", note: "With food · Common deficiency" },
    { name: "Omega-3",             dose: "1000 mg",      note: "With meal · Inflammation + fat metabolism" },
    { name: "Electrolytes (keto)", dose: "As needed",    note: "Sodium, potassium, magnesium — especially on keto" },
  ],
  recomposition: [
    { name: "Magnesium Glycinate", dose: "300–400 mg",   note: "Bedtime · Sleep + muscle recovery" },
    { name: "Vitamin D3",          dose: "1000–2000 IU", note: "With food · Supports muscle function" },
    { name: "Omega-3",             dose: "1000 mg",      note: "With meal · Reduces inflammation" },
    { name: "Creatine Monohydrate",dose: "5 g",          note: "With water daily · Optional — muscle performance" },
  ],
  maintenance: [],
  geriatric: [
    { name: "Vitamin D3",           dose: "2000 IU",      note: "With food · Bone density + muscle function · Deficiency very common in elderly" },
    { name: "Calcium",              dose: "500 mg",       note: "With meal · Split doses · Not with iron · Bone health" },
    { name: "Vitamin B12",          dose: "500–1000 mcg", note: "Morning · Absorption decreases with age — sublingual preferred" },
    { name: "Magnesium Glycinate",  dose: "300–400 mg",   note: "Bedtime · Sleep, muscle cramps, constipation" },
    { name: "Omega-3",              dose: "1000–2000 mg", note: "With meal · Joint, brain and cardiovascular health" },
    { name: "Creatine Monohydrate", dose: "3–5 g",        note: "Daily · Water · Strongest evidence for sarcopenia prevention in elderly" },
    { name: "Collagen Peptides",    dose: "10 g",         note: "Morning · With Vitamin C · Joint and connective tissue support" },
    { name: "Vitamin K2 (MK-7)",    dose: "90–120 mcg",   note: "With food · Directs calcium to bones, not arteries" },
  ],
  child: [
    { name: "Vitamin D3",           dose: "600–1000 IU",  note: "With food · Most Indian children are deficient · Essential for bones and immunity" },
    { name: "Calcium",              dose: "500 mg",       note: "With food · Only if diet is low in dairy · Bone building years" },
    { name: "Omega-3 / DHA",        dose: "250 mg",       note: "With meal · Brain development, focus, learning" },
    { name: "Iron (if anaemic)",    dose: "As prescribed",note: "Only if doctor confirms iron deficiency anaemia — common in India" },
  ],
  teen_early: [
    { name: "Vitamin D3",           dose: "1000–2000 IU", note: "With food · Bone density peaks in teens — critical window" },
    { name: "Calcium",              dose: "1000–1300 mg total", note: "From food + supplement · Dairy, ragi, sesame — peak bone mass formed now" },
    { name: "Iron (girls)",         dose: "As prescribed", note: "Girls: iron loss from menstruation is significant — check ferritin" },
    { name: "Omega-3",              dose: "500–1000 mg",  note: "Brain development, mood regulation, acne reduction" },
    { name: "Zinc",                 dose: "8–11 mg",      note: "With food · Growth, immune function, skin health" },
  ],
  teen_older: [
    { name: "Vitamin D3",           dose: "1000–2000 IU", note: "With food · Critical for bone density — deficiency common in this age group" },
    { name: "Magnesium",            dose: "200–400 mg",   note: "Bedtime · Sleep, stress, muscle recovery, focus" },
    { name: "Omega-3",              dose: "1000 mg",      note: "With meal · Brain, mood, skin" },
    { name: "Iron (girls)",         dose: "As prescribed", note: "Check ferritin annually — menstrual losses" },
  ],
  pre_conception: [
    { name: "Folic Acid",          dose: "400–500 mcg",  note: "Morning · Start 3 months before conceiving" },
    { name: "Iron",                dose: "27 mg",        note: "With Vitamin C · Avoid with tea/coffee" },
    { name: "Vitamin D3",          dose: "1000–2000 IU", note: "With food" },
    { name: "Iodine",              dose: "150 mcg",      note: "Daily · Often in prenatal multi" },
    { name: "Omega-3 / DHA",       dose: "200–300 mg",   note: "With meal" },
    { name: "Vitamin B12",         dose: "500 mcg",      note: "Morning · Essential for vegetarians/eggetarians" },
  ],
  pregnancy_t1: [
    { name: "Folic Acid",          dose: "400–500 mcg",  note: "Morning · Neural tube protection" },
    { name: "Iron",                dose: "27 mg",        note: "With Vitamin C · Avoid with tea/coffee" },
    { name: "Vitamin D3",          dose: "1000–2000 IU", note: "With food" },
    { name: "Calcium",             dose: "500 mg",       note: "With meal · Not at the same time as iron" },
    { name: "Iodine",              dose: "150–220 mcg",  note: "Daily · Brain development" },
    { name: "DHA / Omega-3",       dose: "200 mg",       note: "With meal" },
    { name: "Vitamin B12",         dose: "500 mcg",      note: "Daily · Essential for vegetarians/eggetarians" },
  ],
  pregnancy_t2: [
    { name: "Folic Acid",          dose: "400–500 mcg",  note: "Morning" },
    { name: "Iron",                dose: "27+ mg",       note: "With Vitamin C · Doctor may increase dose" },
    { name: "Vitamin D3",          dose: "1000–2000 IU", note: "With food" },
    { name: "Calcium",             dose: "1000 mg total",note: "Split into 2 doses · Not with iron" },
    { name: "Iodine",              dose: "150–220 mcg",  note: "Daily" },
    { name: "DHA / Omega-3",       dose: "300 mg",       note: "With meal" },
    { name: "Magnesium Glycinate", dose: "200–300 mg",   note: "Bedtime · Helps with leg cramps" },
    { name: "Vitamin B12",         dose: "500 mcg",      note: "Daily · Vegetarians/eggetarians" },
  ],
  pregnancy_t3: [
    { name: "Folic Acid",          dose: "400–500 mcg",  note: "Morning" },
    { name: "Iron",                dose: "27+ mg",       note: "With Vitamin C · As prescribed" },
    { name: "Vitamin D3",          dose: "1000–2000 IU", note: "With food" },
    { name: "Calcium",             dose: "1000 mg total",note: "Split into 2 doses" },
    { name: "Iodine",              dose: "150–220 mcg",  note: "Daily" },
    { name: "DHA / Omega-3",       dose: "300 mg",       note: "With meal" },
    { name: "Magnesium Glycinate", dose: "200–300 mg",   note: "Bedtime" },
    { name: "Vitamin K2",          dose: "90–120 mcg",   note: "With food · If doctor recommends" },
    { name: "Vitamin B12",         dose: "500 mcg",      note: "Daily · Vegetarians/eggetarians" },
  ],
  postpartum: [
    { name: "Iron",                dose: "As prescribed",note: "Recovery from delivery blood loss" },
    { name: "Calcium",             dose: "1000 mg total",note: "Split doses · With food" },
    { name: "Vitamin D3",          dose: "1000–2000 IU", note: "With food" },
    { name: "Postnatal Multivitamin",dose:"As prescribed",note: "If doctor recommended" },
    { name: "Vitamin B12",         dose: "500 mcg",      note: "Daily · Vegetarians/eggetarians" },
  ],
  breastfeeding: [
    { name: "Iodine",              dose: "200–290 mcg",  note: "Critical — passes to baby via milk" },
    { name: "Vitamin D3",          dose: "1000–2000 IU", note: "With food · Baby gets it through milk" },
    { name: "Calcium",             dose: "1000 mg total",note: "Split doses" },
    { name: "DHA / Omega-3",       dose: "200–300 mg",   note: "With meal · Baby brain development" },
    { name: "Vitamin B12",         dose: "500 mcg",      note: "Daily · Baby's neurological development" },
    { name: "Iron",                dose: "As needed",    note: "If postpartum anaemia continues" },
  ],
}

// ─── Blood Test Presets ───────────────────────────────────────────────────────

export interface BloodTestPreset {
  name: string
  reason: string
  intervalDays: number
}

export const BLOOD_TEST_PRESETS: Partial<Record<GoalMode, BloodTestPreset[]>> = {
  pre_conception: [
    { name: "Rubella Immunity",    reason: "Vaccination needed before pregnancy if not immune", intervalDays: 99999 },
    { name: "Thyroid (TSH)",       reason: "Undiagnosed thyroid issues affect fertility and development", intervalDays: 180 },
    { name: "Blood Sugar (HbA1c)", reason: "Uncontrolled diabetes increases risk significantly", intervalDays: 90 },
    { name: "Vitamin D (25-OH)",   reason: "Deficiency common, easily corrected before conceiving", intervalDays: 180 },
    { name: "Iron / Ferritin",     reason: "Build iron stores now — takes months", intervalDays: 90 },
    { name: "CBC (Haemoglobin)",   reason: "Anaemia check — treat before pregnancy", intervalDays: 90 },
  ],
  pregnancy_t1: [
    { name: "Blood Group & Rh Factor", reason: "Rh incompatibility screening",             intervalDays: 99999 },
    { name: "CBC (Haemoglobin)",        reason: "Anaemia screening",                        intervalDays: 90 },
    { name: "Blood Sugar (Fasting)",    reason: "Baseline diabetes screening",              intervalDays: 90 },
    { name: "Thyroid (TSH)",            reason: "Thyroid affects fetal development",        intervalDays: 90 },
    { name: "HbA1c",                    reason: "If diabetic history — diabetes management",intervalDays: 90 },
    { name: "Glucose Tolerance (GTT)",  reason: "Gestational diabetes — due at 24–28 weeks",intervalDays: 180 },
    { name: "Anomaly Scan",             reason: "Structural scan — due at 18–20 weeks",    intervalDays: 180 },
    { name: "Group B Strep (GBS)",      reason: "Delivery planning — due at 35–37 weeks",  intervalDays: 180 },
  ],
}

// ─── Micronutrient Awareness Items ───────────────────────────────────────────

export interface MicronutrientItem {
  id: string
  icon: string
  nutrient: string
  prompt: string        // shown on Today tab
  foods: string         // comma-separated food sources
  modes: GoalMode[]     // which modes show this item
}

export const MICRONUTRIENT_ITEMS: MicronutrientItem[] = [
  {
    id: "folate",
    icon: "🥬",
    nutrient: "Folate",
    prompt: "Had a folate source today?",
    foods: "Leafy greens, lentils, rajma, fortified atta",
    modes: ["pre_conception", "pregnancy_t1", "pregnancy_t2", "pregnancy_t3"],
  },
  {
    id: "iron",
    icon: "🩸",
    nutrient: "Iron",
    prompt: "Had an iron source today?",
    foods: "Lentils, spinach, rajma, fortified cereal · Add lemon juice to boost absorption",
    modes: ["pre_conception", "pregnancy_t1", "pregnancy_t2", "pregnancy_t3", "postpartum", "breastfeeding"],
  },
  {
    id: "calcium",
    icon: "🥛",
    nutrient: "Calcium",
    prompt: "Had a calcium source today?",
    foods: "Dairy, tofu, ragi, sesame, leafy greens, amaranth",
    modes: ["pregnancy_t2", "pregnancy_t3", "postpartum", "breastfeeding"],
  },
  {
    id: "iodine",
    icon: "🧂",
    nutrient: "Iodine",
    prompt: "Using iodised salt today?",
    foods: "Iodised salt, dairy, seafood",
    modes: ["pre_conception", "pregnancy_t1", "pregnancy_t2", "pregnancy_t3", "breastfeeding"],
  },
  {
    id: "dha",
    icon: "🐟",
    nutrient: "DHA / Omega-3",
    prompt: "Had an omega-3 source today?",
    foods: "Walnuts, flaxseed, fatty fish",
    modes: ["pre_conception", "pregnancy_t2", "pregnancy_t3", "breastfeeding"],
  },
  {
    id: "b12",
    icon: "💊",
    nutrient: "Vitamin B12",
    prompt: "B12 supplement taken?",
    foods: "Dairy, eggs · Vegetarians/eggetarians need a supplement",
    modes: ["pre_conception", "pregnancy_t1", "pregnancy_t2", "pregnancy_t3", "postpartum", "breastfeeding"],
  },
  {
    id: "vitamin_d",
    icon: "☀️",
    nutrient: "Vitamin D",
    prompt: "Vitamin D supplement taken?",
    foods: "Sunlight exposure, fortified milk, egg yolk",
    modes: ["pre_conception"],
  },
  {
    id: "geriatric_protein",
    icon: "🥚",
    nutrient: "Protein",
    prompt: "Had protein with every meal today?",
    foods: "Eggs, paneer, dal, curd, fish, chicken — aim for 25–30g per meal",
    modes: ["geriatric"],
  },
  {
    id: "geriatric_calcium",
    icon: "🥛",
    nutrient: "Calcium",
    prompt: "Had a calcium source today?",
    foods: "Dairy, ragi, sesame seeds, tofu, leafy greens",
    modes: ["geriatric"],
  },
  {
    id: "geriatric_b12",
    icon: "💊",
    nutrient: "Vitamin B12",
    prompt: "B12 supplement taken?",
    foods: "Absorption decreases with age — supplement is more reliable than food alone",
    modes: ["geriatric"],
  },
  {
    id: "geriatric_vitamin_d",
    icon: "☀️",
    nutrient: "Vitamin D3",
    prompt: "Vitamin D3 supplement taken?",
    foods: "20 min sunlight + supplement — deficiency causes falls, weak bones and fatigue",
    modes: ["geriatric"],
  },
  {
    id: "geriatric_water",
    icon: "💧",
    nutrient: "Hydration",
    prompt: "Drinking enough water? (thirst sensation reduces with age)",
    foods: "Water, chaas, soups, dal — aim for 2–2.5L even if not thirsty",
    modes: ["geriatric"],
  },
]

// ─── localStorage helpers ─────────────────────────────────────────────────────

const GOAL_MODE_KEY     = "goal_mode"
const PREGNANCY_KEY     = "pregnancy_settings"
const DISCLAIMER_KEY    = "pregnancy_disclaimer_shown"
const SUPP_OFFER_KEY    = (mode: GoalMode) => `supp_offer_shown_${mode}`
const MICRO_KEY         = (date: string) => `micronutrient_${date}`

export function loadGoalMode(): GoalMode {
  try { return (localStorage.getItem(GOAL_MODE_KEY) as GoalMode) || "fat_loss" } catch { return "fat_loss" }
}

export function saveGoalMode(mode: GoalMode) {
  try { localStorage.setItem(GOAL_MODE_KEY, mode) } catch {}
}

export function loadPregnancySettings(): PregnancySettings {
  try {
    const raw = localStorage.getItem(PREGNANCY_KEY)
    return raw ? JSON.parse(raw) : { prePregnancyWeightKg: 0, prePregnancyBMI: 0, gdm: false }
  } catch { return { prePregnancyWeightKg: 0, prePregnancyBMI: 0, gdm: false } }
}

export function savePregnancySettings(s: PregnancySettings) {
  try { localStorage.setItem(PREGNANCY_KEY, JSON.stringify(s)) } catch {}
}

export function hasShownDisclaimer(mode: GoalMode): boolean {
  try { return localStorage.getItem(`${DISCLAIMER_KEY}_${mode}`) === "1" } catch { return false }
}

export function markDisclaimerShown(mode: GoalMode) {
  try { localStorage.setItem(`${DISCLAIMER_KEY}_${mode}`, "1") } catch {}
}

export function hasShownSupplementOffer(mode: GoalMode): boolean {
  // Use sessionStorage so the offer re-appears each time the user
  // switches back to a mode within the same app session.
  try { return sessionStorage.getItem(SUPP_OFFER_KEY(mode)) === "1" } catch { return false }
}

export function markSupplementOfferShown(mode: GoalMode) {
  try { sessionStorage.setItem(SUPP_OFFER_KEY(mode), "1") } catch {}
}

export function loadMicronutrientLog(date: string): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(MICRO_KEY(date)) || "{}") } catch { return {} }
}

export function saveMicronutrientLog(date: string, log: Record<string, boolean>) {
  try { localStorage.setItem(MICRO_KEY(date), JSON.stringify(log)) } catch {}
}
