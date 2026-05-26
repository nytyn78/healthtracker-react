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
  // Optional micronutrients in milligrams per unit.
  // Populated for IFCT-sourced foods where these matter clinically
  // (maternal iron / calcium, geriatric calcium, pediatric iron).
  // Older entries leave these undefined; consumers should treat undefined
  // as "not tracked" rather than "zero".
  calcium?: number  // mg per unit
  iron?:    number  // mg per unit
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

  // ── Additional protein sources ────────────────────────────────────────────

  // Per 1g raw — use quantity in grams
  CHICKEN_BREAST: {
    id: "CHICKEN_BREAST", name: "Chicken Breast (boneless)",
    unitType: "grams",
    macros: { protein: 0.31, carbs: 0, fat: 0.036, calories: 1.65, fiber: 0 },
    tags: ["non-veg", "keto", "high-protein"],
    quantization: { step: 10, min: 80, max: 300 },
    displayName: { hi: "चिकन ब्रेस्ट", en: "Chicken Breast" },
  },

  // Per 1g raw
  CHICKEN_THIGH: {
    id: "CHICKEN_THIGH", name: "Chicken Thigh (boneless)",
    unitType: "grams",
    macros: { protein: 0.26, carbs: 0, fat: 0.085, calories: 1.77, fiber: 0 },
    tags: ["non-veg", "keto", "high-protein"],
    quantization: { step: 10, min: 80, max: 250 },
    displayName: { hi: "चिकन जांघ", en: "Chicken Thigh" },
  },

  // Per 1g raw
  MUTTON_KEEMA: {
    id: "MUTTON_KEEMA", name: "Mutton Keema (minced)",
    unitType: "grams",
    macros: { protein: 0.20, carbs: 0, fat: 0.18, calories: 2.45, fiber: 0 },
    tags: ["non-veg", "keto", "high-protein"],
    quantization: { step: 10, min: 80, max: 250 },
    displayName: { hi: "मटन कीमा", en: "Mutton Keema" },
  },

  // Per 1g raw
  FISH_ROHU: {
    id: "FISH_ROHU", name: "Rohu Fish (fillet)",
    unitType: "grams",
    macros: { protein: 0.17, carbs: 0, fat: 0.018, calories: 0.97, fiber: 0 },
    tags: ["non-veg", "keto", "high-protein"],
    quantization: { step: 10, min: 100, max: 300 },
    displayName: { hi: "रोहू मछली", en: "Rohu Fish" },
  },

  // Per 1g raw — prawns/shrimp
  PRAWNS: {
    id: "PRAWNS", name: "Prawns / Shrimp",
    unitType: "grams",
    macros: { protein: 0.20, carbs: 0.009, fat: 0.013, calories: 0.99, fiber: 0 },
    tags: ["non-veg", "keto", "high-protein"],
    quantization: { step: 10, min: 80, max: 250 },
    displayName: { hi: "झींगा", en: "Prawns" },
  },

  // Per 1g — full fat Greek-style dahi / hung curd
  HUNG_CURD: {
    id: "HUNG_CURD", name: "Hung Curd (strained yogurt)",
    unitType: "grams",
    macros: { protein: 0.087, carbs: 0.038, fat: 0.052, calories: 0.97, fiber: 0 },
    tags: ["veg", "eggetarian", "keto"],
    quantization: { step: 10, min: 50, max: 200 },
    displayName: { hi: "हंग दही", en: "Hung Curd" },
  },

  // Per 1g raw — full fat paneer alternative lower carb
  TOFU_FIRM: {
    id: "TOFU_FIRM", name: "Firm Tofu",
    unitType: "grams",
    macros: { protein: 0.081, carbs: 0.019, fat: 0.049, calories: 0.76, fiber: 0.003 },
    tags: ["veg", "eggetarian", "keto"],
    quantization: { step: 10, min: 80, max: 250 },
    displayName: { hi: "टोफू", en: "Firm Tofu" },
  },

  // ── Additional fats ───────────────────────────────────────────────────────

  // Per 1 tbsp (15ml)
  COCONUT_OIL: {
    id: "COCONUT_OIL", name: "Coconut Oil",
    unitType: "tsp",
    macros: { protein: 0, carbs: 0, fat: 4.5, calories: 41, fiber: 0 },
    tags: ["veg", "eggetarian", "keto"],
    quantization: { step: 0.5, min: 0.5, max: 4 },
    displayName: { hi: "नारियल तेल", en: "Coconut Oil" },
  },

  // Per 1 tbsp
  BUTTER: {
    id: "BUTTER", name: "Butter (unsalted)",
    unitType: "tsp",
    macros: { protein: 0.01, carbs: 0, fat: 3.8, calories: 34, fiber: 0 },
    tags: ["veg", "eggetarian", "keto"],
    quantization: { step: 0.5, min: 0.5, max: 4 },
    displayName: { hi: "मक्खन", en: "Butter" },
  },

  // Per 1 tbsp (15g)
  CREAM: {
    id: "CREAM", name: "Fresh Cream (full fat)",
    unitType: "tsp",
    macros: { protein: 0.06, carbs: 0.13, fat: 2.0, calories: 18, fiber: 0 },
    tags: ["veg", "eggetarian", "keto"],
    quantization: { step: 1, min: 1, max: 6 },
    displayName: { hi: "ताज़ी क्रीम", en: "Fresh Cream" },
  },

  // ── Additional vegetables ─────────────────────────────────────────────────
  // All isTrace: true, per 1g

  MUSHROOM: {
    id: "MUSHROOM", name: "Mushroom (button)",
    unitType: "grams",
    isTrace: true,
    macros: { protein: 0.031, carbs: 0.032, fat: 0.003, calories: 0.22, fiber: 0.010 },
    tags: ["veg", "eggetarian", "keto", "fiber-source"],
    quantization: { step: 10, min: 50, max: 200 },
    displayName: { hi: "मशरूम", en: "Mushroom" },
  },

  CAPSICUM: {
    id: "CAPSICUM", name: "Capsicum (Bell Pepper)",
    unitType: "grams",
    isTrace: true,
    macros: { protein: 0.009, carbs: 0.060, fat: 0.003, calories: 0.26, fiber: 0.021 },
    tags: ["veg", "eggetarian", "keto", "vitamin-c", "fiber-source"],
    quantization: { step: 10, min: 30, max: 150 },
    displayName: { hi: "शिमला मिर्च", en: "Capsicum" },
  },

  ZUCCHINI: {
    id: "ZUCCHINI", name: "Zucchini / Turai",
    unitType: "grams",
    isTrace: true,
    macros: { protein: 0.012, carbs: 0.032, fat: 0.003, calories: 0.17, fiber: 0.010 },
    tags: ["veg", "eggetarian", "keto", "fiber-source"],
    quantization: { step: 10, min: 50, max: 200 },
    displayName: { hi: "तोरई / ज़ुकिनी", en: "Zucchini / Turai" },
  },

  BROCCOLI: {
    id: "BROCCOLI", name: "Broccoli",
    unitType: "grams",
    isTrace: true,
    macros: { protein: 0.028, carbs: 0.070, fat: 0.004, calories: 0.34, fiber: 0.026 },
    tags: ["veg", "eggetarian", "keto", "fiber-source", "vitamin-c"],
    quantization: { step: 10, min: 50, max: 200 },
    displayName: { hi: "ब्रोकली", en: "Broccoli" },
  },

  // ── Flavour agents ────────────────────────────────────────────────────────

  // Per 1 tbsp (15g)
  COCONUT_MILK_THICK: {
    id: "COCONUT_MILK_THICK", name: "Thick Coconut Milk",
    unitType: "tsp",
    macros: { protein: 0.02, carbs: 0.06, fat: 2.4, calories: 22, fiber: 0 },
    tags: ["veg", "eggetarian", "keto"],
    quantization: { step: 1, min: 1, max: 8 },
    displayName: { hi: "गाढ़ा नारियल दूध", en: "Thick Coconut Milk" },
  },

  // ═════════════════════════════════════════════════════════════════════════
  // ── Cereals, millets, and grain staples ───────────────────────────────────
  // ═════════════════════════════════════════════════════════════════════════
  //
  // All values per 1 gram of RAW (uncooked, as-purchased) ingredient.
  // Cooking conversion is handled by callers — see services/cookingConversion.ts
  // (planned). Typical conversions:
  //   - Rice:        1g dry → ~3g cooked
  //   - Dal/lentils: 1g dry → ~2.5g cooked
  //   - Atta:        25g flour + 15g water = ~40g cooked roti
  //   - Sooji/oats:  1g dry → ~3g cooked
  //
  // Source: Indian Food Composition Tables 2017 (IFCT), National Institute of
  // Nutrition / Indian Council of Medical Research, Hyderabad. T. Longvah,
  // R. Ananthan, K. Bhaskarachary & K. Venkaiah, Eds. Available at
  // https://nin.res.in (free public reference for non-commercial use with
  // acknowledgment). Values cited by IFCT food code (e.g. A019 = wheat
  // flour, atta). "n=" indicates the number of regional composite samples
  // averaged in IFCT — higher n = more regionally representative.
  //
  // Energy is converted from kJ (as printed in IFCT) to kcal using
  // factor 1 kcal = 4.184 kJ.
  //
  // Carbs are "available carbohydrate by difference" (CHOAVLDF) — IFCT's
  // standard reporting metric, ≈ net carbs (total carbs minus fibre).
  //
  // Calcium and iron are in mg per gram (i.e. IFCT mg/100g value ÷ 100).

  // A019 — Whole wheat flour. The atta used for chapati / roti / paratha
  // across North India. High fibre because the bran is retained. n=6.
  ATTA: {
    id: "ATTA", name: "Whole Wheat Flour (Atta)",
    unitType: "grams",
    macros: {
      protein: 0.1057, carbs: 0.6417, fat: 0.0153,
      calories: 3.20, fiber: 0.1136,
      calcium: 0.3094, iron: 0.0410,
    },
    tags: ["veg", "eggetarian", "fiber-source"],
    quantization: { step: 5, min: 20, max: 200 },
    displayName: { hi: "गेहूं का आटा", en: "Atta (Whole Wheat Flour)" },
  },

  // A018 — Refined wheat flour. Maida, used for naan, parathas, biscuits,
  // many sweets. Lower fibre because bran is removed; higher carb fraction. n=6.
  MAIDA: {
    id: "MAIDA", name: "Refined Wheat Flour (Maida)",
    unitType: "grams",
    macros: {
      protein: 0.1036, carbs: 0.7427, fat: 0.0076,
      calories: 3.52, fiber: 0.0276,
      calcium: 0.2040, iron: 0.0177,
    },
    tags: ["veg", "eggetarian"],
    quantization: { step: 5, min: 20, max: 150 },
    displayName: { hi: "मैदा", en: "Maida (Refined Flour)" },
  },

  // A022 — Semolina. Sooji / rava — used for upma, halwa, rava idli, dhokla. n=6.
  SOOJI: {
    id: "SOOJI", name: "Semolina (Sooji / Rava)",
    unitType: "grams",
    macros: {
      protein: 0.1138, carbs: 0.6843, fat: 0.0074,
      calories: 3.34, fiber: 0.0972,
      calcium: 0.2938, iron: 0.0298,
    },
    tags: ["veg", "eggetarian", "fiber-source"],
    quantization: { step: 5, min: 20, max: 150 },
    displayName: { hi: "सूजी", en: "Sooji (Semolina)" },
  },

  // A015 — Polished white rice, raw. The most-consumed staple in India. n=6.
  // Low fibre after milling; calcium and iron both modest.
  RICE_WHITE_RAW: {
    id: "RICE_WHITE_RAW", name: "White Rice, raw (milled)",
    unitType: "grams",
    macros: {
      protein: 0.0794, carbs: 0.7824, fat: 0.0052,
      calories: 3.56, fiber: 0.0281,
      calcium: 0.0749, iron: 0.0065,
    },
    tags: ["veg", "eggetarian"],
    quantization: { step: 5, min: 20, max: 150 },
    displayName: { hi: "सफेद चावल (कच्चा)", en: "White Rice (raw)" },
  },

  // A013 — Brown rice, raw. Bran intact — higher fibre, B vitamins, iron
  // and minerals vs polished white. n=6.
  RICE_BROWN_RAW: {
    id: "RICE_BROWN_RAW", name: "Brown Rice, raw",
    unitType: "grams",
    macros: {
      protein: 0.0916, carbs: 0.7480, fat: 0.0124,
      calories: 3.54, fiber: 0.0443,
      calcium: 0.1093, iron: 0.0102,
    },
    tags: ["veg", "eggetarian", "fiber-source"],
    quantization: { step: 5, min: 20, max: 150 },
    displayName: { hi: "भूरा चावल (कच्चा)", en: "Brown Rice (raw)" },
  },

  // A011 — Rice flakes. Poha — flattened parboiled rice, breakfast staple
  // across Maharashtra and North India. n=6.
  POHA: {
    id: "POHA", name: "Rice Flakes (Poha)",
    unitType: "grams",
    macros: {
      protein: 0.0744, carbs: 0.7675, fat: 0.0114,
      calories: 3.54, fiber: 0.0346,
      calcium: 0.0919, iron: 0.0446,
    },
    tags: ["veg", "eggetarian"],
    quantization: { step: 5, min: 20, max: 100 },
    displayName: { hi: "पोहा", en: "Poha (Rice Flakes)" },
  },

  // A003 — Pearl millet. Bajra — winter staple in Rajasthan, Gujarat,
  // Haryana. High fat for a grain, very high iron. n=6.
  BAJRA: {
    id: "BAJRA", name: "Pearl Millet (Bajra)",
    unitType: "grams",
    macros: {
      protein: 0.1096, carbs: 0.6178, fat: 0.0543,
      calories: 3.48, fiber: 0.1149,
      calcium: 0.2735, iron: 0.0642,
    },
    tags: ["veg", "eggetarian", "fiber-source"],
    quantization: { step: 5, min: 20, max: 150 },
    displayName: { hi: "बाजरा", en: "Bajra (Pearl Millet)" },
  },

  // A005 — Sorghum. Jowar — staple in Maharashtra, Karnataka, AP. Often
  // ground for jowar roti / bhakri. Naturally gluten-free. n=6.
  JOWAR: {
    id: "JOWAR", name: "Sorghum (Jowar)",
    unitType: "grams",
    macros: {
      protein: 0.0997, carbs: 0.6768, fat: 0.0173,
      calories: 3.34, fiber: 0.1022,
      calcium: 0.2760, iron: 0.0395,
    },
    tags: ["veg", "eggetarian", "fiber-source"],
    quantization: { step: 5, min: 20, max: 150 },
    displayName: { hi: "ज्वार", en: "Jowar (Sorghum)" },
  },

  // A010 — Finger millet. Ragi — calcium-rich (364 mg/100g — the highest
  // among Indian cereals); important for paediatric and geriatric diets.
  // Karnataka, Tamil Nadu, Andhra staple. n=5.
  RAGI: {
    id: "RAGI", name: "Finger Millet (Ragi)",
    unitType: "grams",
    macros: {
      protein: 0.0716, carbs: 0.6682, fat: 0.0192,
      calories: 3.21, fiber: 0.1118,
      calcium: 3.640, iron: 0.0462,
    },
    tags: ["veg", "eggetarian", "fiber-source"],
    quantization: { step: 5, min: 20, max: 150 },
    displayName: { hi: "रागी", en: "Ragi (Finger Millet)" },
  },

  // A004 — Pearled barley. Very high total fibre (15.6 g/100g) — among the
  // most fibre-dense cereals in IFCT. Useful in DASH-style and lower-GI
  // meal plans. n=6.
  BARLEY: {
    id: "BARLEY", name: "Barley (Jau)",
    unitType: "grams",
    macros: {
      protein: 0.1094, carbs: 0.6129, fat: 0.0130,
      calories: 3.16, fiber: 0.1564,
      calcium: 0.2864, iron: 0.0156,
    },
    tags: ["veg", "eggetarian", "fiber-source"],
    quantization: { step: 5, min: 20, max: 150 },
    displayName: { hi: "जौ", en: "Barley (Jau)" },
  },

} as const satisfies Record<string, FoodItem>
