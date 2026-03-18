// ── Meal Plan Preset Templates ────────────────────────────────────────────────
// Importable starting points — user customises after import
// Nothing is hardcoded into components — these are just data

import type { MealPlanEntry, DietTag } from "../store/useHealthStore"

function makeId() { return `preset-${Math.random().toString(36).slice(2)}` }

// ── Eggetarian Keto preset (your plan, generalised) ───────────────────────────
export const EGGETARIAN_KETO_PRESET: MealPlanEntry[] = [
  {
    id: makeId(), name: "Egg Bhurji with Paneer", time: "2:00 PM",
    protein: 42, carbs: 4, fat: 35, cal: 495, tag: "eggetarian",
    ingredients: ["3 whole eggs", "80g paneer — crumbled", "1 tsp ghee", "Salt, cumin, green chilli"],
    steps: ["Heat ghee — add cumin and green chilli", "Crack eggs — stir slowly on low heat", "Fold in crumbled paneer — 1 min", "Season and serve"],
    isPreset: true,
  },
  {
    id: makeId(), name: "Paneer Tikka with Boiled Eggs", time: "6:30 PM",
    protein: 38, carbs: 5, fat: 28, cal: 418, tag: "eggetarian",
    ingredients: ["100g paneer — cubed", "2 whole eggs — boiled", "2 tbsp curd", "1 tsp tandoori masala", "1 tsp ghee"],
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
    protein: 18, carbs: 32, fat: 6, cal: 258, tag: "veg",
    ingredients: ["100g moong dal — soaked overnight", "1 tsp oil", "Green chilli, coriander", "100g low-fat curd"],
    steps: ["Grind dal to batter — add chilli + coriander", "Pour thin on hot tawa — cook 2 min each side", "Serve with curd"],
    isPreset: true,
  },
  {
    id: makeId(), name: "Palak Paneer with Roti", time: "3:30 PM",
    protein: 22, carbs: 28, fat: 16, cal: 340, tag: "veg",
    ingredients: ["150g paneer — cubed", "200g spinach — blanched", "1 tsp oil", "Spices", "1 whole wheat roti"],
    steps: ["Blend blanched spinach to puree", "Sauté spices and onion — add puree", "Add paneer — simmer 5 min", "Serve with roti"],
    isPreset: true,
  },
  {
    id: makeId(), name: "Rajma Bowl with Brown Rice", time: "7:00 PM",
    protein: 16, carbs: 52, fat: 5, cal: 317, tag: "veg",
    ingredients: ["100g cooked rajma", "50g brown rice — cooked", "Onion, tomato, spices", "Lemon juice"],
    steps: ["Cook rajma masala", "Serve over brown rice with lemon"],
    isPreset: true,
  },
]

// ── Non-veg Keto preset ────────────────────────────────────────────────────────
export const NON_VEG_KETO_PRESET: MealPlanEntry[] = [
  {
    id: makeId(), name: "Tandoori Chicken with Salad", time: "2:00 PM",
    protein: 42, carbs: 4, fat: 12, cal: 292, tag: "non_veg",
    ingredients: ["200g chicken — skin removed", "2 tbsp curd", "1 tsp tandoori masala", "Cucumber + onion salad"],
    steps: ["Marinate chicken 30 min", "Grill or air-fry 20 min", "Serve with salad"],
    isPreset: true,
  },
  {
    id: makeId(), name: "Egg & Chicken Stir Fry", time: "6:30 PM",
    protein: 48, carbs: 6, fat: 18, cal: 378, tag: "non_veg",
    ingredients: ["150g chicken breast — sliced", "2 eggs", "1 tsp oil", "Capsicum, onion, soy sauce", "Garlic, pepper"],
    steps: ["Stir fry chicken on high heat 5 min", "Push aside — scramble eggs in same pan", "Add vegetables — toss together 2 min"],
    isPreset: true,
  },
  {
    id: makeId(), name: "Fish Curry (light)", time: "2:00 PM",
    protein: 38, carbs: 8, fat: 14, cal: 310, tag: "non_veg",
    ingredients: ["200g fish — any white fish", "Coconut milk (light) 100ml", "Onion, tomato, curry leaves", "Turmeric, red chilli, mustard seeds"],
    steps: ["Temper mustard + curry leaves", "Add onion-tomato base — cook down", "Add fish + coconut milk — simmer 8 min"],
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
