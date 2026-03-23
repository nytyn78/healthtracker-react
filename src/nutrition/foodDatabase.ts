// ── foodDatabase.ts ────────────────────────────────────────────────────────────
// Single source of truth for all nutritional values.
// Macros are PER 1 UNIT as defined by unitType:
//   "count"  → per 1 item (e.g. 1 egg)
//   "grams"  → per 1g     (quantity = grams used)
//   "scoop"  → per 1 scoop
//   "tsp"    → per 1 tsp
//
// NEVER store macros at the meal or day level.
// ALWAYS derive upward from ingredients × quantity.

export type FoodId = keyof typeof FOODS

export type Macro = {
  protein:  number
  carbs:    number
  fat:      number
  calories: number
  fiber:    number  // required — never optional
}

export type FoodItem = {
  id:        string
  name:      string
  unitType:  "count" | "grams" | "scoop" | "tsp"
  macros:    Macro        // values per 1 unit
  isTrace?:  boolean      // true = spice/aromatic, excluded from core ingredient count
  tags?:     string[]
  quantization: {
    step:  number         // minimum increment
    min?:  number
    max?:  number
  }
  displayName: {
    hi: string
    en: string
  }
}

export const FOODS = {

  // ── Protein sources ──────────────────────────────────────────────────────────

  EGG: {
    id: "EGG", name: "Whole Egg",
    unitType: "count",
    macros: { protein: 6, carbs: 0.6, fat: 5, calories: 70, fiber: 0 },
    tags: ["eggetarian", "keto"],
    quantization: { step: 1, min: 1, max: 6 },
    displayName: { hi: "पूरा अंडा", en: "Whole Egg" },
  },

  EGG_WHITE: {
    id: "EGG_WHITE", name: "Egg White",
    unitType: "count",
    macros: { protein: 3.6, carbs: 0.2, fat: 0, calories: 17, fiber: 0 },
    tags: ["eggetarian", "keto"],
    quantization: { step: 1, min: 1 },
    displayName: { hi: "अंडे का सफ़ेद भाग", en: "Egg White" },
  },

  // Per 1g — use quantity: 80 for 80g
  PANEER: {
    id: "PANEER", name: "Paneer (full fat)",
    unitType: "grams",
    macros: { protein: 0.18, carbs: 0.02, fat: 0.20, calories: 2.65, fiber: 0 },
    tags: ["veg", "eggetarian", "keto"],
    quantization: { step: 10, min: 30, max: 200 },
    displayName: { hi: "पनीर", en: "Paneer" },
  },

  WHEY: {
    id: "WHEY", name: "Whey Protein Isolate",
    unitType: "scoop",
    macros: { protein: 25, carbs: 2, fat: 1, calories: 120, fiber: 0 },
    tags: ["eggetarian", "keto"],
    quantization: { step: 0.5, min: 0.5, max: 2 },
    displayName: { hi: "व्हे प्रोटीन", en: "Whey Protein" },
  },

  // Per 1g raw — use quantity: 75 for 75g
  MASOOR_DAL: {
    id: "MASOOR_DAL", name: "Masoor Dal (raw)",
    unitType: "grams",
    macros: { protein: 0.24, carbs: 0.60, fat: 0.013, calories: 3.40, fiber: 0.15 },
    tags: ["veg", "eggetarian", "fiber-source"],
    quantization: { step: 5, min: 25, max: 150 },
    displayName: { hi: "मसूर दाल", en: "Masoor Dal" },
  },

  // ── Added fats ───────────────────────────────────────────────────────────────
  // Per 1 tsp

  GHEE: {
    id: "GHEE", name: "Ghee",
    unitType: "tsp",
    macros: { protein: 0, carbs: 0, fat: 5, calories: 45, fiber: 0 },
    tags: ["veg", "eggetarian", "keto"],
    quantization: { step: 0.5, min: 0.5, max: 4 },
    displayName: { hi: "घी", en: "Ghee" },
  },

  // ── Vegetables (isTrace: true — excluded from core ingredient count) ──────────
  // Per 1g raw

  SPINACH: {
    id: "SPINACH", name: "Spinach",
    unitType: "grams",
    isTrace: true,
    macros: { protein: 0.029, carbs: 0.036, fat: 0.004, calories: 0.23, fiber: 0.022 },
    tags: ["veg", "eggetarian", "keto", "fiber-source", "vitamin-c", "magnesium"],
    quantization: { step: 10, min: 30 },
    displayName: { hi: "पालक", en: "Spinach" },
  },

  TOMATO: {
    id: "TOMATO", name: "Tomato",
    unitType: "grams",
    isTrace: true,
    macros: { protein: 0.009, carbs: 0.039, fat: 0.002, calories: 0.18, fiber: 0.012 },
    tags: ["veg", "eggetarian", "keto", "vitamin-c"],
    quantization: { step: 10, min: 20 },
    displayName: { hi: "टमाटर", en: "Tomato" },
  },

  ONION: {
    id: "ONION", name: "Onion",
    unitType: "grams",
    isTrace: true,
    macros: { protein: 0.011, carbs: 0.093, fat: 0.001, calories: 0.40, fiber: 0.017 },
    tags: ["veg", "eggetarian", "keto"],
    quantization: { step: 10, min: 20 },
    displayName: { hi: "प्याज", en: "Onion" },
  },

  CUCUMBER: {
    id: "CUCUMBER", name: "Cucumber",
    unitType: "grams",
    isTrace: true,
    macros: { protein: 0.007, carbs: 0.037, fat: 0.001, calories: 0.15, fiber: 0.005 },
    tags: ["veg", "eggetarian", "keto", "vitamin-c"],
    quantization: { step: 10, min: 30 },
    displayName: { hi: "खीरा", en: "Cucumber" },
  },

  // ── Indian kitchen vegetables (fiber-rich, keto-compatible) ─────────────────
  // All per 1g raw — isTrace: true (excluded from core ingredient count)
  // Values from IFCT (Indian Food Composition Tables)

  METHI: {
    id: "METHI", name: "Methi Leaves (Fenugreek)",
    unitType: "grams",
    isTrace: true,
    macros: { protein: 0.043, carbs: 0.058, fat: 0.006, calories: 0.49, fiber: 0.049 },
    tags: ["veg", "eggetarian", "keto", "fiber-source", "vitamin-c"],
    quantization: { step: 10, min: 20 },
    displayName: { hi: "मेथी पत्तियां", en: "Methi Leaves" },
  },

  KARELA: {
    id: "KARELA", name: "Karela (Bitter Gourd)",
    unitType: "grams",
    isTrace: true,
    macros: { protein: 0.015, carbs: 0.055, fat: 0.002, calories: 0.25, fiber: 0.028 },
    tags: ["veg", "eggetarian", "keto", "fiber-source", "vitamin-c"],
    quantization: { step: 10, min: 30 },
    displayName: { hi: "करेला", en: "Karela" },
  },

  BHINDI: {
    id: "BHINDI", name: "Bhindi (Okra)",
    unitType: "grams",
    isTrace: true,
    macros: { protein: 0.019, carbs: 0.073, fat: 0.002, calories: 0.33, fiber: 0.031 },
    tags: ["veg", "eggetarian", "keto", "fiber-source", "vitamin-c"],
    quantization: { step: 10, min: 30 },
    displayName: { hi: "भिंडी", en: "Bhindi" },
  },

  BAINGAN: {
    id: "BAINGAN", name: "Baingan (Brinjal / Eggplant)",
    unitType: "grams",
    isTrace: true,
    macros: { protein: 0.012, carbs: 0.059, fat: 0.002, calories: 0.25, fiber: 0.030 },
    tags: ["veg", "eggetarian", "keto", "fiber-source"],
    quantization: { step: 10, min: 30 },
    displayName: { hi: "बैंगन", en: "Baingan" },
  },

  CABBAGE: {
    id: "CABBAGE", name: "Cabbage (Patta Gobi)",
    unitType: "grams",
    isTrace: true,
    macros: { protein: 0.013, carbs: 0.058, fat: 0.001, calories: 0.25, fiber: 0.025 },
    tags: ["veg", "eggetarian", "keto", "fiber-source"],
    quantization: { step: 10, min: 30 },
    displayName: { hi: "पत्ता गोभी", en: "Cabbage" },
  },

  CAULIFLOWER: {
    id: "CAULIFLOWER", name: "Cauliflower (Phool Gobi)",
    unitType: "grams",
    isTrace: true,
    macros: { protein: 0.019, carbs: 0.050, fat: 0.003, calories: 0.25, fiber: 0.020 },
    tags: ["veg", "eggetarian", "keto", "fiber-source"],
    quantization: { step: 10, min: 30 },
    displayName: { hi: "फूल गोभी", en: "Cauliflower" },
  },

  // ── Carb source (for non-keto validation testing) ────────────────────────────

  ROTI: {
    id: "ROTI", name: "Whole Wheat Roti",
    unitType: "count",
    macros: { protein: 3, carbs: 15, fat: 1, calories: 80, fiber: 1.5 },
    tags: ["veg", "eggetarian", "fiber-source"],
    quantization: { step: 1, min: 1, max: 4 },
    displayName: { hi: "रोटी", en: "Roti" },
  },

} as const satisfies Record<string, FoodItem>
