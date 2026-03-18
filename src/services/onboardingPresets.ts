// ── Onboarding Presets ────────────────────────────────────────────────────────
// Auto-populated model formats based on user choices during onboarding
// Everything is editable — these are starting points, not prescriptions

import type { WorkoutPlan, ExerciseConfig, DaySchedule } from "../store/useHealthStore"
import type { FitnessLevel, EatingStyle } from "../store/useHealthStore"
import { PRESETS, PresetKey } from "./mealPlanPresets"
import type { MealPlanEntry, DietTag } from "../store/useHealthStore"

function makeId(prefix: string) { return `${prefix}-${Math.random().toString(36).slice(2)}` }

// ── Exercise templates ────────────────────────────────────────────────────────
const BEGINNER_EXERCISES: ExerciseConfig[] = [
  { id: makeId("ex"), name: "Chair Squats", sets: "3", reps: "10", isTimed: false, note: "Hold chair back for balance. Rise slowly." },
  { id: makeId("ex"), name: "Incline Pushups", sets: "3", reps: "8", isTimed: false, note: "Hands on wall or sturdy surface." },
  { id: makeId("ex"), name: "Glute Bridge", sets: "3", reps: "12", isTimed: false, note: "Lie on back, feet flat, push hips up." },
  { id: makeId("ex"), name: "Dead Bug", sets: "3", reps: "8", isTimed: false, note: "Press lower back to floor throughout." },
  { id: makeId("ex"), name: "Plank", sets: "3", reps: "20", isTimed: true, note: "Forearms on floor. Don't let hips sag." },
  { id: makeId("ex"), name: "Calf Raises", sets: "3", reps: "15", isTimed: false, note: "Hold wall for balance." },
]

const INTERMEDIATE_EXERCISES: ExerciseConfig[] = [
  { id: makeId("ex"), name: "Squats", sets: "3-4", reps: "12", isTimed: false, note: "Keep knees behind toes. Rise slowly." },
  { id: makeId("ex"), name: "Pushups", sets: "3-4", reps: "12", isTimed: false, note: "Full range — chest to floor." },
  { id: makeId("ex"), name: "Australian Pull-ups", sets: "3-4", reps: "10", isTimed: false, note: "Low bar at hip height. Body straight." },
  { id: makeId("ex"), name: "Reverse Lunges", sets: "3", reps: "10", isTimed: false, note: "Step back, not forward. Hold wall for balance." },
  { id: makeId("ex"), name: "Plank", sets: "3-4", reps: "30", isTimed: true, note: "Full body tension throughout." },
  { id: makeId("ex"), name: "Bird Dog", sets: "3", reps: "10", isTimed: false, note: "Opposite arm + leg extend. Hold 2 sec." },
  { id: makeId("ex"), name: "Glute Bridge", sets: "3", reps: "15", isTimed: false, note: "Squeeze glutes at top." },
  { id: makeId("ex"), name: "Side Leg Raises", sets: "3", reps: "12", isTimed: false, note: "Slow and controlled." },
]

const ACTIVE_EXERCISES: ExerciseConfig[] = [
  { id: makeId("ex"), name: "Jump Squats", sets: "4", reps: "12", isTimed: false, note: "Land softly, knees tracking toes." },
  { id: makeId("ex"), name: "Pushups", sets: "4", reps: "15", isTimed: false, note: "Chest to floor, full extension." },
  { id: makeId("ex"), name: "Pull-ups / Australian Pull-ups", sets: "4", reps: "10", isTimed: false, note: "Full range, slow negative." },
  { id: makeId("ex"), name: "Bulgarian Split Squats", sets: "3", reps: "10", isTimed: false, note: "Rear foot elevated. Keep torso upright." },
  { id: makeId("ex"), name: "Pike Pushups", sets: "3", reps: "12", isTimed: false, note: "Hips high, elbows track back." },
  { id: makeId("ex"), name: "Plank to Downdog", sets: "3", reps: "10", isTimed: false, note: "Flow between positions with control." },
  { id: makeId("ex"), name: "Mountain Climbers", sets: "3", reps: "30", isTimed: true, note: "Fast but controlled. Hips stay low." },
  { id: makeId("ex"), name: "Superman Hold", sets: "3", reps: "30", isTimed: true, note: "Lift arms and legs simultaneously." },
]

// ── Schedule templates ────────────────────────────────────────────────────────
const BEGINNER_SCHEDULE: DaySchedule[] = [
  { day: "Monday",    types: ["walk","circuit"], walkTarget: 30, note: "Light walk + beginner circuit" },
  { day: "Tuesday",   types: ["walk"],           walkTarget: 20, note: "Easy recovery walk" },
  { day: "Wednesday", types: ["walk","circuit"], walkTarget: 30, note: "Walk + circuit" },
  { day: "Thursday",  types: ["rest"],           walkTarget: 0,  note: "Rest — recovery is essential" },
  { day: "Friday",    types: ["walk","circuit"], walkTarget: 30, note: "Walk + circuit" },
  { day: "Saturday",  types: ["walk"],           walkTarget: 30, note: "Longer walk — enjoy it" },
  { day: "Sunday",    types: ["rest"],           walkTarget: 0,  note: "Full rest day" },
]

const INTERMEDIATE_SCHEDULE: DaySchedule[] = [
  { day: "Monday",    types: ["walk","circuit"], walkTarget: 45, note: "Full workout — walk first, circuit evening" },
  { day: "Tuesday",   types: ["walk"],           walkTarget: 45, note: "Walk only — active recovery" },
  { day: "Wednesday", types: ["walk","circuit"], walkTarget: 45, note: "Full workout day" },
  { day: "Thursday",  types: ["rest"],           walkTarget: 0,  note: "Complete rest — muscle rebuilds today" },
  { day: "Friday",    types: ["walk","circuit"], walkTarget: 45, note: "Full workout day" },
  { day: "Saturday",  types: ["walk"],           walkTarget: 60, note: "Long walk — no strength today" },
  { day: "Sunday",    types: ["walk"],           walkTarget: 30, note: "Light walk — prepare for new week" },
]

const ACTIVE_SCHEDULE: DaySchedule[] = [
  { day: "Monday",    types: ["walk","circuit"], walkTarget: 45, note: "Strength + cardio" },
  { day: "Tuesday",   types: ["walk","circuit"], walkTarget: 30, note: "Strength focus" },
  { day: "Wednesday", types: ["walk"],           walkTarget: 60, note: "Active recovery — long walk" },
  { day: "Thursday",  types: ["walk","circuit"], walkTarget: 45, note: "Strength + cardio" },
  { day: "Friday",    types: ["walk","circuit"], walkTarget: 30, note: "Strength focus" },
  { day: "Saturday",  types: ["walk"],           walkTarget: 60, note: "Long walk or outdoor activity" },
  { day: "Sunday",    types: ["rest"],           walkTarget: 0,  note: "Full rest — non-negotiable" },
]

// ── Public API ────────────────────────────────────────────────────────────────
export function getWorkoutPlanForLevel(level: FitnessLevel): WorkoutPlan {
  const map = {
    beginner:     { exercises: BEGINNER_EXERCISES,     schedule: BEGINNER_SCHEDULE,     circuitRounds: 2, restBetweenRounds: 90 },
    intermediate: { exercises: INTERMEDIATE_EXERCISES, schedule: INTERMEDIATE_SCHEDULE, circuitRounds: 3, restBetweenRounds: 90 },
    active:       { exercises: ACTIVE_EXERCISES,       schedule: ACTIVE_SCHEDULE,       circuitRounds: 4, restBetweenRounds: 60 },
  }
  return map[level]
}

export function getMealPresetForDiet(tag: DietTag, isKeto: boolean): MealPlanEntry[] {
  if (tag === "non_veg")    return PRESETS.non_veg_keto.entries
  if (tag === "eggetarian") return PRESETS.eggetarian_keto.entries
  return PRESETS.vegetarian_balanced.entries
}

export function getIFSettingsForStyle(style: EatingStyle) {
  const map = {
    skip_breakfast: { fastingHours: 16, eatingHours: 8,  fastStartHour: 20 },
    early_eater:    { fastingHours: 16, eatingHours: 8,  fastStartHour: 16 },
    late_eater:     { fastingHours: 19, eatingHours: 5,  fastStartHour: 19 },
    aggressive_if:  { fastingHours: 20, eatingHours: 4,  fastStartHour: 20 },
  }
  return map[style]
}

// Summary text for onboarding preview
export function getScheduleSummary(level: FitnessLevel): string {
  const map = {
    beginner:     "3 workout days · 2 rest days · 20-30 min walk + light circuit",
    intermediate: "3 full workout days · 1 rest day · 45 min walk + circuit",
    active:       "4 workout days · 1 rest day · 45 min walk + full circuit",
  }
  return map[level]
}

// ── Maternal Exercise Templates ───────────────────────────────────────────────
// All exercises follow the reference document guidelines:
//   - High-impact, heavy lifting, supine-after-20wks exercises are flagged/excluded
//   - Focus shifts from "fat burn" to "activity", "strength", "recovery", "mobility"
//   - Pelvic floor (Kegels) featured in all maternal templates
//   - Always paired with the "check with your doctor" advisory in WorkoutLog

import type { GoalMode } from "./goalModeConfig"

// ── PRE-CONCEPTION ────────────────────────────────────────────────────────────
// Standard exercise is encouraged. No special restrictions.
// Focus: general fitness, pelvic floor awareness, stress management.
const PRECONCEPTION_EXERCISES: ExerciseConfig[] = [
  { id: makeId("ex"), name: "Squats", sets: "3", reps: "12", isTimed: false, note: "Keep knees tracking toes. Good hip mobility prep for pregnancy." },
  { id: makeId("ex"), name: "Glute Bridge", sets: "3", reps: "15", isTimed: false, note: "Squeeze glutes at top. Strengthens posterior chain." },
  { id: makeId("ex"), name: "Pushups", sets: "3", reps: "10", isTimed: false, note: "Full or incline. Builds upper body strength." },
  { id: makeId("ex"), name: "Bird Dog", sets: "3", reps: "10", isTimed: false, note: "Core stability. Opposite arm + leg. Hold 2 sec." },
  { id: makeId("ex"), name: "Kegel Exercises", sets: "3", reps: "10", isTimed: false, note: "Contract pelvic floor for 5 sec, release 5 sec. Best habit to start now." },
  { id: makeId("ex"), name: "Dead Bug", sets: "3", reps: "8", isTimed: false, note: "Press lower back flat throughout. Core control." },
  { id: makeId("ex"), name: "Reverse Lunges", sets: "3", reps: "10", isTimed: false, note: "Step back, not forward. Lower impact on knees." },
  { id: makeId("ex"), name: "Cat-Cow Stretch", sets: "2", reps: "10", isTimed: false, note: "Gentle spinal mobility. 5 sec each direction." },
]

const PRECONCEPTION_SCHEDULE: DaySchedule[] = [
  { day: "Monday",    types: ["walk","circuit"], walkTarget: 40, note: "Walk + strength circuit" },
  { day: "Tuesday",   types: ["walk"],           walkTarget: 30, note: "Easy walk — active recovery" },
  { day: "Wednesday", types: ["walk","circuit"], walkTarget: 40, note: "Walk + strength circuit" },
  { day: "Thursday",  types: ["rest"],           walkTarget: 0,  note: "Rest or gentle yoga" },
  { day: "Friday",    types: ["walk","circuit"], walkTarget: 40, note: "Walk + strength circuit" },
  { day: "Saturday",  types: ["walk"],           walkTarget: 45, note: "Longer walk or swim" },
  { day: "Sunday",    types: ["rest"],           walkTarget: 0,  note: "Rest — recovery and relaxation" },
]

// ── FIRST TRIMESTER (Weeks 1–12) ──────────────────────────────────────────────
// Exercise is safe and encouraged. Fatigue and nausea are common — keep it gentle.
// No high-impact. Avoid hot yoga. Pelvic floor very important.
// Heavy squats/deadlifts removed due to intra-abdominal pressure risk.
const T1_EXERCISES: ExerciseConfig[] = [
  { id: makeId("ex"), name: "Walking", sets: "1", reps: "20-30 min", isTimed: true, note: "Comfortable pace. Stop if dizzy or breathless." },
  { id: makeId("ex"), name: "Bodyweight Squats", sets: "3", reps: "10", isTimed: false, note: "Light, controlled. No added weight. Good for hip strength." },
  { id: makeId("ex"), name: "Kegel Exercises", sets: "3", reps: "10", isTimed: false, note: "Contract 5 sec, release 5 sec. Do these every day — essential for pelvic floor health." },
  { id: makeId("ex"), name: "Glute Bridge", sets: "3", reps: "12", isTimed: false, note: "On your back is fine in T1. Strengthens glutes and lower back." },
  { id: makeId("ex"), name: "Side-Lying Leg Raises", sets: "3", reps: "12", isTimed: false, note: "Lie on side. Lift top leg slowly. Hip abductor strength." },
  { id: makeId("ex"), name: "Bird Dog", sets: "3", reps: "8", isTimed: false, note: "Opposite arm + leg. Core stability without spinal flexion." },
  { id: makeId("ex"), name: "Wall Pushups", sets: "3", reps: "12", isTimed: false, note: "Hands on wall. Upper body strength — low effort." },
  { id: makeId("ex"), name: "Cat-Cow Stretch", sets: "2", reps: "10", isTimed: false, note: "Relieves back tension common in T1. Slow and gentle." },
  { id: makeId("ex"), name: "Prenatal Yoga (guided)", sets: "1", reps: "20-30 min", isTimed: true, note: "Follow a prenatal-specific video. Avoid hot yoga." },
]

const T1_SCHEDULE: DaySchedule[] = [
  { day: "Monday",    types: ["walk","circuit"], walkTarget: 25, note: "Light walk + gentle circuit. Listen to your body." },
  { day: "Tuesday",   types: ["walk"],           walkTarget: 20, note: "Easy walk only" },
  { day: "Wednesday", types: ["walk","circuit"], walkTarget: 25, note: "Light circuit if energy allows — skip if nauseous" },
  { day: "Thursday",  types: ["rest"],           walkTarget: 0,  note: "Rest — fatigue in T1 is real. Honour it." },
  { day: "Friday",    types: ["walk","circuit"], walkTarget: 25, note: "Light walk + gentle circuit" },
  { day: "Saturday",  types: ["walk"],           walkTarget: 30, note: "Longer walk or gentle swim" },
  { day: "Sunday",    types: ["rest"],           walkTarget: 0,  note: "Rest and restore" },
]

// ── SECOND TRIMESTER (Weeks 13–26) ────────────────────────────────────────────
// Energy usually returns. Avoid lying flat on back (after 20 wks — vena cava).
// Avoid traditional planks and crunches (diastasis recti risk).
// Diastasis-safe core work only. No jumping.
const T2_EXERCISES: ExerciseConfig[] = [
  { id: makeId("ex"), name: "Walking", sets: "1", reps: "30 min", isTimed: true, note: "Comfortable pace. 30 min most days is excellent." },
  { id: makeId("ex"), name: "Bodyweight Squats", sets: "3", reps: "12", isTimed: false, note: "Hold wall or chair for support as bump grows. Excellent for labour prep." },
  { id: makeId("ex"), name: "Kegel Exercises", sets: "4", reps: "10", isTimed: false, note: "Contract 5–10 sec, release fully. Do 3–4 sets daily." },
  { id: makeId("ex"), name: "Side-Lying Glute Raise", sets: "3", reps: "15", isTimed: false, note: "Lie on side — safe position throughout pregnancy. Hip strength." },
  { id: makeId("ex"), name: "Wall Sit", sets: "3", reps: "30", isTimed: true, note: "Back against wall, thighs parallel. Builds leg endurance." },
  { id: makeId("ex"), name: "Standing Row (band)", sets: "3", reps: "12", isTimed: false, note: "Resistance band around door handle. Pull elbows back. Counters posture changes." },
  { id: makeId("ex"), name: "Incline Pushups", sets: "3", reps: "10", isTimed: false, note: "Hands on bench or table. Avoids pressure on abdomen." },
  { id: makeId("ex"), name: "Clamshells", sets: "3", reps: "15", isTimed: false, note: "Lie on side, knees bent, open top knee. Hip rotator strength." },
  { id: makeId("ex"), name: "Bird Dog", sets: "3", reps: "10", isTimed: false, note: "On all fours — diastasis-safe core work." },
  { id: makeId("ex"), name: "Pelvic Tilts", sets: "2", reps: "15", isTimed: false, note: "Standing or on all fours. Gently tilt pelvis. Relieves back pain." },
  { id: makeId("ex"), name: "Prenatal Yoga / Stretching", sets: "1", reps: "20 min", isTimed: true, note: "Focus on hip openers, shoulder rolls, gentle backbend. Prenatal video recommended." },
]

const T2_SCHEDULE: DaySchedule[] = [
  { day: "Monday",    types: ["walk","circuit"], walkTarget: 30, note: "Walk + strength circuit" },
  { day: "Tuesday",   types: ["walk"],           walkTarget: 30, note: "Walk — active recovery" },
  { day: "Wednesday", types: ["walk","circuit"], walkTarget: 30, note: "Walk + circuit" },
  { day: "Thursday",  types: ["rest"],           walkTarget: 0,  note: "Rest or gentle prenatal yoga" },
  { day: "Friday",    types: ["walk","circuit"], walkTarget: 30, note: "Walk + circuit" },
  { day: "Saturday",  types: ["walk"],           walkTarget: 40, note: "Longer walk or swim — swimming is excellent in T2" },
  { day: "Sunday",    types: ["rest"],           walkTarget: 0,  note: "Rest day" },
]

// ── THIRD TRIMESTER (Weeks 27–40) ─────────────────────────────────────────────
// Reduce intensity. No lying on back after 20 weeks.
// Focus on mobility, pelvic floor, walking. Prepare body for labour.
// All exercises done seated, standing or on all fours / side-lying.
const T3_EXERCISES: ExerciseConfig[] = [
  { id: makeId("ex"), name: "Walking", sets: "1", reps: "20-30 min", isTimed: true, note: "Shorter, more frequent walks. Stop if contractions, pain or breathlessness." },
  { id: makeId("ex"), name: "Kegel Exercises", sets: "4", reps: "10", isTimed: false, note: "Vital for birth prep and recovery. Do daily — multiple times if possible." },
  { id: makeId("ex"), name: "Wall Squats", sets: "3", reps: "10", isTimed: false, note: "Back against wall for support. Labour-prep movement. Go only as low as comfortable." },
  { id: makeId("ex"), name: "Clamshells", sets: "3", reps: "12", isTimed: false, note: "Side-lying. Gentle hip strength." },
  { id: makeId("ex"), name: "Side-Lying Leg Raises", sets: "3", reps: "10", isTimed: false, note: "Low and controlled. Avoids back strain." },
  { id: makeId("ex"), name: "Pelvic Tilts (standing)", sets: "3", reps: "15", isTimed: false, note: "Standing against wall. Tilt pelvis forward and back. Relieves T3 back pain." },
  { id: makeId("ex"), name: "Cat-Cow on all fours", sets: "2", reps: "10", isTimed: false, note: "Excellent for baby positioning and back relief in late pregnancy." },
  { id: makeId("ex"), name: "Seated Resistance Band Row", sets: "3", reps: "12", isTimed: false, note: "Sit on chair with band around feet. Pull elbows back." },
  { id: makeId("ex"), name: "Prenatal Yoga — hip openers", sets: "1", reps: "15-20 min", isTimed: true, note: "Pigeon, butterfly, supported squat. Prepares hips for labour." },
  { id: makeId("ex"), name: "Deep Breathing / Relaxation", sets: "1", reps: "5 min", isTimed: true, note: "4-7-8 breathing or box breathing. Reduces cortisol, prepares for labour." },
]

const T3_SCHEDULE: DaySchedule[] = [
  { day: "Monday",    types: ["walk","circuit"], walkTarget: 20, note: "Short walk + gentle circuit" },
  { day: "Tuesday",   types: ["walk"],           walkTarget: 20, note: "Easy walk" },
  { day: "Wednesday", types: ["walk","circuit"], walkTarget: 20, note: "Gentle circuit + walk" },
  { day: "Thursday",  types: ["rest"],           walkTarget: 0,  note: "Rest — prenatal yoga or just relax" },
  { day: "Friday",    types: ["walk","circuit"], walkTarget: 20, note: "Gentle walk + circuit" },
  { day: "Saturday",  types: ["walk"],           walkTarget: 25, note: "Walk or swim at comfortable pace" },
  { day: "Sunday",    types: ["rest"],           walkTarget: 0,  note: "Rest and prepare" },
]

// ── POSTPARTUM (0–6 weeks) ────────────────────────────────────────────────────
// Weeks 0–6: gentle recovery only. No high intensity.
// Pelvic floor rebuilding is the #1 priority.
// No crunches, sit-ups, heavy lifting, or high impact.
// Always cleared by doctor at 6-week check before increasing intensity.
const POSTPARTUM_EXERCISES: ExerciseConfig[] = [
  { id: makeId("ex"), name: "Gentle Walking", sets: "1", reps: "10-15 min", isTimed: true, note: "Short walks from week 1. Increase gradually — 2 min/day is enough progress." },
  { id: makeId("ex"), name: "Kegel Exercises", sets: "4", reps: "10", isTimed: false, note: "Start day 1 if no perineal trauma — or once comfortable. Essential for pelvic floor recovery." },
  { id: makeId("ex"), name: "Diaphragmatic Breathing", sets: "3", reps: "10", isTimed: false, note: "Belly breathing re-activates deep core. Inhale into belly, exhale with gentle pelvic floor lift." },
  { id: makeId("ex"), name: "Pelvic Tilts (lying)", sets: "2", reps: "10", isTimed: false, note: "Lie on back, knees bent. Gently tilt pelvis. Safe from day 1." },
  { id: makeId("ex"), name: "Heel Slides", sets: "2", reps: "10", isTimed: false, note: "Lie on back, slide one heel out flat and return. Gentle core activation." },
  { id: makeId("ex"), name: "Ankle Pumps & Circles", sets: "2", reps: "20", isTimed: false, note: "Improves circulation and reduces swelling in feet/ankles. Do often." },
  { id: makeId("ex"), name: "Supported Glute Bridge", sets: "2", reps: "8", isTimed: false, note: "From week 3–4 if comfortable. Very low height — 2 inch lift only. No weight." },
  { id: makeId("ex"), name: "Neck and Shoulder Rolls", sets: "2", reps: "8", isTimed: false, note: "Relieves feeding posture tension. Slow circles, both directions." },
]

const POSTPARTUM_SCHEDULE: DaySchedule[] = [
  { day: "Monday",    types: ["walk"],    walkTarget: 10, note: "Short gentle walk. Stop if you feel any pain or pressure." },
  { day: "Tuesday",   types: ["circuit"], walkTarget: 0,  note: "Floor exercises only — Kegels, breathing, heel slides" },
  { day: "Wednesday", types: ["walk"],    walkTarget: 10, note: "Walk — increase by 1-2 min each week" },
  { day: "Thursday",  types: ["rest"],    walkTarget: 0,  note: "Rest — prioritise sleep and feeding" },
  { day: "Friday",    types: ["walk"],    walkTarget: 10, note: "Short walk" },
  { day: "Saturday",  types: ["circuit"], walkTarget: 0,  note: "Gentle floor circuit — Kegels + stretching" },
  { day: "Sunday",    types: ["rest"],    walkTarget: 0,  note: "Full rest — you're doing enough" },
]

// ── BREASTFEEDING (post 6-week check) ─────────────────────────────────────────
// Cleared by doctor. Can gradually increase intensity.
// Avoid very high intensity — can affect milk supply temporarily.
// Wear supportive bra. Stay well hydrated before/during/after.
// Diastasis recti still a consideration — check core function before heavy loading.
const BREASTFEEDING_EXERCISES: ExerciseConfig[] = [
  { id: makeId("ex"), name: "Walking", sets: "1", reps: "30 min", isTimed: true, note: "Excellent base. Build to 30–45 min comfortable walks with baby in carrier or pram." },
  { id: makeId("ex"), name: "Kegel Exercises", sets: "4", reps: "10", isTimed: false, note: "Continue daily — pelvic floor takes 6–12 months to fully recover." },
  { id: makeId("ex"), name: "Glute Bridge", sets: "3", reps: "12", isTimed: false, note: "Progress to single-leg as strength returns. Core and glute foundation." },
  { id: makeId("ex"), name: "Bodyweight Squats", sets: "3", reps: "12", isTimed: false, note: "Check for diastasis before loading. Hold wall if balance is affected." },
  { id: makeId("ex"), name: "Incline Pushups", sets: "3", reps: "10", isTimed: false, note: "Hands on bench. Wear a supportive bra. Progress to floor pushups when ready." },
  { id: makeId("ex"), name: "Seated Row (resistance band)", sets: "3", reps: "12", isTimed: false, note: "Counters rounded feeding posture. Band around feet, pull elbows back." },
  { id: makeId("ex"), name: "Side-Lying Hip Abduction", sets: "3", reps: "12", isTimed: false, note: "Rebuilds hip strength. Slow and controlled." },
  { id: makeId("ex"), name: "Bird Dog", sets: "3", reps: "10", isTimed: false, note: "Diastasis-safe core. Opposite arm + leg. Hold 2 sec." },
  { id: makeId("ex"), name: "Cat-Cow Stretch", sets: "2", reps: "10", isTimed: false, note: "Relieves back tension from feeding. Do morning and evening." },
  { id: makeId("ex"), name: "Chest + Shoulder Stretch", sets: "2", reps: "30", isTimed: true, note: "Doorway chest stretch. Counteracts hunched feeding posture." },
]

const BREASTFEEDING_SCHEDULE: DaySchedule[] = [
  { day: "Monday",    types: ["walk","circuit"], walkTarget: 30, note: "Walk + gentle circuit. Feed baby before exercising." },
  { day: "Tuesday",   types: ["walk"],           walkTarget: 30, note: "Walk with baby — fresh air is good for both of you" },
  { day: "Wednesday", types: ["walk","circuit"], walkTarget: 30, note: "Walk + circuit" },
  { day: "Thursday",  types: ["rest"],           walkTarget: 0,  note: "Rest — recovery and milk production both need it" },
  { day: "Friday",    types: ["walk","circuit"], walkTarget: 30, note: "Walk + circuit" },
  { day: "Saturday",  types: ["walk"],           walkTarget: 40, note: "Longer walk or swim — swimming is great postpartum" },
  { day: "Sunday",    types: ["rest"],           walkTarget: 0,  note: "Rest day — non-negotiable" },
]

// ── Maternal workout plan getter ───────────────────────────────────────────────
export function getMaternalWorkoutPlan(mode: GoalMode): WorkoutPlan | null {
  switch (mode) {
    case "pre_conception": return { exercises: PRECONCEPTION_EXERCISES, schedule: PRECONCEPTION_SCHEDULE, circuitRounds: 3, restBetweenRounds: 90 }
    case "pregnancy_t1":   return { exercises: T1_EXERCISES,            schedule: T1_SCHEDULE,            circuitRounds: 2, restBetweenRounds: 120 }
    case "pregnancy_t2":   return { exercises: T2_EXERCISES,            schedule: T2_SCHEDULE,            circuitRounds: 2, restBetweenRounds: 120 }
    case "pregnancy_t3":   return { exercises: T3_EXERCISES,            schedule: T3_SCHEDULE,            circuitRounds: 2, restBetweenRounds: 120 }
    case "postpartum":     return { exercises: POSTPARTUM_EXERCISES,    schedule: POSTPARTUM_SCHEDULE,    circuitRounds: 1, restBetweenRounds: 120 }
    case "breastfeeding":  return { exercises: BREASTFEEDING_EXERCISES, schedule: BREASTFEEDING_SCHEDULE, circuitRounds: 2, restBetweenRounds: 120 }
    default: return null
  }
}

export function getMaternalScheduleSummary(mode: GoalMode): string {
  switch (mode) {
    case "pre_conception": return "3 workout days · 2 rest days · 40 min walk + strength circuit"
    case "pregnancy_t1":   return "3 gentle sessions · 2 rest days · 25 min walk + gentle circuit"
    case "pregnancy_t2":   return "3 sessions · 2 rest days · 30 min walk + modified circuit"
    case "pregnancy_t3":   return "3 gentle sessions · 2 rest days · 20 min walk + seated/standing circuit"
    case "postpartum":     return "Short daily walks · gentle floor work · rest priority"
    case "breastfeeding":  return "3 workout days · 2 rest days · 30 min walk + recovery circuit"
    default: return ""
  }
}

// ── Geriatric Exercise Templates (60+) ────────────────────────────────────────
// Principles:
//   - Fall prevention is the #1 priority — balance and proprioception exercises
//   - Sarcopenia prevention — resistance training essential
//   - No high-impact, no ballistic movements, no exercises requiring rapid direction change
//   - Every exercise has a modification for seated version
//   - Kegels included — incontinence very common, often untreated
//   - Warm-up and cool-down non-negotiable — tendons and joints need more time

const GERIATRIC_EXERCISES: ExerciseConfig[] = [
  {
    id: makeId("ex"), name: "Sit-to-Stand (Chair Squats)",
    sets: "3", reps: "10", isTimed: false,
    note: "Rise slowly from chair without using hands if possible. The single best functional exercise for independence.",
  },
  {
    id: makeId("ex"), name: "Heel-to-Toe Walk (Tandem Walk)",
    sets: "2", reps: "10", isTimed: false,
    note: "Walk heel-to-toe in a straight line, arms out for balance. Improves proprioception and reduces fall risk.",
  },
  {
    id: makeId("ex"), name: "Single-Leg Stand",
    sets: "3", reps: "30", isTimed: true,
    note: "Hold wall or chair for safety. Stand on one foot for 30 sec. Progress to eyes closed. Essential for fall prevention.",
  },
  {
    id: makeId("ex"), name: "Wall Pushups",
    sets: "3", reps: "10", isTimed: false,
    note: "Hands on wall, step back slightly. Upper body strength for daily tasks (pushing open doors, getting up from floor).",
  },
  {
    id: makeId("ex"), name: "Seated Leg Press (Chair Kicks)",
    sets: "3", reps: "12", isTimed: false,
    note: "Sit in chair, extend one knee fully, hold 2 sec, lower. Strengthens quads critical for stair climbing.",
  },
  {
    id: makeId("ex"), name: "Kegel Exercises",
    sets: "4", reps: "10", isTimed: false,
    note: "Contract pelvic floor 5 sec, release 5 sec. Addresses very common bladder control issues. Do multiple times daily.",
  },
  {
    id: makeId("ex"), name: "Calf Raises (Standing)",
    sets: "3", reps: "15", isTimed: false,
    note: "Hold wall for balance. Rise onto toes, lower slowly. Improves ankle stability and circulation. Reduces fall risk.",
  },
  {
    id: makeId("ex"), name: "Shoulder Rolls & Neck Stretches",
    sets: "2", reps: "10", isTimed: false,
    note: "Slow circles, both directions. Relieves stiffness. Improves posture and reduces fall risk from restricted neck movement.",
  },
  {
    id: makeId("ex"), name: "Glute Bridge (Modified)",
    sets: "3", reps: "10", isTimed: false,
    note: "Lie on back, small lift only (not full bridge). Hip strength for getting up from floor and stair climbing.",
  },
  {
    id: makeId("ex"), name: "Wrist and Ankle Circles",
    sets: "2", reps: "15", isTimed: false,
    note: "Full circles both directions. Maintains joint mobility. Reduces arthritis stiffness. Do on waking.",
  },
  {
    id: makeId("ex"), name: "Deep Breathing (Pursed Lip)",
    sets: "3", reps: "60", isTimed: true,
    note: "Inhale 2 counts, exhale slowly 4 counts through pursed lips. Improves lung capacity and reduces anxiety.",
  },
]

const GERIATRIC_SCHEDULE: DaySchedule[] = [
  { day: "Monday",    types: ["walk","circuit"], walkTarget: 20, note: "Short walk + balance and strength circuit. Morning is best." },
  { day: "Tuesday",   types: ["walk"],           walkTarget: 20, note: "Easy walk — active recovery. Use walking stick if needed." },
  { day: "Wednesday", types: ["walk","circuit"], walkTarget: 20, note: "Walk + circuit" },
  { day: "Thursday",  types: ["rest"],           walkTarget: 0,  note: "Rest — gentle stretching only, or chair yoga." },
  { day: "Friday",    types: ["walk","circuit"], walkTarget: 20, note: "Walk + circuit" },
  { day: "Saturday",  types: ["walk"],           walkTarget: 25, note: "Slightly longer walk at comfortable pace. Walk with a companion." },
  { day: "Sunday",    types: ["rest"],           walkTarget: 0,  note: "Rest and recover. Socialise — social connection is medicine too." },
]

export function getGeriatricWorkoutPlan(): WorkoutPlan {
  return {
    exercises: GERIATRIC_EXERCISES,
    schedule: GERIATRIC_SCHEDULE,
    circuitRounds: 2,
    restBetweenRounds: 120,
  }
}

export function getGeriatricScheduleSummary(): string {
  return "3 sessions/week · 2 rest days · 20 min walk + balance & strength circuit"
}
