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

  // IFCT L003 — Paneer (n=6). Indian full-fat paneer is meaningfully fattier
  // than US "Indian cheese" generics (24.8% fat vs ~20%). Pre-8d values
  // undercounted kcal by ~15% per gram. Existing recipes that use PANEER will
  // see meal totals rise by ~30-50 kcal at typical 80-100g portions; this is
  // an accuracy correction, not a recipe change. Calcium is the headline
  // micronutrient at 476 mg/100g (n=6).
  PANEER: {
    id: "PANEER", name: "Paneer (full fat)",
    unitType: "grams",
    macros: {
      protein: 0.1886, carbs: 0.0241, fat: 0.2478,
      calories: 3.054, fiber: 0,
      calcium: 4.76, iron: 0.0090,
    },
    tags: ["veg", "eggetarian", "keto", "calcium"],
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

  // MASOOR_DAL was previously defined here with hand-estimated values. The
  // IFCT-sourced version (B013 — Lentil dal) now lives in the Grain Legumes
  // section below, alongside the other 8b legumes. The FoodId is unchanged
  // so existing meal-plan references continue to resolve.

  // ── Added fats ───────────────────────────────────────────────────────────────

  // Ghee is essentially pure milk fat (≥99.5% fat, trace milk solids). IFCT
  // 2017 does not tabulate ghee; the standard composition reference is USDA
  // FoodData Central 171411 (Butter oil, anhydrous) which is the closest
  // equivalent. Per 5g (1 tsp): 5g fat × 9 kcal = 45 kcal. Trace protein/
  // carb from residual milk solids are below the granularity meaningful at
  // 1 tsp portions. Values unchanged from pre-8d; citation added.
  GHEE: {
    id: "GHEE", name: "Ghee",
    unitType: "tsp",
    macros: { protein: 0, carbs: 0, fat: 5, calories: 45, fiber: 0 },
    tags: ["veg", "eggetarian", "keto"],
    quantization: { step: 0.5, min: 0.5, max: 4 },
    displayName: { hi: "घी", en: "Ghee" },
  },

  // ── IFCT 2017 — Vegetables (commit 8c) ───────────────────────────────────────
  // Indian Food Composition Tables 2017 (IFCT 2017), National Institute of
  // Nutrition (ICMR), Hyderabad. Same provenance as the 8a/8b cereal+legume
  // entries — see file-header for full citation rules and energy methodology.
  //
  // All entries below are per 1g raw, edible portion. Each entry includes:
  //   - IFCT food code (C-series = Green Leafy Vegetables, D-series = Other
  //     Vegetables, F-series = Roots and Tubers)
  //   - Sample size (n=) — composite from up to six geographical regions
  //   - Carbs are CHOAVLDF (available carbohydrate by difference)
  //   - Energy is IFCT-printed kJ ÷ 4.184 (NOT Atwater on stored macros — see
  //     8a/8b precedent. IFCT uses general factors accounting for fibre and
  //     sugar, so the printed energy is authoritative.)
  //   - Calcium and iron are mg per gram (IFCT Table 5 mg/100g ÷ 100).
  //
  // Note on retrofitting (commit 8c):
  // The pre-8c entries below (SPINACH, METHI, KARELA, BHINDI, BAINGAN, CABBAGE,
  // CAULIFLOWER) were described as "from IFCT" in a header comment but lacked
  // per-entry citations, sample sizes, and Ca/Fe — and their carb values were
  // systematically overstated by ~40-60% vs IFCT 2017 (likely from an older,
  // pre-IFCT source). Bringing them in line with IFCT 2017 means every keto
  // meal generated by the current generator will shift by ~5-15 kcal/day net,
  // which is well within meal-plan noise and overwhelmingly an *improvement*
  // in accuracy. None of the macro engine tests assert against vegetable
  // macros (verified), so 127/127 stays green. The hardcoded macro comments
  // in composedTypes.ts KETO_TEST_DAY will be slightly stale post-retrofit;
  // not load-bearing (no test imports those numbers), regenerate in a future
  // doc-comment pass if needed.
  //
  // Coverage decisions:
  //   - BAINGAN uses D031 ("Brinjal - all varieties", n=6) rather than any one
  //     of the 21 cultivar-specific entries (D010-D030).
  //   - KARELA uses D004 ("Bitter gourd, jagged, teeth ridges, elongate", n=6)
  //     as the most common North Indian variety; IFCT has no composite for
  //     bitter gourd.
  //   - CAULIFLOWER uses D036 (white cauliflower head). Cauliflower LEAVES
  //     (C017) are nutritionally different and not added here.
  //   - ALOO uses F006 ("Potato, brown skin, big", n=6). IFCT samples potatoes
  //     with skin; peeling removes ~2% mass (skin), reducing fibre by ~0.3g
  //     per 100g and leaving kcal/carbs essentially unchanged. Acceptable
  //     approximation for cooking-grade tracking.
  //   - KATHAL uses D051 ("Jack fruit, raw") — the unripe tender variety used
  //     in kathal ki sabzi. D052 (mature seeds) and ripe jackfruit are
  //     different foods entirely.
  //   - FRENCH_BEANS uses D049 ("French beans, country", n=5) as the more
  //     regionally representative entry vs D050 hybrid (n=2).
  //   - MUTTER uses D061 ("Peas, fresh", n=6) — fresh green peas, not dried
  //     matar dal.

  SPINACH: {
    // IFCT C033 — Spinach (Spinacia oleracea), n=6.
    id: "SPINACH", name: "Spinach (Palak)",
    unitType: "grams",
    isTrace: true,
    macros: {
      protein: 0.0214, carbs: 0.0205, fat: 0.0064,
      calories: 0.244, fiber: 0.0238,
      calcium: 0.8229, iron: 0.0295,
    },
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

  // ── Indian kitchen vegetables (IFCT 2017, commit 8c retrofit) ───────────────
  // Pre-8c values were systematically high on carbs (see retrofit note above).
  // TOMATO, ONION, CUCUMBER above are kept as-is for now — they have keto-
  // compatible existing values and are not on the 8c retrofit list, but a
  // future commit should bring them in line with IFCT D074/D075 (tomato),
  // F-series (onion is a bulb but IFCT places it in alliums elsewhere), and
  // D043/D044 (cucumber). Flagging here so it's not forgotten.

  METHI: {
    // IFCT C020 — Fenugreek leaves (Trigonella foenum graecum), n=5.
    // Very high calcium (274 mg/100g) — useful for vegetarian Ca intake.
    id: "METHI", name: "Methi Leaves (Fenugreek)",
    unitType: "grams",
    isTrace: true,
    macros: {
      protein: 0.0368, carbs: 0.0217, fat: 0.0083,
      calories: 0.344, fiber: 0.0490,
      calcium: 2.74, iron: 0.0569,
    },
    tags: ["veg", "eggetarian", "keto", "fiber-source", "vitamin-c", "calcium"],
    quantization: { step: 10, min: 20 },
    displayName: { hi: "मेथी पत्तियां", en: "Methi Leaves" },
  },

  KARELA: {
    // IFCT D004 — Bitter gourd, jagged, teeth ridges, elongate
    // (Momordica charantia), n=6. The most common North Indian variety.
    id: "KARELA", name: "Karela (Bitter Gourd)",
    unitType: "grams",
    isTrace: true,
    macros: {
      protein: 0.0144, carbs: 0.0282, fat: 0.0024,
      calories: 0.208, fiber: 0.0378,
      calcium: 0.2136, iron: 0.0115,
    },
    tags: ["veg", "eggetarian", "keto", "fiber-source", "vitamin-c"],
    quantization: { step: 10, min: 30 },
    displayName: { hi: "करेला", en: "Karela" },
  },

  BHINDI: {
    // IFCT D056 — Ladies finger (Abelmoschus esculentus), n=6.
    // Notable Ca content (86 mg/100g) for a non-leafy vegetable.
    id: "BHINDI", name: "Bhindi (Okra)",
    unitType: "grams",
    isTrace: true,
    macros: {
      protein: 0.0208, carbs: 0.0362, fat: 0.0022,
      calories: 0.275, fiber: 0.0408,
      calcium: 0.8612, iron: 0.0084,
    },
    tags: ["veg", "eggetarian", "keto", "fiber-source", "vitamin-c", "calcium"],
    quantization: { step: 10, min: 30 },
    displayName: { hi: "भिंडी", en: "Bhindi" },
  },

  BAINGAN: {
    // IFCT D031 — Brinjal, all varieties (Solanum melongena), n=6.
    // Composite of 21 cultivars; use this rather than any one cultivar entry.
    id: "BAINGAN", name: "Baingan (Brinjal / Eggplant)",
    unitType: "grams",
    isTrace: true,
    macros: {
      protein: 0.0148, carbs: 0.0352, fat: 0.0032,
      calories: 0.253, fiber: 0.0398,
      calcium: 0.1659, iron: 0.0037,
    },
    tags: ["veg", "eggetarian", "keto", "fiber-source"],
    quantization: { step: 10, min: 30 },
    displayName: { hi: "बैंगन", en: "Baingan" },
  },

  CABBAGE: {
    // IFCT C015 — Cabbage, green (Brassica oleracea var. capitata f. alba), n=6.
    id: "CABBAGE", name: "Cabbage (Patta Gobi)",
    unitType: "grams",
    isTrace: true,
    macros: {
      protein: 0.0136, carbs: 0.0325, fat: 0.0012,
      calories: 0.215, fiber: 0.0276,
      calcium: 0.5176, iron: 0.0035,
    },
    tags: ["veg", "eggetarian", "keto", "fiber-source"],
    quantization: { step: 10, min: 30 },
    displayName: { hi: "पत्ता गोभी", en: "Cabbage" },
  },

  CAULIFLOWER: {
    // IFCT D036 — Cauliflower (Brassica oleracea var. botrytis), n=6.
    // White cauliflower head only; cauliflower leaves (C017) are a different
    // food and not added here.
    id: "CAULIFLOWER", name: "Cauliflower (Phool Gobi)",
    unitType: "grams",
    isTrace: true,
    macros: {
      protein: 0.0215, carbs: 0.0203, fat: 0.0044,
      calories: 0.230, fiber: 0.0371,
      calcium: 0.2516, iron: 0.0096,
    },
    tags: ["veg", "eggetarian", "keto", "fiber-source", "vitamin-c"],
    quantization: { step: 10, min: 30 },
    displayName: { hi: "फूल गोभी", en: "Cauliflower" },
  },

  FRENCH_BEANS: {
    // IFCT D049 — French beans, country (Phaseolus vulgaris), n=5.
    // The "country" variety is more regionally representative than D050
    // hybrid (n=2). Keto-compatible at typical portion sizes.
    id: "FRENCH_BEANS", name: "French Beans (Fansi)",
    unitType: "grams",
    isTrace: true,
    macros: {
      protein: 0.0249, carbs: 0.0268, fat: 0.0026,
      calories: 0.244, fiber: 0.0438,
      calcium: 0.5599, iron: 0.0125,
    },
    tags: ["veg", "eggetarian", "keto", "fiber-source"],
    quantization: { step: 10, min: 30 },
    displayName: { hi: "फ्रेंच बीन्स", en: "French Beans" },
  },

  KATHAL: {
    // IFCT D051 — Jack fruit, raw (Artocarpus heterophyllus), n=5.
    // Raw/tender jackfruit as used in kathal ki sabzi — distinct from D052
    // mature seeds and from ripe jackfruit (a fruit, not a vegetable).
    // Very high fibre (7.7 g/100g) — almost all insoluble. Keto-compatible
    // at typical sabzi portions (carbs ~3.5 g/100g).
    id: "KATHAL", name: "Kathal (Raw Jackfruit)",
    unitType: "grams",
    isTrace: true,
    macros: {
      protein: 0.0198, carbs: 0.0348, fat: 0.0035,
      calories: 0.263, fiber: 0.0769,
      calcium: 0.4574, iron: 0.0031,
    },
    tags: ["veg", "eggetarian", "keto", "fiber-source"],
    quantization: { step: 10, min: 50 },
    displayName: { hi: "कटहल", en: "Kathal" },
  },

  // ── Carb-meaningful vegetables (not isTrace, not keto-tagged) ─────────────
  // MUTTER and ALOO carry enough carbs at typical portions that they should
  // count as core ingredients, not trace aromatics. Both are excluded from
  // the keto tag — at 12 g/100g (peas) and 15 g/100g (potato) they break a
  // keto carb budget in typical sabzi portions.

  MUTTER: {
    // IFCT D061 — Peas, fresh (Pisum sativum), n=6. Fresh green peas (not
    // dried matar dal). Higher carbs than typical sabzi vegetables (12g/100g)
    // and meaningful protein (7g/100g).
    id: "MUTTER", name: "Green Peas (Fresh)",
    unitType: "grams",
    macros: {
      protein: 0.0725, carbs: 0.1188, fat: 0.0013,
      calories: 0.813, fiber: 0.0632,
      calcium: 0.2824, iron: 0.0158,
    },
    tags: ["veg", "eggetarian", "fiber-source"],
    quantization: { step: 10, min: 30 },
    displayName: { hi: "हरी मटर", en: "Green Peas" },
  },

  ALOO: {
    // IFCT F006 — Potato, brown skin, big (Solanum tuberosum), n=6. IFCT
    // samples are with-skin; peeled potato differs by < 5% on all macros
    // (peeling removes ~2% by mass, mostly skin fibre). Acceptable
    // approximation for cooking-grade tracking; precision-critical use
    // cases should reduce fibre by ~0.3 g per 100g cooked.
    id: "ALOO", name: "Potato (Aloo)",
    unitType: "grams",
    macros: {
      protein: 0.0154, carbs: 0.1489, fat: 0.0023,
      calories: 0.698, fiber: 0.0171,
      calcium: 0.0952, iron: 0.0057,
    },
    tags: ["veg", "eggetarian", "fiber-source"],
    quantization: { step: 10, min: 50 },
    displayName: { hi: "आलू", en: "Potato" },
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

  // ── IFCT 2017 — Milk and milk products (commit 8d) ─────────────────────────
  // All milk entries are per 1g (per-100g IFCT values ÷ 100).
  //
  // Cow vs Buffalo: Indian milk consumption is split between the two. Buffalo
  // milk is materially fattier (6.6g vs 4.5g fat per 100g) and is the
  // dominant urban tetrapack product (Amul Gold, Mother Dairy Full Cream).
  // Cow milk is more common in fresh / vendor / certain regional dairy.
  // Both entries kept so the user can pick what they actually buy.
  // IFCT samples are whole milk only; toned/skim variants not separately
  // tabulated. For toned/skim, scale fat down (toned ≈ 3% fat, skim < 0.5%)
  // and recalculate kcal — this is acceptable approximation for cooking-grade
  // tracking but not yet a separate entry.

  COW_MILK: {
    // IFCT L002 — Milk, whole, Cow (n=6). 305 kJ/100g.
    // Calcium 118 mg/100g, iron 0.15 mg/100g.
    id: "COW_MILK", name: "Whole Cow Milk",
    unitType: "grams",
    macros: {
      protein: 0.0326, carbs: 0.0494, fat: 0.0448,
      calories: 0.729, fiber: 0,
      calcium: 1.18, iron: 0.0015,
    },
    tags: ["veg", "eggetarian", "calcium"],
    quantization: { step: 10, min: 50, max: 500 },
    displayName: { hi: "गाय का दूध (फुल क्रीम)", en: "Whole Cow Milk" },
  },

  BUFFALO_MILK: {
    // IFCT L001 — Milk, whole, Buffalo (n=6). 449 kJ/100g.
    // Calcium 121 mg/100g, iron 0.16 mg/100g. Higher fat than cow milk
    // (6.58g vs 4.48g per 100g) — this is the dominant urban full-cream
    // tetrapack milk in India (Amul Gold, Mother Dairy Full Cream).
    id: "BUFFALO_MILK", name: "Whole Buffalo Milk",
    unitType: "grams",
    macros: {
      protein: 0.0368, carbs: 0.0839, fat: 0.0658,
      calories: 1.073, fiber: 0,
      calcium: 1.21, iron: 0.0016,
    },
    tags: ["veg", "eggetarian", "calcium"],
    quantization: { step: 10, min: 50, max: 500 },
    displayName: { hi: "भैंस का दूध (फुल क्रीम)", en: "Whole Buffalo Milk" },
  },

  // ── Yogurt / curd ────────────────────────────────────────────────────────
  // IFCT 2017 does NOT tabulate yogurt or curd, despite both being dietary
  // staples. Source for the two entries below: USDA HG-72 (Gebhardt &
  // Thomas 2002), the standard US food-composition reference.
  //
  // DAHI vs HUNG_CURD:
  //   - DAHI is regular Indian curd, unstrained (whole milk, no added solids).
  //     Per 100g: ~3.5g protein, ~3.1g fat, ~4.9g carbs, ~61 kcal.
  //   - HUNG_CURD is strained / Greek-style: whey is removed by hanging in
  //     muslin for ~4 hours, concentrating protein and fat. Yield is roughly
  //     50% by mass, so per-100g protein/fat roughly double; carbs drop
  //     because some lactose leaves with the whey.

  DAHI: {
    // USDA HG-72 #138 — Yogurt, whole milk, plain, without added milk solids.
    // 1 container 227g = 139 kcal, 8g P, 7g fat, 11g carbs. Per 1g below.
    // Ca/Fe from same HG-72 entry: 274 mg / 0.1 mg per 227g container.
    id: "DAHI", name: "Curd (Dahi)",
    unitType: "grams",
    macros: {
      protein: 0.0353, carbs: 0.0485, fat: 0.0308,
      calories: 0.612, fiber: 0,
      calcium: 1.21, iron: 0.0004,
    },
    tags: ["veg", "eggetarian", "keto", "calcium"],
    quantization: { step: 10, min: 50, max: 300 },
    displayName: { hi: "दही", en: "Curd" },
  },

  // Strained dahi. Yield ≈ 50% of starting curd mass; protein and fat
  // concentrate proportionally, carbs (lactose) partly drain with whey.
  // Values consistent with whole-milk Greek yogurt (USDA FDC ~10g P, 5g
  // fat, 4g carbs per 100g) and align with the pre-8d entry, refined.
  HUNG_CURD: {
    id: "HUNG_CURD", name: "Hung Curd (strained yogurt)",
    unitType: "grams",
    macros: {
      protein: 0.097, carbs: 0.036, fat: 0.050,
      calories: 0.982, fiber: 0,
      calcium: 1.10, iron: 0.0004,
    },
    tags: ["veg", "eggetarian", "keto", "calcium"],
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

  // ── Additional fats (commit 8d citation pass) ─────────────────────────────
  // All entries below are per 1 tsp (5g for ghee/butter/coconut oil; cream
  // and coconut milk are by volume so 1 tsp ≈ 5ml ≈ 4.8g).
  //
  // Pre-8d bug fix: CREAM and COCONUT_MILK_THICK previously stored per-tbsp
  // macros while declaring unitType: "tsp". The unitType display ("1 tsp")
  // told users the wrong portion. Values below are now true per-tsp (3× less
  // than the pre-8d numbers). No recipe is currently impacted — the meal
  // generator does not emit these foods with quantities; they only appear in
  // recipeRegistry compatibleFoods lists, which are flavor candidates not
  // committed amounts. Future generator work picking CREAM should treat the
  // quantity field as tsp count.

  // Per 1 tsp (≈4.5g). Coconut oil is 100% fat by composition; trace water
  // contributes negligible mass. USDA FDC 04047 reference composition.
  COCONUT_OIL: {
    id: "COCONUT_OIL", name: "Coconut Oil",
    unitType: "tsp",
    macros: { protein: 0, carbs: 0, fat: 4.5, calories: 41, fiber: 0 },
    tags: ["veg", "eggetarian", "keto"],
    quantization: { step: 0.5, min: 0.5, max: 4 },
    displayName: { hi: "नारियल तेल", en: "Coconut Oil" },
  },

  // Per 1 tsp (5g). USDA HG-72 #153 (unsalted butter, 1 tsp): 36 kcal,
  // Tr protein, 4g fat, 0 carbs. Pre-8d had 34 kcal / 3.8g fat — slightly
  // low. Difference ~2 kcal per tsp; no meal totals shift meaningfully.
  BUTTER: {
    id: "BUTTER", name: "Butter (unsalted)",
    unitType: "tsp",
    macros: { protein: 0.04, carbs: 0, fat: 4.0, calories: 36, fiber: 0 },
    tags: ["veg", "eggetarian", "keto"],
    quantization: { step: 0.5, min: 0.5, max: 4 },
    displayName: { hi: "मक्खन", en: "Butter" },
  },

  // Per 1 tsp (≈5g). Amul Fresh Cream / Mother Dairy / Nestlé Milkmaid
  // packaged Indian "fresh cream" — typical pack-label spec is ~25% fat.
  // Per 1 tsp ≈ 5g × 0.25 = 1.25g fat, ~12 kcal. Renamed in displayName to
  // make the fat content explicit so users can distinguish from half-and-
  // half. Pre-8d "Fresh Cream (full fat)" stored only 13% fat (consistent
  // with half-and-half, not Amul Fresh Cream) — fixed.
  CREAM: {
    id: "CREAM", name: "Fresh Cream (25% fat, packaged)",
    unitType: "tsp",
    macros: {
      protein: 0.11, carbs: 0.18, fat: 1.25,
      calories: 12.4, fiber: 0,
      calcium: 0.46, iron: 0.0006,
    },
    tags: ["veg", "eggetarian", "keto"],
    quantization: { step: 1, min: 1, max: 6 },
    displayName: { hi: "ताज़ी क्रीम (25%)", en: "Fresh Cream (25%)" },
  },

  // Per 1 tsp (≈5g). USDA HG-72 #87-88 (Light/coffee cream): 469 kcal,
  // 6g P, 46g fat, 9g carbs per 240g cup ⇒ per 5g: 9.8 kcal, 0.13g P,
  // 0.96g fat, 0.19g carbs. ~19.5% fat by mass. In Indian retail this
  // corresponds to the lighter dairy-aisle "half & half" / "table cream"
  // tetrapacks. Distinct entry so users pick the cream they actually buy.
  HALF_AND_HALF: {
    id: "HALF_AND_HALF", name: "Half & Half / Light Cream",
    unitType: "tsp",
    macros: {
      protein: 0.13, carbs: 0.19, fat: 0.96,
      calories: 9.8, fiber: 0,
      calcium: 0.32, iron: 0.0002,
    },
    tags: ["veg", "eggetarian", "keto"],
    quantization: { step: 1, min: 1, max: 6 },
    displayName: { hi: "हाफ एंड हाफ", en: "Half & Half" },
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

  // Per 1 tsp (≈5g). USDA FDC 12118 Coconut milk, raw (thick). Per 100g:
  // ~230 kcal, 2.3g P, 23.8g fat, 5.5g carbs, 2.2g fibre. Per 5g: 11.5 kcal,
  // ~0.12g P, 1.19g fat, 0.28g carbs. Pre-8d "Per 1 tbsp" comment described
  // a 15g portion (3 tsp) while unitType said "tsp" — fixed (see CREAM note).
  COCONUT_MILK_THICK: {
    id: "COCONUT_MILK_THICK", name: "Thick Coconut Milk",
    unitType: "tsp",
    macros: {
      protein: 0.12, carbs: 0.28, fat: 1.19,
      calories: 11.5, fiber: 0.11,
    },
    tags: ["veg", "eggetarian", "keto"],
    quantization: { step: 1, min: 1, max: 8 },
    displayName: { hi: "गाढ़ा नारियल दूध", en: "Thick Coconut Milk" },
  },

  // ── Oats (commit 8d) ──────────────────────────────────────────────────────
  // IFCT 2017 does not tabulate oats. USDA SR Legacy #08120 ("Oats") is the
  // standard reference and is what was used by the previous version of this
  // app's oats entry. Per 100g raw: 13.2g protein, 6.5g fat, 57.6g carbs,
  // 10.6g fibre, 379 kcal. Calcium 54 mg, iron 4.72 mg (SR Legacy mineral
  // panel; not visible in HG-72 PDF, sourced from FDC).
  //
  // "Oats" in USDA SR is rolled oats (regular / old-fashioned). Steel-cut
  // and instant oats have nearly identical dry macros; cooking time differs.
  // No separate entry needed at this granularity.
  OATS_RAW: {
    id: "OATS_RAW", name: "Oats, raw (rolled)",
    unitType: "grams",
    macros: {
      protein: 0.132, carbs: 0.576, fat: 0.065,
      calories: 3.79, fiber: 0.106,
      calcium: 0.54, iron: 0.0472,
    },
    tags: ["veg", "eggetarian", "fiber-source"],
    quantization: { step: 10, min: 20, max: 80 },
    displayName: { hi: "ओट्स (कच्चे)", en: "Oats, raw" },
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
  //
  // Commit 8b fix: the original 8a cereal entries had the `fat` field
  // populated from IFCT Table 1's Ash column (one position to the right of
  // the Fat column) for all 10 cereal entries. Fat values below have been
  // corrected to the actual Table 1 Fat values. The BAJRA comment was also
  // corrected — bajra is not "high fat for a grain" (real fat 1.37%, ash
  // 5.43%, which is what the 8a value was reflecting). Protein, CHOAVL,
  // fibre, calcium, iron, and energy were unaffected by the bug and remain
  // as originally entered. Energy stays as the IFCT-printed kJ value
  // converted to kcal — it is not recomputed by Atwater from the new fat
  // value, because IFCT energy is the authoritative number (it accounts
  // for sugar/fibre/alcohol fractions that pure Atwater on protein-fat-CHO
  // would miss). The resulting protein + fat + carb kcal will be very
  // close to the printed energy but not identical, which is correct.

  // A019 — Whole wheat flour. The atta used for chapati / roti / paratha
  // across North India. High fibre because the bran is retained. n=6.
  ATTA: {
    id: "ATTA", name: "Whole Wheat Flour (Atta)",
    unitType: "grams",
    macros: {
      protein: 0.1057, carbs: 0.6417, fat: 0.0128,
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
      protein: 0.1036, carbs: 0.7427, fat: 0.0051,
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
      protein: 0.1138, carbs: 0.6843, fat: 0.0080,
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
      protein: 0.0794, carbs: 0.7824, fat: 0.0056,
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
      protein: 0.0916, carbs: 0.7480, fat: 0.0104,
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
      protein: 0.0744, carbs: 0.7675, fat: 0.0085,
      calories: 3.54, fiber: 0.0346,
      calcium: 0.0919, iron: 0.0446,
    },
    tags: ["veg", "eggetarian"],
    quantization: { step: 5, min: 20, max: 100 },
    displayName: { hi: "पोहा", en: "Poha (Rice Flakes)" },
  },

  // A003 — Pearl millet. Bajra — winter staple in Rajasthan, Gujarat,
  // Haryana. Modest fat for a grain; very high iron (6.42 mg/100g) and
  // good calcium (27.4 mg/100g). n=6.
  BAJRA: {
    id: "BAJRA", name: "Pearl Millet (Bajra)",
    unitType: "grams",
    macros: {
      protein: 0.1096, carbs: 0.6178, fat: 0.0137,
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
      protein: 0.0997, carbs: 0.6768, fat: 0.0139,
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
      protein: 0.0716, carbs: 0.6682, fat: 0.0204,
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
      protein: 0.1094, carbs: 0.6129, fat: 0.0106,
      calories: 3.16, fiber: 0.1564,
      calcium: 0.2864, iron: 0.0156,
    },
    tags: ["veg", "eggetarian", "fiber-source"],
    quantization: { step: 5, min: 20, max: 150 },
    displayName: { hi: "जौ", en: "Barley (Jau)" },
  },

  // ── IFCT 2017 — Grain Legumes (commit 8b) ────────────────────────────────────
  //
  // Same source, citation, and methodology as the cereal block above:
  // Indian Food Composition Tables 2017 (Longvah et al., NIN/ICMR). Values
  // are per 1 gram raw, with IFCT food code and sample size in each entry's
  // comment. CHOAVL ("available CHO by difference"), TDF for fibre, energy
  // converted from kJ at 1 kcal = 4.184 kJ. Calcium and iron in mg per gram
  // (IFCT mg/100g ÷ 100).
  //
  // Cooking-conversion rule of thumb for dal: 1 g dry → ~2.5 g cooked (varies
  // with soaking, lentil type, and how loose the dal is — masoor and moong
  // are looser, urad and rajma are denser when properly cooked).
  //
  // Coverage decisions:
  //   - Kabuli chana (white chickpea) is not separately tabulated in IFCT.
  //     It is the cream-coloured variety of the same species (Cicer
  //     arietinum) as desi chana. The whole-Bengal-gram entry (B002) is the
  //     closest IFCT match; kabuli is slightly higher in CHOAVL and slightly
  //     lower in fibre, but the difference is within the n=6 sample SD.
  //     Users logging kabuli chana should use CHANA_WHOLE.
  //   - "Bengal gram, whole" (B002) covers both desi chana / kala chana
  //     and serves as the closest proxy for kabuli (see above).

  // B021 — Pigeon pea, dehusked split (toor / arhar dal). The most-used dal
  // across most of India. n=6.
  TOOR_DAL: {
    id: "TOOR_DAL", name: "Toor Dal / Arhar (raw)",
    unitType: "grams",
    macros: {
      protein: 0.2170, carbs: 0.5523, fat: 0.0156,
      calories: 3.31, fiber: 0.0906,
      calcium: 0.7173, iron: 0.0390,
    },
    tags: ["veg", "eggetarian", "fiber-source"],
    quantization: { step: 5, min: 20, max: 150 },
    displayName: { hi: "तूर / अरहर दाल", en: "Toor Dal (Arhar)" },
  },

  // B001 — Bengal gram, dehusked split (chana dal). Slightly higher fat
  // than other split dals; mild glycaemic load. n=6.
  CHANA_DAL: {
    id: "CHANA_DAL", name: "Chana Dal (raw)",
    unitType: "grams",
    macros: {
      protein: 0.2155, carbs: 0.4672, fat: 0.0531,
      calories: 3.29, fiber: 0.1515,
      calcium: 0.4632, iron: 0.0608,
    },
    tags: ["veg", "eggetarian", "fiber-source"],
    quantization: { step: 5, min: 20, max: 150 },
    displayName: { hi: "चना दाल", en: "Chana Dal" },
  },

  // B002 — Bengal gram, whole. Desi black chickpea (kala chana) and the
  // closest IFCT proxy for kabuli chana (see header note above). Very high
  // fibre because the seed coat is intact. Good calcium and iron. n=6.
  CHANA_WHOLE: {
    id: "CHANA_WHOLE", name: "Whole Chana (Kala / Kabuli, raw)",
    unitType: "grams",
    macros: {
      protein: 0.1877, carbs: 0.3956, fat: 0.0511,
      calories: 2.87, fiber: 0.2522,
      calcium: 1.500, iron: 0.0678,
    },
    tags: ["veg", "eggetarian", "fiber-source"],
    quantization: { step: 5, min: 20, max: 150 },
    displayName: { hi: "साबुत चना (काला / काबुली)", en: "Whole Chana" },
  },

  // B010 — Green gram, dehusked split (moong dal). Light, easy to digest,
  // popular in khichdi and dal. Lowest fibre among the split dals here. n=6.
  MOONG_DAL: {
    id: "MOONG_DAL", name: "Moong Dal (raw)",
    unitType: "grams",
    macros: {
      protein: 0.2388, carbs: 0.5259, fat: 0.0135,
      calories: 3.26, fiber: 0.0937,
      calcium: 0.4313, iron: 0.0393,
    },
    tags: ["veg", "eggetarian", "fiber-source"],
    quantization: { step: 5, min: 20, max: 150 },
    displayName: { hi: "मूंग दाल", en: "Moong Dal" },
  },

  // B003 — Black gram, dehusked split (urad dal). The dal in dal makhani
  // (when paired with rajma) and in idli/dosa batter. Highest protein of
  // the split dals tabulated here. n=6.
  URAD_DAL: {
    id: "URAD_DAL", name: "Urad Dal (raw)",
    unitType: "grams",
    macros: {
      protein: 0.2306, carbs: 0.5100, fat: 0.0169,
      calories: 3.24, fiber: 0.1193,
      calcium: 0.5567, iron: 0.0467,
    },
    tags: ["veg", "eggetarian", "fiber-source"],
    quantization: { step: 5, min: 20, max: 150 },
    displayName: { hi: "उड़द दाल", en: "Urad Dal" },
  },

  // B004 — Black gram, whole (sabut urad). Used in dal makhani. Much higher
  // fibre than dehusked urad because the dark seed coat is retained. n=6.
  URAD_WHOLE: {
    id: "URAD_WHOLE", name: "Whole Urad / Sabut Urad (raw)",
    unitType: "grams",
    macros: {
      protein: 0.2197, carbs: 0.4399, fat: 0.0158,
      calories: 2.91, fiber: 0.2041,
      calcium: 0.8618, iron: 0.0597,
    },
    tags: ["veg", "eggetarian", "fiber-source"],
    quantization: { step: 5, min: 20, max: 150 },
    displayName: { hi: "साबुत उड़द", en: "Whole Urad (Sabut)" },
  },

  // B013 — Lentil dal (masoor dal). Replaces the previous hand-estimated
  // entry. Highest protein among the dehusked dals here (24.4 g/100g) and
  // the highest iron (7.06 mg/100g — useful in iron-deficiency diets and
  // maternal modes). n=6.
  MASOOR_DAL: {
    id: "MASOOR_DAL", name: "Masoor Dal (raw)",
    unitType: "grams",
    macros: {
      protein: 0.2435, carbs: 0.5253, fat: 0.0075,
      calories: 3.22, fiber: 0.1043,
      calcium: 0.4432, iron: 0.0706,
    },
    tags: ["veg", "eggetarian", "fiber-source"],
    quantization: { step: 5, min: 25, max: 150 },
    displayName: { hi: "मसूर दाल", en: "Masoor Dal" },
  },

  // B019 — Rajmah, brown (rajma). Kidney bean. High fibre, very high
  // calcium for a legume (134 mg/100g), high iron. The dal makhani pairing
  // partner and the rajma in rajma-chawal. n=6.
  RAJMA: {
    id: "RAJMA", name: "Rajma / Kidney Bean (raw)",
    unitType: "grams",
    macros: {
      protein: 0.1950, carbs: 0.4883, fat: 0.0168,
      calories: 2.98, fiber: 0.1695,
      calcium: 1.340, iron: 0.0630,
    },
    tags: ["veg", "eggetarian", "fiber-source"],
    quantization: { step: 5, min: 20, max: 150 },
    displayName: { hi: "राजमा", en: "Rajma (Kidney Bean)" },
  },

  // ── IFCT 2017 — Nuts and oilseeds (commit 10.2a) ──────────────────────────────
  // Single-entry section for now (peanut), added because Maharashtrian-style
  // karela preparation traditionally uses peanut crumble at ~15-20g per serve
  // — meaningful macros, can't be treated as a trace aromatic. The broader
  // nuts and oilseeds section (cashew, almond, walnut, til, etc. — IFCT H001
  // through H019) is deferred to a focused commit; adding only what 10.2's
  // recipes actually need.
  //
  // Peanut is biologically a legume (groundnut) but conventionally classified
  // with nuts and oilseeds in IFCT and most reference tables, so it lives
  // here, not with the dal entries.

  PEANUT: {
    // IFCT H012 — Ground nut (Arachis hypogaea), n=6. 2176 kJ/100g.
    // Note IFCT samples raw groundnut with skin; roasted/salted peanuts have
    // similar macros (slight water-loss concentration ~3%) but added salt.
    // For roasted/fried use in poha/chivda/karela, the raw IFCT value is the
    // canonical reference; recipes that explicitly toast peanuts pre-use
    // should treat the mass shift as negligible at cooking scale.
    id: "PEANUT", name: "Peanut (raw)",
    unitType: "grams",
    macros: {
      protein: 0.2365, carbs: 0.1038, fat: 0.3963,
      calories: 5.20, fiber: 0.0858,
      calcium: 0.54, iron: 0.0344,
    },
    tags: ["veg", "eggetarian", "keto", "fiber-source"],
    quantization: { step: 5, min: 10, max: 60 },
    displayName: { hi: "मूंगफली", en: "Peanut" },
  },

  // ── Edible oils — mustard oil (commit 10.3a) ──────────────────────────────────
  // Added because macher jhol (Bengali fish curry), East Indian mustard-fish
  // preparations, and several mutton curry traditions use mustard oil as the
  // primary cooking medium, often 2-3 tbsp per dish — ~30g fat that materially
  // affects the meal's macros. Without a tracked FoodId, those calories
  // disappear from the daily total.
  //
  // IFCT 2017 (Table 12, T006) tabulates mustard oil's fatty-acid profile
  // but not proximate macros, because oils are 100% fat by definition. The
  // proximate values below are the universal food-science composition (USDA
  // SR Legacy #04583, FDC 171015): 100% fat, 884 kcal/100g, zero protein,
  // zero carbs, zero fibre. Per 1 tsp (5g): 5g fat, 45 kcal — same shape as
  // GHEE and COCONUT_OIL.

  MUSTARD_OIL: {
    // IFCT 2017 T006 (Table 12 fatty acid profile, n=6) + USDA SR Legacy
    // #04583 for proximate macros (IFCT doesn't tabulate oil proximates).
    // Used as the primary fat in Bengali, Bihari, and eastern UP cooking.
    // Distinctive pungent flavor when raw; mellows on heating to smoke point
    // (~250°C). Per 1 tsp (5g): 5g fat, 45 kcal.
    id: "MUSTARD_OIL", name: "Mustard Oil",
    unitType: "tsp",
    macros: { protein: 0, carbs: 0, fat: 5, calories: 45, fiber: 0 },
    tags: ["veg", "eggetarian", "keto"],
    quantization: { step: 0.5, min: 0.5, max: 4 },
    displayName: { hi: "सरसों का तेल", en: "Mustard Oil" },
  },

  // ── IFCT 2017 — Mutton / Goat curry cut (commit 10.3a) ────────────────────────
  // Indian "mutton" colloquially means goat meat (Capra hircus), not sheep.
  // IFCT covers goat in section O (Mutton/Goat) with cut-specific entries
  // O001-O010. Existing MUTTON_KEEMA covers minced meat for keema dishes;
  // this entry covers the bone-in / whole-cut form used in mutton curry,
  // rogan josh, mutton korma, etc.
  //
  // IFCT samples skinless meat without bone (bone weight excluded). For
  // bone-in cooking weight, multiply by ~1.35 (typical bone fraction in
  // curry cut), but the macro per gram of edible meat is what this entry
  // tracks. Recipes that weigh the curry-cut on the bone should account
  // for ~25-30% non-edible bone before logging.

  MUTTON_CURRY_CUT: {
    // IFCT O001 — Goat, shoulder (n=6). The most representative curry-cut
    // entry. Shoulder is the most common cut sold for curry in Indian
    // markets; chops (O002) and legs (O003) have very similar macros
    // (±5% on protein and fat). 787 kJ/100g per IFCT energy.
    // Low calcium (mammalian muscle); moderate iron (heme).
    id: "MUTTON_CURRY_CUT", name: "Mutton (curry cut, raw)",
    unitType: "grams",
    macros: {
      protein: 0.2033, carbs: 0.0090, fat: 0.1194,
      calories: 1.881, fiber: 0,
      calcium: 0.0618, iron: 0.0148,
    },
    tags: ["non-veg", "keto", "high-protein"],
    quantization: { step: 10, min: 100, max: 300 },
    displayName: { hi: "मटन (करी कट)", en: "Mutton (curry cut)" },
  },

} as const satisfies Record<string, FoodItem>
