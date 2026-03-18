/**
 * healthConditions.ts — Session 12 extension
 * Pre-existing conditions questionnaire data:
 *   - Condition definitions + categories
 *   - Exercise recommendations, modifications and warnings per condition
 *   - Diet recommendations and warnings per condition
 *   - localStorage helpers
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type ConditionId =
  // Cardiovascular
  | "hypertension" | "heart_disease" | "arrhythmia" | "high_cholesterol"
  // Metabolic
  | "type2_diabetes" | "type1_diabetes" | "prediabetes" | "hypothyroidism" | "hyperthyroidism" | "pcos"
  // Musculoskeletal
  | "lower_back_pain" | "knee_pain" | "osteoporosis" | "arthritis" | "herniated_disc"
  // Respiratory
  | "asthma" | "copd"
  // Obesity related
  | "bmi_over_35" | "sleep_apnea"
  // Gastrointestinal
  | "gerd" | "ibs"
  // Mental health
  | "anxiety" | "depression"
  // Pregnancy specific
  | "gestational_diabetes" | "preeclampsia_risk" | "diastasis_recti"

export type ConditionCategory =
  | "cardiovascular" | "metabolic" | "musculoskeletal"
  | "respiratory" | "obesity" | "gastrointestinal" | "mental_health" | "pregnancy"

export interface Condition {
  id: ConditionId
  label: string
  category: ConditionCategory
  icon: string
}

export interface ExerciseGuidance {
  avoid: string[]         // specific movements/types to avoid
  preferred: string[]     // recommended exercise types
  modifications: string[] // how to modify existing exercises
  warning: string         // shown prominently in red if serious
  clearanceNeeded: boolean // must confirm doctor clearance
}

export interface DietGuidance {
  avoid: string[]
  prioritise: string[]
  warnings: string[]
  notes: string
}

export interface ConditionGuidance {
  conditionId: ConditionId
  severity: "caution" | "moderate" | "high"
  exerciseGuidance: ExerciseGuidance
  dietGuidance: DietGuidance
}

// ── Condition definitions ─────────────────────────────────────────────────────

export const CONDITIONS: Condition[] = [
  // Cardiovascular
  { id: "hypertension",      label: "High blood pressure (Hypertension)",  category: "cardiovascular",   icon: "🫀" },
  { id: "heart_disease",     label: "Heart disease / coronary artery",      category: "cardiovascular",   icon: "🫀" },
  { id: "arrhythmia",        label: "Irregular heartbeat (Arrhythmia)",     category: "cardiovascular",   icon: "🫀" },
  { id: "high_cholesterol",  label: "High cholesterol",                      category: "cardiovascular",   icon: "🩸" },
  // Metabolic
  { id: "type2_diabetes",    label: "Type 2 Diabetes",                       category: "metabolic",        icon: "🩺" },
  { id: "type1_diabetes",    label: "Type 1 Diabetes",                       category: "metabolic",        icon: "🩺" },
  { id: "prediabetes",       label: "Prediabetes / insulin resistance",      category: "metabolic",        icon: "🩺" },
  { id: "hypothyroidism",    label: "Hypothyroidism (underactive thyroid)",  category: "metabolic",        icon: "🦋" },
  { id: "hyperthyroidism",   label: "Hyperthyroidism (overactive thyroid)",  category: "metabolic",        icon: "🦋" },
  { id: "pcos",              label: "PCOS (Polycystic ovary syndrome)",      category: "metabolic",        icon: "🔵" },
  // Musculoskeletal
  { id: "lower_back_pain",   label: "Chronic lower back pain",               category: "musculoskeletal",  icon: "🦴" },
  { id: "knee_pain",         label: "Knee pain / osteoarthritis",            category: "musculoskeletal",  icon: "🦵" },
  { id: "osteoporosis",      label: "Osteoporosis / low bone density",       category: "musculoskeletal",  icon: "🦴" },
  { id: "arthritis",         label: "Arthritis (rheumatoid or osteo)",       category: "musculoskeletal",  icon: "🤲" },
  { id: "herniated_disc",    label: "Herniated disc / slipped disc",         category: "musculoskeletal",  icon: "🦴" },
  // Respiratory
  { id: "asthma",            label: "Asthma",                                category: "respiratory",      icon: "🫁" },
  { id: "copd",              label: "COPD / chronic bronchitis",             category: "respiratory",      icon: "🫁" },
  // Obesity related
  { id: "bmi_over_35",       label: "BMI over 35",                           category: "obesity",          icon: "⚖️" },
  { id: "sleep_apnea",       label: "Sleep apnea",                           category: "obesity",          icon: "😴" },
  // Gastrointestinal
  { id: "gerd",              label: "Acid reflux / GERD",                   category: "gastrointestinal", icon: "🔥" },
  { id: "ibs",               label: "IBS / irritable bowel syndrome",        category: "gastrointestinal", icon: "🫃" },
  // Mental health
  { id: "anxiety",           label: "Anxiety disorder",                      category: "mental_health",    icon: "🧠" },
  { id: "depression",        label: "Depression",                            category: "mental_health",    icon: "🧠" },
  // Pregnancy specific
  { id: "gestational_diabetes", label: "Gestational diabetes (GDM)",        category: "pregnancy",        icon: "🤰" },
  { id: "preeclampsia_risk", label: "Preeclampsia / high BP in pregnancy",   category: "pregnancy",        icon: "🤰" },
  { id: "diastasis_recti",   label: "Diastasis recti (abdominal separation)",category: "pregnancy",        icon: "🤰" },
]

export const CONDITION_CATEGORIES: Record<ConditionCategory, string> = {
  cardiovascular:   "❤️ Cardiovascular",
  metabolic:        "🩺 Metabolic",
  musculoskeletal:  "🦴 Musculoskeletal",
  respiratory:      "🫁 Respiratory",
  obesity:          "⚖️ Weight-related",
  gastrointestinal: "🫃 Digestive",
  mental_health:    "🧠 Mental Health",
  pregnancy:        "🤰 Pregnancy-related",
}

// ── Guidance per condition ────────────────────────────────────────────────────

export const CONDITION_GUIDANCE: Record<ConditionId, ConditionGuidance> = {
  hypertension: {
    conditionId: "hypertension",
    severity: "moderate",
    exerciseGuidance: {
      avoid: ["Heavy powerlifting", "Valsalva breathing (breath-holding during lifts)", "High-intensity interval training without warmup", "Inverted positions (headstands)"],
      preferred: ["Brisk walking", "Swimming", "Cycling (steady pace)", "Light resistance training with high reps / low weight", "Yoga (non-heated)"],
      modifications: ["Keep rest periods short but adequate", "Monitor perceived exertion — aim for 5–6/10", "Warm up and cool down for at least 10 min each", "Stop if you feel chest pain, severe headache or dizziness"],
      warning: "Do not exercise if resting BP is above 180/110 mmHg. Check BP before and after sessions initially.",
      clearanceNeeded: true,
    },
    dietGuidance: {
      avoid: ["High sodium foods — processed foods, pickles, papadums, salty snacks", "Excessive caffeine", "Alcohol", "High saturated fat"],
      prioritise: ["Potassium-rich foods — banana, sweet potato, spinach", "Magnesium — nuts, seeds, leafy greens", "Low-sodium cooking — use herbs, lime instead of salt", "DASH-style eating — more fruits, vegetables, whole grains"],
      warnings: ["Even keto diets can be adapted for hypertension — prioritise unsaturated fats and low-sodium options"],
      notes: "Saroglitazar and Olmesartan (already in your medication list) treat hypertension directly. Diet is a powerful complement.",
    },
  },

  heart_disease: {
    conditionId: "heart_disease",
    severity: "high",
    exerciseGuidance: {
      avoid: ["Any unsupervised high-intensity exercise", "Heavy lifting", "Competitive sport", "Exercise in extreme heat or cold"],
      preferred: ["Cardiac-rehab supervised programme (ask your cardiologist)", "Walking at comfortable pace", "Swimming", "Stationary cycling"],
      modifications: ["Keep heart rate in prescribed zone from cardiologist", "Always exercise with someone present initially", "Have your emergency medication accessible"],
      warning: "⚠️ Always get explicit clearance from your cardiologist before starting or changing your exercise programme.",
      clearanceNeeded: true,
    },
    dietGuidance: {
      avoid: ["Trans fats — vanaspati, margarine, most packaged biscuits", "High saturated fat — coconut oil in excess, red meat", "High sodium", "Alcohol", "Fried foods"],
      prioritise: ["Omega-3 fatty acids — walnuts, flaxseed, fatty fish", "Soluble fibre — oats, dal, psyllium husk", "Antioxidant-rich foods — berries, tomatoes, green tea", "Olive oil or mustard oil for cooking"],
      warnings: ["Keto may increase LDL in some people with heart disease — monitor lipid panel every 3 months"],
      notes: "Discuss dietary approach with your cardiologist. Mediterranean-style eating has the strongest evidence base for cardiovascular health.",
    },
  },

  arrhythmia: {
    conditionId: "arrhythmia",
    severity: "high",
    exerciseGuidance: {
      avoid: ["High-intensity training", "Stimulant pre-workouts", "Exercise when sleep-deprived"],
      preferred: ["Walking", "Swimming", "Light yoga", "Tai chi"],
      modifications: ["Use heart rate monitor if prescribed", "Avoid sudden intense bursts — gradual warm-up essential", "Stop immediately if you feel palpitations, dizziness or chest discomfort"],
      warning: "⚠️ Discuss all exercise with your cardiologist. Some arrhythmias require exercise restriction.",
      clearanceNeeded: true,
    },
    dietGuidance: {
      avoid: ["Caffeine (may trigger palpitations)", "Alcohol", "Energy drinks", "Very low carb diets without electrolyte management (risk of hypokalemia)"],
      prioritise: ["Magnesium-rich foods — pumpkin seeds, spinach, almonds", "Potassium — banana, sweet potato, coconut water", "Omega-3 — walnuts, flaxseed"],
      warnings: ["Electrolyte imbalances (low potassium/magnesium) can worsen arrhythmia — monitor on keto"],
      notes: "Keep consistent meal timing — skipping meals and large blood sugar swings can trigger arrhythmia in some people.",
    },
  },

  high_cholesterol: {
    conditionId: "high_cholesterol",
    severity: "caution",
    exerciseGuidance: {
      avoid: ["Prolonged sedentary periods"],
      preferred: ["Aerobic exercise — 150+ min/week moderate intensity", "Walking, swimming, cycling", "Resistance training 2x/week"],
      modifications: ["Consistency matters more than intensity — daily 30-min walks are very effective"],
      warning: "",
      clearanceNeeded: false,
    },
    dietGuidance: {
      avoid: ["Trans fats (vanaspati, margarine)", "Excess saturated fat — ghee in large quantities, red meat", "Refined carbohydrates and sugary foods"],
      prioritise: ["Soluble fibre — oats, barley, rajma, chana", "Plant sterols — nuts, seeds", "Omega-3 — walnuts, flaxseed, fatty fish", "Olive oil for cooking"],
      warnings: ["Keto can raise LDL cholesterol in some people — monitor lipid panel every 3–6 months if on keto", "High protein from dairy may raise LDL — prefer plant protein sources"],
      notes: "Exercise has a direct positive effect on HDL (good cholesterol). Diet primarily reduces LDL.",
    },
  },

  type2_diabetes: {
    conditionId: "type2_diabetes",
    severity: "moderate",
    exerciseGuidance: {
      avoid: ["Exercise when blood sugar is below 5.5 mmol/L (100 mg/dL) without eating first", "Exercise when blood sugar is above 16.7 mmol/L (300 mg/dL)", "Barefoot exercise (neuropathy risk — foot injuries)"],
      preferred: ["Brisk walking after meals — very effective for blood sugar control", "Resistance training 3x/week — improves insulin sensitivity significantly", "Swimming", "Cycling"],
      modifications: ["Check blood sugar before and after exercise initially", "Carry fast-acting glucose during workouts", "Wear proper footwear — inspect feet daily", "Resistance training is as important as cardio for T2D"],
      warning: "Monitor blood sugar before and after exercise. Adjust medication timing with your doctor if you start a new programme.",
      clearanceNeeded: true,
    },
    dietGuidance: {
      avoid: ["Refined carbohydrates — white rice, maida, sugar", "Sugary drinks — juice, sodas", "High glycaemic index foods — white bread, processed snacks", "Large meals — prefer smaller frequent meals"],
      prioritise: ["Low GI foods — oats, rajma, dal, vegetables", "Protein at every meal — slows glucose absorption", "Fibre — helps glucose control", "Bitter gourd (karela) — some evidence for glucose lowering"],
      warnings: ["Keto and low-carb are actually beneficial for T2D management — discuss with your doctor as medication may need adjustment", "Very low calorie diets can cause hypoglycaemia with insulin or sulphonylureas"],
      notes: "This app's keto settings align well with diabetes management. Monitor HbA1c every 3 months.",
    },
  },

  type1_diabetes: {
    conditionId: "type1_diabetes",
    severity: "high",
    exerciseGuidance: {
      avoid: ["Exercise when hypoglycaemic", "Exercise alone if unstable control", "Contact sports without adequate glucose management"],
      preferred: ["Any exercise is beneficial — timing and glucose management are key", "Walking, swimming, cycling, yoga"],
      modifications: ["Always carry fast-acting glucose during exercise", "Reduce insulin dose before exercise (discuss with endocrinologist)", "Monitor glucose before, during and after long sessions", "Aerobic exercise lowers glucose; anaerobic exercise may raise it temporarily"],
      warning: "⚠️ T1D exercise management is complex. Work with your endocrinologist to set glucose targets and insulin adjustment protocols before starting.",
      clearanceNeeded: true,
    },
    dietGuidance: {
      avoid: ["Inconsistent meal timing — regular meals essential for insulin matching", "High GI foods without insulin cover"],
      prioritise: ["Consistent carbohydrate intake per meal for easier insulin dosing", "Protein and fat slow absorption — useful for glucose stability", "Fibre-rich foods"],
      warnings: ["Keto is used by some T1D patients but requires very careful insulin management — only with endocrinologist supervision"],
      notes: "Ozempic (in your medication list) is approved for T1D in some protocols — discuss with your endocrinologist.",
    },
  },

  prediabetes: {
    conditionId: "prediabetes",
    severity: "caution",
    exerciseGuidance: {
      avoid: ["Prolonged inactivity — prediabetes is highly reversible with exercise"],
      preferred: ["150 min/week moderate activity — target for reversing prediabetes", "Resistance training 2–3x/week", "Walking after meals"],
      modifications: ["Even 10-min walks after meals improve post-meal glucose significantly"],
      warning: "",
      clearanceNeeded: false,
    },
    dietGuidance: {
      avoid: ["Refined carbs and sugar", "Processed foods", "Sugary drinks"],
      prioritise: ["Low GI whole foods", "High fibre", "Protein at every meal", "Healthy fats"],
      warnings: ["Prediabetes is highly reversible — diet and exercise can return HbA1c to normal"],
      notes: "Keto and low-carb diets are very effective for reversing prediabetes. The app's current settings are well-suited.",
    },
  },

  hypothyroidism: {
    conditionId: "hypothyroidism",
    severity: "caution",
    exerciseGuidance: {
      avoid: ["Overtraining — fatigue is common and recovery is slower"],
      preferred: ["Low to moderate intensity exercise", "Walking, yoga, swimming", "Resistance training — helps counter the metabolic slowdown"],
      modifications: ["Start slowly — hypothyroidism causes fatigue and muscle weakness", "Increase duration before intensity", "Morning exercise may be better (energy is higher before the day wears on)"],
      warning: "Exercise capacity is reduced until thyroid levels are optimised on medication. Don't judge progress against euthyroid baselines.",
      clearanceNeeded: false,
    },
    dietGuidance: {
      avoid: ["Raw cruciferous vegetables in large quantities (goitrogens — broccoli, cauliflower, cabbage) — cooked is fine", "Soy in large amounts", "Very high fibre close to thyroid medication time (impairs absorption)"],
      prioritise: ["Selenium — Brazil nuts (1–2/day), sunflower seeds, eggs", "Zinc — pumpkin seeds, chickpeas", "Iodine — iodised salt, dairy, seafood", "Iron-rich foods — low ferritin is common with hypothyroidism"],
      warnings: ["Take thyroid medication 30–60 min before food and supplements — especially calcium, iron"],
      notes: "Weight loss is harder with hypothyroidism until levels are optimised. Track TSH every 6 months minimum.",
    },
  },

  hyperthyroidism: {
    conditionId: "hyperthyroidism",
    severity: "moderate",
    exerciseGuidance: {
      avoid: ["High-intensity training until levels are controlled", "Exercise if resting heart rate is >100 bpm"],
      preferred: ["Gentle walking", "Yoga", "Swimming at easy pace"],
      modifications: ["Wait for thyroid levels to normalise before increasing intensity", "Monitor heart rate — hyperthyroidism raises it significantly"],
      warning: "⚠️ Untreated hyperthyroidism puts significant strain on the heart. Exercise restriction until medically managed.",
      clearanceNeeded: true,
    },
    dietGuidance: {
      avoid: ["Iodine-rich foods — seafood, iodised salt (can worsen hyperthyroidism)", "Caffeine (amplifies heart rate effects)", "Alcohol"],
      prioritise: ["Calcium and Vitamin D — hyperthyroidism depletes bone density", "Antioxidant-rich foods", "Adequate calories — hyperthyroidism increases metabolic rate"],
      warnings: ["Weight loss during hyperthyroidism is often muscle loss — prioritise adequate protein"],
      notes: "Once medically controlled, calorie targets will need adjustment as metabolism normalises.",
    },
  },

  pcos: {
    conditionId: "pcos",
    severity: "caution",
    exerciseGuidance: {
      avoid: ["Excessive cardio-only training without resistance (can worsen cortisol and hormone imbalance)"],
      preferred: ["Resistance training 3x/week — most effective for PCOS and insulin resistance", "Walking and low-intensity cardio", "Yoga — reduces cortisol and improves hormonal balance"],
      modifications: ["Prioritise strength over cardio", "Avoid overtraining — PCOS is associated with elevated cortisol", "Consistency over intensity"],
      warning: "",
      clearanceNeeded: false,
    },
    dietGuidance: {
      avoid: ["Refined carbohydrates", "Sugary foods and drinks", "Dairy in large quantities (can raise IGF-1 in some women with PCOS)"],
      prioritise: ["Low GI diet", "Anti-inflammatory foods — turmeric, omega-3, berries, leafy greens", "Inositol (myoinositol) foods — wholegrains, citrus, legumes", "Magnesium — pumpkin seeds, almonds"],
      warnings: ["Keto and low-carb are well-evidenced for PCOS management — particularly effective for insulin resistance and androgen reduction"],
      notes: "PCOS with insulin resistance responds very well to this app's keto/low-carb settings. Ozempic is sometimes prescribed for PCOS — already in your medication list.",
    },
  },

  lower_back_pain: {
    conditionId: "lower_back_pain",
    severity: "moderate",
    exerciseGuidance: {
      avoid: ["Heavy deadlifts and loaded squats (until cleared)", "Sit-ups and crunches", "Running on hard surfaces", "Prolonged sitting without breaks", "Twisting under load"],
      preferred: ["Walking — gentle daily walks are therapeutic", "Swimming — zero spinal loading", "Bird Dog", "Dead Bug", "Glute Bridge", "Cat-Cow stretch", "Hip flexor stretches"],
      modifications: ["Core stability exercises (bird dog, dead bug) are more effective than crunches for back pain", "All exercises should be pain-free — stop at any sharp or shooting pain", "Strengthen glutes — weak glutes are a common cause of back pain", "Avoid sitting for more than 45 min at a time"],
      warning: "⚠️ Seek medical review if you have pain radiating down the leg, numbness or weakness — could indicate nerve involvement.",
      clearanceNeeded: false,
    },
    dietGuidance: {
      avoid: ["Pro-inflammatory foods — excess refined carbs, seed oils, processed foods"],
      prioritise: ["Anti-inflammatory diet — turmeric, ginger, omega-3, colourful vegetables", "Adequate protein for muscle and disc repair", "Vitamin D and calcium — support vertebral health", "Magnesium — muscle relaxation"],
      warnings: [],
      notes: "Weight reduction significantly reduces spinal load — every 5kg lost reduces lower back pain meaningfully.",
    },
  },

  knee_pain: {
    conditionId: "knee_pain",
    severity: "moderate",
    exerciseGuidance: {
      avoid: ["Deep squats past 90 degrees", "Lunges if painful", "Running on hard surfaces", "Step-ups with heavy load", "Kneeling on hard floors"],
      preferred: ["Swimming and water aerobics — zero knee impact", "Cycling (stationary bike — low resistance)", "Straight-leg raises", "Seated leg press (light weight)", "Quad sets", "Hip strengthening — weak hips stress the knee"],
      modifications: ["Strengthen VMO (inner quad) — helps with knee tracking", "Hip abductor and glute work reduces knee valgus stress", "Avoid locking the knee fully when doing leg exercises", "Use foam pad for any kneeling exercises"],
      warning: "Stop if you feel grinding, locking, or significant swelling. Get an MRI if you haven't already.",
      clearanceNeeded: false,
    },
    dietGuidance: {
      avoid: ["Pro-inflammatory foods", "Excess refined carbohydrates"],
      prioritise: ["Omega-3 — anti-inflammatory effect on joints", "Collagen peptides — some evidence for cartilage support", "Vitamin C — collagen synthesis", "Turmeric (curcumin) — well-evidenced anti-inflammatory"],
      warnings: [],
      notes: "Weight loss is the single most effective intervention for knee osteoarthritis — 1kg weight lost = 4kg less force on each knee.",
    },
  },

  osteoporosis: {
    conditionId: "osteoporosis",
    severity: "moderate",
    exerciseGuidance: {
      avoid: ["High-impact jumping exercises", "Exercises with high fall risk", "Forward spine flexion under load (risk of vertebral fracture)", "Twisting of the spine under load"],
      preferred: ["Weight-bearing walking — essential for bone density", "Resistance training — most effective for building bone", "Balance exercises — reduce fall risk", "Stair climbing", "Dancing"],
      modifications: ["Prioritise form over weight", "Focus on back extension exercises (not flexion)", "Balance work (single-leg stand, heel-to-toe walking) is as important as lifting", "Ensure adequate calcium and Vitamin D before exercising hard"],
      warning: "Vertebral fractures can occur with minimal trauma in severe osteoporosis. Avoid forward bending under load.",
      clearanceNeeded: true,
    },
    dietGuidance: {
      avoid: ["Excessive caffeine (impairs calcium absorption)", "Very high sodium (increases calcium loss in urine)", "Excessive alcohol", "Very high protein without adequate calcium"],
      prioritise: ["Calcium — dairy, ragi (richest plant source at 344mg/100g), sesame seeds, tofu", "Vitamin D — sunlight 20 min/day, egg yolk, fortified foods", "Vitamin K2 — fermented foods, egg yolk, ghee", "Magnesium — helps calcium utilisation"],
      warnings: ["Keto can be adequate for bone health if calcium-rich foods are included — ragi, dairy, sesame"],
      notes: "Ragi (finger millet) is exceptionally high in calcium and is excellent for osteoporosis. Try ragi roti or ragi porridge.",
    },
  },

  arthritis: {
    conditionId: "arthritis",
    severity: "moderate",
    exerciseGuidance: {
      avoid: ["High-impact exercises on flare days", "Repetitive joint stress", "Exercising through significant joint pain"],
      preferred: ["Swimming — best exercise for arthritis", "Cycling (stationary)", "Walking at comfortable pace", "Yoga and tai chi — strong evidence for arthritis", "Resistance bands — gentle on joints", "Range-of-motion exercises daily"],
      modifications: ["Exercise is medicine for arthritis — inactivity worsens stiffness", "Warm up joints for 10 min before any exercise", "Morning stiffness usually improves with gentle movement", "Adjust intensity on flare days — even gentle stretching counts"],
      warning: "During a flare-up — rest the affected joint but keep other joints moving.",
      clearanceNeeded: false,
    },
    dietGuidance: {
      avoid: ["Pro-inflammatory foods — refined carbs, processed oils, sugar", "Red meat in excess (arachidonic acid)", "Nightshades if sensitive (anecdotal for some people)"],
      prioritise: ["Anti-inflammatory diet — omega-3, turmeric, ginger, berries, leafy greens", "Olive oil over other cooking oils", "Cherries — some evidence for reducing uric acid and inflammation", "Adequate protein for joint tissue repair"],
      warnings: [],
      notes: "For rheumatoid arthritis: fish oil (omega-3) has the strongest evidence base. Discuss with your rheumatologist.",
    },
  },

  herniated_disc: {
    conditionId: "herniated_disc",
    severity: "moderate",
    exerciseGuidance: {
      avoid: ["Forward spine flexion (touching toes, sit-ups, crunches)", "Deadlifts and heavy squats", "Running and jumping during acute phase", "Twisting under load", "Leg press with extreme range"],
      preferred: ["Walking — gentle movement aids disc recovery", "Swimming", "McKenzie extension exercises (if appropriate for your disc level — ask physio)", "Gentle yoga — back-extension focused"],
      modifications: ["Physiotherapy assessment is essential — herniation level determines safe movements", "Core stability is key but through anti-flexion exercises only (dead bug, bird dog, plank)"],
      warning: "⚠️ If you have pain, numbness or tingling radiating down the leg (sciatica), get medical clearance before any exercise programme.",
      clearanceNeeded: true,
    },
    dietGuidance: {
      avoid: ["Pro-inflammatory foods"],
      prioritise: ["Anti-inflammatory foods — omega-3, turmeric, colourful vegetables", "Adequate protein for disc repair", "Vitamin D — supports musculoskeletal health"],
      warnings: [],
      notes: "Weight management significantly reduces disc pressure. Every kg lost reduces disc load during walking.",
    },
  },

  asthma: {
    conditionId: "asthma",
    severity: "moderate",
    exerciseGuidance: {
      avoid: ["Cold, dry air exercise without mask", "High-intensity exercise without warm-up", "Exercise during high pollen or pollution days", "Exercising with poorly controlled asthma"],
      preferred: ["Swimming — humid air is best for asthmatic airways", "Walking", "Yoga and breathing exercises — significant benefit for asthma control", "Cycling (at moderate pace)"],
      modifications: ["Always have reliever inhaler (Asthalin/Ventolin) accessible during exercise", "Extended warm-up (10+ min) reduces exercise-induced bronchospasm", "Breathe through nose when possible", "Use preventer inhaler before exercise if prescribed"],
      warning: "Stop exercise if you experience significant breathlessness, wheezing or chest tightness. Use reliever inhaler.",
      clearanceNeeded: false,
    },
    dietGuidance: {
      avoid: ["Sulphite-containing foods (wine, dried fruit, processed foods) — can trigger asthma", "Food allergens if identified", "Excess processed foods"],
      prioritise: ["Omega-3 — anti-inflammatory effect on airways", "Vitamin C and E — antioxidants for airway protection", "Magnesium — bronchodilator effect", "Ginger and turmeric"],
      warnings: [],
      notes: "Pranayama (yogic breathing exercises) has strong evidence for improving asthma control. Anulom vilom and bhramari are particularly beneficial.",
    },
  },

  copd: {
    conditionId: "copd",
    severity: "high",
    exerciseGuidance: {
      avoid: ["High-intensity exercise", "Exercise in cold or polluted air", "Exercise during exacerbations"],
      preferred: ["Pulmonary rehabilitation programme (ask your pulmonologist)", "Walking at comfortable pace", "Arm and leg strengthening exercises", "Breathing exercises — pursed-lip breathing, diaphragmatic breathing"],
      modifications: ["Pace yourself — walk until slightly breathless, rest, continue", "Monitor oxygen saturation during exercise if prescribed", "Short frequent sessions better than long ones"],
      warning: "⚠️ Get pulmonologist clearance. Pulmonary rehabilitation has the strongest evidence base for COPD — ask for referral.",
      clearanceNeeded: true,
    },
    dietGuidance: {
      avoid: ["Foods that cause bloating (can worsen breathlessness) — beans, cruciferous veg, carbonated drinks", "Large meals (reduces breathing capacity)"],
      prioritise: ["Small frequent meals", "High protein — prevents respiratory muscle wasting", "Adequate calories — COPD is often associated with malnutrition", "Antioxidant-rich foods"],
      warnings: ["High carbohydrate diet produces more CO2 during metabolism — some COPD patients benefit from higher fat, lower carb"],
      notes: "Adequate nutrition is as important as exercise in COPD management.",
    },
  },

  bmi_over_35: {
    conditionId: "bmi_over_35",
    severity: "moderate",
    exerciseGuidance: {
      avoid: ["High-impact jumping exercises — excessive joint stress", "Exercises with high fall risk", "Very hot environments"],
      preferred: ["Water-based exercise — pool walking, water aerobics (reduced joint load)", "Cycling (stationary or recumbent)", "Walking — start with 10-15 min and build", "Seated resistance exercises", "Aqua aerobics"],
      modifications: ["Joint load is proportional to weight — water exercise is safest starting point", "Chair-based exercises are appropriate initially", "Focus on duration before intensity", "All progress counts — 5 min more per week is meaningful"],
      warning: "Start slow. Joint pain during exercise at high BMI is common — switch to low-impact alternatives rather than stopping altogether.",
      clearanceNeeded: true,
    },
    dietGuidance: {
      avoid: ["Liquid calories — juices, chai with sugar, lassi", "Ultra-processed foods", "Night-time eating"],
      prioritise: ["High protein — 1.2–1.5g/kg to preserve muscle during weight loss", "High volume, low calorie foods — salads, vegetables, soups", "Fibre — increases satiety", "Adequate hydration — often mistaken for hunger"],
      warnings: ["Very low calorie diets (<800 kcal) without medical supervision risk cardiac complications and muscle loss at high BMI"],
      notes: "Ozempic (in your medication list) is increasingly used for weight management at BMI >35. Discuss with your doctor if weight loss is the primary goal.",
    },
  },

  sleep_apnea: {
    conditionId: "sleep_apnea",
    severity: "moderate",
    exerciseGuidance: {
      avoid: ["Exercising when severely sleep-deprived — injury risk is high"],
      preferred: ["Morning exercise is beneficial — better sleep onset at night", "Regular aerobic exercise significantly reduces sleep apnea severity", "Resistance training"],
      modifications: ["Even modest weight loss (5–10%) significantly reduces sleep apnea severity", "Upper airway muscle exercises — tongue and throat exercises have some evidence"],
      warning: "Use your CPAP machine consistently — poorly treated sleep apnea significantly increases cardiovascular risk during exercise.",
      clearanceNeeded: false,
    },
    dietGuidance: {
      avoid: ["Alcohol — significantly worsens sleep apnea", "Heavy meals within 3 hours of sleep", "Excess caffeine after 2 PM"],
      prioritise: ["Weight loss-focused diet — most effective intervention for sleep apnea", "Anti-inflammatory foods", "Adequate magnesium — sleep quality"],
      warnings: [],
      notes: "Weight loss is the most effective non-CPAP treatment for sleep apnea. The app's calorie deficit settings directly support this.",
    },
  },

  gerd: {
    conditionId: "gerd",
    severity: "caution",
    exerciseGuidance: {
      avoid: ["Exercise immediately after meals (wait 2–3 hours)", "High-impact exercises that jar the body — running, jumping", "Core compression exercises — crunches, heavy squats — increase abdominal pressure", "Exercises requiring lying flat after eating"],
      preferred: ["Walking — gentle stimulates digestion", "Swimming", "Cycling", "Yoga — avoid inversions and twists right after meals"],
      modifications: ["Eat lightly before exercise", "Wear loose clothing — abdominal compression worsens reflux", "Keep head elevated during any floor exercises"],
      warning: "",
      clearanceNeeded: false,
    },
    dietGuidance: {
      avoid: ["Spicy foods", "Tomatoes and citrus", "Chocolate", "Mint", "Coffee and alcohol", "Fried and fatty foods", "Carbonated drinks", "Eating within 3 hours of sleep"],
      prioritise: ["Small frequent meals", "Alkaline foods — oats, banana, melon, low-fat dairy", "Chewing food thoroughly", "Ginger tea before meals"],
      warnings: ["Keto high-fat diet can worsen GERD in some people — monitor and adjust fat sources"],
      notes: "Elevate head of bed by 15–20 cm. Weight loss significantly reduces GERD severity.",
    },
  },

  ibs: {
    conditionId: "ibs",
    severity: "caution",
    exerciseGuidance: {
      avoid: ["High-intensity exercise during a flare", "Exercise on an empty stomach if it triggers symptoms"],
      preferred: ["Regular moderate exercise significantly improves IBS symptoms", "Walking", "Yoga — most evidence-based exercise for IBS", "Swimming", "Cycling"],
      modifications: ["Know your bathroom locations on any route", "Exercise timing — morning may work better if evenings are symptomatic", "Stress management through exercise directly improves gut function"],
      warning: "",
      clearanceNeeded: false,
    },
    dietGuidance: {
      avoid: ["High-FODMAP foods if sensitive — onion, garlic, wheat, lactose, certain fruits", "Gas-producing foods — beans, cruciferous veg", "Artificial sweeteners — sorbitol, xylitol", "Spicy foods if a trigger"],
      prioritise: ["Low-FODMAP diet trial (under dietitian supervision)", "Probiotics — some strains help IBS (Lactobacillus and Bifidobacterium)", "Soluble fibre — psyllium husk is well-tolerated", "Regular meal timing"],
      warnings: ["Keto eliminates many high-FODMAP foods — may naturally improve IBS symptoms"],
      notes: "IBS is strongly linked to stress and gut-brain axis. Stress management (yoga, meditation) is as important as diet.",
    },
  },

  anxiety: {
    conditionId: "anxiety",
    severity: "caution",
    exerciseGuidance: {
      avoid: ["Pushing through panic during exercise — it's okay to stop and do breathing exercises", "High-stimulant pre-workouts"],
      preferred: ["Regular exercise is one of the most effective treatments for anxiety", "Walking in nature", "Yoga and pranayama — strongest evidence for anxiety", "Swimming", "Any rhythmic exercise"],
      modifications: ["Routine and consistency are more important than intensity for anxiety", "Exercise with a partner if social anxiety is manageable", "Morning exercise regulates cortisol rhythm"],
      warning: "",
      clearanceNeeded: false,
    },
    dietGuidance: {
      avoid: ["Caffeine — worsens anxiety significantly", "Alcohol — short-term relief, long-term worsening", "High sugar foods — blood sugar crashes worsen anxiety", "Skipping meals"],
      prioritise: ["Magnesium — deficiency is linked to anxiety", "Omega-3 — anti-inflammatory effect on nervous system", "Complex carbohydrates — stabilise blood sugar and serotonin", "Probiotic foods — gut-brain axis"],
      warnings: ["Very low carb diets can worsen anxiety in some people through cortisol effects — monitor closely"],
      notes: "Sleep quality has a major impact on anxiety. Exercise, magnesium and consistent sleep timing all help.",
    },
  },

  depression: {
    conditionId: "depression",
    severity: "moderate",
    exerciseGuidance: {
      avoid: ["Setting goals so high that missing them reinforces hopelessness"],
      preferred: ["Exercise is as effective as antidepressants for mild-moderate depression", "Walking — simplest and most accessible", "Group exercise — social aspect adds benefit", "Yoga", "Any activity the person enjoys"],
      modifications: ["On difficult days — 5 minutes is enough. Walking to the end of the street counts.", "Habit stacking — attach exercise to an existing habit", "Track progress — seeing small improvements is motivating"],
      warning: "If you are experiencing severe depression, please discuss all treatment options with your doctor. Exercise is a complement, not a replacement, for medical care.",
      clearanceNeeded: false,
    },
    dietGuidance: {
      avoid: ["Alcohol — a central nervous system depressant", "Ultra-processed foods — associated with higher depression rates", "Skipping meals — blood sugar instability affects mood"],
      prioritise: ["Omega-3 (EPA specifically) — strongest evidence for depression", "Fermented foods — gut-brain axis", "Magnesium, zinc, B vitamins", "Regular meals — mood stabilising"],
      warnings: [],
      notes: "Ozempic and GLP-1 drugs are being studied for depression. If you take Ozempic, monitor mood changes.",
    },
  },

  gestational_diabetes: {
    conditionId: "gestational_diabetes",
    severity: "high",
    exerciseGuidance: {
      avoid: ["Lying flat on back after 20 weeks", "High-impact exercise", "Exercise when blood sugar is not controlled"],
      preferred: ["Walking after meals — highly effective for post-meal glucose in GDM", "Swimming", "Seated resistance exercises", "Prenatal yoga"],
      modifications: ["Check blood sugar before and after exercise", "Keep exercise sessions to 20–30 min", "Monitor for signs of hypoglycaemia"],
      warning: "⚠️ GDM exercise management must be done in close consultation with your obstetrician and diabetes care team.",
      clearanceNeeded: true,
    },
    dietGuidance: {
      avoid: ["All refined carbohydrates and sugars", "Fruit juice and sugary drinks", "Large meals — smaller more frequent meals are better", "White rice — switch to brown rice or millets"],
      prioritise: ["Protein at every meal — slows glucose absorption", "Low GI carbohydrates — oats, millets, dal, vegetables", "Fibre — reduces post-meal glucose spikes", "Adequate calories — GDM is not a reason to severely restrict calories"],
      warnings: ["Carb restriction must be done carefully to avoid ketoacidosis in pregnancy — target is moderate reduction, not keto"],
      notes: "The app's GDM flag (in pregnancy settings) will adjust carb target guidance. Always follow your diabetes team's specific carb budget.",
    },
  },

  preeclampsia_risk: {
    conditionId: "preeclampsia_risk",
    severity: "high",
    exerciseGuidance: {
      avoid: ["High-intensity exercise", "Exercise if BP is elevated (above 140/90)", "Isometric exercises (holding breath under load)"],
      preferred: ["Gentle walking if BP is stable", "Prenatal yoga at low intensity", "Rest is often more important than exercise"],
      modifications: ["Monitor blood pressure regularly", "Stop immediately if you have headache, vision changes or swelling"],
      warning: "⚠️ Preeclampsia requires close medical supervision. Rest your activity level on your obstetrician's specific advice — this guidance is general only.",
      clearanceNeeded: true,
    },
    dietGuidance: {
      avoid: ["High sodium foods — particularly important for BP management", "Processed foods", "Excessive caffeine"],
      prioritise: ["Calcium — 1000–1200mg/day (some evidence it reduces preeclampsia risk)", "Magnesium", "Potassium-rich foods", "Omega-3"],
      warnings: ["Low-dose aspirin is commonly prescribed for preeclampsia prevention — ensure this is in your medication list"],
      notes: "Report any sudden increase in swelling, headache, visual changes or upper abdominal pain to your doctor immediately.",
    },
  },

  diastasis_recti: {
    conditionId: "diastasis_recti",
    severity: "moderate",
    exerciseGuidance: {
      avoid: ["Traditional crunches, sit-ups, leg raises", "Plank (until cleared by physio)", "Double-leg lowering", "Heavy lifting with poor core bracing", "Exercises that cause 'doming' or 'coning' of the abdomen"],
      preferred: ["Physiotherapy-guided diastasis rehabilitation programme", "Diaphragmatic breathing with pelvic floor engagement", "Bird Dog", "Dead Bug (modified)", "Glute Bridge", "Walking"],
      modifications: ["All exercises should be done with inward drawing of abdomen (gentle — don't brace hard)", "Check for doming by placing fingers on midline while doing exercises — stop if doming occurs", "Splinting during heavy lifting helps"],
      warning: "⚠️ Get assessed by a women's health physiotherapist — severity and gap size determine which exercises are safe. Self-diagnosing and self-treating can worsen the separation.",
      clearanceNeeded: true,
    },
    dietGuidance: {
      avoid: ["Heavy meals that cause bloating — increases intra-abdominal pressure"],
      prioritise: ["Adequate protein for connective tissue repair", "Vitamin C — collagen synthesis", "Zinc — tissue healing"],
      warnings: [],
      notes: "Diastasis recti affects 60%+ of women postpartum. It is treatable — physiotherapy is highly effective.",
    },
  },
}

// ── Saved conditions ───────────────────────────────────────────────────────────

const CONDITIONS_KEY = "health_conditions"

export interface SavedConditions {
  conditions: ConditionId[]
  completedAt: number
  dismissed: boolean
}

export function loadSavedConditions(): SavedConditions {
  try {
    return JSON.parse(localStorage.getItem(CONDITIONS_KEY) || '{"conditions":[],"completedAt":0,"dismissed":false}')
  } catch {
    return { conditions: [], completedAt: 0, dismissed: false }
  }
}

export function saveConditions(data: SavedConditions) {
  try { localStorage.setItem(CONDITIONS_KEY, JSON.stringify(data)) } catch {}
}

export function getActiveGuidance(conditionIds: ConditionId[]): ConditionGuidance[] {
  return conditionIds
    .map(id => CONDITION_GUIDANCE[id])
    .filter(Boolean)
    .sort((a, b) => {
      const order = { high: 0, moderate: 1, caution: 2 }
      return order[a.severity] - order[b.severity]
    })
}
