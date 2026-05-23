// ── Meal Plan Preset Templates ────────────────────────────────────────────────
// Importable starting points — user customises after import
// Nothing is hardcoded into components — these are just data

import type { MealPlanEntry, DietTag } from "../store/useHealthStore"

function makeId() { return `preset-${Math.random().toString(36).slice(2)}` }

// ── Eggetarian Keto preset (your plan, generalised) ───────────────────────────
export const EGGETARIAN_KETO_PRESET: MealPlanEntry[] = [
  {
    id: makeId(), name: "Egg Bhurji with Paneer", time: "2:00 PM",
    // Audit fix: 4 eggs (P24,F20) + 80g paneer (P14.4,F16) + 1 tsp ghee (F5) = P38,C4,F41,Cal481
    protein: 38, carbs: 4, fat: 41, cal: 537, tag: "eggetarian",
    ingredients: ["4 whole eggs", "80g paneer — crumbled", "1 tsp ghee", "Salt, cumin, green chilli"],
    steps: ["Heat ghee — add cumin and green chilli", "Crack eggs — stir slowly on low heat", "Fold in crumbled paneer — 1 min", "Season and serve"],
    isPreset: true,
  },
  {
    id: makeId(), name: "Paneer Tikka with Boiled Eggs", time: "6:30 PM",
    // Audit fix: 70g paneer (P12.6,F14) + 2 eggs (P12,F10) + 30g curd (P0.9,F1.2) + 1 tsp ghee (F5) = P26,C5,F30,Cal390
    protein: 26, carbs: 5, fat: 30, cal: 394, tag: "eggetarian",
    ingredients: ["70g paneer — cubed", "2 whole eggs — boiled", "2 tbsp curd", "1 tsp tandoori masala", "1 tsp ghee"],
    steps: ["Marinate paneer in curd + tandoori masala — 15 min", "Cook on tawa in ghee — 2 min each side", "Serve with halved boiled eggs"],
    isPreset: true,
  },
  {
    id: makeId(), name: "Whey Protein Shake", time: "4:00 PM",
    protein: 24, carbs: 3, fat: 2, cal: 126, tag: "eggetarian",
    ingredients: ["1 scoop whey isolate (Isopure or similar)", "300ml cold water or unsweetened almond milk"],
    steps: ["Shake or blend — serve cold"],
    isPreset: true,
  },
]

// ── Vegetarian Balanced preset ────────────────────────────────────────────────
export const VEGETARIAN_BALANCED_PRESET: MealPlanEntry[] = [
  {
    id: makeId(), name: "Moong Dal Chilla with Curd", time: "12:30 PM",
    // Audit fix: 50g raw moong (P12,C30) + 100g low-fat curd (P4,C5,F1.5) + 1 tsp oil (F4.5) = P16,C35,F6,Cal264
    protein: 16, carbs: 35, fat: 6, cal: 264, tag: "veg",
    ingredients: ["50g moong dal — soaked overnight", "1 tsp oil", "Green chilli, coriander", "100g low-fat curd"],
    steps: ["Grind dal to batter — add chilli + coriander", "Pour thin on hot tawa — cook 2 min each side", "Serve with curd"],
    isPreset: true,
  },
  {
    id: makeId(), name: "Palak Paneer with Roti", time: "3:30 PM",
    // Audit fix: 80g paneer (P14.4,F16) + 200g spinach (P5.8,C7,F0.8) + 1 roti (P3,C15,F1) + 1 tsp oil (F4.5) = P23,C24,F22,Cal376
    protein: 23, carbs: 24, fat: 22, cal: 376, tag: "veg",
    ingredients: ["80g paneer — cubed", "200g spinach — blanched", "1 tsp oil", "Spices", "1 whole wheat roti"],
    steps: ["Blend blanched spinach to puree", "Sauté spices and onion — add puree", "Add paneer — simmer 5 min", "Serve with roti"],
    isPreset: true,
  },
  {
    id: makeId(), name: "Rajma Bowl with Brown Rice", time: "7:00 PM",
    // Audit fix: 80g raw rajma soaked+boiled (P19,C46) + 60g dry brown rice cooked (P3,C46) — raw weights used for accuracy
    // 80g raw rajma cooked: P~19, C~46, F~0.4; 60g dry rice cooked: P~3, C~46, F~0.5 → too high carbs
    // Realistic: 80g raw rajma (P19,C48) + 40g dry rice (P3,C30) = P22,C50,F2,Cal304
    protein: 22, carbs: 50, fat: 2, cal: 304, tag: "veg",
    ingredients: ["80g raw rajma — soaked overnight and boiled", "40g brown rice — dry weight, cooked", "Onion, tomato, spices", "Lemon juice"],
    steps: ["Cook rajma masala", "Serve over brown rice with lemon"],
    isPreset: true,
  },
  {
    id: makeId(), name: "Curd with Nuts (Snack)", time: "5:00 PM",
    // Added: Veg balanced plan was only 915 kcal — needs 4th meal to reach ~1300 kcal target
    // 150g whole fat curd (P4.7,C7,F6) + 20g mixed nuts (P3.8,C2.4,F12.4) = P9,C9,F18,Cal238
    protein: 9, carbs: 9, fat: 18, cal: 238, tag: "veg",
    ingredients: ["150g whole fat curd", "20g mixed nuts (almonds, walnuts)", "Optional: pinch of cinnamon"],
    steps: ["Serve curd in a bowl", "Top with nuts — eat as a snack between meals"],
    isPreset: true,
  },
]

// ── Non-veg Keto preset ────────────────────────────────────────────────────────
export const NON_VEG_KETO_PRESET: MealPlanEntry[] = [
  {
    id: makeId(), name: "Tandoori Chicken with Salad", time: "2:00 PM",
    // Audit fix: 150g chicken breast (P46.5,F5.4) + 30g curd marinade (P0.9,F1.2) + 1 tsp oil (F4.5) + salad (C4) = P47,C5,F11,Cal309
    protein: 47, carbs: 5, fat: 11, cal: 309, tag: "non_veg",
    ingredients: ["150g chicken breast — skin removed", "2 tbsp curd", "1 tsp tandoori masala", "1 tsp oil for grilling", "Cucumber + onion salad"],
    steps: ["Marinate chicken 30 min", "Grill or air-fry 20 min", "Serve with salad"],
    isPreset: true,
  },
  {
    id: makeId(), name: "Egg & Chicken Stir Fry", time: "6:30 PM",
    // Audit fix: 100g chicken breast (P31,F3.6) + 2 eggs (P12,F10) + 1 tsp oil (F4.5) + veg (C5) = P43,C6,F18,Cal358
    protein: 43, carbs: 6, fat: 18, cal: 358, tag: "non_veg",
    ingredients: ["100g chicken breast — sliced", "2 eggs", "1 tsp oil", "Capsicum, onion, soy sauce", "Garlic, pepper"],
    steps: ["Stir fry chicken on high heat 5 min", "Push aside — scramble eggs in same pan", "Add vegetables — toss together 2 min"],
    isPreset: true,
  },
  {
    id: makeId(), name: "Fish Curry (light)", time: "2:00 PM",
    // Audit: 200g fish (P38,F4) + 100ml light coconut milk (P1.5,C4,F7) + veg (C8) = P40,C12,F11,Cal307 — acceptable
    protein: 40, carbs: 12, fat: 11, cal: 307, tag: "non_veg",
    ingredients: ["200g fish — any white fish", "Coconut milk (light) 100ml", "Onion, tomato, curry leaves", "Turmeric, red chilli, mustard seeds"],
    steps: ["Temper mustard + curry leaves", "Add onion-tomato base — cook down", "Add fish + coconut milk — simmer 8 min"],
    isPreset: true,
  },
  {
    id: makeId(), name: "Whey Protein Shake", time: "4:30 PM",
    // Added: non-veg keto was only 2 meals at ~980 kcal — add shake to match eggetarian preset structure
    protein: 25, carbs: 2, fat: 1, cal: 117, tag: "non_veg",
    ingredients: ["1 scoop whey isolate", "300ml cold water"],
    steps: ["Shake or blend — serve cold"],
    isPreset: true,
  },
]

export type PresetKey = "eggetarian_keto" | "vegetarian_balanced" | "non_veg_keto"

export const PRESETS: Record<PresetKey, { label: string; tag: DietTag; entries: MealPlanEntry[] }> = {
  eggetarian_keto:       { label: "Eggetarian Keto",        tag: "eggetarian", entries: EGGETARIAN_KETO_PRESET },
  vegetarian_balanced:   { label: "Vegetarian Balanced",    tag: "veg",        entries: VEGETARIAN_BALANCED_PRESET },
  non_veg_keto:          { label: "Non-veg Keto",           tag: "non_veg",    entries: NON_VEG_KETO_PRESET },
}

// ── Eating out database ────────────────────────────────────────────────────────
export type EatingOutDish = {
  name: string
  cuisine: string
  protein: number  // midpoint
  carbs: number
  fat: number
  cal: number
  calRange: string  // e.g. "320–400"
  tag: DietTag[]    // which diet types this suits
  ketoFriendly: boolean
  note?: string
}

export const EATING_OUT_DB: EatingOutDish[] = [
  // ── North Indian ──────────────────────────────────────────────────────────
  { name: "Dal Makhani (1 bowl)", cuisine: "North Indian", protein: 12, carbs: 28, fat: 16, cal: 300, calRange: "260–340", tag: ["veg","eggetarian"], ketoFriendly: false },
  { name: "Palak Paneer (1 bowl)", cuisine: "North Indian", protein: 14, carbs: 8, fat: 22, cal: 282, calRange: "250–320", tag: ["veg","eggetarian"], ketoFriendly: true },
  { name: "Paneer Butter Masala (1 bowl)", cuisine: "North Indian", protein: 14, carbs: 14, fat: 28, cal: 360, calRange: "320–420", tag: ["veg","eggetarian"], ketoFriendly: false, note: "High fat from cream — watch portion" },
  { name: "Kadai Paneer (1 bowl)", cuisine: "North Indian", protein: 16, carbs: 10, fat: 20, cal: 288, calRange: "260–320", tag: ["veg","eggetarian"], ketoFriendly: true },
  { name: "Paneer Tikka (150g)", cuisine: "North Indian", protein: 22, carbs: 5, fat: 18, cal: 270, calRange: "240–300", tag: ["veg","eggetarian"], ketoFriendly: true },
  { name: "Butter Chicken (1 bowl)", cuisine: "North Indian", protein: 28, carbs: 10, fat: 22, cal: 350, calRange: "300–400", tag: ["non_veg"], ketoFriendly: false, note: "Tomato + cream base — moderate carbs" },
  { name: "Tandoori Chicken (2 pieces)", cuisine: "North Indian", protein: 40, carbs: 4, fat: 12, cal: 280, calRange: "250–320", tag: ["non_veg"], ketoFriendly: true },
  { name: "Chicken Tikka (150g)", cuisine: "North Indian", protein: 36, carbs: 4, fat: 10, cal: 250, calRange: "220–290", tag: ["non_veg"], ketoFriendly: true },
  { name: "Seekh Kebab (2 pieces)", cuisine: "North Indian", protein: 24, carbs: 5, fat: 14, cal: 238, calRange: "200–270", tag: ["non_veg"], ketoFriendly: true },
  { name: "Egg Curry (2 eggs)", cuisine: "North Indian", protein: 14, carbs: 8, fat: 16, cal: 232, calRange: "200–270", tag: ["eggetarian"], ketoFriendly: true },
  { name: "Plain Roti (1)", cuisine: "North Indian", protein: 3, carbs: 22, fat: 1, cal: 110, calRange: "90–130", tag: ["veg","eggetarian","non_veg"], ketoFriendly: false },
  { name: "Butter Naan (1)", cuisine: "North Indian", protein: 5, carbs: 38, fat: 8, cal: 244, calRange: "200–280", tag: ["veg","eggetarian","non_veg"], ketoFriendly: false, note: "High carb — avoid on keto" },
  { name: "Plain Raita (100g)", cuisine: "North Indian", protein: 4, carbs: 6, fat: 3, cal: 67, calRange: "55–80", tag: ["veg","eggetarian"], ketoFriendly: true },
  // ── Biryani ───────────────────────────────────────────────────────────────
  { name: "Veg Biryani (1 plate)", cuisine: "Biryani", protein: 8, carbs: 60, fat: 12, cal: 377, calRange: "340–420", tag: ["veg","eggetarian"], ketoFriendly: false, note: "High carb — skip or small portion on keto" },
  { name: "Egg Biryani (1 plate)", cuisine: "Biryani", protein: 20, carbs: 58, fat: 14, cal: 434, calRange: "390–480", tag: ["eggetarian"], ketoFriendly: false },
  { name: "Chicken Biryani (1 plate)", cuisine: "Biryani", protein: 28, carbs: 55, fat: 16, cal: 480, calRange: "430–540", tag: ["non_veg"], ketoFriendly: false },
  // ── South Indian ──────────────────────────────────────────────────────────
  { name: "Masala Dosa (1)", cuisine: "South Indian", protein: 6, carbs: 40, fat: 10, cal: 272, calRange: "240–310", tag: ["veg","eggetarian"], ketoFriendly: false },
  { name: "Idli + Sambar (3 + bowl)", cuisine: "South Indian", protein: 12, carbs: 45, fat: 3, cal: 255, calRange: "220–290", tag: ["veg","eggetarian"], ketoFriendly: false },
  { name: "Chettinad Chicken Curry (1 bowl)", cuisine: "South Indian", protein: 30, carbs: 8, fat: 18, cal: 314, calRange: "280–360", tag: ["non_veg"], ketoFriendly: true },
  { name: "Rasam (1 bowl)", cuisine: "South Indian", protein: 2, carbs: 8, fat: 2, cal: 58, calRange: "45–75", tag: ["veg","eggetarian","non_veg"], ketoFriendly: true, note: "Light — good addition" },
  // ── Chinese Indian ────────────────────────────────────────────────────────
  { name: "Veg Fried Rice (1 plate)", cuisine: "Chinese Indian", protein: 5, carbs: 42, fat: 8, cal: 258, calRange: "220–300", tag: ["veg","eggetarian"], ketoFriendly: false },
  { name: "Egg Fried Rice (1 plate)", cuisine: "Chinese Indian", protein: 11, carbs: 42, fat: 10, cal: 302, calRange: "270–340", tag: ["eggetarian"], ketoFriendly: false },
  { name: "Chicken Manchurian (dry, 150g)", cuisine: "Chinese Indian", protein: 24, carbs: 18, fat: 14, cal: 294, calRange: "260–330", tag: ["non_veg"], ketoFriendly: false, note: "Cornflour coating — moderate carbs" },
  { name: "Chilli Paneer (dry, 150g)", cuisine: "Chinese Indian", protein: 18, carbs: 14, fat: 16, cal: 272, calRange: "240–310", tag: ["veg","eggetarian"], ketoFriendly: false },
  // ── Café / Continental ────────────────────────────────────────────────────
  { name: "Omelette (2 egg, plain)", cuisine: "Café", protein: 14, carbs: 1, fat: 14, cal: 186, calRange: "160–210", tag: ["eggetarian"], ketoFriendly: true },
  { name: "Grilled Chicken Sandwich", cuisine: "Café", protein: 28, carbs: 32, fat: 12, cal: 348, calRange: "300–400", tag: ["non_veg"], ketoFriendly: false, note: "Bread is the main carb source" },
  { name: "Caesar Salad (no croutons)", cuisine: "Café", protein: 18, carbs: 6, fat: 22, cal: 290, calRange: "250–330", tag: ["non_veg"], ketoFriendly: true },
  { name: "Paneer Wrap / Kathi Roll", cuisine: "Café", protein: 16, carbs: 38, fat: 14, cal: 342, calRange: "300–390", tag: ["veg","eggetarian"], ketoFriendly: false },
  // ── Fast Food ─────────────────────────────────────────────────────────────
  { name: "McAloo Tikki Burger", cuisine: "Fast Food", protein: 6, carbs: 42, fat: 14, cal: 318, calRange: "290–350", tag: ["veg","eggetarian"], ketoFriendly: false },
  { name: "McChicken Burger", cuisine: "Fast Food", protein: 16, carbs: 38, fat: 16, cal: 360, calRange: "320–400", tag: ["non_veg"], ketoFriendly: false },
  { name: "KFC Chicken (1 piece, grilled)", cuisine: "Fast Food", protein: 28, carbs: 3, fat: 12, cal: 232, calRange: "200–270", tag: ["non_veg"], ketoFriendly: true, note: "Grilled, not fried" },
  { name: "Dominos Veggie Paradise (2 slices)", cuisine: "Fast Food", protein: 10, carbs: 52, fat: 14, cal: 374, calRange: "340–420", tag: ["veg","eggetarian"], ketoFriendly: false },
]

export const EATING_OUT_CUISINES = [...new Set(EATING_OUT_DB.map(d => d.cuisine))]

// ── Smart ordering suggestions ────────────────────────────────────────────────
export type OrderingSuggestion = {
  type: "order" | "avoid"
  text: string
}

export function getOrderingSuggestions(
  remainingMacros: { cal: number; protein: number; carbs: number; fat: number },
  dietTag: DietTag,
  isKeto: boolean,
): OrderingSuggestion[] {
  const suggestions: OrderingSuggestion[] = []
  const { protein, carbs } = remainingMacros

  // Protein focus
  if (protein > 20) {
    if (dietTag === "non_veg") {
      suggestions.push({ type: "order", text: "Tandoori or grilled chicken/fish — highest protein, lowest carbs" })
      suggestions.push({ type: "order", text: "Egg preparations if available — boiled, bhurji, omelette" })
    }
    if (dietTag === "eggetarian") {
      suggestions.push({ type: "order", text: "Egg bhurji, omelette, or egg curry — best protein per calorie" })
      suggestions.push({ type: "order", text: "Paneer dishes — tikka or dry preparations over gravy" })
    }
    if (dietTag === "veg") {
      suggestions.push({ type: "order", text: "Paneer preparations — tikka, bhurji, or dry sabzi" })
      suggestions.push({ type: "order", text: "Dal or lentil soup alongside your main — boosts protein" })
      suggestions.push({ type: "order", text: "Curd/raita as a side — adds protein and probiotics" })
    }
  }

  // Keto / low carb guidance
  if (isKeto) {
    suggestions.push({ type: "avoid", text: "Rice, biryani, roti, naan — skip or single small portion max" })
    suggestions.push({ type: "avoid", text: "Gravies with onion-tomato base — hidden carbs from reduction" })
    suggestions.push({ type: "order", text: "Dry preparations over gravies — less sauce means fewer carbs" })
    suggestions.push({ type: "order", text: "Ask for extra salad instead of bread or rice" })
  } else if (carbs < 30) {
    suggestions.push({ type: "order", text: "1 roti or small rice portion is fine — stick to one" })
    suggestions.push({ type: "avoid", text: "Naan, paratha, biryani — too high in carbs for today's remaining budget" })
  }

  // General smart choices
  suggestions.push({ type: "avoid", text: "Deep fried starters — samosa, pakora, french fries add 200–400 empty calories" })
  suggestions.push({ type: "order", text: "Soup or rasam to start — fills you up before main course arrives" })
  suggestions.push({ type: "order", text: "Ask for less oil / no butter on top — most restaurants use 2x what's needed" })

  return suggestions
}
