// ── Meal Plan Preset Templates ────────────────────────────────────────────────
// Importable starting points — user customises after import
// Nothing is hardcoded into components — these are just data

import type { MealPlanEntry, DietTag } from "../store/useHealthStore"

function makeId() { return `preset-${Math.random().toString(36).slice(2)}` }

// ── Vegetarian preset — regular Indian 3-meal day ─────────────────────────────
// Realistic household meals · ~1500 kcal · breakfast + lunch + dinner
export const VEGETARIAN_REGULAR_PRESET: MealPlanEntry[] = [
  {
    id: makeId(), name: "Poha with Curd", time: "8:00 AM",
    protein: 10, carbs: 70, fat: 12, cal: 428, tag: "veg",
    ingredients: [
      "80g poha — flattened rice (dry weight)",
      "1 tsp oil",
      "1 small onion, 1 green chilli, curry leaves",
      "Mustard seeds, turmeric, peanuts (15g)",
      "100g curd — on the side",
      "1 cup tea",
    ],
    steps: [
      "Rinse poha and drain — keep aside",
      "Heat oil, splutter mustard seeds, add peanuts, curry leaves",
      "Add onion + chilli, sauté until soft",
      "Add turmeric and poha, mix gently, cover 2 min",
      "Serve hot with curd and tea",
    ],
    isPreset: true,
  },
  {
    id: makeId(), name: "Dal + 2 Roti + Sabzi + Curd", time: "1:00 PM",
    protein: 25, carbs: 83, fat: 17, cal: 585, tag: "veg",
    ingredients: [
      "1 katori dal (150g cooked) — moong, toor or mix",
      "2 whole wheat rotis",
      "1 katori sabzi (200g) — aloo gobi or seasonal veg",
      "1 tsp oil for cooking",
      "100g curd",
      "Salad — onion, cucumber, lemon",
    ],
    steps: [
      "Pressure cook dal with turmeric and salt",
      "Make sabzi with 1 tsp oil and spices",
      "Roll and cook rotis on tawa",
      "Serve dal + sabzi + roti with curd on the side",
    ],
    isPreset: true,
  },
  {
    id: makeId(), name: "Paneer Bhurji + 2 Roti + Salad", time: "8:00 PM",
    protein: 26, carbs: 40, fat: 27, cal: 507, tag: "veg",
    ingredients: [
      "100g paneer — crumbled",
      "1 small onion, 1 tomato, 1 green chilli",
      "1 tsp oil",
      "2 whole wheat rotis",
      "Salad — cucumber, carrot, lemon",
      "Salt, turmeric, garam masala, coriander",
    ],
    steps: [
      "Heat oil, sauté onion + chilli until golden",
      "Add tomato, cook until soft, add spices",
      "Fold in crumbled paneer, cook 2 min",
      "Garnish with coriander, serve with hot rotis and salad",
    ],
    isPreset: true,
  },
]

// ── High-Protein Vegetarian preset — for users with 90g+ protein targets ──────
// ~1530 kcal · ~97g protein from food alone (no whey needed)
// Uses soya chunks + larger paneer portions + dual dairy sources
// Honest trade-off: more cooking effort, less variety than regular veg
export const VEGETARIAN_HIGH_PROTEIN_PRESET: MealPlanEntry[] = [
  {
    id: makeId(), name: "Paneer Bhurji + 2 Toast", time: "8:00 AM",
    protein: 22, carbs: 28, fat: 27, cal: 443, tag: "veg",
    ingredients: [
      "100g paneer — crumbled",
      "1 small onion, 1 tomato, 1 green chilli",
      "1 tsp oil",
      "2 slices whole wheat toast",
      "Salt, turmeric, garam masala, coriander",
      "1 cup tea",
    ],
    steps: [
      "Heat oil, sauté onion + chilli until golden",
      "Add tomato, cook until soft, add spices",
      "Fold in crumbled paneer, cook 2 min",
      "Serve with toast and tea",
    ],
    isPreset: true,
  },
  {
    id: makeId(), name: "Soya Chunks Curry + Dal + 2 Roti + Curd", time: "1:00 PM",
    protein: 43, carbs: 71, fat: 12, cal: 564, tag: "veg",
    ingredients: [
      "50g soya chunks (dry weight) — soaked in hot water for 15 min",
      "1 katori dal (100g cooked) — moong or toor",
      "2 whole wheat rotis",
      "1 onion, 1 tomato, ginger-garlic paste",
      "1 tsp oil",
      "100g curd on the side",
      "Turmeric, red chilli, garam masala",
    ],
    steps: [
      "Soak soya in hot water 15 min, squeeze out water",
      "Heat oil, sauté onion until golden, add tomato + spices",
      "Add soya chunks, cook 5 min, add water and simmer 10 min",
      "Serve with hot dal, rotis and curd",
    ],
    isPreset: true,
  },
  {
    id: makeId(), name: "Paneer Tikka + 1 Roti + Salad", time: "8:00 PM",
    protein: 32, carbs: 26, fat: 32, cal: 520, tag: "veg",
    ingredients: [
      "150g paneer — cubed",
      "3 tbsp hung curd for marinade",
      "1 tsp oil",
      "1 whole wheat roti",
      "Capsicum, onion chunks",
      "Salad — cucumber, tomato, lemon",
      "Tandoori masala, ginger-garlic paste",
    ],
    steps: [
      "Marinate paneer + capsicum + onion in curd, tandoori masala, ginger-garlic for 30 min",
      "Heat 1 tsp oil on tawa, cook marinated paneer 2-3 min each side",
      "Serve with hot roti and salad",
    ],
    isPreset: true,
  },
]

// ── Eggetarian preset — regular Indian 3-meal day ─────────────────────────────
// ~1490 kcal · adds eggs to a balanced Indian vegetarian base
export const EGGETARIAN_REGULAR_PRESET: MealPlanEntry[] = [
  {
    id: makeId(), name: "Masala Omelette + 2 Toast", time: "8:00 AM",
    protein: 22, carbs: 28, fat: 22, cal: 398, tag: "eggetarian",
    ingredients: [
      "3 whole eggs",
      "1 tsp butter or oil",
      "1 small onion, 1 green chilli, coriander — chopped",
      "Salt, pepper, pinch of turmeric",
      "2 slices whole wheat toast",
      "1 cup tea",
    ],
    steps: [
      "Whisk eggs with chopped onion, chilli, coriander, salt, pepper",
      "Heat butter in pan, pour egg mixture, cook 2 min each side",
      "Toast the bread separately",
      "Serve omelette with toast and tea",
    ],
    isPreset: true,
  },
  {
    id: makeId(), name: "Egg Curry + Dal + 2 Roti", time: "1:00 PM",
    protein: 32, carbs: 67, fat: 21, cal: 585, tag: "eggetarian",
    ingredients: [
      "2 boiled eggs",
      "1 katori dal (150g cooked)",
      "2 whole wheat rotis",
      "1 small onion + 1 tomato for egg curry",
      "1 tsp oil",
      "100g curd",
      "Garam masala, turmeric, red chilli, coriander",
    ],
    steps: [
      "Boil eggs, peel, halve",
      "Heat oil, sauté onion until golden, add tomato + spices",
      "Add 1 cup water, simmer 5 min, add halved eggs",
      "Serve with hot dal, rotis and curd",
    ],
    isPreset: true,
  },
  {
    id: makeId(), name: "Paneer Bhurji + 2 Roti + Salad", time: "8:00 PM",
    protein: 26, carbs: 40, fat: 27, cal: 507, tag: "eggetarian",
    ingredients: [
      "100g paneer — crumbled",
      "1 small onion, 1 tomato, 1 green chilli",
      "1 tsp oil",
      "2 whole wheat rotis",
      "Salad — cucumber, carrot, lemon",
      "Salt, turmeric, garam masala, coriander",
    ],
    steps: [
      "Heat oil, sauté onion + chilli until golden",
      "Add tomato, cook until soft, add spices",
      "Fold in crumbled paneer, cook 2 min",
      "Garnish with coriander, serve with hot rotis and salad",
    ],
    isPreset: true,
  },
]

// ── Non-veg preset — regular Indian 3-meal day ────────────────────────────────
// ~1335 kcal · high protein with normal meal structure
export const NON_VEG_REGULAR_PRESET: MealPlanEntry[] = [
  {
    id: makeId(), name: "Scrambled Eggs + 1 Toast", time: "8:00 AM",
    protein: 20, carbs: 14, fat: 20, cal: 316, tag: "non_veg",
    ingredients: [
      "3 whole eggs",
      "1 tsp butter",
      "1 slice whole wheat toast",
      "Salt, pepper",
      "1 cup tea or black coffee",
    ],
    steps: [
      "Whisk eggs with salt and pepper",
      "Melt butter in pan, pour eggs, stir gently on low heat",
      "Cook until just set, soft and fluffy",
      "Serve with toast and tea",
    ],
    isPreset: true,
  },
  {
    id: makeId(), name: "Chicken Curry + Dal + 2 Roti", time: "1:00 PM",
    protein: 63, carbs: 60, fat: 12, cal: 600, tag: "non_veg",
    ingredients: [
      "150g chicken breast — cubed",
      "1 katori dal (150g cooked)",
      "2 whole wheat rotis",
      "1 onion, 1 tomato, ginger-garlic paste",
      "1 tsp oil",
      "Turmeric, red chilli, garam masala, coriander",
    ],
    steps: [
      "Marinate chicken with salt, turmeric, ginger-garlic paste for 15 min",
      "Heat oil, sauté onion until golden, add tomato + spices",
      "Add chicken, cook 5 min, add water, simmer 15 min covered",
      "Serve with dal and rotis",
    ],
    isPreset: true,
  },
  {
    id: makeId(), name: "Fish Curry + 1 Roti + Sabzi", time: "8:00 PM",
    protein: 44, carbs: 27, fat: 15, cal: 419, tag: "non_veg",
    ingredients: [
      "200g fish — any white fish (rohu, tilapia, basa)",
      "1 whole wheat roti",
      "1 katori sabzi (150g) — bhindi, beans or seasonal",
      "1 small onion, 1 tomato, curry leaves",
      "1 tsp oil",
      "Turmeric, red chilli, mustard seeds, coriander",
    ],
    steps: [
      "Marinate fish with turmeric and salt — 10 min",
      "Heat oil, splutter mustard seeds, add curry leaves",
      "Add onion + tomato, cook until soft, add spices",
      "Add fish and 1/2 cup water, simmer 8 min",
      "Serve with roti and sabzi",
    ],
    isPreset: true,
  },
]

export type PresetKey = "vegetarian_regular" | "vegetarian_high_protein" | "eggetarian_regular" | "non_veg_regular"

export const PRESETS: Record<PresetKey, { label: string; tag: DietTag; entries: MealPlanEntry[]; note?: string }> = {
  vegetarian_regular:       { label: "Vegetarian — Regular Indian",      tag: "veg",        entries: VEGETARIAN_REGULAR_PRESET, note: "~1520 kcal · ~61g protein (typical Indian veg eating)" },
  vegetarian_high_protein:  { label: "Vegetarian — High Protein",        tag: "veg",        entries: VEGETARIAN_HIGH_PROTEIN_PRESET, note: "~1530 kcal · ~97g protein (uses soya + extra paneer)" },
  eggetarian_regular:       { label: "Eggetarian — Regular Indian",      tag: "eggetarian", entries: EGGETARIAN_REGULAR_PRESET, note: "~1490 kcal · ~80g protein" },
  non_veg_regular:          { label: "Non-veg — Regular Indian",         tag: "non_veg",    entries: NON_VEG_REGULAR_PRESET, note: "~1335 kcal · ~127g protein" },
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
