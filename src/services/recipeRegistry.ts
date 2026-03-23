// ── recipeRegistry.ts ──────────────────────────────────────────────────────────
// Pure content layer. Bilingual Hindi + English.
// Covers eggetarian AND non-veg options — generator selects based on diet tag.

import type { FoodId } from "./foodDatabase"

export type Recipe = {
  id:              string
  name:            { hi: string; en: string }
  compatibleFoods: FoodId[]
  requiredRanges?: Partial<Record<FoodId, { min: number; max: number }>>
  dietTags:        Array<"veg" | "eggetarian" | "non-veg">
  steps: {
    hi: string[]
    en: string[]
  }
}

export const GENERIC_PREP: Recipe = {
  id: "GENERIC_PREP",
  name: { hi: "सादी तैयारी", en: "Simple Preparation" },
  compatibleFoods: [],
  dietTags: ["veg", "eggetarian", "non-veg"],
  steps: {
    hi: ["घी गरम करें — मसाले तड़काएं", "प्याज-टमाटर भूनें — 2 मिनट", "मुख्य सामग्री पकाएं — गरम परोसें"],
    en: ["Heat ghee — splutter spices", "Sauté onion-tomato — 2 min", "Cook main ingredients — serve hot"],
  },
}

export const RECIPES: Record<string, Recipe> = {

  // ── Egg + Paneer (eggetarian core) ──────────────────────────────────────────

  PANEER_EGG_BHURJI: {
    id: "PANEER_EGG_BHURJI",
    name: { hi: "पनीर अंडा भुर्जी", en: "Paneer Egg Bhurji" },
    compatibleFoods: ["EGG", "PANEER", "GHEE", "SPINACH", "TOMATO", "ONION", "CAPSICUM", "MUSHROOM"],
    dietTags: ["eggetarian"],
    steps: {
      hi: ["घी गरम करें — जीरा, हरी मिर्च तड़काएं", "प्याज — 2 मिनट सुनहरा", "टमाटर, पालक — 2 मिनट", "अंडे फोड़ें — धीरे हिलाएं", "पनीर क्रम्बल — 1 मिनट — गरम परोसें"],
      en: ["Heat ghee — cumin, green chilli", "Onion — 2 min golden", "Tomato, spinach — 2 min", "Crack eggs — stir gently", "Crumble paneer — 1 min — serve hot"],
    },
  },

  EGG_PANEER_MASALA: {
    id: "EGG_PANEER_MASALA",
    name: { hi: "अंडा पनीर मसाला", en: "Egg Paneer Masala" },
    compatibleFoods: ["EGG", "PANEER", "GHEE", "TOMATO", "ONION", "SPINACH", "CREAM"],
    dietTags: ["eggetarian"],
    steps: {
      hi: ["अंडे 12 मिनट उबालें — छीलें — आधे काटें", "घी में जीरा, करी पत्ता", "प्याज 2 मिनट — अदरक-लहसुन 1 मिनट", "टमाटर 3 मिनट — हल्दी, गरम मसाला", "पनीर 2 मिनट — अंडे डालें — 2 मिनट धीमी आंच", "कसूरी मेथी — हरा धनिया — परोसें"],
      en: ["Boil eggs 12 min — peel — halve", "Ghee — cumin, curry leaves", "Onion 2 min — ginger-garlic 1 min", "Tomato 3 min — turmeric, garam masala", "Paneer 2 min — add eggs — 2 min low flame", "Kasuri methi — coriander — serve"],
    },
  },

  METHI_PANEER_BHURJI: {
    id: "METHI_PANEER_BHURJI",
    name: { hi: "मेथी पनीर भुर्जी", en: "Methi Paneer with Scrambled Eggs" },
    compatibleFoods: ["EGG", "PANEER", "GHEE", "METHI", "TOMATO", "ONION"],
    dietTags: ["eggetarian"],
    steps: {
      hi: ["घी में जीरा, हींग — 15 सेकंड", "प्याज 2 मिनट — अदरक-लहसुन 1 मिनट", "मेथी पत्तियां — 1 मिनट मुरझाने तक", "टमाटर — हल्दी, धनिया — 2 मिनट", "अंडे फोड़ें — भुर्जी बनाएं", "पनीर क्रम्बल — 1 मिनट — परोसें"],
      en: ["Ghee — cumin, asafoetida — 15 sec", "Onion 2 min — ginger-garlic 1 min", "Methi leaves — 1 min until wilted", "Tomato — turmeric, coriander — 2 min", "Crack eggs — scramble", "Crumble paneer — 1 min — serve"],
    },
  },

  ANDHRA_EGG_MASALA: {
    id: "ANDHRA_EGG_MASALA",
    name: { hi: "आंध्रा अंडा मसाला", en: "Andhra Egg Masala" },
    compatibleFoods: ["EGG", "PANEER", "GHEE", "TOMATO", "ONION", "CAPSICUM"],
    dietTags: ["eggetarian"],
    steps: {
      hi: ["अंडे उबालें — छीलें — हल्के से स्कोर करें", "घी में सरसों, करी पत्ता, सूखी लाल मिर्च", "प्याज 3 मिनट गहरा सुनहरा", "टमाटर — लाल मिर्च भरपूर — 3 मिनट", "पनीर क्यूब्स 2 मिनट — अंडे डालें", "3 मिनट धीमी आंच — करी पत्ता — परोसें"],
      en: ["Boil eggs — peel — lightly score", "Ghee — mustard, curry leaves, dry red chilli", "Onion 3 min deep golden", "Tomato — generous red chilli — 3 min", "Paneer cubes 2 min — add eggs", "3 min low flame — curry leaves — serve"],
    },
  },

  EGG_MUSHROOM_STIR_FRY: {
    id: "EGG_MUSHROOM_STIR_FRY",
    name: { hi: "अंडा मशरूम स्टर फ्राई", en: "Egg Mushroom Stir-Fry with Paneer" },
    compatibleFoods: ["EGG", "PANEER", "GHEE", "MUSHROOM", "CAPSICUM", "ONION", "TOMATO"],
    dietTags: ["eggetarian"],
    steps: {
      hi: ["घी में मशरूम — सुनहरा और पानी सूखने तक — अलग रखें", "उसी घी में प्याज, शिमला मिर्च — 2 मिनट", "अदरक-लहसुन, टमाटर — 2 मिनट", "अंडे फोड़ें — भुर्जी बनाएं", "मशरूम और पनीर वापस डालें — 1 मिनट", "काली मिर्च, सोया सॉस — परोसें"],
      en: ["Ghee — mushrooms until golden and dry — set aside", "Same ghee — onion, capsicum — 2 min", "Ginger-garlic, tomato — 2 min", "Crack eggs — scramble", "Return mushrooms and paneer — 1 min", "Black pepper, soy sauce — serve"],
    },
  },

  PALAK_PANEER_EGGS: {
    id: "PALAK_PANEER_EGGS",
    name: { hi: "पालक पनीर अंडा", en: "Saag Paneer with Poached Eggs" },
    compatibleFoods: ["EGG", "PANEER", "GHEE", "SPINACH", "ONION", "TOMATO", "CREAM"],
    dietTags: ["eggetarian"],
    steps: {
      hi: ["पालक उबालें — पीसें — प्यूरी बनाएं", "घी में प्याज 3 मिनट — टमाटर 2 मिनट", "पालक प्यूरी — हल्दी, गरम मसाला — 3 मिनट", "पनीर क्यूब्स डालें — मिलाएं", "बीच में जगह बनाएं — अंडे पोच करें — 4 मिनट", "क्रीम — गरम परोसें"],
      en: ["Blanch spinach — blend to purée", "Ghee — onion 3 min — tomato 2 min", "Spinach purée — turmeric, garam masala — 3 min", "Add paneer cubes — fold", "Make wells — crack eggs — poach 4 min", "Swirl cream — serve hot"],
    },
  },

  BAINGAN_EGG_BHARTA: {
    id: "BAINGAN_EGG_BHARTA",
    name: { hi: "बैंगन अंडा भरता", en: "Smoky Baingan Bharta with Eggs" },
    compatibleFoods: ["EGG", "PANEER", "GHEE", "BAINGAN", "ONION", "TOMATO"],
    dietTags: ["eggetarian"],
    steps: {
      hi: ["बैंगन सीधे आंच पर भूनें — छीलें — मैश करें", "घी में जीरा — प्याज 3 मिनट गहरा सुनहरा", "टमाटर — मसाले — 2 मिनट", "भरता मिलाएं — 2 मिनट", "बीच में जगह — अंडे फोड़ें — ढकें — 3 मिनट", "पनीर क्रम्बल — हरा धनिया — परोसें"],
      en: ["Char baingan directly over flame — peel — mash", "Ghee — cumin — onion 3 min deep golden", "Tomato — spices — 2 min", "Mix in bharta — 2 min", "Make wells — crack eggs — cover — 3 min", "Crumble paneer — coriander — serve"],
    },
  },

  KARELA_EGG_PANEER: {
    id: "KARELA_EGG_PANEER",
    name: { hi: "करेला अंडा पनीर", en: "Karela with Eggs and Paneer" },
    compatibleFoods: ["EGG", "PANEER", "GHEE", "KARELA", "ONION", "TOMATO"],
    dietTags: ["eggetarian"],
    steps: {
      hi: ["करेला पतला काटें — नमक लगाएं — 10 मिनट — निचोड़ें", "घी में कुरकुरा होने तक भूनें — अलग रखें", "उसी घी में प्याज, टमाटर — 2 मिनट", "पनीर क्यूब्स — 2 मिनट", "अंडे फोड़ें — करेला वापस — मिलाएं", "एक चुटकी गुड़ — परोसें"],
      en: ["Slice karela thin — salt — 10 min — squeeze", "Fry in ghee until crisp — set aside", "Same ghee — onion, tomato — 2 min", "Paneer cubes — 2 min", "Crack eggs — return karela — fold", "Pinch of jaggery — serve"],
    },
  },

  // ── Non-veg (chicken) ────────────────────────────────────────────────────────

  CHICKEN_HANDI: {
    id: "CHICKEN_HANDI",
    name: { hi: "चिकन हांडी", en: "Chicken Handi" },
    compatibleFoods: ["CHICKEN_THIGH", "GHEE", "ONION", "TOMATO", "HUNG_CURD", "CREAM", "CAPSICUM"],
    requiredRanges: { CHICKEN_THIGH: { min: 100, max: 300 } },
    dietTags: ["non-veg"],
    steps: {
      hi: ["चिकन — दही, हल्दी, लाल मिर्च में मैरिनेट — 20 मिनट", "घी में प्याज 4 मिनट गहरा सुनहरा", "अदरक-लहसुन पेस्ट — 2 मिनट", "टमाटर — 3 मिनट तेल छूटने तक", "मैरिनेट चिकन डालें — 5 मिनट तेज़ आंच", "ढककर 15 मिनट धीमी आंच — क्रीम — परोसें"],
      en: ["Chicken — marinate in yogurt, turmeric, red chilli — 20 min", "Ghee — onion 4 min deep golden", "Ginger-garlic paste — 2 min", "Tomato — 3 min until oil separates", "Add marinated chicken — 5 min high heat", "Cover — 15 min low flame — cream — serve"],
    },
  },

  CHICKEN_SAAG: {
    id: "CHICKEN_SAAG",
    name: { hi: "चिकन साग", en: "Chicken Saag" },
    compatibleFoods: ["CHICKEN_BREAST", "GHEE", "SPINACH", "ONION", "TOMATO", "HUNG_CURD"],
    requiredRanges: { CHICKEN_BREAST: { min: 120, max: 300 } },
    dietTags: ["non-veg"],
    steps: {
      hi: ["पालक उबालें — मोटी प्यूरी बनाएं", "घी में चिकन — सुनहरा — निकालें", "उसी घी में प्याज 3 मिनट — अदरक-लहसुन 1 मिनट", "टमाटर — मसाले — 2 मिनट", "पालक प्यूरी — चिकन वापस — 10 मिनट ढककर", "दही मिलाएं — गरम परोसें"],
      en: ["Blanch spinach — blend to rough purée", "Ghee — chicken golden — remove", "Same ghee — onion 3 min — ginger-garlic 1 min", "Tomato — spices — 2 min", "Spinach purée — return chicken — 10 min covered", "Stir in yogurt — serve hot"],
    },
  },

  CHICKEN_KALI_MIRCH: {
    id: "CHICKEN_KALI_MIRCH",
    name: { hi: "चिकन काली मिर्च", en: "Chicken Kali Mirch" },
    compatibleFoods: ["CHICKEN_BREAST", "GHEE", "ONION", "HUNG_CURD", "CREAM", "MUSHROOM"],
    requiredRanges: { CHICKEN_BREAST: { min: 120, max: 300 } },
    dietTags: ["non-veg"],
    steps: {
      hi: ["चिकन — दही, काली मिर्च, नमक में 30 मिनट मैरिनेट", "घी में प्याज 4 मिनट — क्रीमी होने तक", "अदरक-लहसुन — 1 मिनट", "मैरिनेट चिकन — 6 मिनट हर तरफ भूनें", "मशरूम डालें — 3 मिनट", "भरपूर काली मिर्च — क्रीम — परोसें"],
      en: ["Chicken — marinate in yogurt, black pepper, salt — 30 min", "Ghee — onion 4 min until creamy", "Ginger-garlic — 1 min", "Marinated chicken — 6 min each side", "Add mushrooms — 3 min", "Generous black pepper — cream — serve"],
    },
  },

  CHICKEN_TIKKA_DRY: {
    id: "CHICKEN_TIKKA_DRY",
    name: { hi: "चिकन टिक्का (ड्राई)", en: "Dry Chicken Tikka" },
    compatibleFoods: ["CHICKEN_BREAST", "HUNG_CURD", "GHEE", "CAPSICUM", "ONION"],
    requiredRanges: { CHICKEN_BREAST: { min: 150, max: 300 } },
    dietTags: ["non-veg"],
    steps: {
      hi: ["चिकन टुकड़े — दही, लाल मिर्च, हल्दी, गरम मसाला — 1 घंटा मैरिनेट", "तवे पर घी — तेज़ आंच पर सेकें — 4 मिनट हर तरफ", "शिमला मिर्च और प्याज रिंग्स — 2 मिनट", "नींबू — चाट मसाला — परोसें"],
      en: ["Chicken pieces — yogurt, red chilli, turmeric, garam masala — 1 hr", "Tawa — ghee — high heat — 4 min each side", "Capsicum and onion rings — 2 min", "Lemon — chaat masala — serve"],
    },
  },

  // ── Non-veg (mutton) ─────────────────────────────────────────────────────────

  MUTTON_KEEMA_MASALA: {
    id: "MUTTON_KEEMA_MASALA",
    name: { hi: "मटन कीमा मसाला", en: "Mutton Keema Masala" },
    compatibleFoods: ["MUTTON_KEEMA", "GHEE", "ONION", "TOMATO", "SPINACH", "CAPSICUM"],
    requiredRanges: { MUTTON_KEEMA: { min: 100, max: 250 } },
    dietTags: ["non-veg"],
    steps: {
      hi: ["घी में प्याज 4 मिनट गहरा सुनहरा", "अदरक-लहसुन पेस्ट — 2 मिनट", "कीमा — तेज़ आंच — 5 मिनट भूनें", "टमाटर — हल्दी, लाल मिर्च, गरम मसाला — 3 मिनट", "ढककर 15 मिनट धीमी आंच", "हरा धनिया और पुदीना — गरम परोसें"],
      en: ["Ghee — onion 4 min deep golden", "Ginger-garlic paste — 2 min", "Keema — high heat — bhuno 5 min", "Tomato — turmeric, red chilli, garam masala — 3 min", "Cover — 15 min low flame", "Fresh coriander and mint — serve hot"],
    },
  },

  MUTTON_KEEMA_PALAK: {
    id: "MUTTON_KEEMA_PALAK",
    name: { hi: "मटन कीमा पालक", en: "Mutton Keema with Spinach" },
    compatibleFoods: ["MUTTON_KEEMA", "GHEE", "SPINACH", "ONION", "TOMATO"],
    requiredRanges: { MUTTON_KEEMA: { min: 100, max: 250 } },
    dietTags: ["non-veg"],
    steps: {
      hi: ["घी में जीरा — प्याज 3 मिनट", "कीमा — तेज़ आंच 4 मिनट भूनें", "टमाटर — मसाले — 2 मिनट", "पालक बारीक काटकर डालें", "ढककर 12 मिनट धीमी आंच", "नींबू — हरा धनिया — परोसें"],
      en: ["Ghee — cumin — onion 3 min", "Keema — high heat bhuno 4 min", "Tomato — spices — 2 min", "Add finely chopped spinach", "Cover — 12 min low flame", "Lemon — coriander — serve"],
    },
  },

  // ── Non-veg (fish/prawns) ────────────────────────────────────────────────────

  FISH_CURRY_SIMPLE: {
    id: "FISH_CURRY_SIMPLE",
    name: { hi: "सादी मछली करी", en: "Simple Fish Curry" },
    compatibleFoods: ["FISH_ROHU", "COCONUT_OIL", "ONION", "TOMATO", "COCONUT_MILK_THICK"],
    requiredRanges: { FISH_ROHU: { min: 150, max: 350 } },
    dietTags: ["non-veg"],
    steps: {
      hi: ["मछली — हल्दी, नमक — 10 मिनट", "नारियल तेल में सरसों, करी पत्ता", "प्याज 2 मिनट — टमाटर 2 मिनट", "गाढ़ा नारियल दूध — इमली — 3 मिनट उबालें", "मछली डालें — 8 मिनट धीमी आंच", "करी पत्ता गार्निश — परोसें"],
      en: ["Fish — turmeric, salt — 10 min", "Coconut oil — mustard seeds, curry leaves", "Onion 2 min — tomato 2 min", "Thick coconut milk — tamarind — simmer 3 min", "Add fish — 8 min low flame", "Curry leaves garnish — serve"],
    },
  },

  PRAWN_MASALA: {
    id: "PRAWN_MASALA",
    name: { hi: "झींगा मसाला", en: "Prawn Masala" },
    compatibleFoods: ["PRAWNS", "GHEE", "ONION", "TOMATO", "CAPSICUM", "COCONUT_MILK_THICK"],
    requiredRanges: { PRAWNS: { min: 120, max: 300 } },
    dietTags: ["non-veg"],
    steps: {
      hi: ["झींगे — हल्दी, लाल मिर्च — 5 मिनट मैरिनेट", "घी में सरसों, करी पत्ता", "प्याज 2 मिनट — शिमला मिर्च 1 मिनट", "टमाटर — मसाले — 2 मिनट", "झींगे — तेज़ आंच — 3-4 मिनट (ज़्यादा नहीं)", "नींबू — हरा धनिया — परोसें"],
      en: ["Prawns — turmeric, red chilli — 5 min", "Ghee — mustard seeds, curry leaves", "Onion 2 min — capsicum 1 min", "Tomato — spices — 2 min", "Prawns — high heat — 3-4 min (don't overcook)", "Lemon — coriander — serve"],
    },
  },

  // ── Shake ─────────────────────────────────────────────────────────────────────

  WHEY_SHAKE: {
    id: "WHEY_SHAKE",
    name: { hi: "व्हे प्रोटीन शेक", en: "Whey Protein Shake" },
    compatibleFoods: ["WHEY"],
    dietTags: ["eggetarian", "non-veg", "veg"],
    steps: {
      hi: ["300ml ठंडा पानी या बादाम दूध", "1 स्कूप व्हे प्रोटीन — शेक करें — ठंडा परोसें"],
      en: ["300ml cold water or almond milk", "1 scoop whey — shake well — serve cold"],
    },
  },

}

export function getRecipe(recipeId: string): Recipe {
  return RECIPES[recipeId] ?? GENERIC_PREP
}

// ── Diet-filtered recipe lookup ────────────────────────────────────────────────
// Returns all recipes compatible with a given diet tag

export function getRecipesForDiet(diet: "veg" | "eggetarian" | "non-veg"): Recipe[] {
  const allowed: Array<"veg" | "eggetarian" | "non-veg"> =
    diet === "non-veg"    ? ["veg", "eggetarian", "non-veg"] :
    diet === "eggetarian" ? ["veg", "eggetarian"] :
    ["veg"]

  return Object.values(RECIPES).filter(r =>
    r.dietTags.some(t => allowed.includes(t)) && r.id !== "WHEY_SHAKE"
  )
}
