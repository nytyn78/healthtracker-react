// ── mealGenerator.ts ────────────────────────────────────────────────────────────
// Generates a ComposedDayPlan matching the user's macro targets.
//
// Diet-aware: eggetarian uses eggs+paneer+whey. Non-veg rotates chicken/mutton/fish/prawns.
// 7-day variety guaranteed — no two consecutive days use the same protein source.
// Macros computed from ingredients upward — never stored as fixed values.
//
// ── Commit 11.3 — Mode-aware meal templates ──────────────────────────────────
// Previously, all 6 macro modes received the same keto-shaped rotation
// (paneer/egg/cauliflower). A BALANCED user on 130–200g carbs/day got correct
// macro targets from the engine but keto meal suggestions — no rice, no dal,
// no roti.
//
// 11.3 adds mode-keyed week rotations for every non-keto mode, backed by
// three new meal builders:
//
//   buildThaliMeal   — BALANCED. Dal + grain (rice or roti) + sabzi + protein.
//                      Thali-style: normal Indian meal composition.
//   buildDalMeal     — LOW_CARB. Dal as main protein source, 0–1 roti,
//                      generous vegetable, no rice. Pulse + vegetable.
//   buildRiceBowlMeal— RECOMPOSITION. Protein + cooked rice in one bowl.
//                      Carb-forward, pre/post workout framing.
//
// HIGH_PROTEIN_CUT uses the existing keto builders (same protein logic) with
// a distinct rotation that includes more egg whites and lighter recipes.
//
// Dispatch:
//   generateDayPlan (diet, mode) → resolveWeekRotation(diet, mode) → week[dayIndex]
//
// Ingredient quantities in all builders use RAW GRAM WEIGHTS, consistent with
// the entire foodDatabase.ts (all entries are per 1g raw). The cooking-conversion
// module (cookingConversion.ts) translates to cooked display on meal cards.
// E.g. 60g raw TOOR_DAL → 150g cooked dal → "1 katori dal" on the card.
//
// ⚠ STRUCTURAL DEBT — addressed in commit 11.4:
//   - Meal shape is still hardcoded to 2 meals + shake (IF 19:5 schedule).
//     BALANCED / RECOMP users who eat breakfast are served a 2-meal plan.
//     Decoupling meal count + meal times from macro mode is commit 11.4.
//
// Commit 11.0 added: macroMode threaded through to validateNutrition.
// Commit 11.1 added: pure-veg branch (buildVegMeal).
// Commit 11.2a added: dispatch by recipe.compatibleFoods; recipe ID renames.
// Commit 11.3 adds: mode-aware rotations + thali/dal/rice-bowl builders.

import type { ComposedDayPlan, ComposedMeal, ComposedIngredient, GeneratorTargets } from "./composedTypes"
import { validateNutrition } from "./constraintEngine"
import type { ValidationResult } from "./constraintEngine"
import { RECIPES } from "./recipeRegistry"
import type { MacroMode } from "./adaptiveTDEE"
import { type MealSchedule, LEGACY_IF_SCHEDULE } from "./mealSchedule"

// Re-export so callers can build schedules without a second import.
export { deriveMealSchedule, type MealSchedule } from "./mealSchedule"

// Re-export for callers that previously imported GeneratorTargets from here.
export type { GeneratorTargets } from "./composedTypes"

export type DietType = "eggetarian" | "non-veg" | "veg"

// ═════════════════════════════════════════════════════════════════════════════
// ── Week rotation types ──────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

// Keto/HPC meals: recipe-only slot (builder resolves ingredients from recipe).
type KetoSlot = { m1Recipe: string; m2Recipe: string }

// Non-veg keto meals additionally carry the protein FoodId (which protein
// source goes into the slot — chicken thigh vs breast vs mutton etc.)
type NonVegKetoSlot = KetoSlot & { m1FoodId: string; m2FoodId: string }

// Thali slot: dal FoodId + grain recipe + sabzi recipe + protein recipe.
// The builder reads these to compose a thali-style combined meal.
//
// dalFoodId    — one of the raw dal FoodIds (TOOR_DAL, MOONG_DAL, etc.)
// grainRecipe  — PLAIN_RICE, JEERA_RICE, PLAIN_ROTI — carb staple
// sabziRecipe  — ALOO_GOBHI, MATAR_PANEER, etc.
// proteinRecipe— optional extra protein dish (PANEER_BHURJI, ANDA_CURRY etc.)
//               when absent, dal + sabzi carry the protein
// mealName     — display name for the combined thali meal
type ThaliSlot = {
  kind:          "thali"
  dalFoodId:     string
  grainRecipe:   string
  sabziRecipe:   string
  proteinRecipe: string | null
  mealName:      { hi: string; en: string }
}

// Non-veg thali: same as ThaliSlot but protein recipe uses a meat source.
type NonVegThaliSlot = {
  kind:         "nonveg_thali"
  dalFoodId:    string | null    // some non-veg thalis skip dal (e.g. mutton chawal)
  grainRecipe:  string
  meatRecipe:   string
  meatFoodId:   string
  mealName:     { hi: string; en: string }
}

// Dal-meal slot: dal + optional small grain + vegetable (LOW_CARB).
// grainRecipe is null for days with no grain (pure dal+veg).
type DalMealSlot = {
  kind:        "dal_meal"
  dalFoodId:   string
  grainRecipe: string | null   // PLAIN_ROTI (1 roti) or null
  sabziRecipe: string
  mealName:    { hi: string; en: string }
}

// Rice bowl: protein + rice, RECOMP mode.
type RiceBowlSlot = {
  kind:       "rice_bowl"
  riceRecipe: string           // PLAIN_RICE or JEERA_RICE
  mainRecipe: string           // protein dish
  mealName:   { hi: string; en: string }
}

// Non-veg rice bowl: meat + rice
type NonVegRiceBowlSlot = {
  kind:       "nonveg_rice_bowl"
  riceRecipe: string
  meatRecipe: string
  meatFoodId: string
  mealName:   { hi: string; en: string }
}

type AnyMeal2Slot =
  | { kind: "keto";         slot: KetoSlot }
  | { kind: "nonveg_keto";  slot: NonVegKetoSlot }
  | ThaliSlot
  | NonVegThaliSlot
  | DalMealSlot
  | RiceBowlSlot
  | NonVegRiceBowlSlot

// ═════════════════════════════════════════════════════════════════════════════
// ── KETO / VERY_LOW_CARB rotations (unchanged from 11.2a) ───────────────────
// ═════════════════════════════════════════════════════════════════════════════

// Eggetarian week (commit 11.2a). Keto-compatible, unchanged.
const EGGETARIAN_WEEK: Array<KetoSlot> = [
  { m1Recipe: "PANEER_EGG_BHURJI",    m2Recipe: "ANDA_CURRY" },
  { m1Recipe: "ANDHRA_EGG_MASALA",    m2Recipe: "METHI_PANEER_BHURJI" },
  { m1Recipe: "MASALA_OMELETTE",      m2Recipe: "KADHAI_PANEER" },
  { m1Recipe: "SAAG_ANDA",            m2Recipe: "PANEER_BHURJI" },
  { m1Recipe: "ANDA_PANEER_MASALA",   m2Recipe: "BAINGAN_EGG_BHARTA" },
  { m1Recipe: "EGG_MUSHROOM_STIR_FRY",m2Recipe: "KARELA_ANDA" },
  { m1Recipe: "ANDA_CURRY",           m2Recipe: "PANEER_EGG_BHURJI" },
]

// Non-veg keto week. Unchanged from 11.2a.
const NON_VEG_WEEK: Array<NonVegKetoSlot> = [
  { m1Recipe: "CHICKEN_HANDI",       m2Recipe: "ANDA_PANEER_MASALA",  m1FoodId: "CHICKEN_THIGH",  m2FoodId: "EGG_PANEER" },
  { m1Recipe: "MUTTON_KEEMA_MASALA", m2Recipe: "CHICKEN_SAAG",        m1FoodId: "MUTTON_KEEMA",   m2FoodId: "CHICKEN_BREAST" },
  { m1Recipe: "PRAWN_MASALA",        m2Recipe: "CHICKEN_TIKKA_DRY",   m1FoodId: "PRAWNS",         m2FoodId: "CHICKEN_BREAST" },
  { m1Recipe: "CHICKEN_KALI_MIRCH",  m2Recipe: "MUTTON_KEEMA_PALAK",  m1FoodId: "CHICKEN_BREAST", m2FoodId: "MUTTON_KEEMA" },
  { m1Recipe: "FISH_CURRY_SIMPLE",   m2Recipe: "CHICKEN_HANDI",       m1FoodId: "FISH_ROHU",      m2FoodId: "CHICKEN_THIGH" },
  { m1Recipe: "CHICKEN_SAAG",        m2Recipe: "PRAWN_MASALA",        m1FoodId: "CHICKEN_BREAST", m2FoodId: "PRAWNS" },
  { m1Recipe: "MUTTON_KEEMA_PALAK",  m2Recipe: "CHICKEN_TIKKA_DRY",   m1FoodId: "MUTTON_KEEMA",   m2FoodId: "CHICKEN_BREAST" },
]

// Pure-veg keto week (commit 11.1). Unchanged.
const VEG_WEEK: Array<KetoSlot> = [
  { m1Recipe: "PALAK_PANEER_VEG", m2Recipe: "PANEER_BHURJI" },
  { m1Recipe: "KADHAI_PANEER",    m2Recipe: "PALAK_PANEER_VEG" },
  { m1Recipe: "PANEER_BHURJI",    m2Recipe: "KADHAI_PANEER" },
  { m1Recipe: "PALAK_PANEER_VEG", m2Recipe: "KADHAI_PANEER" },
  { m1Recipe: "PANEER_BHURJI",    m2Recipe: "PALAK_PANEER_VEG" },
  { m1Recipe: "KADHAI_PANEER",    m2Recipe: "PANEER_BHURJI" },
  { m1Recipe: "PALAK_PANEER_VEG", m2Recipe: "PANEER_BHURJI" },
]

// ═════════════════════════════════════════════════════════════════════════════
// ── BALANCED rotations (commit 11.3) ────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
// Thali-style: dal + grain + sabzi (+ optional protein dish).
// Dal rotates through the main Indian dals across the week.
// Grain alternates rice/roti. Sabzi gives vegetable variety.
//
// Raw dal gram weights in ThaliSlot / DalMealSlot / RiceBowlSlot are
// interpreted as UNCOOKED by the builders, consistent with the DB.
//   60g raw toor dal → 150g cooked (2.5× ratio) = 1 katori.
//   70g raw moong    → 175g cooked.
//   50g raw rice raw → 150g cooked (3.0× ratio) = 1 katori.
// The builders pass these raw weights to ComposedIngredient.quantity directly;
// cookingConversion.ts renders them in human units on meal cards.
//
// Protein split logic:
// In a BALANCED thali, protein comes from dal + paneer/egg + curd (dahi).
// Dal 60g raw ≈ 13g protein (toor) to 14.6g protein (masoor).
// The remaining protein target for the meal is met by the protein recipe.
// The builder sizes the protein dish accordingly.

// ── BALANCED eggetarian week ──────────────────────────────────────────────────
const BALANCED_EGGETARIAN_WEEK: Array<{ m1: ThaliSlot; m2: ThaliSlot }> = [
  // Mon: Toor dal + jeera rice / Paneer bhurji + roti
  {
    m1: {
      kind: "thali", dalFoodId: "TOOR_DAL", grainRecipe: "JEERA_RICE",
      sabziRecipe: "ALOO_GOBHI", proteinRecipe: null,
      mealName: { hi: "तूर दाल + जीरा चावल + आलू गोभी", en: "Toor Dal + Jeera Rice + Aloo Gobhi" },
    },
    m2: {
      kind: "thali", dalFoodId: "TOOR_DAL", grainRecipe: "PLAIN_ROTI",
      sabziRecipe: "PHOOL_GOBHI_SABZI", proteinRecipe: "PANEER_BHURJI",
      mealName: { hi: "पनीर भुर्जी + रोटी + गोभी सब्ज़ी", en: "Paneer Bhurji + Roti + Gobhi Sabzi" },
    },
  },
  // Tue: Masoor dal + roti / Anda curry + roti + veg
  {
    m1: {
      kind: "thali", dalFoodId: "MASOOR_DAL", grainRecipe: "PLAIN_ROTI",
      sabziRecipe: "ALOO_MUTTER", proteinRecipe: null,
      mealName: { hi: "मसूर दाल + रोटी + आलू मटर", en: "Masoor Dal + Roti + Aloo Mutter" },
    },
    m2: {
      kind: "thali", dalFoodId: "MASOOR_DAL", grainRecipe: "PLAIN_ROTI",
      sabziRecipe: "KARELA_SABZI_VEG", proteinRecipe: "ANDA_CURRY",
      mealName: { hi: "अंडा करी + रोटी + करेला सब्ज़ी", en: "Anda Curry + Roti + Karela Sabzi" },
    },
  },
  // Wed: Rajma chawal / Masala omelette + roti + palak
  {
    m1: {
      kind: "thali", dalFoodId: "RAJMA", grainRecipe: "PLAIN_RICE",
      sabziRecipe: "PHOOL_GOBHI_SABZI", proteinRecipe: null,
      mealName: { hi: "राजमा चावल + गोभी सब्ज़ी", en: "Rajma Chawal + Gobhi Sabzi" },
    },
    m2: {
      kind: "thali", dalFoodId: "MASOOR_DAL", grainRecipe: "PLAIN_ROTI",
      sabziRecipe: "PALAK_PANEER_VEG", proteinRecipe: "MASALA_OMELETTE",
      mealName: { hi: "मसाला ऑमलेट + रोटी + पालक पनीर", en: "Masala Omelette + Roti + Palak Paneer" },
    },
  },
  // Thu: Moong dal + rice / Kadhai paneer + roti
  {
    m1: {
      kind: "thali", dalFoodId: "MOONG_DAL", grainRecipe: "JEERA_RICE",
      sabziRecipe: "ALOO_GOBHI", proteinRecipe: null,
      mealName: { hi: "मूंग दाल + जीरा चावल + आलू गोभी", en: "Moong Dal + Jeera Rice + Aloo Gobhi" },
    },
    m2: {
      kind: "thali", dalFoodId: "MOONG_DAL", grainRecipe: "PLAIN_ROTI",
      sabziRecipe: "ALOO_MUTTER", proteinRecipe: "KADHAI_PANEER",
      mealName: { hi: "कड़ाई पनीर + रोटी + आलू मटर", en: "Kadhai Paneer + Roti + Aloo Mutter" },
    },
  },
  // Fri: Chana masala + rice / Anda paneer masala + roti
  {
    m1: {
      kind: "thali", dalFoodId: "CHANA_WHOLE", grainRecipe: "PLAIN_RICE",
      sabziRecipe: "ALOO_GOBHI", proteinRecipe: "CHANA_MASALA",
      mealName: { hi: "छोले चावल + आलू गोभी", en: "Chana Masala Rice + Aloo Gobhi" },
    },
    m2: {
      kind: "thali", dalFoodId: "TOOR_DAL", grainRecipe: "PLAIN_ROTI",
      sabziRecipe: "PHOOL_GOBHI_SABZI", proteinRecipe: "ANDA_PANEER_MASALA",
      mealName: { hi: "अंडा पनीर मसाला + रोटी + गोभी", en: "Anda Paneer Masala + Roti + Gobhi" },
    },
  },
  // Sat: Dal makhani + roti / Paneer egg bhurji + rice
  {
    m1: {
      kind: "thali", dalFoodId: "URAD_WHOLE", grainRecipe: "PLAIN_ROTI",
      sabziRecipe: "ALOO_MUTTER", proteinRecipe: "DAL_MAKHANI_SIMPLE",
      mealName: { hi: "दाल मखनी + रोटी + आलू मटर", en: "Dal Makhani + Roti + Aloo Mutter" },
    },
    m2: {
      kind: "thali", dalFoodId: "MASOOR_DAL", grainRecipe: "JEERA_RICE",
      sabziRecipe: "KARELA_SABZI_VEG", proteinRecipe: "PANEER_EGG_BHURJI",
      mealName: { hi: "पनीर एग भुर्जी + जीरा चावल + करेला", en: "Paneer Egg Bhurji + Jeera Rice + Karela" },
    },
  },
  // Sun: Toor dal + rice / Matar paneer + roti
  {
    m1: {
      kind: "thali", dalFoodId: "TOOR_DAL", grainRecipe: "PLAIN_RICE",
      sabziRecipe: "ALOO_GOBHI", proteinRecipe: null,
      mealName: { hi: "दाल चावल + आलू गोभी", en: "Dal Chawal + Aloo Gobhi" },
    },
    m2: {
      kind: "thali", dalFoodId: "MOONG_DAL", grainRecipe: "PLAIN_ROTI",
      sabziRecipe: "KATHAL_SABZI", proteinRecipe: "MATAR_PANEER",
      mealName: { hi: "मटर पनीर + रोटी + कटहल सब्ज़ी", en: "Matar Paneer + Roti + Kathal Sabzi" },
    },
  },
]

// ── BALANCED pure-veg week ─────────────────────────────────────────────────────
// Same structure but no egg protein recipes.
const BALANCED_VEG_WEEK: Array<{ m1: ThaliSlot; m2: ThaliSlot }> = [
  {
    m1: {
      kind: "thali", dalFoodId: "TOOR_DAL", grainRecipe: "JEERA_RICE",
      sabziRecipe: "ALOO_GOBHI", proteinRecipe: null,
      mealName: { hi: "तूर दाल + जीरा चावल + आलू गोभी", en: "Toor Dal + Jeera Rice + Aloo Gobhi" },
    },
    m2: {
      kind: "thali", dalFoodId: "TOOR_DAL", grainRecipe: "PLAIN_ROTI",
      sabziRecipe: "PALAK_PANEER_VEG", proteinRecipe: "PANEER_BHURJI",
      mealName: { hi: "पनीर भुर्जी + रोटी + पालक पनीर", en: "Paneer Bhurji + Roti + Palak Paneer" },
    },
  },
  {
    m1: {
      kind: "thali", dalFoodId: "MASOOR_DAL", grainRecipe: "PLAIN_ROTI",
      sabziRecipe: "ALOO_MUTTER", proteinRecipe: null,
      mealName: { hi: "मसूर दाल + रोटी + आलू मटर", en: "Masoor Dal + Roti + Aloo Mutter" },
    },
    m2: {
      kind: "thali", dalFoodId: "MASOOR_DAL", grainRecipe: "PLAIN_ROTI",
      sabziRecipe: "KARELA_SABZI_VEG", proteinRecipe: "KADHAI_PANEER",
      mealName: { hi: "कड़ाई पनीर + रोटी + करेला सब्ज़ी", en: "Kadhai Paneer + Roti + Karela Sabzi" },
    },
  },
  {
    m1: {
      kind: "thali", dalFoodId: "RAJMA", grainRecipe: "PLAIN_RICE",
      sabziRecipe: "PHOOL_GOBHI_SABZI", proteinRecipe: null,
      mealName: { hi: "राजमा चावल + गोभी सब्ज़ी", en: "Rajma Chawal + Gobhi Sabzi" },
    },
    m2: {
      kind: "thali", dalFoodId: "MOONG_DAL", grainRecipe: "PLAIN_ROTI",
      sabziRecipe: "PALAK_PANEER_VEG", proteinRecipe: "MATAR_PANEER",
      mealName: { hi: "मटर पनीर + रोटी + पालक", en: "Matar Paneer + Roti + Palak" },
    },
  },
  {
    m1: {
      kind: "thali", dalFoodId: "MOONG_DAL", grainRecipe: "JEERA_RICE",
      sabziRecipe: "ALOO_GOBHI", proteinRecipe: null,
      mealName: { hi: "मूंग दाल + जीरा चावल + आलू गोभी", en: "Moong Dal + Jeera Rice + Aloo Gobhi" },
    },
    m2: {
      kind: "thali", dalFoodId: "MOONG_DAL", grainRecipe: "PLAIN_ROTI",
      sabziRecipe: "ALOO_MUTTER", proteinRecipe: "KADHAI_PANEER",
      mealName: { hi: "कड़ाई पनीर + रोटी + आलू मटर", en: "Kadhai Paneer + Roti + Aloo Mutter" },
    },
  },
  {
    m1: {
      kind: "thali", dalFoodId: "CHANA_WHOLE", grainRecipe: "PLAIN_RICE",
      sabziRecipe: "ALOO_GOBHI", proteinRecipe: "CHANA_MASALA",
      mealName: { hi: "छोले चावल + आलू गोभी", en: "Chana Masala Rice + Aloo Gobhi" },
    },
    m2: {
      kind: "thali", dalFoodId: "TOOR_DAL", grainRecipe: "PLAIN_ROTI",
      sabziRecipe: "PHOOL_GOBHI_SABZI", proteinRecipe: "PALAK_PANEER_VEG",
      mealName: { hi: "पालक पनीर + रोटी + गोभी", en: "Palak Paneer + Roti + Gobhi Sabzi" },
    },
  },
  {
    m1: {
      kind: "thali", dalFoodId: "URAD_WHOLE", grainRecipe: "PLAIN_ROTI",
      sabziRecipe: "ALOO_MUTTER", proteinRecipe: "DAL_MAKHANI_SIMPLE",
      mealName: { hi: "दाल मखनी + रोटी + आलू मटर", en: "Dal Makhani + Roti + Aloo Mutter" },
    },
    m2: {
      kind: "thali", dalFoodId: "MASOOR_DAL", grainRecipe: "JEERA_RICE",
      sabziRecipe: "KATHAL_SABZI", proteinRecipe: "MATAR_PANEER",
      mealName: { hi: "मटर पनीर + जीरा चावल + कटहल", en: "Matar Paneer + Jeera Rice + Kathal" },
    },
  },
  {
    m1: {
      kind: "thali", dalFoodId: "TOOR_DAL", grainRecipe: "PLAIN_RICE",
      sabziRecipe: "ALOO_GOBHI", proteinRecipe: null,
      mealName: { hi: "दाल चावल + आलू गोभी", en: "Dal Chawal + Aloo Gobhi" },
    },
    m2: {
      kind: "thali", dalFoodId: "MOONG_DAL", grainRecipe: "PLAIN_ROTI",
      sabziRecipe: "KARELA_SABZI_VEG", proteinRecipe: "KADHAI_PANEER",
      mealName: { hi: "कड़ाई पनीर + रोटी + करेला", en: "Kadhai Paneer + Roti + Karela" },
    },
  },
]

// ── BALANCED non-veg week ──────────────────────────────────────────────────────
// Dal + rice/roti + a proper curry (chicken/mutton/fish). The grain-paired
// non-veg meals that were always the intent of BALANCED mode.
const BALANCED_NON_VEG_WEEK: Array<{ m1: NonVegThaliSlot; m2: NonVegThaliSlot }> = [
  // Mon: Toor dal + chicken curry rice / Mutton curry + roti
  {
    m1: {
      kind: "nonveg_thali", dalFoodId: "TOOR_DAL", grainRecipe: "PLAIN_RICE",
      meatRecipe: "CHICKEN_CURRY", meatFoodId: "CHICKEN_THIGH",
      mealName: { hi: "चिकन करी + चावल + दाल", en: "Chicken Curry + Rice + Dal" },
    },
    m2: {
      kind: "nonveg_thali", dalFoodId: null, grainRecipe: "PLAIN_ROTI",
      meatRecipe: "ANDA_CURRY", meatFoodId: "EGG_PANEER",
      mealName: { hi: "अंडा करी + रोटी", en: "Anda Curry + Roti" },
    },
  },
  // Tue: Mutton keema + rice / Chicken saag + roti
  {
    m1: {
      kind: "nonveg_thali", dalFoodId: "MASOOR_DAL", grainRecipe: "JEERA_RICE",
      meatRecipe: "MUTTON_KEEMA_MASALA", meatFoodId: "MUTTON_KEEMA",
      mealName: { hi: "मटन कीमा + जीरा चावल + दाल", en: "Mutton Keema + Jeera Rice + Dal" },
    },
    m2: {
      kind: "nonveg_thali", dalFoodId: null, grainRecipe: "PLAIN_ROTI",
      meatRecipe: "CHICKEN_SAAG", meatFoodId: "CHICKEN_BREAST",
      mealName: { hi: "चिकन साग + रोटी", en: "Chicken Saag + Roti" },
    },
  },
  // Wed: Macher jhol + rice / Chicken tikka dry + roti
  {
    m1: {
      kind: "nonveg_thali", dalFoodId: "TOOR_DAL", grainRecipe: "PLAIN_RICE",
      meatRecipe: "MACHER_JHOL", meatFoodId: "FISH_ROHU",
      mealName: { hi: "माछेर झोल + चावल + दाल", en: "Macher Jhol + Rice + Dal" },
    },
    m2: {
      kind: "nonveg_thali", dalFoodId: null, grainRecipe: "PLAIN_ROTI",
      meatRecipe: "CHICKEN_TIKKA_DRY", meatFoodId: "CHICKEN_BREAST",
      mealName: { hi: "चिकन टिक्का + रोटी", en: "Dry Chicken Tikka + Roti" },
    },
  },
  // Thu: Chicken handi + rice / Prawn masala + roti
  {
    m1: {
      kind: "nonveg_thali", dalFoodId: "MOONG_DAL", grainRecipe: "JEERA_RICE",
      meatRecipe: "CHICKEN_HANDI", meatFoodId: "CHICKEN_THIGH",
      mealName: { hi: "चिकन हांडी + जीरा चावल + दाल", en: "Chicken Handi + Jeera Rice + Dal" },
    },
    m2: {
      kind: "nonveg_thali", dalFoodId: null, grainRecipe: "PLAIN_ROTI",
      meatRecipe: "PRAWN_MASALA", meatFoodId: "PRAWNS",
      mealName: { hi: "झींगा मसाला + रोटी", en: "Prawn Masala + Roti" },
    },
  },
  // Fri: Butter chicken + rice / Mutton curry + roti
  {
    m1: {
      kind: "nonveg_thali", dalFoodId: null, grainRecipe: "PLAIN_RICE",
      meatRecipe: "BUTTER_CHICKEN", meatFoodId: "CHICKEN_THIGH",
      mealName: { hi: "बटर चिकन + चावल", en: "Butter Chicken + Rice" },
    },
    m2: {
      kind: "nonveg_thali", dalFoodId: "MASOOR_DAL", grainRecipe: "PLAIN_ROTI",
      meatRecipe: "MUTTON_CURRY", meatFoodId: "MUTTON_CURRY_CUT",
      mealName: { hi: "मटन करी + रोटी + दाल", en: "Mutton Curry + Roti + Dal" },
    },
  },
  // Sat: Fish curry + rice / Murgh do pyaza + roti
  {
    m1: {
      kind: "nonveg_thali", dalFoodId: "TOOR_DAL", grainRecipe: "PLAIN_RICE",
      meatRecipe: "FISH_CURRY_SIMPLE", meatFoodId: "FISH_ROHU",
      mealName: { hi: "मछली करी + चावल + दाल", en: "Fish Curry + Rice + Dal" },
    },
    m2: {
      kind: "nonveg_thali", dalFoodId: null, grainRecipe: "PLAIN_ROTI",
      meatRecipe: "MURGH_DO_PYAZA", meatFoodId: "CHICKEN_THIGH",
      mealName: { hi: "मुर्ग दो प्याज़ा + रोटी", en: "Murgh Do Pyaza + Roti" },
    },
  },
  // Sun: Chicken curry + rice + dal / Anda curry + roti
  {
    m1: {
      kind: "nonveg_thali", dalFoodId: "TOOR_DAL", grainRecipe: "PLAIN_RICE",
      meatRecipe: "CHICKEN_CURRY", meatFoodId: "CHICKEN_THIGH",
      mealName: { hi: "चिकन करी + चावल + दाल", en: "Chicken Curry + Rice + Dal" },
    },
    m2: {
      kind: "nonveg_thali", dalFoodId: null, grainRecipe: "PLAIN_ROTI",
      meatRecipe: "MUTTON_KEEMA_PALAK", meatFoodId: "MUTTON_KEEMA",
      mealName: { hi: "मटन कीमा पालक + रोटी", en: "Mutton Keema Palak + Roti" },
    },
  },
]

// ═════════════════════════════════════════════════════════════════════════════
// ── LOW_CARB rotations (commit 11.3) ────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
// Dal as main carb+protein source. 0–1 roti per meal. No rice. No potato.
// Generous vegetables for fiber and volume.

const LOW_CARB_EGGETARIAN_WEEK: Array<{ m1: DalMealSlot; m2: DalMealSlot }> = [
  {
    m1: {
      kind: "dal_meal", dalFoodId: "MASOOR_DAL", grainRecipe: "PLAIN_ROTI",
      sabziRecipe: "PHOOL_GOBHI_SABZI",
      mealName: { hi: "मसूर दाल + रोटी + गोभी सब्ज़ी", en: "Masoor Dal + Roti + Gobhi Sabzi" },
    },
    m2: {
      kind: "dal_meal", dalFoodId: "TOOR_DAL", grainRecipe: null,
      sabziRecipe: "PALAK_PANEER_VEG",
      mealName: { hi: "पालक पनीर + तूर दाल", en: "Palak Paneer + Toor Dal" },
    },
  },
  {
    m1: {
      kind: "dal_meal", dalFoodId: "MOONG_DAL", grainRecipe: "PLAIN_ROTI",
      sabziRecipe: "KARELA_SABZI_VEG",
      mealName: { hi: "मूंग दाल + रोटी + करेला सब्ज़ी", en: "Moong Dal + Roti + Karela Sabzi" },
    },
    m2: {
      kind: "dal_meal", dalFoodId: "MASOOR_DAL", grainRecipe: null,
      sabziRecipe: "KADHAI_PANEER",
      mealName: { hi: "कड़ाई पनीर + मसूर दाल", en: "Kadhai Paneer + Masoor Dal" },
    },
  },
  {
    m1: {
      kind: "dal_meal", dalFoodId: "CHANA_DAL", grainRecipe: "PLAIN_ROTI",
      sabziRecipe: "PHOOL_GOBHI_SABZI",
      mealName: { hi: "चना दाल + रोटी + गोभी", en: "Chana Dal + Roti + Gobhi Sabzi" },
    },
    m2: {
      kind: "dal_meal", dalFoodId: "TOOR_DAL", grainRecipe: null,
      sabziRecipe: "METHI_PANEER_BHURJI",
      mealName: { hi: "मेथी पनीर भुर्जी + तूर दाल", en: "Methi Paneer Bhurji + Toor Dal" },
    },
  },
  {
    m1: {
      kind: "dal_meal", dalFoodId: "MASOOR_DAL", grainRecipe: "PLAIN_ROTI",
      sabziRecipe: "KARELA_SABZI_VEG",
      mealName: { hi: "मसूर दाल + रोटी + करेला", en: "Masoor Dal + Roti + Karela Sabzi" },
    },
    m2: {
      kind: "dal_meal", dalFoodId: "MOONG_DAL", grainRecipe: null,
      sabziRecipe: "PALAK_PANEER_VEG",
      mealName: { hi: "पालक पनीर + मूंग दाल", en: "Palak Paneer + Moong Dal" },
    },
  },
  {
    m1: {
      kind: "dal_meal", dalFoodId: "TOOR_DAL", grainRecipe: "PLAIN_ROTI",
      sabziRecipe: "PHOOL_GOBHI_SABZI",
      mealName: { hi: "तूर दाल + रोटी + गोभी सब्ज़ी", en: "Toor Dal + Roti + Gobhi Sabzi" },
    },
    m2: {
      kind: "dal_meal", dalFoodId: "CHANA_DAL", grainRecipe: null,
      sabziRecipe: "KADHAI_PANEER",
      mealName: { hi: "कड़ाई पनीर + चना दाल", en: "Kadhai Paneer + Chana Dal" },
    },
  },
  {
    m1: {
      kind: "dal_meal", dalFoodId: "MOONG_DAL", grainRecipe: "PLAIN_ROTI",
      sabziRecipe: "KARELA_SABZI_VEG",
      mealName: { hi: "मूंग दाल + रोटी + करेला", en: "Moong Dal + Roti + Karela Sabzi" },
    },
    m2: {
      kind: "dal_meal", dalFoodId: "MASOOR_DAL", grainRecipe: null,
      sabziRecipe: "PANEER_BHURJI",
      mealName: { hi: "पनीर भुर्जी + मसूर दाल", en: "Paneer Bhurji + Masoor Dal" },
    },
  },
  {
    m1: {
      kind: "dal_meal", dalFoodId: "TOOR_DAL", grainRecipe: "PLAIN_ROTI",
      sabziRecipe: "PHOOL_GOBHI_SABZI",
      mealName: { hi: "तूर दाल + रोटी + गोभी", en: "Toor Dal + Roti + Gobhi Sabzi" },
    },
    m2: {
      kind: "dal_meal", dalFoodId: "MOONG_DAL", grainRecipe: null,
      sabziRecipe: "PALAK_PANEER_VEG",
      mealName: { hi: "पालक पनीर + मूंग दाल", en: "Palak Paneer + Moong Dal" },
    },
  },
]

// LOW_CARB veg — same structure, no egg protein dishes
const LOW_CARB_VEG_WEEK: Array<{ m1: DalMealSlot; m2: DalMealSlot }> = [
  {
    m1: {
      kind: "dal_meal", dalFoodId: "TOOR_DAL", grainRecipe: "PLAIN_ROTI",
      sabziRecipe: "PHOOL_GOBHI_SABZI",
      mealName: { hi: "तूर दाल + रोटी + गोभी सब्ज़ी", en: "Toor Dal + Roti + Gobhi Sabzi" },
    },
    m2: {
      kind: "dal_meal", dalFoodId: "MASOOR_DAL", grainRecipe: null,
      sabziRecipe: "PALAK_PANEER_VEG",
      mealName: { hi: "पालक पनीर + मसूर दाल", en: "Palak Paneer + Masoor Dal" },
    },
  },
  {
    m1: {
      kind: "dal_meal", dalFoodId: "MOONG_DAL", grainRecipe: "PLAIN_ROTI",
      sabziRecipe: "KARELA_SABZI_VEG",
      mealName: { hi: "मूंग दाल + रोटी + करेला", en: "Moong Dal + Roti + Karela Sabzi" },
    },
    m2: {
      kind: "dal_meal", dalFoodId: "TOOR_DAL", grainRecipe: null,
      sabziRecipe: "KADHAI_PANEER",
      mealName: { hi: "कड़ाई पनीर + तूर दाल", en: "Kadhai Paneer + Toor Dal" },
    },
  },
  {
    m1: {
      kind: "dal_meal", dalFoodId: "CHANA_DAL", grainRecipe: "PLAIN_ROTI",
      sabziRecipe: "PHOOL_GOBHI_SABZI",
      mealName: { hi: "चना दाल + रोटी + गोभी", en: "Chana Dal + Roti + Gobhi Sabzi" },
    },
    m2: {
      kind: "dal_meal", dalFoodId: "MASOOR_DAL", grainRecipe: null,
      sabziRecipe: "MATAR_PANEER",
      mealName: { hi: "मटर पनीर + मसूर दाल", en: "Matar Paneer + Masoor Dal" },
    },
  },
  {
    m1: {
      kind: "dal_meal", dalFoodId: "MASOOR_DAL", grainRecipe: "PLAIN_ROTI",
      sabziRecipe: "KARELA_SABZI_VEG",
      mealName: { hi: "मसूर दाल + रोटी + करेला", en: "Masoor Dal + Roti + Karela Sabzi" },
    },
    m2: {
      kind: "dal_meal", dalFoodId: "MOONG_DAL", grainRecipe: null,
      sabziRecipe: "PALAK_PANEER_VEG",
      mealName: { hi: "पालक पनीर + मूंग दाल", en: "Palak Paneer + Moong Dal" },
    },
  },
  {
    m1: {
      kind: "dal_meal", dalFoodId: "TOOR_DAL", grainRecipe: "PLAIN_ROTI",
      sabziRecipe: "PHOOL_GOBHI_SABZI",
      mealName: { hi: "तूर दाल + रोटी + गोभी", en: "Toor Dal + Roti + Gobhi Sabzi" },
    },
    m2: {
      kind: "dal_meal", dalFoodId: "CHANA_DAL", grainRecipe: null,
      sabziRecipe: "KADHAI_PANEER",
      mealName: { hi: "कड़ाई पनीर + चना दाल", en: "Kadhai Paneer + Chana Dal" },
    },
  },
  {
    m1: {
      kind: "dal_meal", dalFoodId: "MOONG_DAL", grainRecipe: "PLAIN_ROTI",
      sabziRecipe: "KARELA_SABZI_VEG",
      mealName: { hi: "मूंग दाल + रोटी + करेला", en: "Moong Dal + Roti + Karela Sabzi" },
    },
    m2: {
      kind: "dal_meal", dalFoodId: "MASOOR_DAL", grainRecipe: null,
      sabziRecipe: "PANEER_BHURJI",
      mealName: { hi: "पनीर भुर्जी + मसूर दाल", en: "Paneer Bhurji + Masoor Dal" },
    },
  },
  {
    m1: {
      kind: "dal_meal", dalFoodId: "TOOR_DAL", grainRecipe: "PLAIN_ROTI",
      sabziRecipe: "PHOOL_GOBHI_SABZI",
      mealName: { hi: "तूर दाल + रोटी + गोभी", en: "Toor Dal + Roti + Gobhi Sabzi" },
    },
    m2: {
      kind: "dal_meal", dalFoodId: "MOONG_DAL", grainRecipe: null,
      sabziRecipe: "PALAK_PANEER_VEG",
      mealName: { hi: "पालक पनीर + मूंग दाल", en: "Palak Paneer + Moong Dal" },
    },
  },
]

// LOW_CARB non-veg — dal + 0–1 roti + meat/egg; no rice
const LOW_CARB_NON_VEG_WEEK: Array<{ m1: DalMealSlot & { meatRecipe?: string; meatFoodId?: string }; m2: DalMealSlot & { meatRecipe?: string; meatFoodId?: string } }> = [
  {
    m1: {
      kind: "dal_meal", dalFoodId: "TOOR_DAL", grainRecipe: "PLAIN_ROTI",
      sabziRecipe: "CHICKEN_SAAG", meatRecipe: "CHICKEN_SAAG", meatFoodId: "CHICKEN_BREAST",
      mealName: { hi: "चिकन साग + तूर दाल + रोटी", en: "Chicken Saag + Toor Dal + Roti" },
    },
    m2: {
      kind: "dal_meal", dalFoodId: "MASOOR_DAL", grainRecipe: null,
      sabziRecipe: "ANDA_CURRY",
      mealName: { hi: "अंडा करी + मसूर दाल", en: "Anda Curry + Masoor Dal" },
    },
  },
  {
    m1: {
      kind: "dal_meal", dalFoodId: "MASOOR_DAL", grainRecipe: "PLAIN_ROTI",
      sabziRecipe: "MUTTON_KEEMA_PALAK", meatRecipe: "MUTTON_KEEMA_PALAK", meatFoodId: "MUTTON_KEEMA",
      mealName: { hi: "मटन कीमा पालक + दाल + रोटी", en: "Mutton Keema Palak + Dal + Roti" },
    },
    m2: {
      kind: "dal_meal", dalFoodId: "MOONG_DAL", grainRecipe: null,
      sabziRecipe: "MASALA_OMELETTE",
      mealName: { hi: "मसाला ऑमलेट + मूंग दाल", en: "Masala Omelette + Moong Dal" },
    },
  },
  {
    m1: {
      kind: "dal_meal", dalFoodId: "TOOR_DAL", grainRecipe: "PLAIN_ROTI",
      sabziRecipe: "CHICKEN_TIKKA_DRY", meatRecipe: "CHICKEN_TIKKA_DRY", meatFoodId: "CHICKEN_BREAST",
      mealName: { hi: "चिकन टिक्का + तूर दाल + रोटी", en: "Chicken Tikka + Toor Dal + Roti" },
    },
    m2: {
      kind: "dal_meal", dalFoodId: "MASOOR_DAL", grainRecipe: null,
      sabziRecipe: "ANDHRA_EGG_MASALA",
      mealName: { hi: "आंध्र अंडा मसाला + मसूर दाल", en: "Andhra Egg Masala + Masoor Dal" },
    },
  },
  {
    m1: {
      kind: "dal_meal", dalFoodId: "MOONG_DAL", grainRecipe: "PLAIN_ROTI",
      sabziRecipe: "PRAWN_MASALA", meatRecipe: "PRAWN_MASALA", meatFoodId: "PRAWNS",
      mealName: { hi: "झींगा मसाला + मूंग दाल + रोटी", en: "Prawn Masala + Moong Dal + Roti" },
    },
    m2: {
      kind: "dal_meal", dalFoodId: "TOOR_DAL", grainRecipe: null,
      sabziRecipe: "ANDA_PANEER_MASALA",
      mealName: { hi: "अंडा पनीर मसाला + दाल", en: "Anda Paneer Masala + Dal" },
    },
  },
  {
    m1: {
      kind: "dal_meal", dalFoodId: "MASOOR_DAL", grainRecipe: "PLAIN_ROTI",
      sabziRecipe: "CHICKEN_KALI_MIRCH", meatRecipe: "CHICKEN_KALI_MIRCH", meatFoodId: "CHICKEN_BREAST",
      mealName: { hi: "चिकन काली मिर्च + दाल + रोटी", en: "Chicken Kali Mirch + Dal + Roti" },
    },
    m2: {
      kind: "dal_meal", dalFoodId: "MOONG_DAL", grainRecipe: null,
      sabziRecipe: "SAAG_ANDA",
      mealName: { hi: "साग अंडा + मूंग दाल", en: "Saag Anda + Moong Dal" },
    },
  },
  {
    m1: {
      kind: "dal_meal", dalFoodId: "TOOR_DAL", grainRecipe: "PLAIN_ROTI",
      sabziRecipe: "FISH_CURRY_SIMPLE", meatRecipe: "FISH_CURRY_SIMPLE", meatFoodId: "FISH_ROHU",
      mealName: { hi: "मछली करी + दाल + रोटी", en: "Fish Curry + Dal + Roti" },
    },
    m2: {
      kind: "dal_meal", dalFoodId: "MASOOR_DAL", grainRecipe: null,
      sabziRecipe: "MASALA_OMELETTE",
      mealName: { hi: "मसाला ऑमलेट + मसूर दाल", en: "Masala Omelette + Masoor Dal" },
    },
  },
  {
    m1: {
      kind: "dal_meal", dalFoodId: "MOONG_DAL", grainRecipe: "PLAIN_ROTI",
      sabziRecipe: "CHICKEN_SAAG", meatRecipe: "CHICKEN_SAAG", meatFoodId: "CHICKEN_BREAST",
      mealName: { hi: "चिकन साग + मूंग दाल + रोटी", en: "Chicken Saag + Moong Dal + Roti" },
    },
    m2: {
      kind: "dal_meal", dalFoodId: "TOOR_DAL", grainRecipe: null,
      sabziRecipe: "ANDA_CURRY",
      mealName: { hi: "अंडा करी + तूर दाल", en: "Anda Curry + Toor Dal" },
    },
  },
]

// ═════════════════════════════════════════════════════════════════════════════
// ── HIGH_PROTEIN_CUT rotations (commit 11.3) ────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
// Lean protein-forward, lower ghee, larger veg. Uses existing keto builders
// (same egg/paneer/meat logic) but a distinct recipe rotation that favours
// leaner recipes and egg-white-forward dishes. No thali builder needed.

const HPC_EGGETARIAN_WEEK: Array<KetoSlot> = [
  { m1Recipe: "MASALA_OMELETTE",      m2Recipe: "ANDHRA_EGG_MASALA" },
  { m1Recipe: "ANDHRA_EGG_MASALA",    m2Recipe: "KADHAI_PANEER" },
  { m1Recipe: "SAAG_ANDA",            m2Recipe: "PANEER_BHURJI" },
  { m1Recipe: "EGG_MUSHROOM_STIR_FRY",m2Recipe: "METHI_PANEER_BHURJI" },
  { m1Recipe: "ANDA_CURRY",           m2Recipe: "PALAK_PANEER_VEG" },
  { m1Recipe: "KARELA_ANDA",          m2Recipe: "ANDHRA_EGG_MASALA" },
  { m1Recipe: "MASALA_OMELETTE",      m2Recipe: "SAAG_ANDA" },
]

const HPC_NON_VEG_WEEK: Array<NonVegKetoSlot> = [
  { m1Recipe: "CHICKEN_TIKKA_DRY",   m2Recipe: "ANDA_CURRY",          m1FoodId: "CHICKEN_BREAST", m2FoodId: "EGG_PANEER" },
  { m1Recipe: "CHICKEN_SAAG",        m2Recipe: "MASALA_OMELETTE",      m1FoodId: "CHICKEN_BREAST", m2FoodId: "EGG_PANEER" },
  { m1Recipe: "CHICKEN_KALI_MIRCH",  m2Recipe: "ANDHRA_EGG_MASALA",   m1FoodId: "CHICKEN_BREAST", m2FoodId: "EGG_PANEER" },
  { m1Recipe: "MUTTON_KEEMA_PALAK",  m2Recipe: "SAAG_ANDA",           m1FoodId: "MUTTON_KEEMA",   m2FoodId: "EGG_PANEER" },
  { m1Recipe: "FISH_CURRY_SIMPLE",   m2Recipe: "MASALA_OMELETTE",     m1FoodId: "FISH_ROHU",      m2FoodId: "EGG_PANEER" },
  { m1Recipe: "PRAWN_MASALA",        m2Recipe: "SAAG_ANDA",           m1FoodId: "PRAWNS",         m2FoodId: "EGG_PANEER" },
  { m1Recipe: "CHICKEN_TIKKA_DRY",   m2Recipe: "EGG_MUSHROOM_STIR_FRY",m1FoodId: "CHICKEN_BREAST",m2FoodId: "EGG_PANEER" },
]

const HPC_VEG_WEEK: Array<KetoSlot> = [
  { m1Recipe: "PALAK_PANEER_VEG",  m2Recipe: "KADHAI_PANEER" },
  { m1Recipe: "KADHAI_PANEER",     m2Recipe: "PALAK_PANEER_VEG" },
  { m1Recipe: "PANEER_BHURJI",     m2Recipe: "PALAK_PANEER_VEG" },
  { m1Recipe: "PALAK_PANEER_VEG",  m2Recipe: "METHI_PANEER_BHURJI" },
  { m1Recipe: "KADHAI_PANEER",     m2Recipe: "PANEER_BHURJI" },
  { m1Recipe: "METHI_PANEER_BHURJI",m2Recipe: "PALAK_PANEER_VEG" },
  { m1Recipe: "PALAK_PANEER_VEG",  m2Recipe: "KADHAI_PANEER" },
]

// ═════════════════════════════════════════════════════════════════════════════
// ── RECOMPOSITION rotations (commit 11.3) ───────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
// Higher carb to fuel training. Protein + rice bowl. Pre/post-workout framing.
// Dal also appears to keep the fibre target reachable on high-carb plans.

const RECOMP_EGGETARIAN_WEEK: Array<{ m1: RiceBowlSlot; m2: RiceBowlSlot }> = [
  {
    m1: { kind: "rice_bowl", riceRecipe: "JEERA_RICE", mainRecipe: "ANDA_PANEER_MASALA",
          mealName: { hi: "अंडा पनीर मसाला + जीरा चावल (Pre-workout)", en: "Anda Paneer Masala + Jeera Rice (Pre-workout)" } },
    m2: { kind: "rice_bowl", riceRecipe: "PLAIN_RICE", mainRecipe: "PANEER_EGG_BHURJI",
          mealName: { hi: "पनीर एग भुर्जी + चावल (Post-workout)", en: "Paneer Egg Bhurji + Rice (Post-workout)" } },
  },
  {
    m1: { kind: "rice_bowl", riceRecipe: "PLAIN_RICE", mainRecipe: "ANDHRA_EGG_MASALA",
          mealName: { hi: "आंध्र अंडा मसाला + चावल (Pre-workout)", en: "Andhra Egg Masala + Rice (Pre-workout)" } },
    m2: { kind: "rice_bowl", riceRecipe: "JEERA_RICE", mainRecipe: "METHI_PANEER_BHURJI",
          mealName: { hi: "मेथी पनीर भुर्जी + जीरा चावल (Post-workout)", en: "Methi Paneer Bhurji + Jeera Rice (Post-workout)" } },
  },
  {
    m1: { kind: "rice_bowl", riceRecipe: "JEERA_RICE", mainRecipe: "ANDA_CURRY",
          mealName: { hi: "अंडा करी + जीरा चावल (Pre-workout)", en: "Anda Curry + Jeera Rice (Pre-workout)" } },
    m2: { kind: "rice_bowl", riceRecipe: "PLAIN_RICE", mainRecipe: "KADHAI_PANEER",
          mealName: { hi: "कड़ाई पनीर + चावल (Post-workout)", en: "Kadhai Paneer + Rice (Post-workout)" } },
  },
  {
    m1: { kind: "rice_bowl", riceRecipe: "PLAIN_RICE", mainRecipe: "MASALA_OMELETTE",
          mealName: { hi: "मसाला ऑमलेट + चावल (Pre-workout)", en: "Masala Omelette + Rice (Pre-workout)" } },
    m2: { kind: "rice_bowl", riceRecipe: "JEERA_RICE", mainRecipe: "PANEER_BHURJI",
          mealName: { hi: "पनीर भुर्जी + जीरा चावल (Post-workout)", en: "Paneer Bhurji + Jeera Rice (Post-workout)" } },
  },
  {
    m1: { kind: "rice_bowl", riceRecipe: "JEERA_RICE", mainRecipe: "SAAG_ANDA",
          mealName: { hi: "साग अंडा + जीरा चावल (Pre-workout)", en: "Saag Anda + Jeera Rice (Pre-workout)" } },
    m2: { kind: "rice_bowl", riceRecipe: "PLAIN_RICE", mainRecipe: "MATAR_PANEER",
          mealName: { hi: "मटर पनीर + चावल (Post-workout)", en: "Matar Paneer + Rice (Post-workout)" } },
  },
  {
    m1: { kind: "rice_bowl", riceRecipe: "PLAIN_RICE", mainRecipe: "ANDA_PANEER_MASALA",
          mealName: { hi: "अंडा पनीर मसाला + चावल (Pre-workout)", en: "Anda Paneer Masala + Rice (Pre-workout)" } },
    m2: { kind: "rice_bowl", riceRecipe: "JEERA_RICE", mainRecipe: "PALAK_PANEER_VEG",
          mealName: { hi: "पालक पनीर + जीरा चावल (Post-workout)", en: "Palak Paneer + Jeera Rice (Post-workout)" } },
  },
  {
    m1: { kind: "rice_bowl", riceRecipe: "JEERA_RICE", mainRecipe: "EGG_MUSHROOM_STIR_FRY",
          mealName: { hi: "एग मशरूम स्टिर फ्राई + जीरा चावल", en: "Egg Mushroom Stir Fry + Jeera Rice" } },
    m2: { kind: "rice_bowl", riceRecipe: "PLAIN_RICE", mainRecipe: "ANDA_CURRY",
          mealName: { hi: "अंडा करी + चावल", en: "Anda Curry + Rice" } },
  },
]

const RECOMP_VEG_WEEK: Array<{ m1: RiceBowlSlot; m2: RiceBowlSlot }> = [
  {
    m1: { kind: "rice_bowl", riceRecipe: "JEERA_RICE", mainRecipe: "MATAR_PANEER",
          mealName: { hi: "मटर पनीर + जीरा चावल (Pre-workout)", en: "Matar Paneer + Jeera Rice (Pre-workout)" } },
    m2: { kind: "rice_bowl", riceRecipe: "PLAIN_RICE", mainRecipe: "PALAK_PANEER_VEG",
          mealName: { hi: "पालक पनीर + चावल (Post-workout)", en: "Palak Paneer + Rice (Post-workout)" } },
  },
  {
    m1: { kind: "rice_bowl", riceRecipe: "PLAIN_RICE", mainRecipe: "KADHAI_PANEER",
          mealName: { hi: "कड़ाई पनीर + चावल (Pre-workout)", en: "Kadhai Paneer + Rice (Pre-workout)" } },
    m2: { kind: "rice_bowl", riceRecipe: "JEERA_RICE", mainRecipe: "PALAK_PANEER_VEG",
          mealName: { hi: "पालक पनीर + जीरा चावल (Post-workout)", en: "Palak Paneer + Jeera Rice (Post-workout)" } },
  },
  {
    m1: { kind: "rice_bowl", riceRecipe: "JEERA_RICE", mainRecipe: "MATAR_PANEER",
          mealName: { hi: "मटर पनीर + जीरा चावल", en: "Matar Paneer + Jeera Rice" } },
    m2: { kind: "rice_bowl", riceRecipe: "PLAIN_RICE", mainRecipe: "KADHAI_PANEER",
          mealName: { hi: "कड़ाई पनीर + चावल", en: "Kadhai Paneer + Rice" } },
  },
  {
    m1: { kind: "rice_bowl", riceRecipe: "PLAIN_RICE", mainRecipe: "PALAK_PANEER_VEG",
          mealName: { hi: "पालक पनीर + चावल (Pre-workout)", en: "Palak Paneer + Rice (Pre-workout)" } },
    m2: { kind: "rice_bowl", riceRecipe: "JEERA_RICE", mainRecipe: "PANEER_BHURJI",
          mealName: { hi: "पनीर भुर्जी + जीरा चावल (Post-workout)", en: "Paneer Bhurji + Jeera Rice (Post-workout)" } },
  },
  {
    m1: { kind: "rice_bowl", riceRecipe: "JEERA_RICE", mainRecipe: "KADHAI_PANEER",
          mealName: { hi: "कड़ाई पनीर + जीरा चावल", en: "Kadhai Paneer + Jeera Rice" } },
    m2: { kind: "rice_bowl", riceRecipe: "PLAIN_RICE", mainRecipe: "MATAR_PANEER",
          mealName: { hi: "मटर पनीर + चावल", en: "Matar Paneer + Rice" } },
  },
  {
    m1: { kind: "rice_bowl", riceRecipe: "PLAIN_RICE", mainRecipe: "PALAK_PANEER_VEG",
          mealName: { hi: "पालक पनीर + चावल", en: "Palak Paneer + Rice" } },
    m2: { kind: "rice_bowl", riceRecipe: "JEERA_RICE", mainRecipe: "MATAR_PANEER",
          mealName: { hi: "मटर पनीर + जीरा चावल", en: "Matar Paneer + Jeera Rice" } },
  },
  {
    m1: { kind: "rice_bowl", riceRecipe: "JEERA_RICE", mainRecipe: "KADHAI_PANEER",
          mealName: { hi: "कड़ाई पनीर + जीरा चावल (Pre-workout)", en: "Kadhai Paneer + Jeera Rice (Pre-workout)" } },
    m2: { kind: "rice_bowl", riceRecipe: "PLAIN_RICE", mainRecipe: "PALAK_PANEER_VEG",
          mealName: { hi: "पालक पनीर + चावल (Post-workout)", en: "Palak Paneer + Rice (Post-workout)" } },
  },
]

const RECOMP_NON_VEG_WEEK: Array<{ m1: NonVegRiceBowlSlot; m2: NonVegRiceBowlSlot }> = [
  {
    m1: { kind: "nonveg_rice_bowl", riceRecipe: "JEERA_RICE", meatRecipe: "CHICKEN_CURRY",
          meatFoodId: "CHICKEN_THIGH",
          mealName: { hi: "चिकन करी + जीरा चावल (Pre-workout)", en: "Chicken Curry + Jeera Rice (Pre-workout)" } },
    m2: { kind: "nonveg_rice_bowl", riceRecipe: "PLAIN_RICE", meatRecipe: "ANDA_PANEER_MASALA",
          meatFoodId: "EGG_PANEER",
          mealName: { hi: "अंडा पनीर मसाला + चावल (Post-workout)", en: "Anda Paneer Masala + Rice (Post-workout)" } },
  },
  {
    m1: { kind: "nonveg_rice_bowl", riceRecipe: "PLAIN_RICE", meatRecipe: "MUTTON_CURRY",
          meatFoodId: "MUTTON_CURRY_CUT",
          mealName: { hi: "मटन करी + चावल", en: "Mutton Curry + Rice" } },
    m2: { kind: "nonveg_rice_bowl", riceRecipe: "JEERA_RICE", meatRecipe: "CHICKEN_SAAG",
          meatFoodId: "CHICKEN_BREAST",
          mealName: { hi: "चिकन साग + जीरा चावल", en: "Chicken Saag + Jeera Rice" } },
  },
  {
    m1: { kind: "nonveg_rice_bowl", riceRecipe: "JEERA_RICE", meatRecipe: "MACHER_JHOL",
          meatFoodId: "FISH_ROHU",
          mealName: { hi: "माछेर झोल + जीरा चावल (Pre-workout)", en: "Macher Jhol + Jeera Rice (Pre-workout)" } },
    m2: { kind: "nonveg_rice_bowl", riceRecipe: "PLAIN_RICE", meatRecipe: "CHICKEN_TIKKA_DRY",
          meatFoodId: "CHICKEN_BREAST",
          mealName: { hi: "चिकन टिक्का + चावल (Post-workout)", en: "Chicken Tikka + Rice (Post-workout)" } },
  },
  {
    m1: { kind: "nonveg_rice_bowl", riceRecipe: "PLAIN_RICE", meatRecipe: "BUTTER_CHICKEN",
          meatFoodId: "CHICKEN_THIGH",
          mealName: { hi: "बटर चिकन + चावल", en: "Butter Chicken + Rice" } },
    m2: { kind: "nonveg_rice_bowl", riceRecipe: "JEERA_RICE", meatRecipe: "MUTTON_KEEMA_MASALA",
          meatFoodId: "MUTTON_KEEMA",
          mealName: { hi: "मटन कीमा + जीरा चावल", en: "Mutton Keema + Jeera Rice" } },
  },
  {
    m1: { kind: "nonveg_rice_bowl", riceRecipe: "JEERA_RICE", meatRecipe: "PRAWN_MASALA",
          meatFoodId: "PRAWNS",
          mealName: { hi: "झींगा मसाला + जीरा चावल (Pre-workout)", en: "Prawn Masala + Jeera Rice (Pre-workout)" } },
    m2: { kind: "nonveg_rice_bowl", riceRecipe: "PLAIN_RICE", meatRecipe: "CHICKEN_HANDI",
          meatFoodId: "CHICKEN_THIGH",
          mealName: { hi: "चिकन हांडी + चावल (Post-workout)", en: "Chicken Handi + Rice (Post-workout)" } },
  },
  {
    m1: { kind: "nonveg_rice_bowl", riceRecipe: "PLAIN_RICE", meatRecipe: "MURGH_DO_PYAZA",
          meatFoodId: "CHICKEN_THIGH",
          mealName: { hi: "मुर्ग दो प्याज़ा + चावल", en: "Murgh Do Pyaza + Rice" } },
    m2: { kind: "nonveg_rice_bowl", riceRecipe: "JEERA_RICE", meatRecipe: "MUTTON_KEEMA_PALAK",
          meatFoodId: "MUTTON_KEEMA",
          mealName: { hi: "मटन कीमा पालक + जीरा चावल", en: "Mutton Keema Palak + Jeera Rice" } },
  },
  {
    m1: { kind: "nonveg_rice_bowl", riceRecipe: "JEERA_RICE", meatRecipe: "CHICKEN_CURRY",
          meatFoodId: "CHICKEN_THIGH",
          mealName: { hi: "चिकन करी + जीरा चावल", en: "Chicken Curry + Jeera Rice" } },
    m2: { kind: "nonveg_rice_bowl", riceRecipe: "PLAIN_RICE", meatRecipe: "FISH_CURRY_SIMPLE",
          meatFoodId: "FISH_ROHU",
          mealName: { hi: "मछली करी + चावल", en: "Fish Curry + Rice" } },
  },
]

// ═════════════════════════════════════════════════════════════════════════════
// ── Vegetable rotation (unchanged from 11.2a) ───────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
const VEG_ROTATION: Array<{ primary: string; vitaminC: string }> = [
  { primary: "SPINACH",     vitaminC: "TOMATO" },
  { primary: "MUSHROOM",    vitaminC: "CAPSICUM" },
  { primary: "BROCCOLI",    vitaminC: "BROCCOLI" },
  { primary: "BHINDI",      vitaminC: "BHINDI" },
  { primary: "CAULIFLOWER", vitaminC: "TOMATO" },
  { primary: "ZUCCHINI",    vitaminC: "CAPSICUM" },
  { primary: "CABBAGE",     vitaminC: "TOMATO" },
]

// ═════════════════════════════════════════════════════════════════════════════
// ── Macro constants (unchanged from 11.2a) ──────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
const PROTEIN_PER_UNIT: Record<string, { unit: "grams" | "count"; proteinPerUnit: number; fatPerUnit: number }> = {
  EGG:           { unit: "count",  proteinPerUnit: 6,    fatPerUnit: 5 },
  PANEER:        { unit: "grams",  proteinPerUnit: 0.18, fatPerUnit: 0.20 },
  CHICKEN_BREAST:{ unit: "grams",  proteinPerUnit: 0.31, fatPerUnit: 0.036 },
  CHICKEN_THIGH: { unit: "grams",  proteinPerUnit: 0.26, fatPerUnit: 0.085 },
  MUTTON_KEEMA:  { unit: "grams",  proteinPerUnit: 0.20, fatPerUnit: 0.18 },
  MUTTON_CURRY_CUT: { unit: "grams", proteinPerUnit: 0.20, fatPerUnit: 0.12 },
  FISH_ROHU:     { unit: "grams",  proteinPerUnit: 0.17, fatPerUnit: 0.018 },
  PRAWNS:        { unit: "grams",  proteinPerUnit: 0.20, fatPerUnit: 0.013 },
}

// ── Raw grain weights for a standard serving (raw grams, per meal) ────────────
// Thali / rice-bowl builders add a fixed grain portion sized for a single meal.
// These are RAW gram weights; cookingConversion converts to displayed cooked qty.
//   50g raw white rice  → 150g cooked (1 katori)
//   25g raw atta        → 1 roti (~40g cooked)
//   50g raw atta        → 2 rotis
// These values anchor the carb contribution per grain slot. Protein target
// remaining after grain + dal fills the protein dish sizing.
const RICE_RAW_PER_MEAL_G   = 50  // 50g raw → ~1 katori cooked (150g)
const ATTA_1_ROTI_G         = 25  // 25g atta → 1 roti
const ATTA_2_ROTI_G         = 50  // 50g atta → 2 rotis

// Raw dal weight for a standard serving: 60g raw → ~150g cooked (1 katori)
const DAL_RAW_PER_MEAL_G    = 60

function clamp(n: number, min: number, max: number) { return Math.min(max, Math.max(min, n)) }
function roundTo(n: number, step: number) { return Math.round(n / step) * step }

// ═════════════════════════════════════════════════════════════════════════════
// ── Existing keto builders (unchanged from 11.2a) ───────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

function buildEggPaneerMeal(
  recipeId: string,
  slot: "primary" | "secondary",
  targetProtein: number,
  targetFat: number,
  veg: { primary: string; vitaminC: string },
  time: string,
): ComposedMeal {
  const eggs = slot === "primary" ? 2 : 3
  const proteinFromEggs = eggs * 6
  const paneerG = clamp(roundTo((targetProtein - proteinFromEggs) / 0.18, 10), 50, 150)
  const fatFromSources = eggs * 5 + paneerG * 0.20
  const gheeNeeded = clamp(roundTo((targetFat - fatFromSources) / 5, 0.5), 1, 4)

  const ingredients: ComposedIngredient[] = [
    { foodId: "EGG" as any,    quantity: eggs,
      prepNote: slot === "primary" ? { hi: "फेंटे हुए", en: "whisked" } : { hi: "उबले", en: "boiled" } },
    { foodId: "PANEER" as any, quantity: paneerG,
      prepNote: slot === "primary" ? { hi: "क्रम्बल्ड", en: "crumbled" } : { hi: "क्यूब्स", en: "cubes" } },
    { foodId: "GHEE" as any,   quantity: gheeNeeded },
    { foodId: veg.primary as any, quantity: 80 },
  ]
  if (veg.vitaminC !== veg.primary) ingredients.push({ foodId: veg.vitaminC as any, quantity: 60 })
  ingredients.push({ foodId: "ONION" as any, quantity: 30 })

  const recipe = RECIPES[recipeId]
  const name = recipe?.name.en ?? recipeId
  return { name, slot, time, recipeId, ingredients }
}

type EggSplitRule = {
  threshold:     number
  firstFormPrep: { hi: string; en: string }
  secondFormPrep:{ hi: string; en: string }
}

const EGG_SPLIT_RULES: Record<string, EggSplitRule> = {
  ANDHRA_EGG_MASALA: {
    threshold: 5,
    firstFormPrep:  { hi: "उबले — मसाले में", en: "boiled, in gravy" },
    secondFormPrep: { hi: "भुर्जी — फिनिशिंग", en: "scrambled, finish" },
  },
  ANDA_CURRY: {
    threshold: 5,
    firstFormPrep:  { hi: "उबले — मसाले में", en: "boiled, in gravy" },
    secondFormPrep: { hi: "भुर्जी — फिनिशिंग", en: "scrambled, finish" },
  },
  KARELA_ANDA: {
    threshold: 4,
    firstFormPrep:  { hi: "भुर्जी — करेले के साथ", en: "scrambled with karela" },
    secondFormPrep: { hi: "उबले आधे — ऊपर से", en: "boiled halves on top" },
  },
}

function buildEggOnlyMeal(
  recipeId: string,
  slot: "primary" | "secondary",
  targetProtein: number,
  targetFat: number,
  veg: { primary: string; vitaminC: string },
  time: string,
): ComposedMeal {
  let effectiveVeg = veg
  if (recipeId === "SAAG_ANDA") {
    effectiveVeg = { primary: "SPINACH", vitaminC: "TOMATO" }
  } else if (recipeId === "BAINGAN_EGG_BHARTA") {
    effectiveVeg = { primary: "BAINGAN", vitaminC: "TOMATO" }
  } else if (recipeId === "KARELA_ANDA") {
    effectiveVeg = { primary: "KARELA", vitaminC: "TOMATO" }
  } else if (recipeId === "EGG_MUSHROOM_STIR_FRY") {
    effectiveVeg = { primary: "MUSHROOM", vitaminC: "CAPSICUM" }
  }

  const eggs           = clamp(Math.round(targetProtein / 6), 2, 6)
  const fatFromEggs    = eggs * 5
  const gheeNeeded     = clamp(roundTo((targetFat - fatFromEggs) / 5, 0.5), 0.5, 4)

  const splitRule = EGG_SPLIT_RULES[recipeId]
  const ingredients: ComposedIngredient[] = []
  if (splitRule && eggs >= splitRule.threshold) {
    const firstForm  = Math.floor(eggs / 2)
    const secondForm = eggs - firstForm
    ingredients.push({ foodId: "EGG" as any, quantity: firstForm,  prepNote: splitRule.firstFormPrep })
    ingredients.push({ foodId: "EGG" as any, quantity: secondForm, prepNote: splitRule.secondFormPrep })
  } else {
    const defaultPrep =
      recipeId === "MASALA_OMELETTE"       ? { hi: "ऑमलेट के लिए फेंटे", en: "whisked for omelette" } :
      recipeId === "SAAG_ANDA"             ? { hi: "साग में पोच किए", en: "poached in saag" } :
      recipeId === "BAINGAN_EGG_BHARTA"    ? { hi: "बीच में फोड़े", en: "cracked into wells" } :
      recipeId === "EGG_MUSHROOM_STIR_FRY" ? { hi: "हल्के स्क्रैंबल", en: "soft scramble" } :
      recipeId === "ANDA_CURRY"            ? { hi: "उबले — मसाले में", en: "boiled, in gravy" } :
      recipeId === "ANDHRA_EGG_MASALA"     ? { hi: "उबले — मसाले में", en: "boiled, in gravy" } :
      recipeId === "KARELA_ANDA"           ? { hi: "भुर्जी", en: "scrambled" } :
                                             { hi: "उबले", en: "boiled" }
    ingredients.push({ foodId: "EGG" as any, quantity: eggs, prepNote: defaultPrep })
  }

  ingredients.push({ foodId: "GHEE" as any, quantity: gheeNeeded })
  ingredients.push({ foodId: effectiveVeg.primary as any, quantity: 80 })
  if (effectiveVeg.vitaminC !== effectiveVeg.primary) {
    ingredients.push({ foodId: effectiveVeg.vitaminC as any, quantity: 60 })
  }
  ingredients.push({ foodId: "ONION" as any, quantity: 30 })
  ingredients.push({ foodId: "TOMATO" as any, quantity: 50 })

  const recipe = RECIPES[recipeId]
  const name = recipe?.name.en ?? recipeId
  return { name, slot, time, recipeId, ingredients }
}

function buildPaneerOnlyMeal(
  recipeId: string,
  slot: "primary" | "secondary",
  targetProtein: number,
  targetFat: number,
  veg: { primary: string; vitaminC: string },
  time: string,
): ComposedMeal {
  let effectiveVeg = veg
  if (recipeId === "KADHAI_PANEER") {
    effectiveVeg = { primary: "CAPSICUM", vitaminC: "CAPSICUM" }
  }

  const paneerG          = clamp(roundTo(targetProtein / 0.1886, 10), 80, 200)
  const fatFromPaneer    = paneerG * 0.2478
  const gheeNeeded       = clamp(roundTo((targetFat - fatFromPaneer) / 5, 0.5), 0.5, 4)

  const ingredients: ComposedIngredient[] = [
    { foodId: "PANEER" as any, quantity: paneerG,
      prepNote: recipeId === "PANEER_BHURJI"
        ? { hi: "क्रम्बल्ड", en: "crumbled" }
        : { hi: "क्यूब्स", en: "cubes" } },
    { foodId: "GHEE" as any, quantity: gheeNeeded },
    { foodId: effectiveVeg.primary as any, quantity: 80 },
  ]
  if (effectiveVeg.vitaminC !== effectiveVeg.primary) {
    ingredients.push({ foodId: effectiveVeg.vitaminC as any, quantity: 60 })
  }
  ingredients.push({ foodId: "ONION" as any, quantity: 30 })
  ingredients.push({ foodId: "TOMATO" as any, quantity: 50 })

  const recipe = RECIPES[recipeId]
  const name = recipe?.name.en ?? recipeId
  return { name, slot, time, recipeId, ingredients }
}

type EggetarianBuilder = "EggPaneer" | "EggOnly" | "PaneerOnly"

function resolveEggetarianBuilder(recipeId: string): EggetarianBuilder {
  const recipe = RECIPES[recipeId]
  if (!recipe) return "EggPaneer"
  const hasEgg    = recipe.compatibleFoods.includes("EGG" as any)
  const hasPaneer = recipe.compatibleFoods.includes("PANEER" as any)
  if (hasEgg && hasPaneer) return "EggPaneer"
  if (hasEgg)              return "EggOnly"
  if (hasPaneer)           return "PaneerOnly"
  return "EggPaneer"
}

function buildEggetarianMeal(
  recipeId: string,
  slot: "primary" | "secondary",
  targetProtein: number,
  targetFat: number,
  veg: { primary: string; vitaminC: string },
  time: string,
): ComposedMeal {
  switch (resolveEggetarianBuilder(recipeId)) {
    case "EggOnly":    return buildEggOnlyMeal(recipeId, slot, targetProtein, targetFat, veg, time)
    case "PaneerOnly": return buildPaneerOnlyMeal(recipeId, slot, targetProtein, targetFat, veg, time)
    case "EggPaneer":
    default:           return buildEggPaneerMeal(recipeId, slot, targetProtein, targetFat, veg, time)
  }
}

function buildVegMeal(
  recipeId: string,
  slot: "primary" | "secondary",
  targetProtein: number,
  targetFat: number,
  veg: { primary: string; vitaminC: string },
  time: string,
): ComposedMeal {
  let effectiveVeg = veg
  if (recipeId === "PALAK_PANEER_VEG") {
    effectiveVeg = { primary: "SPINACH", vitaminC: "TOMATO" }
  } else if (recipeId === "KADHAI_PANEER") {
    effectiveVeg = { primary: "CAPSICUM", vitaminC: "CAPSICUM" }
  }

  const hungCurdG       = 80
  const proteinFromCurd = hungCurdG * 0.097

  const paneerNeeded    = (targetProtein - proteinFromCurd) / 0.1886
  const paneerG         = clamp(roundTo(paneerNeeded, 10), 80, 180)
  const proteinFromPaneer = paneerG * 0.1886

  const proteinGapAfterPaneer = targetProtein - proteinFromCurd - proteinFromPaneer
  const tofuG = proteinGapAfterPaneer > 5
    ? clamp(roundTo(proteinGapAfterPaneer / 0.081, 10), 0, 150)
    : 0

  const fatFromSources  = paneerG * 0.2478 + hungCurdG * 0.05 + tofuG * 0.049
  const gheeNeeded      = clamp(roundTo((targetFat - fatFromSources) / 5, 0.5), 0.5, 4)

  const ingredients: ComposedIngredient[] = [
    { foodId: "PANEER" as any, quantity: paneerG,
      prepNote: recipeId === "PANEER_BHURJI"
        ? { hi: "क्रम्बल्ड", en: "crumbled" }
        : { hi: "क्यूब्स", en: "cubes" } },
    { foodId: "HUNG_CURD" as any, quantity: hungCurdG,
      prepNote: { hi: "मैरिनेड के लिए", en: "for marinade / texture" } },
  ]
  if (tofuG > 0) {
    ingredients.push({ foodId: "TOFU_FIRM" as any, quantity: tofuG })
  }
  ingredients.push({ foodId: "GHEE" as any, quantity: gheeNeeded })
  ingredients.push({ foodId: effectiveVeg.primary as any, quantity: 80 })
  if (effectiveVeg.vitaminC !== effectiveVeg.primary) {
    ingredients.push({ foodId: effectiveVeg.vitaminC as any, quantity: 60 })
  }
  ingredients.push({ foodId: "ONION" as any, quantity: 30 })

  const recipe = RECIPES[recipeId]
  const name = recipe?.name.en ?? recipeId
  return { name, slot, time, recipeId, ingredients }
}

function buildProteinMeal(
  recipeId: string,
  slot: "primary" | "secondary",
  foodId: string,
  targetProtein: number,
  targetFat: number,
  veg: { primary: string; vitaminC: string },
  time: string,
): ComposedMeal {
  const src = PROTEIN_PER_UNIT[foodId]
  if (!src) return buildEggPaneerMeal(recipeId, slot, targetProtein, targetFat, veg, time)

  let qty: number
  if (src.unit === "count") {
    qty = clamp(Math.round(targetProtein / src.proteinPerUnit), 1, 6)
  } else {
    qty = clamp(roundTo(targetProtein / src.proteinPerUnit, 10), 80, 350)
  }

  const fatFromSource = qty * src.fatPerUnit
  const fatNeeded = targetFat - fatFromSource
  const ghee = clamp(roundTo(fatNeeded / 5, 0.5), 0.5, 4)
  const fat = foodId === "FISH_ROHU" || foodId === "PRAWNS" ? "COCONUT_OIL" : "GHEE"

  const ingredients: ComposedIngredient[] = [
    { foodId: foodId as any, quantity: qty },
    { foodId: fat as any,    quantity: ghee },
    { foodId: veg.primary as any, quantity: 80 },
  ]
  if (veg.vitaminC !== veg.primary) ingredients.push({ foodId: veg.vitaminC as any, quantity: 60 })
  if (foodId !== "FISH_ROHU") ingredients.push({ foodId: "ONION" as any, quantity: 30 })
  if (foodId !== "FISH_ROHU" && foodId !== "PRAWNS") {
    ingredients.push({ foodId: "TOMATO" as any, quantity: 60 })
  }

  if (["CHICKEN_HANDI","CHICKEN_TIKKA_DRY","CHICKEN_KALI_MIRCH","CHICKEN_SAAG"].includes(recipeId)) {
    ingredients.push({ foodId: "HUNG_CURD" as any, quantity: 60,
      prepNote: { hi: "मैरिनेड के लिए", en: "for marinade" } })
  }

  const recipe = RECIPES[recipeId]
  const name = recipe?.name.en ?? recipeId
  return { name, slot, time, recipeId, ingredients }
}

// ═════════════════════════════════════════════════════════════════════════════
// ── New builders — commit 11.3 ───────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

// ── buildThaliMeal ────────────────────────────────────────────────────────────
// BALANCED mode. Composes a thali: dal + grain + sabzi + optional protein dish.
//
// Protein arithmetic:
//   1. Dal contributes protein at ~DAL_RAW_PER_MEAL_G g raw × dal's g/g protein.
//      Toor at 21.7g/100g → 60g raw ≈ 13g protein.
//   2. Grain contributes carbs (not protein-significant at these amounts).
//   3. Remaining protein target is met by paneer/egg protein dish sized
//      using the same builders. When proteinRecipe is null the dal + sabzi
//      carry the protein and no extra protein dish is added.
//   4. Fat target: 1 tsp ghee for cooking plus whatever the protein dish adds.
//
// Grain quantities are anchored at standard household portions (see consts).
// All quantities are RAW grams consistent with the food DB.

function buildThaliMeal(
  slot: ThaliSlot,
  mealSlot: "primary" | "secondary",
  targetProtein: number,
  targetFat: number,
  diet: DietType,
  veg: { primary: string; vitaminC: string },
  time: string,
): ComposedMeal {
  const ingredients: ComposedIngredient[] = []

  // ── Dal ───────────────────────────────────────────────────────────────────
  // Fixed portion per meal. Protein contribution is accounted for before
  // sizing the protein dish.
  ingredients.push({ foodId: slot.dalFoodId as any, quantity: DAL_RAW_PER_MEAL_G,
    prepNote: { hi: "पकी हुई — 1 कटोरी", en: "cooked — 1 katori" } })

  // ── Grain ─────────────────────────────────────────────────────────────────
  // Rice meals: 50g raw rice (1 katori cooked). Roti meals: 50g atta (2 rotis).
  // JEERA_RICE adds ghee — reflected in fat accounting below.
  const isRiceMeal = slot.grainRecipe === "PLAIN_RICE" || slot.grainRecipe === "JEERA_RICE"
  const attaG = isRiceMeal ? 0 : ATTA_2_ROTI_G
  const riceRawG = isRiceMeal ? RICE_RAW_PER_MEAL_G : 0
  if (isRiceMeal) {
    ingredients.push({ foodId: "RICE_WHITE_RAW" as any, quantity: riceRawG,
      prepNote: { hi: "पका हुआ — 1 कटोरी", en: "cooked — 1 katori" } })
  } else {
    ingredients.push({ foodId: "ATTA" as any, quantity: attaG,
      prepNote: { hi: "2 रोटी", en: "2 rotis" } })
  }

  // ── Sabzi ─────────────────────────────────────────────────────────────────
  // Fixed vegetable portion. Uses rotation vegetable for the day's veg.
  // Sabzi contributes negligible protein; it's a volume + micronutrient filler.
  const sabziVegG = 150  // substantial sabzi portion for fiber / satiety
  ingredients.push({ foodId: veg.primary as any, quantity: sabziVegG })
  if (veg.vitaminC !== veg.primary) ingredients.push({ foodId: veg.vitaminC as any, quantity: 60 })
  ingredients.push({ foodId: "ONION" as any, quantity: 40 })
  ingredients.push({ foodId: "TOMATO" as any, quantity: 60 })

  // ── Cooking fat ───────────────────────────────────────────────────────────
  // 1 tsp ghee for the dal tarka + 1 tsp for sabzi cooking.
  // Jeera rice adds another 1 tsp. Total base = 2–3 tsp.
  const baseFatTsp = slot.grainRecipe === "JEERA_RICE" ? 3 : 2
  ingredients.push({ foodId: "GHEE" as any, quantity: baseFatTsp })

  // ── Protein dish ──────────────────────────────────────────────────────────
  // Protein remaining after dal's contribution. Dal protein ≈ 13–15g per
  // 60g raw serving (varies by dal type; we use 13g as a conservative anchor
  // so we don't under-prescribe the protein dish).
  const DAL_PROTEIN_ESTIMATE_G = 13
  const residualProtein = Math.max(targetProtein - DAL_PROTEIN_ESTIMATE_G, 0)

  // Fat remaining after base ghee.
  const baseFatG = baseFatTsp * 5  // each tsp = 5g fat (GHEE macros)
  const residualFat = Math.max(targetFat - baseFatG, 0)

  if (slot.proteinRecipe !== null && residualProtein > 5) {
    // Build the protein dish using the appropriate diet branch.
    // Pass reduced targets so the protein builder sizes correctly
    // rather than trying to hit the full meal target after dal is already in.
    const innerMeal = diet === "veg"
      ? buildVegMeal(slot.proteinRecipe, mealSlot, residualProtein, residualFat, veg, time)
      : buildEggetarianMeal(slot.proteinRecipe, mealSlot, residualProtein, residualFat, veg, time)
    // Incorporate the protein dish's ingredients (skip duplicates: onion/tomato already present).
    const alreadyPresent = new Set(["ONION", "TOMATO", "GHEE"])
    for (const ing of innerMeal.ingredients) {
      if (!alreadyPresent.has(ing.foodId as string)) {
        ingredients.push(ing)
      }
    }
  }

  return {
    name:        slot.mealName.en,
    slot:        mealSlot,
    time,
    recipeId:    slot.proteinRecipe ?? slot.grainRecipe,
    ingredients,
  }
}

// ── buildNonVegThaliMeal ──────────────────────────────────────────────────────
// BALANCED non-veg. Dal (optional) + grain + meat curry.

function buildNonVegThaliMeal(
  slot: NonVegThaliSlot,
  mealSlot: "primary" | "secondary",
  targetProtein: number,
  targetFat: number,
  veg: { primary: string; vitaminC: string },
  time: string,
): ComposedMeal {
  const ingredients: ComposedIngredient[] = []

  // ── Dal (optional) ────────────────────────────────────────────────────────
  const DAL_PROTEIN_ESTIMATE_G = slot.dalFoodId ? 13 : 0
  if (slot.dalFoodId) {
    ingredients.push({ foodId: slot.dalFoodId as any, quantity: DAL_RAW_PER_MEAL_G,
      prepNote: { hi: "पकी हुई — 1 कटोरी", en: "cooked — 1 katori" } })
  }

  // ── Grain ─────────────────────────────────────────────────────────────────
  const isRiceMeal = slot.grainRecipe === "PLAIN_RICE" || slot.grainRecipe === "JEERA_RICE"
  if (isRiceMeal) {
    ingredients.push({ foodId: "RICE_WHITE_RAW" as any, quantity: RICE_RAW_PER_MEAL_G,
      prepNote: { hi: "पका हुआ — 1 कटोरी", en: "cooked — 1 katori" } })
  } else {
    ingredients.push({ foodId: "ATTA" as any, quantity: ATTA_2_ROTI_G,
      prepNote: { hi: "2 रोटी", en: "2 rotis" } })
  }

  // ── Meat dish ─────────────────────────────────────────────────────────────
  const baseFatTsp  = slot.grainRecipe === "JEERA_RICE" ? 2 : 1
  const baseFatG    = baseFatTsp * 5
  const residualP   = Math.max(targetProtein - DAL_PROTEIN_ESTIMATE_G, 0)
  const residualF   = Math.max(targetFat - baseFatG, 0)

  // EGG_PANEER meatFoodId → use eggetarian builder; all others → protein builder
  const meatMeal = slot.meatFoodId === "EGG_PANEER"
    ? buildEggetarianMeal(slot.meatRecipe, mealSlot, residualP, residualF, veg, time)
    : buildProteinMeal(slot.meatRecipe, mealSlot, slot.meatFoodId, residualP, residualF, veg, time)

  const alreadyPresent = new Set(ingredients.map(i => i.foodId as string))
  for (const ing of meatMeal.ingredients) {
    if (!alreadyPresent.has(ing.foodId as string)) {
      ingredients.push(ing)
    }
  }

  if (baseFatTsp > 0) {
    ingredients.push({ foodId: "GHEE" as any, quantity: baseFatTsp })
  }

  return {
    name:     slot.mealName.en,
    slot:     mealSlot,
    time,
    recipeId: slot.meatRecipe,
    ingredients,
  }
}

// ── buildDalMeal ──────────────────────────────────────────────────────────────
// LOW_CARB mode. Dal as main carb+protein source. Optional 1 roti. Rich sabzi.
// No rice. No potato. Protein gap topped up by paneer/egg from the sabziRecipe
// (which in LC rotations is always a paneer/egg dish, not a pure veg dish).

function buildDalMeal(
  slot: DalMealSlot & { meatRecipe?: string; meatFoodId?: string },
  mealSlot: "primary" | "secondary",
  targetProtein: number,
  targetFat: number,
  diet: DietType,
  veg: { primary: string; vitaminC: string },
  time: string,
): ComposedMeal {
  const ingredients: ComposedIngredient[] = []

  // Dal — fixed standard portion
  ingredients.push({ foodId: slot.dalFoodId as any, quantity: DAL_RAW_PER_MEAL_G,
    prepNote: { hi: "पकी हुई — 1 कटोरी", en: "cooked — 1 katori" } })

  // Optional 1 roti (some LC meals have a small grain, others don't)
  const hasRoti = slot.grainRecipe !== null
  if (hasRoti) {
    ingredients.push({ foodId: "ATTA" as any, quantity: ATTA_1_ROTI_G,
      prepNote: { hi: "1 रोटी", en: "1 roti" } })
  }

  // Sabzi / protein dish — this IS the protein vehicle in LC meals.
  // The sabziRecipe field doubles as protein recipe in the LC rotation.
  const DAL_PROTEIN_ESTIMATE_G = 13
  const residualP = Math.max(targetProtein - DAL_PROTEIN_ESTIMATE_G, 0)
  const baseFatG  = 10  // 2 tsp ghee for dal + roti cooking base
  const residualF = Math.max(targetFat - baseFatG, 0)

  // If a meat recipe is specified (non-veg LC), use that; else use sabziRecipe
  let innerMeal: ComposedMeal
  if (slot.meatRecipe && slot.meatFoodId && diet === "non-veg") {
    if (slot.meatFoodId === "EGG_PANEER") {
      innerMeal = buildEggetarianMeal(slot.meatRecipe, mealSlot, residualP, residualF, veg, time)
    } else {
      innerMeal = buildProteinMeal(slot.meatRecipe, mealSlot, slot.meatFoodId, residualP, residualF, veg, time)
    }
  } else if (diet === "veg") {
    innerMeal = buildVegMeal(slot.sabziRecipe, mealSlot, residualP, residualF, veg, time)
  } else {
    innerMeal = buildEggetarianMeal(slot.sabziRecipe, mealSlot, residualP, residualF, veg, time)
  }

  const alreadyPresent = new Set(ingredients.map(i => i.foodId as string))
  for (const ing of innerMeal.ingredients) {
    if (!alreadyPresent.has(ing.foodId as string)) {
      ingredients.push(ing)
    }
  }

  // Base cooking ghee
  ingredients.push({ foodId: "GHEE" as any, quantity: 2 })
  ingredients.push({ foodId: "ONION" as any, quantity: 30 })
  ingredients.push({ foodId: "TOMATO" as any, quantity: 50 })

  return {
    name:     slot.mealName.en,
    slot:     mealSlot,
    time,
    recipeId: slot.sabziRecipe,
    ingredients,
  }
}

// ── buildRiceBowlMeal ─────────────────────────────────────────────────────────
// RECOMPOSITION mode. Protein dish + rice. Carb-forward, all protein comes
// from the main dish (no dal). Rice sized at standard katori (50g raw).
// Fat comes from the protein dish's natural fat + minimal cooking ghee.

function buildRiceBowlMeal(
  slot: RiceBowlSlot,
  mealSlot: "primary" | "secondary",
  targetProtein: number,
  targetFat: number,
  diet: DietType,
  veg: { primary: string; vitaminC: string },
  time: string,
): ComposedMeal {
  const ingredients: ComposedIngredient[] = []

  // Rice — cooked portion sized at standard 1 katori (50g raw → 150g cooked)
  ingredients.push({ foodId: "RICE_WHITE_RAW" as any, quantity: RICE_RAW_PER_MEAL_G,
    prepNote: { hi: "पका हुआ — 1 कटोरी", en: "cooked — 1 katori" } })

  // Add ghee for jeera rice
  if (slot.riceRecipe === "JEERA_RICE") {
    ingredients.push({ foodId: "GHEE" as any, quantity: 1 })
  }

  // Main protein dish — full protein target (no dal splitting here)
  const baseFatG  = slot.riceRecipe === "JEERA_RICE" ? 5 : 0
  const residualF = Math.max(targetFat - baseFatG, 0)

  const mainMeal = diet === "veg"
    ? buildVegMeal(slot.mainRecipe, mealSlot, targetProtein, residualF, veg, time)
    : buildEggetarianMeal(slot.mainRecipe, mealSlot, targetProtein, residualF, veg, time)

  const alreadyPresent = new Set(ingredients.map(i => i.foodId as string))
  for (const ing of mainMeal.ingredients) {
    if (!alreadyPresent.has(ing.foodId as string)) {
      ingredients.push(ing)
    }
  }

  return {
    name:     slot.mealName.en,
    slot:     mealSlot,
    time,
    recipeId: slot.mainRecipe,
    ingredients,
  }
}

// ── buildNonVegRiceBowlMeal ───────────────────────────────────────────────────
// RECOMP non-veg. Meat + rice.

function buildNonVegRiceBowlMeal(
  slot: NonVegRiceBowlSlot,
  mealSlot: "primary" | "secondary",
  targetProtein: number,
  targetFat: number,
  veg: { primary: string; vitaminC: string },
  time: string,
): ComposedMeal {
  const ingredients: ComposedIngredient[] = []

  ingredients.push({ foodId: "RICE_WHITE_RAW" as any, quantity: RICE_RAW_PER_MEAL_G,
    prepNote: { hi: "पका हुआ — 1 कटोरी", en: "cooked — 1 katori" } })
  if (slot.riceRecipe === "JEERA_RICE") {
    ingredients.push({ foodId: "GHEE" as any, quantity: 1 })
  }

  const baseFatG  = slot.riceRecipe === "JEERA_RICE" ? 5 : 0
  const residualF = Math.max(targetFat - baseFatG, 0)

  const meatMeal = slot.meatFoodId === "EGG_PANEER"
    ? buildEggetarianMeal(slot.meatRecipe, mealSlot, targetProtein, residualF, veg, time)
    : buildProteinMeal(slot.meatRecipe, mealSlot, slot.meatFoodId, targetProtein, residualF, veg, time)

  const alreadyPresent = new Set(ingredients.map(i => i.foodId as string))
  for (const ing of meatMeal.ingredients) {
    if (!alreadyPresent.has(ing.foodId as string)) {
      ingredients.push(ing)
    }
  }

  return {
    name:     slot.mealName.en,
    slot:     mealSlot,
    time,
    recipeId: slot.meatRecipe,
    ingredients,
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// ── Rotation resolver ────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
// Returns the correct week rotation array for a given (diet, mode) pair.
// KETO and VERY_LOW_CARB share the same keto templates — VLC carbs are already
// within keto template bounds, and the generator doesn't need to differentiate.
// HIGH_PROTEIN_CUT uses distinct lean-protein rotations (HPC_* tables) but
// the same keto builders (no grain).

type RotationResult =
  | { kind: "keto";           week: Array<KetoSlot> }
  | { kind: "nonveg_keto";    week: Array<NonVegKetoSlot> }
  | { kind: "thali";          week: Array<{ m1: ThaliSlot; m2: ThaliSlot }> }
  | { kind: "nonveg_thali";   week: Array<{ m1: NonVegThaliSlot; m2: NonVegThaliSlot }> }
  | { kind: "dal";            week: Array<{ m1: DalMealSlot & { meatRecipe?: string; meatFoodId?: string }; m2: DalMealSlot & { meatRecipe?: string; meatFoodId?: string } }> }
  | { kind: "rice_bowl";      week: Array<{ m1: RiceBowlSlot; m2: RiceBowlSlot }> }
  | { kind: "nonveg_rice_bowl"; week: Array<{ m1: NonVegRiceBowlSlot; m2: NonVegRiceBowlSlot }> }

function resolveRotation(diet: DietType, mode: MacroMode): RotationResult {
  // KETO and VERY_LOW_CARB → same keto templates
  if (mode === "KETO" || mode === "VERY_LOW_CARB") {
    if (diet === "non-veg") return { kind: "nonveg_keto", week: NON_VEG_WEEK }
    if (diet === "veg")     return { kind: "keto",        week: VEG_WEEK }
    return                         { kind: "keto",        week: EGGETARIAN_WEEK }
  }

  // BALANCED
  if (mode === "BALANCED") {
    if (diet === "non-veg") return { kind: "nonveg_thali", week: BALANCED_NON_VEG_WEEK }
    if (diet === "veg")     return { kind: "thali",        week: BALANCED_VEG_WEEK }
    return                         { kind: "thali",        week: BALANCED_EGGETARIAN_WEEK }
  }

  // LOW_CARB
  if (mode === "LOW_CARB") {
    if (diet === "non-veg") return { kind: "dal", week: LOW_CARB_NON_VEG_WEEK }
    if (diet === "veg")     return { kind: "dal", week: LOW_CARB_VEG_WEEK }
    return                         { kind: "dal", week: LOW_CARB_EGGETARIAN_WEEK }
  }

  // HIGH_PROTEIN_CUT — keto builders, distinct lean rotation
  if (mode === "HIGH_PROTEIN_CUT") {
    if (diet === "non-veg") return { kind: "nonveg_keto", week: HPC_NON_VEG_WEEK }
    if (diet === "veg")     return { kind: "keto",        week: HPC_VEG_WEEK }
    return                         { kind: "keto",        week: HPC_EGGETARIAN_WEEK }
  }

  // RECOMPOSITION
  if (mode === "RECOMPOSITION") {
    if (diet === "non-veg") return { kind: "nonveg_rice_bowl", week: RECOMP_NON_VEG_WEEK }
    if (diet === "veg")     return { kind: "rice_bowl",        week: RECOMP_VEG_WEEK }
    return                         { kind: "rice_bowl",        week: RECOMP_EGGETARIAN_WEEK }
  }

  // Fallback — should never reach here given the union is exhaustive,
  // but TypeScript needs a return path.
  return { kind: "keto", week: EGGETARIAN_WEEK }
}

// ═════════════════════════════════════════════════════════════════════════════
// ── Public API ────────────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

export type GenerationResult = {
  plan:       ComposedDayPlan
  validation: ValidationResult
  dayIndex:   number
}

export function generateDayPlan(
  targets:   GeneratorTargets,
  dayIndex:  number,
  diet:      DietType = "eggetarian",
  macroMode: MacroMode = "KETO",
  schedule:  MealSchedule = LEGACY_IF_SCHEDULE,
): GenerationResult {
  const veg = VEG_ROTATION[dayIndex % 7]

  // ── Meal times come from the schedule (commit 11.4) ───────────────────────
  // Pre-11.4 these were hardcoded "2:00 PM" / "4:30 PM" / "6:30 PM". Now they
  // come from the injected MealSchedule, which is derived from the user's IF
  // settings. When no schedule is supplied the LEGACY_IF_SCHEDULE default
  // reproduces the exact pre-11.4 clock times, so existing callers and tests
  // are unaffected.
  //
  // The generator consumes the first two main-meal times (the MealSlot
  // vocabulary supports two main meals + a shake; see mealSchedule.ts header
  // for why 3+ main meals is deferred). If a schedule somehow carries fewer
  // than two times we fall back to the legacy clock for the missing slot so
  // we never emit an undefined time.
  const m1Time    = schedule.mealTimes[0] ?? LEGACY_IF_SCHEDULE.mealTimes[0]
  const m2Time    = schedule.mealTimes[1] ?? LEGACY_IF_SCHEDULE.mealTimes[1]
  const shakeTime = schedule.shakeTime ?? LEGACY_IF_SCHEDULE.shakeTime!

  // ── Macro split across meals (commit 11.4 shake-aware) ────────────────────
  // The whey shake covers a fixed slice of the day's protein/fat. When the
  // schedule omits the shake, that slice must be redistributed across the two
  // main meals so the day still hits its target — otherwise a no-shake plan
  // would silently fall ~25g protein short. We therefore decide the shake
  // contribution first, then split only the REMAINDER between the two meals.
  const includeShake = schedule.includeShake
  const shakeP = includeShake ? 25 : 0
  const shakeF = includeShake ? 1  : 0
  const remP   = targets.proteinG - shakeP
  const remF   = targets.fatG     - shakeF
  const m1P    = roundTo(remP * 0.48, 1)
  const m2P    = remP - m1P
  const m1F    = roundTo(remF * 0.50, 1)
  const m2F    = remF - m1F

  const rotation = resolveRotation(diet, macroMode)

  let meal1: ComposedMeal
  let meal2: ComposedMeal

  switch (rotation.kind) {
    case "nonveg_keto": {
      const day = rotation.week[dayIndex % 7]
      meal1 = day.m1FoodId === "EGG_PANEER"
        ? buildEggetarianMeal(day.m1Recipe, "primary",   m1P, m1F, veg, m1Time)
        : buildProteinMeal(day.m1Recipe, "primary", day.m1FoodId, m1P, m1F, veg, m1Time)
      meal2 = day.m2FoodId === "EGG_PANEER"
        ? buildEggetarianMeal(day.m2Recipe, "secondary", m2P, m2F, veg, m2Time)
        : buildProteinMeal(day.m2Recipe, "secondary", day.m2FoodId, m2P, m2F, veg, m2Time)
      break
    }

    case "keto": {
      const day = rotation.week[dayIndex % 7]
      if (diet === "veg") {
        meal1 = buildVegMeal(day.m1Recipe, "primary",   m1P, m1F, veg, m1Time)
        meal2 = buildVegMeal(day.m2Recipe, "secondary", m2P, m2F, veg, m2Time)
      } else {
        meal1 = buildEggetarianMeal(day.m1Recipe, "primary",   m1P, m1F, veg, m1Time)
        meal2 = buildEggetarianMeal(day.m2Recipe, "secondary", m2P, m2F, veg, m2Time)
      }
      break
    }

    case "thali": {
      const day = rotation.week[dayIndex % 7]
      meal1 = buildThaliMeal(day.m1, "primary",   m1P, m1F, diet, veg, m1Time)
      meal2 = buildThaliMeal(day.m2, "secondary", m2P, m2F, diet, veg, m2Time)
      break
    }

    case "nonveg_thali": {
      const day = rotation.week[dayIndex % 7]
      meal1 = buildNonVegThaliMeal(day.m1, "primary",   m1P, m1F, veg, m1Time)
      meal2 = buildNonVegThaliMeal(day.m2, "secondary", m2P, m2F, veg, m2Time)
      break
    }

    case "dal": {
      const day = rotation.week[dayIndex % 7]
      meal1 = buildDalMeal(day.m1, "primary",   m1P, m1F, diet, veg, m1Time)
      meal2 = buildDalMeal(day.m2, "secondary", m2P, m2F, diet, veg, m2Time)
      break
    }

    case "rice_bowl": {
      const day = rotation.week[dayIndex % 7]
      meal1 = buildRiceBowlMeal(day.m1, "primary",   m1P, m1F, diet, veg, m1Time)
      meal2 = buildRiceBowlMeal(day.m2, "secondary", m2P, m2F, diet, veg, m2Time)
      break
    }

    case "nonveg_rice_bowl": {
      const day = rotation.week[dayIndex % 7]
      meal1 = buildNonVegRiceBowlMeal(day.m1, "primary",   m1P, m1F, veg, m1Time)
      meal2 = buildNonVegRiceBowlMeal(day.m2, "secondary", m2P, m2F, veg, m2Time)
      break
    }

    default: {
      // TypeScript exhaustive check — should never reach
      const _exhaustive: never = rotation
      const day = EGGETARIAN_WEEK[dayIndex % 7]
      meal1 = buildEggetarianMeal(day.m1Recipe, "primary",   m1P, m1F, veg, m1Time)
      meal2 = buildEggetarianMeal(day.m2Recipe, "secondary", m2P, m2F, veg, m2Time)
    }
  }

  // ── Assemble the day's meals, time-sorted ─────────────────────────────────
  // The shake (when included) sits between the two main meals. Downstream
  // slot-index logic (mealSwap, tomorrowPlan) keys off the time-sorted
  // position, so we keep the array ordered by clock time. With the legacy
  // schedule this reproduces [meal1, shake, meal2] exactly.
  const meals: ComposedMeal[] = [meal1, meal2]
  if (includeShake) {
    const shake: ComposedMeal = {
      name: "Whey Protein Shake",
      slot: "shake",
      time: shakeTime,
      recipeId: "WHEY_SHAKE",
      ingredients: [{ foodId: "WHEY" as any, quantity: 1 }],
    }
    meals.push(shake)
  }
  meals.sort((a, b) => parseClockToMinutes(a.time) - parseClockToMinutes(b.time))

  const shakeNote = includeShake ? "with shake" : "no shake"
  const plan: ComposedDayPlan = {
    meals,
    meta: {
      decisions: [
        `Diet: ${diet} | Mode: ${macroMode} | Day: ${dayIndex} | Veg: ${veg.primary}`,
        `Target: P${targets.proteinG}g F${targets.fatG}g C${targets.carbsG}g ${targets.calories}kcal`,
        `Schedule: ${meals.map(m => m.time).join(" / ")} (${shakeNote})`,
      ],
    },
  }

  const validation = validateNutrition(plan, macroMode, targets)
  return { plan, validation, dayIndex }
}

// Parse a "H:MM AM/PM" clock string to minutes since midnight, for time-
// sorting the day's meals. Mirrors mealSwap.parseTimeForSort (kept local to
// avoid a cross-module dependency from the engine layer into the store-facing
// swap layer). Unparseable strings sort to the end.
function parseClockToMinutes(time: string): number {
  const m = time.match(/(\d+)(?::(\d+))?\s*(AM|PM)?/i)
  if (!m) return 9999
  let h = parseInt(m[1], 10)
  const min = m[2] ? parseInt(m[2], 10) : 0
  const ampm = m[3]?.toUpperCase()
  if (ampm === "PM" && h < 12) h += 12
  if (ampm === "AM" && h === 12) h = 0
  return h * 60 + min
}

export function generateWeekPlan(
  targets:   GeneratorTargets,
  diet:      DietType = "eggetarian",
  macroMode: MacroMode = "KETO",
  schedule:  MealSchedule = LEGACY_IF_SCHEDULE,
): GenerationResult[] {
  return Array.from({ length: 7 }, (_, i) => generateDayPlan(targets, i, diet, macroMode, schedule))
}
