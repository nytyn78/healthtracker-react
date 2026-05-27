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
  // Reworked in commit 10.2 for taste coherence. The earlier shape of these
  // recipes optimised for protein-stacking at the expense of dish identity
  // (e.g. paneer crumbled into baingan bharta — bharta has no dairy in any
  // tradition; soy sauce in egg-mushroom stir-fry — anachronistic for Indian
  // household; six vegetables in a single bhurji — kitchen-sink composition).
  //
  // The IDs are preserved because mealGenerator.ts hardcodes them in its
  // 7-day rotation. Names and content are updated to match what someone
  // actually cooks. After the commit-11 generator rewrite, IDs can be
  // renamed cleanly to match the dishes (e.g. KARELA_EGG_PANEER → KARELA_ANDA).
  //
  // Convention (unchanged): compatibleFoods lists ingredients essentially
  // always in the dish. Aromatics (cumin, mustard seeds, asafoetida, ginger-
  // garlic, green chilli, turmeric, garam masala, kasuri methi, curry leaves,
  // fresh coriander, jaggery pinch, tamarind paste) live in step text only —
  // they contribute < 5g and < 10 kcal at typical portions, below the macro
  // noise floor.

  PANEER_EGG_BHURJI: {
    // Real paneer-anda-bhurji (Punjabi dhaba style). Trimmed from the
    // pre-10.2 six-vegetable kitchen-sink composition to just onion + tomato
    // + optional capsicum, which is how the dish is actually cooked.
    id: "PANEER_EGG_BHURJI",
    name: { hi: "पनीर अंडा भुर्जी", en: "Paneer Anda Bhurji" },
    compatibleFoods: ["EGG", "PANEER", "GHEE", "ONION", "TOMATO", "CAPSICUM"],
    requiredRanges: { EGG: { min: 2, max: 4 }, PANEER: { min: 60, max: 150 } },
    dietTags: ["eggetarian"],
    steps: {
      hi: ["घी में जीरा, हींग — हरी मिर्च — 15 सेकंड", "प्याज 2 मिनट सुनहरा", "टमाटर — हल्दी, लाल मिर्च — 2 मिनट तेल छूटने तक", "अंडे फोड़ें — भुर्जी बनाएं — 1 मिनट", "पनीर क्रम्बल — 1 मिनट — हरा धनिया — परोसें"],
      en: ["Ghee — cumin, asafoetida — green chilli — 15 sec", "Onion 2 min golden", "Tomato — turmeric, red chilli — 2 min until oil separates", "Crack eggs — scramble — 1 min", "Crumble paneer — 1 min — coriander — serve"],
    },
  },

  EGG_PANEER_MASALA: {
    // Anda masala with a few paneer cubes as secondary protein. Cream
    // removed (anda masala isn't a creamy gravy — that conflates it with
    // shahi paneer). Spinach removed from compatibleFoods.
    id: "EGG_PANEER_MASALA",
    name: { hi: "अंडा पनीर मसाला", en: "Egg Paneer Masala" },
    compatibleFoods: ["EGG", "PANEER", "GHEE", "TOMATO", "ONION"],
    requiredRanges: { EGG: { min: 2, max: 4 }, PANEER: { min: 50, max: 120 } },
    dietTags: ["eggetarian"],
    steps: {
      hi: ["अंडे 10 मिनट उबालें — छीलें — आधे काटें", "घी में जीरा, तेज़पत्ता", "प्याज 3 मिनट गहरा सुनहरा", "अदरक-लहसुन पेस्ट — 1 मिनट", "टमाटर — हल्दी, लाल मिर्च, धनिया, गरम मसाला — 3 मिनट तेल छूटने तक", "पानी — 2 मिनट उबालें", "पनीर क्यूब्स — 1 मिनट — अंडे डालें कटे हुए चेहरे ऊपर — 2 मिनट धीमी आंच", "हरा धनिया — परोसें"],
      en: ["Boil eggs 10 min — peel — halve", "Ghee — cumin, bay leaf", "Onion 3 min deep golden", "Ginger-garlic paste — 1 min", "Tomato — turmeric, red chilli, coriander, garam masala — 3 min until oil separates", "Water — simmer 2 min", "Paneer cubes — 1 min — add eggs cut-face up — 2 min low flame", "Coriander — serve"],
    },
  },

  METHI_PANEER_BHURJI: {
    // Genuine Punjabi combo (methi + paneer + egg bhurji). Kept mostly as-is.
    id: "METHI_PANEER_BHURJI",
    name: { hi: "मेथी पनीर भुर्जी", en: "Methi Paneer Bhurji with Egg" },
    compatibleFoods: ["EGG", "PANEER", "GHEE", "METHI", "TOMATO", "ONION"],
    requiredRanges: { EGG: { min: 2, max: 3 }, PANEER: { min: 60, max: 120 }, METHI: { min: 40, max: 100 } },
    dietTags: ["eggetarian"],
    steps: {
      hi: ["घी में जीरा, हींग — 15 सेकंड", "प्याज 2 मिनट — अदरक-लहसुन 1 मिनट", "मेथी पत्तियां — एक चुटकी नमक — 2 मिनट मुरझाने तक", "टमाटर — हल्दी, लाल मिर्च, धनिया — 2 मिनट", "अंडे फोड़ें — भुर्जी बनाएं", "पनीर क्रम्बल — 1 मिनट — कसूरी मेथी — परोसें"],
      en: ["Ghee — cumin, asafoetida — 15 sec", "Onion 2 min — ginger-garlic 1 min", "Methi leaves — pinch salt — 2 min until wilted", "Tomato — turmeric, red chilli, coriander — 2 min", "Crack eggs — scramble", "Crumble paneer — 1 min — kasuri methi — serve"],
    },
  },

  ANDHRA_EGG_MASALA: {
    // Real Andhra anda masala is eggs in a spicy onion-tomato gravy — no
    // paneer (paneer is a North Indian ingredient; Andhra cooking has its
    // own protein tradition built around eggs, chicken, and lentils).
    // Capsicum also dropped; not traditional.
    id: "ANDHRA_EGG_MASALA",
    name: { hi: "आंध्रा अंडा मसाला", en: "Andhra Egg Masala" },
    compatibleFoods: ["EGG", "GHEE", "TOMATO", "ONION"],
    requiredRanges: { EGG: { min: 3, max: 5 } },
    dietTags: ["eggetarian"],
    steps: {
      hi: ["अंडे 10 मिनट उबालें — छीलें — कांटे से हल्के से कोचें", "घी में सरसों, करी पत्ता, सूखी लाल मिर्च, मेथी दाना — 15 सेकंड", "प्याज 4 मिनट गहरा सुनहरा", "अदरक-लहसुन पेस्ट — 1 मिनट", "टमाटर — हल्दी, खूब लाल मिर्च (आंध्रा तीखापन), धनिया — 4 मिनट तेल छूटने तक", "पानी — उबाल — अंडे डालें — 5 मिनट धीमी आंच मसाला अंडों पर चढ़े", "करी पत्ता — परोसें"],
      en: ["Boil eggs 10 min — peel — prick lightly with fork", "Ghee — mustard, curry leaves, dry red chilli, fenugreek seeds — 15 sec", "Onion 4 min deep golden", "Ginger-garlic paste — 1 min", "Tomato — turmeric, generous red chilli (Andhra heat), coriander — 4 min until oil separates", "Water — boil — add eggs — 5 min low flame so masala coats eggs", "Curry leaves — serve"],
    },
  },

  EGG_MUSHROOM_STIR_FRY: {
    // Indian-kitchen egg-mushroom stir-fry. Paneer removed (it dilutes the
    // dish without adding anything). Soy sauce removed — that was an
    // Indo-Chinese touch that doesn't belong here.
    id: "EGG_MUSHROOM_STIR_FRY",
    name: { hi: "अंडा मशरूम स्टर फ्राई", en: "Egg Mushroom Stir-Fry" },
    compatibleFoods: ["EGG", "GHEE", "MUSHROOM", "CAPSICUM", "ONION"],
    requiredRanges: { EGG: { min: 2, max: 4 }, MUSHROOM: { min: 100, max: 200 } },
    dietTags: ["eggetarian"],
    steps: {
      hi: ["घी गरम — मशरूम तेज़ आंच — सुनहरा और पानी सूखने तक 4 मिनट — अलग रखें", "उसी घी में प्याज, शिमला मिर्च — 2 मिनट हल्के कुरकुरे", "अदरक-लहसुन — 30 सेकंड", "अंडे फोड़ें — फेंटें नहीं — हल्के स्क्रैंबल", "मशरूम वापस — काली मिर्च — नमक — 1 मिनट", "हरा धनिया — परोसें"],
      en: ["Hot ghee — mushrooms on high heat — golden and dry, 4 min — set aside", "Same ghee — onion, capsicum — 2 min lightly crisp", "Ginger-garlic — 30 sec", "Crack eggs — don't beat — soft scramble", "Return mushrooms — black pepper — salt — 1 min", "Coriander — serve"],
    },
  },

  PALAK_PANEER_EGGS: {
    // Saag with poached eggs — paneer dropped (PALAK_PANEER_VEG covers
    // the paneer version; this is now a distinct dish, saag-anda).
    // Cream also dropped — saag-anda is a homely dish, not a restaurant
    // gravy. Eggs poach directly in the saag in the final step.
    id: "PALAK_PANEER_EGGS",
    name: { hi: "पालक अंडा", en: "Saag Anda (Spinach with Poached Eggs)" },
    compatibleFoods: ["EGG", "GHEE", "SPINACH", "ONION", "TOMATO"],
    requiredRanges: { EGG: { min: 2, max: 4 }, SPINACH: { min: 150, max: 300 } },
    dietTags: ["eggetarian"],
    steps: {
      hi: ["पालक उबलते पानी में 2 मिनट — ठंडे पानी में डालें — हल्के से पीसें (दानेदार रखें)", "घी में जीरा — 15 सेकंड", "प्याज 3 मिनट सुनहरा — अदरक-लहसुन 1 मिनट", "टमाटर — हल्दी, लाल मिर्च, धनिया — 2 मिनट", "पालक डालें — 3 मिनट धीमी आंच", "बीच में जगह बनाएं — अंडे फोड़ें (पोच) — ढककर 4 मिनट सफ़ेदी जमने तक", "गरम परोसें"],
      en: ["Blanch spinach 2 min — shock in cold water — chop coarse (don't fully purée)", "Ghee — cumin — 15 sec", "Onion 3 min golden — ginger-garlic 1 min", "Tomato — turmeric, red chilli, coriander — 2 min", "Add spinach — 3 min low flame", "Make wells — crack eggs in (to poach) — cover 4 min until whites set", "Serve hot"],
    },
  },

  BAINGAN_EGG_BHARTA: {
    // Bharta with eggs cracked into wells. Paneer dropped — bharta has no
    // dairy in any tradition; mustard oil and smoke are its identity.
    id: "BAINGAN_EGG_BHARTA",
    name: { hi: "बैंगन अंडा भरता", en: "Baingan Bharta with Eggs" },
    compatibleFoods: ["EGG", "GHEE", "BAINGAN", "ONION", "TOMATO"],
    requiredRanges: { EGG: { min: 2, max: 4 }, BAINGAN: { min: 200, max: 400 } },
    dietTags: ["eggetarian"],
    steps: {
      hi: ["बैंगन सीधे आंच पर भूनें — सब तरफ काला — 10 मिनट", "ठंडा करें — छीलें — मोटा मैश करें (बारीक नहीं)", "घी में जीरा — हींग", "प्याज 3 मिनट गहरा सुनहरा", "अदरक-लहसुन-हरी मिर्च — 1 मिनट", "टमाटर — हल्दी, लाल मिर्च — 3 मिनट तेल छूटने तक", "भरता मिलाएं — 3 मिनट", "बीच में जगह — अंडे फोड़ें — ढकें — 4 मिनट सफ़ेदी जमने तक", "हरा धनिया — परोसें"],
      en: ["Char baingan directly over flame — black all sides — 10 min", "Cool — peel — coarse mash (not fine)", "Ghee — cumin — asafoetida", "Onion 3 min deep golden", "Ginger-garlic-green chilli — 1 min", "Tomato — turmeric, red chilli — 3 min until oil separates", "Mix in bharta — 3 min", "Make wells — crack eggs — cover — 4 min until whites set", "Coriander — serve"],
    },
  },

  KARELA_EGG_PANEER: {
    // Reworked: Maharashtrian-style karela with eggs and peanut crumble.
    // Paneer dropped (doesn't complement karela's bitterness; competes).
    // PEANUT added — the traditional sweet-bitter-savoury balance for
    // karela uses peanut crumble + onion + jaggery, which is what makes
    // karela palatable to people who otherwise avoid it.
    // ID retained for mealGenerator.ts compatibility; name updated to
    // match what the dish actually is.
    id: "KARELA_EGG_PANEER",
    name: { hi: "करेला अंडा (महाराष्ट्रियन शैली)", en: "Karela Anda (Maharashtrian-style)" },
    compatibleFoods: ["EGG", "GHEE", "KARELA", "PEANUT", "ONION", "TOMATO"],
    requiredRanges: { EGG: { min: 2, max: 3 }, KARELA: { min: 100, max: 200 }, PEANUT: { min: 15, max: 30 } },
    dietTags: ["eggetarian"],
    steps: {
      hi: ["करेले पतले काटें — नमक लगाएं 15 मिनट — कड़वाहट निकालने पानी से धोएं — निचोड़ें", "मूंगफली सूखी तवे पर भूनें — छिलका रगड़कर निकालें — मोटा कूटें — अलग रखें", "घी में जीरा, सरसों, सौंफ", "प्याज 4 मिनट गहरा सुनहरा (कड़वाहट का संतुलन)", "करेले — 8 मिनट तेज़ आंच कुरकुरे होने तक", "टमाटर — हल्दी, लाल मिर्च, धनिया — 2 मिनट", "अंडे फोड़ें — भुर्जी बनाएं — 2 मिनट", "मूंगफली कूटी हुई — एक चुटकी गुड़ — मिलाएं — परोसें"],
      en: ["Slice karela thin — salt 15 min — rinse to reduce bitterness — squeeze", "Dry-roast peanuts on tawa — rub skins off — crush coarsely — set aside", "Ghee — cumin, mustard, fennel", "Onion 4 min deep golden (sweetness balances karela's bitterness)", "Karela — 8 min high heat until crisp", "Tomato — turmeric, red chilli, coriander — 2 min", "Crack eggs — scramble — 2 min", "Crushed peanuts — pinch of jaggery — fold in — serve"],
    },
  },

  // ── New eggetarian recipes (commit 10.2) ────────────────────────────────────

  MASALA_OMELETTE: {
    // The Indian breakfast omelette. Set (not scrambled) eggs with onion +
    // tomato + green chilli + coriander folded in. Distinct from anda
    // bhurji which is scrambled.
    id: "MASALA_OMELETTE",
    name: { hi: "मसाला ऑमलेट", en: "Masala Omelette" },
    compatibleFoods: ["EGG", "GHEE", "ONION", "TOMATO"],
    requiredRanges: { EGG: { min: 2, max: 4 } },
    dietTags: ["eggetarian"],
    steps: {
      hi: ["अंडे एक कटोरे में फेंटें — नमक, काली मिर्च, हल्दी एक चुटकी", "बारीक कटा प्याज, टमाटर, हरी मिर्च, धनिया मिलाएं", "तवा गरम — घी — मिश्रण डालें फैलाएं", "धीमी आंच — किनारे जमने तक 2 मिनट", "एक तरफ से उठाकर पलटें — 30 सेकंड — मोड़कर परोसें"],
      en: ["Whisk eggs in a bowl — salt, black pepper, pinch of turmeric", "Stir in finely chopped onion, tomato, green chilli, coriander", "Hot tawa — ghee — pour mixture and spread", "Low flame — until edges set, 2 min", "Lift one edge and flip — 30 sec — fold and serve"],
    },
  },

  ANDA_CURRY: {
    // The real "anda masala" — boiled eggs in onion-tomato gravy, no
    // paneer. (EGG_PANEER_MASALA above keeps a few paneer cubes as a
    // secondary protein; this one is pure anda curry.) Standard North
    // Indian household preparation.
    id: "ANDA_CURRY",
    name: { hi: "अंडा करी", en: "Anda Curry" },
    compatibleFoods: ["EGG", "GHEE", "TOMATO", "ONION"],
    requiredRanges: { EGG: { min: 3, max: 5 } },
    dietTags: ["eggetarian"],
    steps: {
      hi: ["अंडे 10 मिनट उबालें — छीलें — हल्के से स्कोर करें (मसाला अंदर जाने के लिए)", "घी में जीरा, तेज़पत्ता, लौंग", "प्याज पीसकर — 4 मिनट गहरा सुनहरा", "अदरक-लहसुन पेस्ट — 1 मिनट", "टमाटर पीसकर — हल्दी, लाल मिर्च, धनिया पाउडर, गरम मसाला — 4 मिनट तेल छूटने तक", "पानी — उबाल आने तक", "अंडे डालें — 6 मिनट धीमी आंच मसाला चढ़ने तक — हरा धनिया — परोसें"],
      en: ["Boil eggs 10 min — peel — score lightly (so masala penetrates)", "Ghee — cumin, bay leaf, clove", "Pureed onion — 4 min deep golden", "Ginger-garlic paste — 1 min", "Pureed tomato — turmeric, red chilli, coriander powder, garam masala — 4 min until oil separates", "Water — bring to boil", "Add eggs — 6 min low flame so masala coats — coriander — serve"],
    },
  },

  PANEER_BHURJI: {
    // Pure paneer bhurji — no eggs. Distinct from PANEER_EGG_BHURJI (which
    // is paneer + egg both crumbled). This is the simpler everyday version.
    id: "PANEER_BHURJI",
    name: { hi: "पनीर भुर्जी", en: "Paneer Bhurji" },
    compatibleFoods: ["PANEER", "GHEE", "ONION", "TOMATO", "CAPSICUM"],
    requiredRanges: { PANEER: { min: 100, max: 200 } },
    // Note: contains no eggs, but tagged eggetarian rather than veg because
    // it sits in the eggetarian recipe block stylistically and the pure-veg
    // PALAK_PANEER_VEG already covers a paneer dish for veg users. A future
    // commit could move this to veg-tagged; defer to the registry-cleanup
    // pass after commit 11.
    dietTags: ["eggetarian"],
    steps: {
      hi: ["पनीर हल्के हाथ से क्रम्बल करें", "घी में जीरा, हींग, हरी मिर्च — 15 सेकंड", "प्याज 2 मिनट सुनहरा", "शिमला मिर्च (वैकल्पिक) — 1 मिनट", "टमाटर — हल्दी, लाल मिर्च, धनिया — 2 मिनट तेल छूटने तक", "पनीर क्रम्बल — मिलाएं — 2 मिनट धीमी आंच (ज़्यादा न पकाएं — पनीर रबर हो जाता है)", "कसूरी मेथी — हरा धनिया — परोसें"],
      en: ["Crumble paneer gently by hand", "Ghee — cumin, asafoetida, green chilli — 15 sec", "Onion 2 min golden", "Capsicum (optional) — 1 min", "Tomato — turmeric, red chilli, coriander — 2 min until oil separates", "Add paneer crumble — fold — 2 min low flame (don't overcook — paneer turns rubbery)", "Kasuri methi — coriander — serve"],
    },
  },

  MATAR_PANEER: {
    // Mid-carb dish (peas at 12g carb/100g) — suited to BALANCED and
    // LOW_CARB modes, not keto. Standard Punjabi home preparation.
    id: "MATAR_PANEER",
    name: { hi: "मटर पनीर", en: "Matar Paneer" },
    compatibleFoods: ["PANEER", "MUTTER", "GHEE", "TOMATO", "ONION"],
    requiredRanges: { PANEER: { min: 80, max: 150 }, MUTTER: { min: 60, max: 120 } },
    dietTags: ["eggetarian"],
    steps: {
      hi: ["पनीर क्यूब्स काटें — हल्के से घी में सेकें (वैकल्पिक) — अलग रखें", "घी में जीरा, तेज़पत्ता", "प्याज पीसकर — 4 मिनट गहरा सुनहरा", "अदरक-लहसुन पेस्ट — 1 मिनट", "टमाटर पीसकर — हल्दी, लाल मिर्च, धनिया, गरम मसाला — 4 मिनट", "(वैकल्पिक: 5-6 काजू भिगोकर पीसकर डालें गाढ़ी ग्रेवी के लिए)", "पानी — उबाल — मटर डालें — 5 मिनट धीमी आंच", "पनीर डालें — 2 मिनट (ज़्यादा न पकाएं)", "कसूरी मेथी — परोसें"],
      en: ["Cube paneer — lightly pan-fry in ghee (optional) — set aside", "Ghee — cumin, bay leaf", "Pureed onion — 4 min deep golden", "Ginger-garlic paste — 1 min", "Pureed tomato — turmeric, red chilli, coriander, garam masala — 4 min", "(Optional: 5-6 cashews soaked and ground, added now for a richer gravy)", "Water — boil — add mutter — 5 min low flame", "Add paneer — 2 min (don't overcook)", "Kasuri methi — serve"],
    },
  },

  KADHAI_PANEER: {
    // Dry-ish paneer with capsicum in a tomato-onion kadhai masala. Coarser
    // textured than matar paneer's smooth gravy. A semi-dry restaurant
    // staple but the home version skips the cream — built around the
    // freshly-pounded coriander seed + cumin seed + dry red chilli masala.
    id: "KADHAI_PANEER",
    name: { hi: "कढ़ाई पनीर", en: "Kadhai Paneer" },
    compatibleFoods: ["PANEER", "CAPSICUM", "GHEE", "TOMATO", "ONION"],
    requiredRanges: { PANEER: { min: 100, max: 200 }, CAPSICUM: { min: 80, max: 150 } },
    dietTags: ["eggetarian"],
    steps: {
      hi: ["कढ़ाई मसाला: साबुत धनिया, जीरा, सूखी लाल मिर्च, सौंफ — सूखी कढ़ाई में 30 सेकंड भूनें — मोटा कूटें", "पनीर मोटे लंबे टुकड़े काटें", "शिमला मिर्च लंबे टुकड़ों में", "घी गरम — प्याज लंबे कटे — 2 मिनट हल्के सुनहरे (कुरकुरापन रखें)", "अदरक-लहसुन — 30 सेकंड", "टमाटर मोटा कटा — 3 मिनट (पीसें नहीं — टुकड़े दिखें)", "कढ़ाई मसाला — हल्दी — 1 मिनट", "शिमला मिर्च — 2 मिनट तेज़ आंच", "पनीर — हल्के हाथ से मिलाएं — 2 मिनट", "कसूरी मेथी — हरा धनिया — परोसें"],
      en: ["Kadhai masala: whole coriander, cumin, dry red chilli, fennel — dry-roast in kadhai 30 sec — crush coarse", "Cube paneer in long pieces", "Capsicum in long strips", "Hot ghee — onion in long slices — 2 min light golden (keep crunch)", "Ginger-garlic — 30 sec", "Tomato roughly chopped — 3 min (don't purée — keep chunks)", "Kadhai masala — turmeric — 1 min", "Capsicum — 2 min high heat", "Paneer — fold gently — 2 min", "Kasuri methi — coriander — serve"],
    },
  },

  // ── Pure veg — dals and legumes (commit 10.1) ────────────────────────────────
  // Standard North Indian household preparations. No named-author content;
  // technique described in plain functional terms. compatibleFoods lists only
  // ingredients essentially always in the dish — aromatics like onion/tomato
  // are listed where they're part of the dish identity, omitted where they're
  // optional. dietTags ["veg"] makes these visible to all diets (veg ⊂
  // eggetarian ⊂ non-veg in the existing getRecipesForDiet filter).

  DAL_TADKA: {
    id: "DAL_TADKA",
    name: { hi: "दाल तड़का", en: "Dal Tadka" },
    // Any of the three light dals works; generator picks one.
    compatibleFoods: ["TOOR_DAL", "MOONG_DAL", "MASOOR_DAL", "GHEE", "ONION", "TOMATO"],
    requiredRanges: { TOOR_DAL: { min: 30, max: 80 }, MOONG_DAL: { min: 30, max: 80 }, MASOOR_DAL: { min: 30, max: 80 } },
    dietTags: ["veg"],
    steps: {
      hi: ["दाल धोएं — हल्दी, नमक, पानी — कुकर में 3 सीटी", "अलग कड़ाही में घी — जीरा, हींग — 15 सेकंड", "प्याज 2 मिनट सुनहरा — अदरक-लहसुन 1 मिनट", "टमाटर — लाल मिर्च, गरम मसाला — 2 मिनट तेल छूटने तक", "पकी दाल डालें — 2 मिनट उबालें — गाढ़ापन ठीक करें", "हरा धनिया — गरम परोसें"],
      en: ["Rinse dal — turmeric, salt, water — pressure-cook 3 whistles", "Separate pan — ghee — cumin, asafoetida — 15 sec", "Onion 2 min golden — ginger-garlic 1 min", "Tomato — red chilli, garam masala — 2 min until oil separates", "Add cooked dal — simmer 2 min — adjust consistency", "Coriander — serve hot"],
    },
  },

  DAL_MAKHANI_SIMPLE: {
    id: "DAL_MAKHANI_SIMPLE",
    name: { hi: "दाल मखनी (सादी)", en: "Dal Makhani (Simple)" },
    // Traditional dal makhani uses urad whole + rajma in roughly 3:1 ratio.
    // "Simple" = pressure-cooked, not the 8-hour slow simmer.
    compatibleFoods: ["URAD_WHOLE", "RAJMA", "GHEE", "ONION", "TOMATO", "CREAM"],
    requiredRanges: { URAD_WHOLE: { min: 30, max: 70 }, RAJMA: { min: 10, max: 25 } },
    dietTags: ["veg"],
    steps: {
      hi: ["उड़द और राजमा रात भर भिगोएं", "हल्दी, नमक, पानी — कुकर में 5-6 सीटी — गला तक पकाएं", "अलग कड़ाही में घी — जीरा — प्याज 3 मिनट गहरा सुनहरा", "अदरक-लहसुन पेस्ट — 1 मिनट", "टमाटर पीसकर — मसाले — 4 मिनट", "पकी दाल डालें — 8 मिनट धीमी आंच — मसलें", "क्रीम — कसूरी मेथी — परोसें"],
      en: ["Soak urad and rajma overnight", "Turmeric, salt, water — pressure-cook 5-6 whistles until very soft", "Separate pan — ghee — cumin — onion 3 min deep golden", "Ginger-garlic paste — 1 min", "Pureed tomato — spices — 4 min", "Add cooked dal — 8 min low flame — mash partially", "Swirl cream — kasuri methi — serve"],
    },
  },

  CHANA_MASALA: {
    id: "CHANA_MASALA",
    name: { hi: "छोले / चना मसाला", en: "Chana Masala" },
    compatibleFoods: ["CHANA_WHOLE", "GHEE", "ONION", "TOMATO"],
    requiredRanges: { CHANA_WHOLE: { min: 40, max: 100 } },
    dietTags: ["veg"],
    steps: {
      hi: ["चना रात भर भिगोएं — हल्दी, नमक — कुकर में 4-5 सीटी", "घी में जीरा, तेज़पत्ता", "प्याज 3 मिनट गहरा सुनहरा", "अदरक-लहसुन पेस्ट — 1 मिनट", "टमाटर — लाल मिर्च, धनिया पाउडर, अनारदाना — 3 मिनट", "पका चना — पानी — 8 मिनट उबालें", "गरम मसाला — हरा धनिया — परोसें"],
      en: ["Soak chana overnight — turmeric, salt — pressure-cook 4-5 whistles", "Ghee — cumin, bay leaf", "Onion 3 min deep golden", "Ginger-garlic paste — 1 min", "Tomato — red chilli, coriander powder, anardana — 3 min", "Cooked chana — water — simmer 8 min", "Garam masala — coriander — serve"],
    },
  },

  KAALE_CHANE: {
    id: "KAALE_CHANE",
    name: { hi: "काले चने", en: "Kala Chana (Black Chickpeas)" },
    // Same FoodId as kabuli (CHANA_WHOLE serves as IFCT proxy for both);
    // distinct recipe because kala chana is conventionally a thinner gravy
    // with different spicing (saunf, anardana absent, more cumin).
    compatibleFoods: ["CHANA_WHOLE", "GHEE", "ONION", "TOMATO"],
    requiredRanges: { CHANA_WHOLE: { min: 40, max: 100 } },
    dietTags: ["veg"],
    steps: {
      hi: ["काले चने रात भर भिगोएं — कुकर में हल्दी, नमक — 5 सीटी", "घी में जीरा भरपूर — हींग", "प्याज 2 मिनट — अदरक-लहसुन 1 मिनट", "टमाटर — लाल मिर्च, धनिया पाउडर — 2 मिनट", "पके चने — पानी पतला — 10 मिनट उबालें", "नींबू — हरा धनिया — परोसें"],
      en: ["Soak kala chana overnight — pressure-cook with turmeric, salt — 5 whistles", "Ghee — generous cumin — asafoetida", "Onion 2 min — ginger-garlic 1 min", "Tomato — red chilli, coriander powder — 2 min", "Cooked chana — thin gravy — simmer 10 min", "Lemon — coriander — serve"],
    },
  },

  RAJMA_CURRY: {
    id: "RAJMA_CURRY",
    name: { hi: "राजमा", en: "Rajma Curry" },
    compatibleFoods: ["RAJMA", "GHEE", "ONION", "TOMATO"],
    requiredRanges: { RAJMA: { min: 40, max: 100 } },
    dietTags: ["veg"],
    steps: {
      hi: ["राजमा रात भर भिगोएं — कुकर में हल्दी, नमक — 5-6 सीटी गला तक", "घी में जीरा — तेज़पत्ता", "प्याज 3 मिनट गहरा सुनहरा", "अदरक-लहसुन पेस्ट — 1 मिनट", "टमाटर पीसकर — लाल मिर्च, धनिया, गरम मसाला — 4 मिनट तेल छूटने तक", "राजमा डालें — कुछ राजमा मसलें — 10 मिनट धीमी आंच", "हरा धनिया — परोसें"],
      en: ["Soak rajma overnight — pressure-cook with turmeric, salt — 5-6 whistles until soft", "Ghee — cumin, bay leaf", "Onion 3 min deep golden", "Ginger-garlic paste — 1 min", "Pureed tomato — red chilli, coriander, garam masala — 4 min until oil separates", "Add rajma — mash a few beans — 10 min low flame", "Coriander — serve"],
    },
  },

  // ── Pure veg — rice and breads ───────────────────────────────────────────────

  PLAIN_RICE: {
    id: "PLAIN_RICE",
    name: { hi: "सादे चावल", en: "Plain Rice" },
    compatibleFoods: ["RICE_WHITE_RAW"],
    requiredRanges: { RICE_WHITE_RAW: { min: 30, max: 80 } },
    dietTags: ["veg"],
    steps: {
      hi: ["चावल धोएं — 10 मिनट भिगोएं", "1:2 पानी — नमक — उबाल आने दें", "ढककर धीमी आंच — 12 मिनट", "5 मिनट दम — कांटे से अलग करें — परोसें"],
      en: ["Rinse rice — soak 10 min", "1:2 water — salt — bring to boil", "Cover — low flame — 12 min", "Rest 5 min — fluff with fork — serve"],
    },
  },

  JEERA_RICE: {
    id: "JEERA_RICE",
    name: { hi: "जीरा चावल", en: "Jeera Rice" },
    compatibleFoods: ["RICE_WHITE_RAW", "GHEE"],
    requiredRanges: { RICE_WHITE_RAW: { min: 30, max: 80 } },
    dietTags: ["veg"],
    steps: {
      hi: ["चावल धोएं — 10 मिनट भिगोएं", "घी में जीरा — तेज़पत्ता, लौंग, दालचीनी — 15 सेकंड", "चावल डालें — हल्के से भूनें — 1 मिनट", "1:2 गरम पानी — नमक — उबाल", "ढककर 12 मिनट धीमी आंच — 5 मिनट दम — परोसें"],
      en: ["Rinse rice — soak 10 min", "Ghee — cumin — bay leaf, clove, cinnamon — 15 sec", "Add rice — toast gently — 1 min", "1:2 hot water — salt — boil", "Cover — 12 min low flame — rest 5 min — serve"],
    },
  },

  PLAIN_ROTI: {
    id: "PLAIN_ROTI",
    name: { hi: "सादी रोटी", en: "Plain Roti" },
    // 25g atta per roti is the household standard (see cookingConversion.ts).
    compatibleFoods: ["ATTA"],
    requiredRanges: { ATTA: { min: 25, max: 100 } },
    dietTags: ["veg"],
    steps: {
      hi: ["आटा — पानी (60% मात्रा) — चुटकी नमक — मुलायम गूंदें", "10 मिनट ढककर रखें — फिर हल्का गूंदें", "लोई बेलें — सूखा आटा बहुत हल्का", "गरम तवा — एक तरफ 30 सेकंड — पलटें", "दूसरी तरफ बुलबुले उठें तक — सीधी आंच पर फुलाएं", "तुरंत परोसें"],
      en: ["Atta — water (60% by volume) — pinch salt — knead soft dough", "Rest covered 10 min — knead lightly again", "Roll out — minimal dry flour", "Hot tawa — 30 sec one side — flip", "Until bubbles form — puff over direct flame", "Serve immediately"],
    },
  },

  ALOO_PARATHA: {
    id: "ALOO_PARATHA",
    name: { hi: "आलू पराठा", en: "Aloo Paratha" },
    compatibleFoods: ["ATTA", "ALOO", "GHEE"],
    requiredRanges: { ATTA: { min: 30, max: 80 }, ALOO: { min: 60, max: 150 } },
    dietTags: ["veg"],
    steps: {
      hi: ["आलू उबालें — मैश करें — जीरा, हरी मिर्च, धनिया, अमचूर, नमक", "आटा मुलायम गूंदें — 10 मिनट रखें", "लोई में आलू भरें — सावधानी से बेलें", "गरम तवा — हर तरफ घी — सुनहरा कुरकुरा सेकें", "दही या मक्खन के साथ परोसें"],
      en: ["Boil potatoes — mash — cumin, green chilli, coriander, amchur, salt", "Knead soft dough — rest 10 min", "Stuff dough ball with aloo — roll carefully", "Hot tawa — ghee both sides — cook golden crisp", "Serve with curd or butter"],
    },
  },

  GOBHI_PARATHA: {
    id: "GOBHI_PARATHA",
    name: { hi: "गोभी पराठा", en: "Gobhi Paratha" },
    compatibleFoods: ["ATTA", "CAULIFLOWER", "GHEE"],
    requiredRanges: { ATTA: { min: 30, max: 80 }, CAULIFLOWER: { min: 80, max: 150 } },
    dietTags: ["veg"],
    steps: {
      hi: ["गोभी कद्दूकस — नमक लगाएं 5 मिनट — पानी निचोड़ें", "जीरा, अदरक-हरी मिर्च, धनिया, गरम मसाला मिलाएं", "आटा गूंदें — 10 मिनट रखें", "लोई में गोभी भरें — हल्के हाथ से बेलें", "गरम तवा — हर तरफ घी — सुनहरा सेकें", "दही या अचार के साथ परोसें"],
      en: ["Grate cauliflower — salt 5 min — squeeze water out", "Mix in cumin, ginger-chilli, coriander, garam masala", "Knead dough — rest 10 min", "Stuff with cauliflower — roll gently", "Hot tawa — ghee both sides — cook golden", "Serve with curd or pickle"],
    },
  },

  // ── Pure veg — paneer and sabzi ──────────────────────────────────────────────

  PALAK_PANEER_VEG: {
    id: "PALAK_PANEER_VEG",
    name: { hi: "पालक पनीर", en: "Palak Paneer (Vegetarian)" },
    // Distinct from PALAK_PANEER_EGGS — pure-veg, no eggs.
    compatibleFoods: ["PANEER", "SPINACH", "GHEE", "ONION", "TOMATO", "CREAM"],
    requiredRanges: { PANEER: { min: 80, max: 200 }, SPINACH: { min: 100, max: 250 } },
    dietTags: ["veg"],
    steps: {
      hi: ["पालक उबलते पानी में 2 मिनट — ठंडे पानी में डालें — पीसें", "घी में जीरा — प्याज 3 मिनट सुनहरा", "अदरक-लहसुन पेस्ट — 1 मिनट", "टमाटर — हल्दी, गरम मसाला — 2 मिनट", "पालक प्यूरी — 4 मिनट धीमी आंच", "पनीर क्यूब्स — 2 मिनट — क्रीम वैकल्पिक", "कसूरी मेथी — परोसें"],
      en: ["Blanch spinach 2 min — shock in cold water — purée", "Ghee — cumin — onion 3 min golden", "Ginger-garlic paste — 1 min", "Tomato — turmeric, garam masala — 2 min", "Spinach purée — 4 min low flame", "Paneer cubes — 2 min — cream optional", "Kasuri methi — serve"],
    },
  },

  ALOO_MUTTER: {
    id: "ALOO_MUTTER",
    name: { hi: "आलू मटर", en: "Aloo Mutter" },
    compatibleFoods: ["ALOO", "MUTTER", "GHEE", "ONION", "TOMATO"],
    requiredRanges: { ALOO: { min: 80, max: 200 }, MUTTER: { min: 50, max: 120 } },
    dietTags: ["veg"],
    steps: {
      hi: ["आलू छीलें — क्यूब्स काटें", "घी में जीरा, हींग — प्याज 2 मिनट सुनहरा", "अदरक-हरी मिर्च — 30 सेकंड", "टमाटर — हल्दी, लाल मिर्च, धनिया — 2 मिनट", "आलू और मटर डालें — 2 मिनट भूनें", "पानी — ढककर 15 मिनट धीमी आंच आलू नरम होने तक", "गरम मसाला — हरा धनिया — परोसें"],
      en: ["Peel and cube potatoes", "Ghee — cumin, asafoetida — onion 2 min golden", "Ginger-green chilli — 30 sec", "Tomato — turmeric, red chilli, coriander — 2 min", "Add aloo and mutter — 2 min toss", "Water — covered 15 min low flame until potato tender", "Garam masala — coriander — serve"],
    },
  },

  ALOO_GOBHI: {
    id: "ALOO_GOBHI",
    name: { hi: "आलू गोभी", en: "Aloo Gobhi" },
    compatibleFoods: ["ALOO", "CAULIFLOWER", "GHEE", "ONION", "TOMATO"],
    requiredRanges: { ALOO: { min: 80, max: 200 }, CAULIFLOWER: { min: 100, max: 250 } },
    dietTags: ["veg"],
    steps: {
      hi: ["आलू और गोभी मध्यम टुकड़ों में काटें", "घी में जीरा, हींग — 15 सेकंड", "प्याज 2 मिनट — अदरक-हरी मिर्च — 30 सेकंड", "हल्दी, लाल मिर्च, धनिया पाउडर — 30 सेकंड", "आलू-गोभी — टमाटर — 3 मिनट भूनें", "ढककर 12 मिनट धीमी आंच — बीच में हिलाएं", "गरम मसाला — हरा धनिया — परोसें"],
      en: ["Cut aloo and gobhi into medium pieces", "Ghee — cumin, asafoetida — 15 sec", "Onion 2 min — ginger-green chilli — 30 sec", "Turmeric, red chilli, coriander powder — 30 sec", "Aloo-gobhi — tomato — 3 min toss", "Cover — 12 min low flame — stir once", "Garam masala — coriander — serve"],
    },
  },

  PHOOL_GOBHI_SABZI: {
    id: "PHOOL_GOBHI_SABZI",
    name: { hi: "फूल गोभी की सब्ज़ी", en: "Phool Gobhi Sabzi" },
    compatibleFoods: ["CAULIFLOWER", "GHEE", "ONION", "TOMATO"],
    requiredRanges: { CAULIFLOWER: { min: 120, max: 250 } },
    dietTags: ["veg"],
    steps: {
      hi: ["गोभी छोटे फूल — गरम पानी में 5 मिनट — छानें", "घी में जीरा, हींग — 15 सेकंड", "प्याज 2 मिनट — अदरक-हरी मिर्च 30 सेकंड", "टमाटर — हल्दी, लाल मिर्च — 2 मिनट", "गोभी डालें — 3 मिनट भूनें", "ढककर 8 मिनट धीमी आंच", "अमचूर — हरा धनिया — परोसें"],
      en: ["Small cauliflower florets — hot water 5 min — drain", "Ghee — cumin, asafoetida — 15 sec", "Onion 2 min — ginger-green chilli 30 sec", "Tomato — turmeric, red chilli — 2 min", "Add cauliflower — 3 min toss", "Cover — 8 min low flame", "Amchur — coriander — serve"],
    },
  },

  KATHAL_SABZI: {
    id: "KATHAL_SABZI",
    name: { hi: "कटहल की सब्ज़ी", en: "Kathal Sabzi" },
    // Raw/tender jackfruit (IFCT D051), not ripe. Cube and pressure-cook
    // briefly before final sauté for tender result.
    compatibleFoods: ["KATHAL", "GHEE", "ONION", "TOMATO"],
    requiredRanges: { KATHAL: { min: 150, max: 300 } },
    dietTags: ["veg"],
    steps: {
      hi: ["कटहल छीलें (हाथों पर तेल लगाएं) — मध्यम क्यूब्स — हल्दी, नमक के साथ कुकर में 1 सीटी", "घी में जीरा, सौंफ — 15 सेकंड", "प्याज 3 मिनट गहरा सुनहरा", "अदरक-लहसुन — 1 मिनट", "टमाटर — लाल मिर्च, धनिया, गरम मसाला — 3 मिनट", "कटहल — हल्के हाथ से मिलाएं — 5 मिनट धीमी आंच", "हरा धनिया — परोसें"],
      en: ["Peel kathal (oil hands first) — medium cubes — pressure-cook 1 whistle with turmeric, salt", "Ghee — cumin, fennel — 15 sec", "Onion 3 min deep golden", "Ginger-garlic — 1 min", "Tomato — red chilli, coriander, garam masala — 3 min", "Kathal — fold gently — 5 min low flame", "Coriander — serve"],
    },
  },

  KARELA_SABZI_VEG: {
    id: "KARELA_SABZI_VEG",
    name: { hi: "करेले की सब्ज़ी (सादी)", en: "Karela Sabzi (Vegetarian)" },
    // Distinct from KARELA_EGG_PANEER — pure-veg.
    compatibleFoods: ["KARELA", "GHEE", "ONION", "TOMATO"],
    requiredRanges: { KARELA: { min: 100, max: 200 } },
    dietTags: ["veg"],
    steps: {
      hi: ["करेले काटें — नमक लगाएं 15 मिनट — कड़वाहट निकालने पानी से धोएं — निचोड़ें", "घी में जीरा, सौंफ", "प्याज 4 मिनट गहरा सुनहरा", "करेले — 8 मिनट तेज़ आंच कुरकुरे होने तक", "टमाटर — हल्दी, लाल मिर्च, धनिया, अमचूर — 3 मिनट", "एक चुटकी गुड़ — परोसें"],
      en: ["Slice karela — salt 15 min — rinse to reduce bitterness — squeeze", "Ghee — cumin, fennel", "Onion 4 min deep golden", "Karela — 8 min high heat until crisp", "Tomato — turmeric, red chilli, coriander, amchur — 3 min", "Pinch of jaggery — serve"],
    },
  },

  POHA: {
    id: "POHA",
    name: { hi: "पोहा", en: "Poha" },
    // Quick breakfast — onion-poha style. Peanuts are conventional but
    // omitted (no PEANUT FoodId yet); will add when food DB covers nuts.
    compatibleFoods: ["POHA", "ONION", "MUTTER", "GHEE"],
    requiredRanges: { POHA: { min: 40, max: 80 } },
    dietTags: ["veg"],
    steps: {
      hi: ["पोहा छलनी में डालें — नल के नीचे 30 सेकंड भिगोएं — छानें — नमक, चीनी एक चुटकी — रखें", "घी में सरसों, करी पत्ता, हरी मिर्च — 30 सेकंड", "प्याज 2 मिनट — मटर (अगर) — 2 मिनट", "हल्दी — पोहा डालें — हल्के हाथ से मिलाएं — 2 मिनट ढककर भाप", "नींबू — हरा धनिया — गरम परोसें"],
      en: ["Poha in colander — rinse 30 sec under tap — drain — pinch salt and sugar — set aside", "Ghee — mustard seeds, curry leaves, green chilli — 30 sec", "Onion 2 min — mutter (if using) — 2 min", "Turmeric — add poha — fold gently — 2 min covered steam", "Lemon — coriander — serve hot"],
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
