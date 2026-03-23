// ── recipeRegistry.ts ──────────────────────────────────────────────────────────
// Pure content layer. No macros, no constraints, no engine logic.
// Linked from ComposedMeal via recipeId.
// compatibleFoods: engine checks this before attaching recipe to a meal.
// requiredRanges: prevents recipe being attached to wildly mismatched quantities.

import type { FoodId } from "./foodDatabase"

export type Recipe = {
  id:              string
  name:            string
  compatibleFoods: FoodId[]
  requiredRanges?: Partial<Record<FoodId, { min: number; max: number }>>
  steps: {
    hi: string[]
    en: string[]
  }
  tags?: string[]
}

// Fallback recipe — used when no specific recipe matches the generated meal
export const GENERIC_PREP: Recipe = {
  id: "GENERIC_PREP",
  name: "Simple Preparation",
  compatibleFoods: [],
  steps: {
    hi: [
      "घी/तेल गरम करें — जीरा तड़काएं",
      "प्याज और टमाटर भूनें — 2 मिनट",
      "मसाले डालें — 1 मिनट",
      "मुख्य सामग्री डालें — अच्छे से पकाएं",
      "हरा धनिया गार्निश — गरम परोसें",
    ],
    en: [
      "Heat ghee/oil — splutter cumin",
      "Sauté onion and tomato — 2 min",
      "Add spices — 1 min",
      "Add main ingredients — cook through",
      "Garnish with coriander — serve hot",
    ],
  },
}

export const RECIPES: Record<string, Recipe> = {

  PANEER_EGG_BHURJI: {
    id: "PANEER_EGG_BHURJI",
    name: "Paneer Egg Bhurji",
    compatibleFoods: ["EGG", "PANEER", "GHEE", "SPINACH", "TOMATO", "ONION"],
    requiredRanges: {
      PANEER: { min: 50, max: 200 },
      EGG:    { min: 1,  max: 4 },
    },
    steps: {
      hi: [
        "घी गरम करें — जीरा और हरी मिर्च तड़काएं — 20 सेकंड",
        "प्याज डालें — 2 मिनट सुनहरा भूनें",
        "टमाटर और पालक — 2 मिनट तेल छूटने तक",
        "अंडे फोड़ें — धीरे हिलाएं — आधा पकने दें",
        "पनीर क्रम्बल करके डालें — 1 मिनट",
        "नमक, हल्दी, लाल मिर्च — मिलाएं — गरम परोसें",
      ],
      en: [
        "Heat ghee — splutter cumin and green chilli — 20 sec",
        "Add onion — sauté 2 min until golden",
        "Add tomato and spinach — 2 min until oil separates",
        "Crack eggs in — stir gently — allow to half-set",
        "Crumble paneer in — 1 min",
        "Add salt, turmeric, red chilli — mix — serve hot",
      ],
    },
    tags: ["keto", "eggetarian"],
  },

  EGG_PANEER_MASALA: {
    id: "EGG_PANEER_MASALA",
    name: "Egg Paneer Masala",
    compatibleFoods: ["EGG", "PANEER", "GHEE", "SPINACH", "TOMATO", "ONION"],
    requiredRanges: {
      EGG:    { min: 2, max: 4 },
      PANEER: { min: 50, max: 200 },
    },
    steps: {
      hi: [
        "अंडे 12 मिनट उबालें — छीलें — आधे काटें",
        "घी गरम करें — जीरा, करी पत्ता — 20 सेकंड",
        "प्याज — 2 मिनट — अदरक-लहसुन पेस्ट — 1 मिनट",
        "टमाटर — 3 मिनट तेल छूटने तक — हल्दी, धनिया, गरम मसाला",
        "पनीर के टुकड़े — 2 मिनट भूनें",
        "उबले अंडे डालें — ग्रेवी में ढकें — 2 मिनट धीमी आंच",
        "कसूरी मेथी मसलकर — हरा धनिया — गरम परोसें",
      ],
      en: [
        "Boil eggs 12 min — peel — halve",
        "Heat ghee — cumin, curry leaves — 20 sec",
        "Onion — 2 min — ginger-garlic paste — 1 min",
        "Tomato — 3 min until oil separates — turmeric, coriander, garam masala",
        "Paneer cubes — sauté 2 min",
        "Add boiled eggs — coat in masala — 2 min low flame",
        "Crush kasuri methi — fresh coriander — serve hot",
      ],
    },
    tags: ["keto", "eggetarian"],
  },

  WHEY_SHAKE: {
    id: "WHEY_SHAKE",
    name: "Whey Protein Shake",
    compatibleFoods: ["WHEY"],
    steps: {
      hi: [
        "300ml ठंडा पानी या अनस्वीटेंड बादाम दूध लें",
        "1 स्कूप व्हे प्रोटीन डालें",
        "शेकर में अच्छे से मिलाएं — ठंडा परोसें",
      ],
      en: [
        "Take 300ml cold water or unsweetened almond milk",
        "Add 1 scoop whey protein",
        "Shake well — serve cold",
      ],
    },
    tags: ["keto", "eggetarian"],
  },

}

export function getRecipe(recipeId: string): Recipe {
  return RECIPES[recipeId] ?? GENERIC_PREP
}
