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

// Per-meal grain/dal/ghee portions scale CONTINUOUSLY with grainScale (no hard
// threshold — an abrupt small-plate cliff made low-calorie 3-meal users swing
// between +20% and −20%). Baselines below are the FULL-plate portions; the
// builders multiply them by grainScale, which for a low-calorie 3-meal day runs
// ~0.7–0.85 (smaller plates) and for a teen runs up to 1.75 (bigger plates).
// Ghee scales the same way, floored at 1 tsp so a meal always has some cooking
// fat.
function scaledGheeTsp(baseTsp: number, grainScale: number): number {
  return Math.max(1, roundTo(baseTsp * grainScale, 0.5))
}

// Raw dal weight for a standard serving: 60g raw → ~150g cooked (1 katori)
const DAL_RAW_PER_MEAL_G    = 60
const DAL_MAX_RAW_G         = 70

// Dal is a SECONDARY protein source in a thali (the protein dish carries the
// rest) — it shouldn't scale 1:1 with grainScale the way rice/roti does. Below
// 1x (smaller plates — elderly, 3-meal low-cal days) it scales fully, so those
// plates still shrink correctly. Above 1x (bigger-calorie targets) it's
// dampened to half effect and capped at a realistic single-serving max —
// a bigger appetite should get more grain or more of the protein dish, not
// a proportionally bigger dal bowl (uncapped, a 124kg user's 1.5x scale was
// producing 90g raw dal in one dish — closer to a family bowl than one
// person's katori).
function scaleDalG(baseG: number, grainScale: number): number {
  const dampedScale = grainScale <= 1 ? grainScale : 1 + (grainScale - 1) * 0.5
  return roundTo(clamp(baseG * dampedScale, 20, DAL_MAX_RAW_G), 5)
}

function clamp(n: number, min: number, max: number) { return Math.min(max, Math.max(min, n)) }
function roundTo(n: number, step: number) { return Math.round(n / step) * step }

// Compute cooking ghee (in tsp) to close the gap between a meal's fat target
// and the fat already supplied by its protein/veg sources.
//
// Macro-fidelity fix: the previous builders used clamp(..., FLOOR, 4) with a
// FLOOR of 0.5–1 tsp, which FORCED ghee onto meals whose protein source
// (paneer ≈ 0.25 g fat/g) already met or exceeded the fat target — the main
// driver of the +20–100% fat overshoot in the audit. This helper:
//   - returns 0 when sources already meet/exceed target (no forced floor),
//   - otherwise adds just enough ghee (¼-tsp resolution) to reach target,
//   - caps at maxTsp so a single meal never drowns in ghee.
// 1 tsp ghee = 5 g fat (GHEE macros).
const GHEE_FAT_PER_TSP = 5
function solveGhee(targetFat: number, fatFromSources: number, maxTsp = 5): number {
  const gap = targetFat - fatFromSources
  if (gap <= 0) return 0
  return clamp(roundTo(gap / GHEE_FAT_PER_TSP, 0.5), 0, maxTsp)
}

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
  const gheeNeeded = solveGhee(targetFat, fatFromSources)

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

  // Macro-fidelity: whole eggs carry ~5 g fat each (0.83 g fat/g protein). For
  // a lean high-protein meal (HPC: high protein, low fat) protein-sized whole
  // eggs blow the fat target AND cap out at 6 eggs (36 g protein) — the audit's
  // HPC protein −20% / fat +35%. So we cap whole eggs at the fat budget, then
  // fill the protein gap with EGG_WHITE (3.6 g protein, ~0 fat each). For
  // higher-fat targets (keto) the fat budget allows the full egg count and no
  // whites are needed — same behaviour as before.
  const WHOLE_EGG_PROTEIN = 6, WHOLE_EGG_FAT = 5
  const eggsByProtein = Math.round(targetProtein / WHOLE_EGG_PROTEIN)
  const eggsByFat     = Math.floor(targetFat / WHOLE_EGG_FAT)
  const eggs          = clamp(Math.min(eggsByProtein, eggsByFat), 2, 6)
  const proteinFromEggs = eggs * WHOLE_EGG_PROTEIN
  const proteinGap      = targetProtein - proteinFromEggs
  const eggWhites       = proteinGap > 4 ? clamp(Math.round(proteinGap / 3.6), 0, 8) : 0
  const fatFromEggs    = eggs * WHOLE_EGG_FAT
  const gheeNeeded     = solveGhee(targetFat, fatFromEggs)

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

  if (eggWhites > 0) {
    ingredients.push({ foodId: "EGG_WHITE" as any, quantity: eggWhites,
      prepNote: { hi: "अतिरिक्त प्रोटीन", en: "added for lean protein" } })
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

  // Macro-fidelity: cap paneer by the fat budget, not just protein. Paneer is
  // tried first and alone in every mode EXCEPT here — this function backs
  // HIGH_PROTEIN_CUT's paneer-named dishes (Kadhai Paneer, Paneer Bhurji,
  // etc.), which combine a high protein target with a tight fat budget.
  // Paneer's fat density (0.2478 g fat/g) makes that combination genuinely
  // unreachable without a lean source — confirmed by the calorie-fidelity
  // test suite: removing tofu here dropped HIGH_PROTEIN_CUT/eggetarian's
  // whole-day average from ~1340 kcal target to 1094 kcal, a real 18%
  // shortfall, not a cosmetic one. Tofu stays here ONLY as a last-resort gap
  // filler — tried after paneer, not instead of it — everywhere else in the
  // generator (BALANCED thali, LOW_CARB, RECOMPOSITION) paneer alone is
  // sufficient and tofu has been removed.
  const P_PROT = 0.1886, P_FAT = 0.2478
  const paneerByProtein = targetProtein / P_PROT
  const paneerByFat     = targetFat / P_FAT
  const paneerG          = clamp(roundTo(Math.min(paneerByProtein, paneerByFat), 10), 40, 200)
  const proteinFromPaneer = paneerG * P_PROT
  const proteinGap        = targetProtein - proteinFromPaneer
  const tofuG = proteinGap > 5 ? clamp(roundTo(proteinGap / 0.106, 10), 0, 200) : 0
  const fatFromPaneer    = paneerG * P_FAT + tofuG * 0.049
  const gheeNeeded       = solveGhee(targetFat, fatFromPaneer)

  const ingredients: ComposedIngredient[] = [
    { foodId: "PANEER" as any, quantity: paneerG,
      prepNote: recipeId === "PANEER_BHURJI"
        ? { hi: "क्रम्बल्ड", en: "crumbled" }
        : { hi: "क्यूब्स", en: "cubes" } },
  ]
  if (tofuG > 0) ingredients.push({ foodId: "TOFU_FIRM" as any, quantity: tofuG })
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
  asProteinDish: boolean = false,
): ComposedMeal {
  let effectiveVeg = veg
  if (recipeId === "PALAK_PANEER_VEG") {
    effectiveVeg = { primary: "SPINACH", vitaminC: "TOMATO" }
  } else if (recipeId === "KADHAI_PANEER") {
    effectiveVeg = { primary: "CAPSICUM", vitaminC: "CAPSICUM" }
  }

  // ── Protein composition ──────────────────────────────────────────────────
  // Two modes:
  //   asProteinDish=true  — this veg dish is the protein component of a LARGER
  //     meal (dal meal / rice bowl already supply grain + dal). Paneer alone
  //     carries the protein (no tofu filler), never stacked with dal in a way
  //     that produced unrealistic plates. Confirmed sufficient by the test
  //     suite (LOW_CARB, RECOMPOSITION targets are reachable this way).
  //   asProteinDish=false — this is a STANDALONE veg meal, and it's what
  //     backs HIGH_PROTEIN_CUT's veg rotation (Kadhai Paneer, Palak Paneer,
  //     etc. — all HPC_VEG_WEEK dishes go through this branch). HPC combines
  //     a high protein target with a tight fat budget; paneer's fat density
  //     (0.2478 g fat/g) makes that combination genuinely unreachable alone —
  //     confirmed by the calorie-fidelity tests: removing tofu here dropped
  //     HIGH_PROTEIN_CUT/veg's whole-day average to 845 kcal against a 1320
  //     kcal target, a 36% shortfall. Tofu stays here as a last-resort filler
  //     (tried after paneer, not instead of it) specifically because this
  //     branch has no other lever — no dal, no grain, nothing else to lean on.
  const PANEER_PROTEIN_PER_G = 0.1886
  const PANEER_FAT_PER_G     = 0.2478
  const TOFU_PROTEIN_PER_G   = 0.106

  let paneerG = 0, tofuG = 0, hungCurdG = 0
  let proteinFromCurd = 0, fatFromCurd = 0

  if (asProteinDish) {
    // Single protein lead — paneer. If the recipe is a NAMED paneer dish
    // (e.g. Kadhai Paneer, Palak Paneer, Matar Paneer), its name and steps
    // say "paneer", so it keeps a realistic single-dish portion (≤150g) even
    // if that undershoots the protein target. Diet-neutral dishes (not
    // paneer-named) get slightly more headroom (≤180g) since they aren't
    // visually tied to a specific serving convention.
    const recipeName = (RECIPES[recipeId]?.name.en ?? recipeId).toLowerCase()
    const isPaneerDish = recipeName.includes("paneer")
    const paneerByProtein = targetProtein / PANEER_PROTEIN_PER_G
    const paneerByFat      = Math.max(targetFat, 0) / PANEER_FAT_PER_G
    const paneerLimited    = Math.min(paneerByProtein, paneerByFat)
    if (isPaneerDish) {
      paneerG = clamp(roundTo(paneerByProtein, 10), 40, 150)
    } else {
      paneerG = clamp(roundTo(paneerLimited, 10), 30, 180)
    }
  } else {
    // Standalone: curd + fat-capped paneer + lean tofu for the gap.
    hungCurdG       = targetFat >= 35 ? 80 : targetFat >= 22 ? 50 : 30
    proteinFromCurd = hungCurdG * 0.097
    fatFromCurd     = hungCurdG * 0.05
    const fatBudgetForPaneer = Math.max(targetFat - fatFromCurd, 0)
    const paneerByProtein    = (targetProtein - proteinFromCurd) / PANEER_PROTEIN_PER_G
    const paneerByFat        = fatBudgetForPaneer / PANEER_FAT_PER_G
    paneerG = clamp(roundTo(Math.min(paneerByProtein, paneerByFat), 10), 40, 180)
    const proteinGap = targetProtein - proteinFromCurd - paneerG * PANEER_PROTEIN_PER_G
    tofuG = proteinGap > 8 ? clamp(roundTo(proteinGap / TOFU_PROTEIN_PER_G, 10), 0, 200) : 0
  }

  const fatFromSources = paneerG * PANEER_FAT_PER_G + fatFromCurd + tofuG * 0.049
  const gheeNeeded     = solveGhee(targetFat, fatFromSources)

  const ingredients: ComposedIngredient[] = []
  if (paneerG > 0) ingredients.push({ foodId: "PANEER" as any, quantity: paneerG,
    prepNote: recipeId === "PANEER_BHURJI" ? { hi: "क्रम्बल्ड", en: "crumbled" } : { hi: "क्यूब्स", en: "cubes" } })
  if (hungCurdG > 0) ingredients.push({ foodId: "HUNG_CURD" as any, quantity: hungCurdG,
    prepNote: { hi: "मैरिनेड के लिए", en: "for marinade / texture" } })
  if (tofuG > 0) ingredients.push({ foodId: "TOFU_FIRM" as any, quantity: tofuG })
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
  // Lean meats (chicken breast, fish, prawns) carry little fat, so a keto-level
  // fat target can need a lot of cooking fat. Allow up to 8 tsp here (vs the
  // default 5) so KETO/non-veg meals reach target instead of undershooting.
  const ghee = solveGhee(targetFat, fatFromSource, 8)
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
  grainScale: number = 1,
): ComposedMeal {
  const ingredients: ComposedIngredient[] = []

  // ── Dal ───────────────────────────────────────────────────────────────────
  // Portion scales with grainScale (meal-shape elasticity): bigger for high
  // calorie targets (teens), smaller across a 3-meal day (elderly). In the
  // small-plate regime the baseline itself drops (half-katori dal) so low-cal
  // 3-meal days don't overshoot.
  const dalG = scaleDalG(DAL_RAW_PER_MEAL_G, grainScale)
  ingredients.push({ foodId: slot.dalFoodId as any, quantity: dalG,
    prepNote: { hi: "पकी हुई", en: "cooked" } })

  // ── Grain ─────────────────────────────────────────────────────────────────
  // Rice meals: 50g raw rice (1 katori cooked). Roti meals: 50g atta (2 rotis).
  // Both scale with grainScale. JEERA_RICE adds ghee — in fat accounting below.
  const isRiceMeal = slot.grainRecipe === "PLAIN_RICE" || slot.grainRecipe === "JEERA_RICE"
  const attaG = isRiceMeal ? 0 : roundTo(ATTA_2_ROTI_G * grainScale, 5)
  const riceRawG = isRiceMeal ? roundTo(RICE_RAW_PER_MEAL_G * grainScale, 5) : 0
  if (isRiceMeal) {
    ingredients.push({ foodId: "RICE_WHITE_RAW" as any, quantity: riceRawG,
      prepNote: { hi: "पका हुआ — 1 कटोरी", en: "cooked — 1 katori" } })
  } else {
    ingredients.push({ foodId: "ATTA" as any, quantity: attaG,
      prepNote: { hi: "2 रोटी", en: "2 rotis" } })
  }

  // ── Sabzi ─────────────────────────────────────────────────────────────────
  // Build the sabzi from its ACTUAL recipe (slot.sabziRecipe), not from the
  // day's rotation vegetable. Pre-fix this section added veg.primary (always
  // the rotation veg, e.g. cauliflower) regardless of what the recipe was
  // named — so "Aloo Gobhi" contained no aloo and no gobhi-specific steps,
  // and the same rotation veg appeared in both the day's meals. Now the
  // vegetables come from the sabzi recipe's requiredRanges (e.g. ALOO_GOBHI →
  // potato + cauliflower) and the recipe's steps are surfaced via
  // extraRecipeIds. (11.3 regression fix.)
  const sabziFoods = buildSabziFromRecipe(slot.sabziRecipe)
  // Scale sabzi vegetable portions with grainScale too. Without this, a 3-meal
  // day (grainScale < 1, smaller plates) still served full-size sabzi (e.g.
  // 140g potato + 180g spinach), so the mains didn't shrink enough to make room
  // for breakfast and the day overshot its calorie target. Vegetables scale
  // with the plate; aromatics (onion/tomato, added below) stay fixed.
  for (const ing of sabziFoods) {
    ingredients.push({ ...ing, quantity: roundTo(ing.quantity * grainScale, 5) })
  }
  // Aromatics for the sabzi (onion/tomato) added once at thali level.
  ingredients.push({ foodId: "ONION" as any, quantity: 40 })
  ingredients.push({ foodId: "TOMATO" as any, quantity: 60 })

  // ── Cooking fat ───────────────────────────────────────────────────────────
  // 1 tsp ghee for the dal tarka + 1 tsp for sabzi cooking.
  // Jeera rice adds another 1 tsp. Total base = 2–3 tsp.
  const baseFatTsp = scaledGheeTsp(slot.grainRecipe === "JEERA_RICE" ? 3 : 2, grainScale)
  ingredients.push({ foodId: "GHEE" as any, quantity: baseFatTsp })

  // ── Protein dish ──────────────────────────────────────────────────────────
  // Protein remaining after dal's contribution. Derived from the ACTUAL dalG
  // computed above (post-dampening/cap), using dal's real ~0.217 g protein/g
  // raw anchor (toor dal's density — a reasonable cross-dal conservative
  // estimate). Previously this was `13 * grainScale`, uncapped and linear —
  // once dalG itself was capped (scaleDalG), that formula started
  // overstating dal's real protein contribution at high grainScale, which
  // under-sized the protein dish and produced a day-level calorie/protein
  // shortfall (caught by the HIGH_PROTEIN_CUT calorie-fidelity tests).
  const DAL_PROTEIN_ESTIMATE_G = dalG * 0.217
  const residualProtein = Math.max(targetProtein - DAL_PROTEIN_ESTIMATE_G, 0)

  // Fat remaining after base ghee.
  const baseFatG = baseFatTsp * 5  // each tsp = 5g fat (GHEE macros)
  const residualFat = Math.max(targetFat - baseFatG, 0)

  // Recipes whose steps should appear: the sabzi always; the protein dish when
  // one is built. (Grain steps are trivial — boil rice / make rotis — and are
  // intentionally not surfaced to keep the step list focused.)
  const extraRecipeIds: string[] = [slot.sabziRecipe]

  if (slot.proteinRecipe !== null && residualProtein > 5) {
    // Add the headline protein for the protein dish DIRECTLY, sized to the
    // residual protein and capped by the residual fat budget. We intentionally
    // do NOT call the standalone meal builders here: those add their own curd /
    // tofu / vegetable fillers meant for a standalone plate, which double-stack
    // on top of the thali's dal + grain + sabzi and caused the BALANCED
    // protein/calorie overshoot in the audit (a "Paneer Bhurji" thali was
    // landing >1000 kcal). The thali already supplies vegetables and dal; here
    // we only need the protein centrepiece.
    const recipe = RECIPES[slot.proteinRecipe]
    const recipeUsesEgg = recipe?.compatibleFoods.includes("EGG" as any)
    // requiredRanges (not compatibleFoods) is the authoritative "this food is
    // structural to the dish" signal — compatibleFoods also lists optional
    // items like CAPSICUM. A dish like PANEER_EGG_BHURJI has requiredRanges
    // for BOTH EGG and PANEER, meaning it needs both, not just egg.
    const recipeRequiresPaneer = !!recipe?.requiredRanges?.PANEER
    // Helper: add a quantity to an existing ingredient line if present, else push.
    const addOrMerge = (foodId: string, qty: number, prepNote?: { hi: string; en: string }) => {
      const existing = ingredients.find(i => i.foodId as string === foodId)
      if (existing) existing.quantity += qty
      else ingredients.push({ foodId: foodId as any, quantity: qty, prepNote })
    }
    if (diet !== "veg" && recipeUsesEgg && recipeRequiresPaneer) {
      // Combo dish (e.g. "Paneer Egg Bhurji", "Anda Paneer Masala") — the
      // recipe requires BOTH eggs and paneer. The plain recipeUsesEgg branch
      // below would add eggs only, silently dropping paneer even though the
      // dish's name and steps ("crumble paneer — serve") depend on it — this
      // is exactly what produced a "Paneer Egg Bhurji" with no paneer in its
      // ingredient list. Eggs are anchored at the recipe's own minimum (keeps
      // the egg component real without eating the whole protein budget);
      // paneer absorbs the rest of the residual protein within the recipe's
      // own paneer range, fat-capped the same way the veg paneer branch is.
      const eggRange    = recipe!.requiredRanges!.EGG!
      const paneerRange = recipe!.requiredRanges!.PANEER!
      const eggs = eggRange.min
      addOrMerge("EGG", eggs, { hi: "भुर्जी", en: "scrambled" })
      const eggProteinG = eggs * 6
      const eggFatG     = eggs * 5
      const P_PROT = 0.1886, P_FAT = 0.2478
      const paneerProteinNeeded = Math.max(residualProtein - eggProteinG, 0)
      const paneerFatBudget     = Math.max(residualFat - eggFatG, 0)
      const paneerByProtein = paneerProteinNeeded / P_PROT
      const paneerByFat     = paneerFatBudget / P_FAT
      const paneerG = clamp(roundTo(Math.min(paneerByProtein, paneerByFat), 10), paneerRange.min, paneerRange.max)
      addOrMerge("PANEER", paneerG, { hi: "क्यूब्स / क्रम्बल्ड", en: "cubes / crumbled" })
    } else if (diet !== "veg" && recipeUsesEgg) {
      // Eggetarian protein dish → whole eggs capped by fat, whites for the gap.
      const eggsByProtein = Math.round(residualProtein / 6)
      const eggsByFat     = Math.floor(residualFat / 5)
      const eggs          = clamp(Math.min(eggsByProtein, eggsByFat), 1, 4)
      addOrMerge("EGG", eggs, { hi: "भुर्जी / उबले", en: "scrambled / boiled" })
      const gap = residualProtein - eggs * 6
      const whites = gap > 4 ? clamp(Math.round(gap / 3.6), 0, 6) : 0
      if (whites > 0) addOrMerge("EGG_WHITE", whites, { hi: "अतिरिक्त प्रोटीन", en: "added for lean protein" })
    } else {
      // Veg protein dish — paneer, sized by protein but fat-capped so a lean
      // meal doesn't overshoot. Tofu is intentionally not used here (or
      // anywhere in the generator) — paneer alone carries the protein,
      // accepting a small undershoot rather than substituting an unfamiliar
      // ingredient. This is the site that previously produced a 200g tofu
      // block delivering only ~16g protein against a 40g need — paneer at
      // its cap covers a much larger share of the same gap.
      const P_PROT = 0.1886, P_FAT = 0.2478
      // Both named-paneer and diet-neutral dishes cap at a normal
      // single-dish serving (≤150g) — this thali already has dal + grain +
      // sabzi contributing calories, so the protein dish doesn't need (or
      // get) extra headroom the way a standalone dish does.
      const protName = (RECIPES[slot.proteinRecipe]?.name.en ?? "").toLowerCase()
      const isPaneerDish = protName.includes("paneer")
      const paneerByProtein = residualProtein / P_PROT
      const paneerByFat      = Math.max(residualFat, 0) / P_FAT
      const paneerLimited    = Math.min(paneerByProtein, paneerByFat)

      if (isPaneerDish) {
        const paneerG = clamp(roundTo(paneerByProtein, 10), 40, 150)
        addOrMerge("PANEER", paneerG, { hi: "क्यूब्स / क्रम्बल्ड", en: "cubes / crumbled" })
      } else {
        // Paneer leads, but slot.proteinRecipe (e.g. Dal Makhani) has no idea
        // paneer exists — its own steps never mention it. Give the paneer a
        // real instruction via PANEER_TOPPER rather than letting it appear
        // in the ingredient list with nothing telling the cook what to do
        // with it.
        const paneerG = clamp(roundTo(paneerLimited, 10), 30, 150)
        addOrMerge("PANEER", paneerG, { hi: "क्यूब्स / क्रम्बल्ड", en: "cubes / crumbled" })
        extraRecipeIds.push("PANEER_TOPPER")
      }
    }
    extraRecipeIds.push(slot.proteinRecipe)
  }

  return {
    name:           slot.mealName.en,
    slot:           mealSlot,
    time,
    recipeId:       slot.proteinRecipe ?? slot.grainRecipe,
    extraRecipeIds,
    ingredients,
  }
}

// ── buildSabziFromRecipe ──────────────────────────────────────────────────────
// Produce a sabzi's vegetable ingredients from its recipe definition, so the
// dish actually contains what its name says (ALOO_GOBHI → potato + cauliflower)
// rather than whatever the day's rotation vegetable happens to be.
//
// Portions: for each vegetable in the recipe's requiredRanges we use the
// midpoint of [min, max], rounded to 10g — a sensible single-serving sabzi
// portion. Recipes without requiredRanges fall back to their first non-fat,
// non-aromatic compatibleFood at a default portion. Fats (GHEE, oils) and
// aromatics (ONION, TOMATO) are intentionally excluded here — the thali adds
// those once at the meal level so they aren't double-counted.
// Foods the sabzi must NOT contribute to a thali: aromatics + fats (added once
// at thali level) and PROTEIN sources. A sabzi's role in the thali is the
// VEGETABLE; the protein centrepiece is the separate protein dish. Without this
// exclusion, a paneer-based sabzi (e.g. PALAK_PANEER_VEG used as the sabzi)
// contributed paneer AND the protein dish added paneer again — double paneer +
// double ghee, the BALANCED/veg fat spike in the audit (one meal hit 68 g fat).
const SABZI_AROMATICS_AND_FATS = new Set<string>([
  "GHEE", "MUSTARD_OIL", "COCONUT_OIL", "ONION", "TOMATO",
  // protein sources — belong to the protein dish, not the sabzi
  "PANEER", "EGG", "EGG_WHITE", "TOFU_FIRM", "HUNG_CURD", "DAHI",
  "CHICKEN_BREAST", "CHICKEN_THIGH", "MUTTON_KEEMA", "MUTTON_CURRY_CUT",
  "FISH_ROHU", "PRAWNS",
])
const SABZI_DEFAULT_VEG_G = 150

function buildSabziFromRecipe(recipeId: string): ComposedIngredient[] {
  const recipe = RECIPES[recipeId]
  if (!recipe) {
    // Unknown recipe — fall back to a generic vegetable portion so the meal
    // is never empty. Should not happen for the curated thali rotations.
    return [{ foodId: "CAULIFLOWER" as any, quantity: SABZI_DEFAULT_VEG_G }]
  }

  const out: ComposedIngredient[] = []
  const ranges = recipe.requiredRanges ?? {}
  for (const [foodId, range] of Object.entries(ranges)) {
    if (!range) continue
    if (SABZI_AROMATICS_AND_FATS.has(foodId)) continue
    const midpoint = roundTo((range.min + range.max) / 2, 10)
    out.push({ foodId: foodId as any, quantity: midpoint })
  }

  // No usable VEGETABLE ranges (e.g. the recipe's only required food is paneer,
  // like PALAK_PANEER_VEG) — take the first non-protein vegetable from
  // compatibleFoods so the sabzi still has a vegetable.
  if (out.length === 0) {
    const veg = recipe.compatibleFoods.find(f => !SABZI_AROMATICS_AND_FATS.has(f as string))
    if (veg) out.push({ foodId: veg as any, quantity: SABZI_DEFAULT_VEG_G })
  }

  return out
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
  grainScale: number = 1,
): ComposedMeal {
  const ingredients: ComposedIngredient[] = []

  // ── Dal (optional) ────────────────────────────────────────────────────────
  // Estimate derived from the actual (capped) dal quantity — see buildThaliMeal
  // for why this must match scaleDalG's output rather than a separate uncapped
  // linear formula.
  const nonVegDalG = slot.dalFoodId ? scaleDalG(DAL_RAW_PER_MEAL_G, grainScale) : 0
  const DAL_PROTEIN_ESTIMATE_G = nonVegDalG * 0.217
  if (slot.dalFoodId) {
    ingredients.push({ foodId: slot.dalFoodId as any, quantity: nonVegDalG,
      prepNote: { hi: "पकी हुई — 1 कटोरी", en: "cooked — 1 katori" } })
  }

  // ── Grain ─────────────────────────────────────────────────────────────────
  const isRiceMeal = slot.grainRecipe === "PLAIN_RICE" || slot.grainRecipe === "JEERA_RICE"
  if (isRiceMeal) {
    ingredients.push({ foodId: "RICE_WHITE_RAW" as any, quantity: roundTo(RICE_RAW_PER_MEAL_G * grainScale, 5),
      prepNote: { hi: "पका हुआ — 1 कटोरी", en: "cooked — 1 katori" } })
  } else {
    ingredients.push({ foodId: "ATTA" as any, quantity: roundTo(ATTA_2_ROTI_G * grainScale, 5),
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
  grainScale: number = 1,
): ComposedMeal {
  const ingredients: ComposedIngredient[] = []

  // Dal — fixed standard portion
  const dalMealDalG = scaleDalG(DAL_RAW_PER_MEAL_G, grainScale)
  ingredients.push({ foodId: slot.dalFoodId as any, quantity: dalMealDalG,
    prepNote: { hi: "पकी हुई — 1 कटोरी", en: "cooked — 1 katori" } })

  // Optional 1 roti (some LC meals have a small grain, others don't)
  const hasRoti = slot.grainRecipe !== null
  if (hasRoti) {
    ingredients.push({ foodId: "ATTA" as any, quantity: roundTo(ATTA_1_ROTI_G * grainScale, 5),
      prepNote: { hi: "1 रोटी", en: "1 roti" } })
  }

  // Sabzi / protein dish — this IS the protein vehicle in LC meals.
  // The sabziRecipe field doubles as protein recipe in the LC rotation.
  // Estimate derived from the actual (capped) dal quantity — see
  // buildThaliMeal for why this must track scaleDalG's output.
  const DAL_PROTEIN_ESTIMATE_G = dalMealDalG * 0.217
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
    innerMeal = buildVegMeal(slot.sabziRecipe, mealSlot, residualP, residualF, veg, time, true)
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
  grainScale: number = 1,
): ComposedMeal {
  const ingredients: ComposedIngredient[] = []

  // Rice — a rice BOWL is rice-anchored (no dal sharing the plate), so it
  // carries a larger portion than a thali's rice: ~1.5 katori base. This is
  // also what keeps carb-fuel modes (RECOMPOSITION) at their carb/calorie
  // target — a single katori left them ~30% short.
  const RICE_BOWL_BASE_G = 75
  ingredients.push({ foodId: "RICE_WHITE_RAW" as any, quantity: roundTo(RICE_BOWL_BASE_G * grainScale, 5),
    prepNote: { hi: "पका हुआ — 1.5 कटोरी", en: "cooked — 1.5 katori" } })

  // Add ghee for jeera rice
  if (slot.riceRecipe === "JEERA_RICE") {
    ingredients.push({ foodId: "GHEE" as any, quantity: 1 })
  }

  // Main protein dish — full protein target (no dal splitting here)
  const baseFatG  = slot.riceRecipe === "JEERA_RICE" ? 5 : 0
  const residualF = Math.max(targetFat - baseFatG, 0)

  const mainMeal = diet === "veg"
    ? buildVegMeal(slot.mainRecipe, mealSlot, targetProtein, residualF, veg, time, true)
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
  grainScale: number = 1,
): ComposedMeal {
  const ingredients: ComposedIngredient[] = []

  ingredients.push({ foodId: "RICE_WHITE_RAW" as any, quantity: roundTo(RICE_RAW_PER_MEAL_G * grainScale, 5),
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

// ═════════════════════════════════════════════════════════════════════════════
// ── Meal-shape + portion elasticity ──────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
// Two decisions the day's plan must make, then honour in the builders:
//
//   1. MEAL COUNT — 2 meals (+ shake) for fasting users; 3 meals (breakfast +
//      lunch + dinner) for non-fasting; + a snack for growing minors. Derived
//      from (fastingEnabled, goalMode) so a non-fasting user gets 3 meals
//      automatically, no toggle required. child/teen_early can NEVER be in the
//      2-meal fasting shape (showFasting:false in goalModeConfig).
//
//   2. PORTION SIZE — the carb/protein-bearing components of each meal scale to
//      hit that meal's calorie share, instead of being fixed katoris. This is
//      what lets the engine feed a 2500 kcal teen (scale up) and a 1400 kcal
//      elderly woman across 3 small meals (scale down) from the same builders.
//      Vegetables/aromatics stay fixed (you don't eat 3× the onion).
//
// MAX_MEAL_SCALE 1.75: a baseline thali plate is ~650-700 kcal; 1.75× ≈ 1150-
// 1225 kcal — a large but still realistic plate (≈2 katori dal, 1.5 katori
// rice, 3 rotis). Beyond ~1.8× it stops resembling a single sitting, so we cap
// there and let MEAL COUNT (+ snack) absorb the rest. MIN keeps small meals
// from collapsing to nothing.
const MAX_MEAL_SCALE = 1.75
const MIN_MEAL_SCALE = 0.6

// Estimate the calories a builder produces at its UNSCALED baseline portions,
// so we can compute the scale needed to reach a target. These are approximate
// (the real total depends on the protein dish), used only to size the scale
// factor; the builders still compute exact macros from real ingredients.
// Anchored on the thali baseline (dal 60g + rice/atta 50g + sabzi + ~1 protein).
const BASELINE_MEAL_CAL = 680

// Compute the portion scale for a meal to approach its calorie share.
function computeMealScale(targetMealCal: number): number {
  if (targetMealCal <= 0) return 1
  return clamp(roundTo(targetMealCal / BASELINE_MEAL_CAL, 0.05), MIN_MEAL_SCALE, MAX_MEAL_SCALE)
}

// ── Meal-count resolution ─────────────────────────────────────────────────────
// Returns the day's shape. Driven by fasting state + goalMode, not a toggle.
//   - fasting ON  → 2 meals + shake (compressed eating window)
//   - fasting OFF → 3 meals (breakfast/lunch/dinner), no shake
//   - minors (child/teen_early), fasting always OFF → 3 meals + snack
// A user override (mealShapeOverride) can force "two" or "three" but can never
// enable fasting/2-meal for a minor.
export type MealShapeKind = "two_plus_shake" | "three" | "three_plus_snack"

export function resolveMealShape(
  fastingEnabled: boolean,
  isGrowingMinor: boolean,
  override?: "two" | "three",
): MealShapeKind {
  // Growing minors always get 3 meals + snack, never fasting/2-meal. Hard rule.
  if (isGrowingMinor) return "three_plus_snack"
  if (override === "two") return "two_plus_shake"
  if (override === "three") return "three"
  return fastingEnabled ? "two_plus_shake" : "three"
}

// ── Breakfast + snack builders ────────────────────────────────────────────────
// Breakfast is a lighter meal (smaller macro share). Per mode: grain-based
// (poha/upma) for carb-anchored modes, egg/dahi for keto/HPC. Snack is the
// growing-minor top-up (banana + peanut + curd). All ingredients are in the
// food DB; all recipes are cited.
type BreakfastKind = "poha" | "upma" | "chilla" | "paneer_chilla" | "paneer_bhurji" | "egg" | "dahi"

// Weekly breakfast ROTATION per mode × diet (indexed by dayIndex % length).
// Variety serves three goals at once: (1) breakfast isn't identical every day,
// (2) the meal-swap picker has real alternatives to offer (it draws candidates
// from OTHER days — with one fixed breakfast there was nothing to swap to),
// (3) protein-forward options (paneer chilla / bhurji) are available.
//
// Carb-anchored modes (BALANCED/RECOMP) get the grain breakfasts (poha/upma/
// chilla) plus protein options. Low/very-low-carb and keto/HPC deliberately
// EXCLUDE grain breakfasts — a poha would blow their carb target — and rotate
// among protein-dense ones (paneer chilla/bhurji, egg, dahi).
const BREAKFAST_ROTATION: Record<string, Record<DietType, BreakfastKind[]>> = {
  BALANCED: {
    veg:          ["poha", "upma", "chilla", "paneer_chilla", "poha", "dahi", "upma"],
    eggetarian:   ["poha", "egg", "upma", "paneer_chilla", "poha", "egg", "chilla"],
    "non-veg":    ["egg", "poha", "egg", "upma", "paneer_chilla", "egg", "poha"],
  },
  RECOMPOSITION: {
    veg:          ["poha", "upma", "paneer_chilla", "chilla", "poha", "paneer_chilla", "upma"],
    eggetarian:   ["egg", "poha", "paneer_chilla", "upma", "egg", "poha", "paneer_chilla"],
    "non-veg":    ["egg", "poha", "egg", "paneer_chilla", "upma", "egg", "poha"],
  },
  LOW_CARB: {
    veg:          ["chilla", "paneer_chilla", "dahi", "chilla", "paneer_bhurji", "dahi", "paneer_chilla"],
    eggetarian:   ["egg", "paneer_chilla", "egg", "paneer_bhurji", "egg", "chilla", "egg"],
    "non-veg":    ["egg", "paneer_chilla", "egg", "paneer_bhurji", "egg", "chilla", "egg"],
  },
  VERY_LOW_CARB: {
    veg:          ["paneer_bhurji", "dahi", "paneer_chilla", "paneer_bhurji", "dahi", "paneer_chilla", "dahi"],
    eggetarian:   ["egg", "paneer_bhurji", "egg", "paneer_chilla", "egg", "paneer_bhurji", "egg"],
    "non-veg":    ["egg", "paneer_bhurji", "egg", "paneer_chilla", "egg", "paneer_bhurji", "egg"],
  },
  KETO: {
    veg:          ["paneer_bhurji", "dahi", "paneer_chilla", "paneer_bhurji", "dahi", "paneer_bhurji", "paneer_chilla"],
    eggetarian:   ["egg", "paneer_bhurji", "egg", "paneer_chilla", "egg", "paneer_bhurji", "egg"],
    "non-veg":    ["egg", "paneer_bhurji", "egg", "paneer_chilla", "egg", "paneer_bhurji", "egg"],
  },
  HIGH_PROTEIN_CUT: {
    veg:          ["paneer_bhurji", "dahi", "paneer_chilla", "paneer_bhurji", "dahi", "paneer_bhurji", "paneer_chilla"],
    eggetarian:   ["egg", "paneer_bhurji", "egg", "paneer_chilla", "egg", "paneer_bhurji", "egg"],
    "non-veg":    ["egg", "paneer_bhurji", "egg", "paneer_chilla", "egg", "paneer_bhurji", "egg"],
  },
}

function pickBreakfastKind(macroMode: MacroMode, diet: DietType, dayIndex: number): BreakfastKind {
  const modeRot = BREAKFAST_ROTATION[macroMode] ?? BREAKFAST_ROTATION.BALANCED
  const arr = modeRot[diet] ?? modeRot.veg
  return arr[dayIndex % arr.length]
}

// Pick a protein "side" for a grain breakfast (poha/upma). Rotates by day so
// it's not dahi every morning (veg: dahi↔paneer; egg/non-veg: +boiled egg).
//
// Calorie-aware: a protein side adds real calories, which a LOW-calorie 3-meal
// day (e.g. a 1400-kcal elderly plan) can't afford on top of two full main
// meals — it overshoots. So the side only fires when the day has calorie
// headroom, ramping from none at ≤1500 kcal to full at ≥1700. Low-calorie users
// keep a lighter breakfast and the separate protein-shortfall advisory flags
// any resulting gap (a shake/curd suggestion) rather than the plan silently
// overshooting calories to force even protein distribution.
const BREAKFAST_PROTEIN_MIN_CAL = 1500
const BREAKFAST_PROTEIN_FULL_CAL = 1700
function breakfastProteinSide(
  diet: DietType, dayIndex: number, gapProtein: number, dayCalories: number,
): { items: ComposedIngredient[]; fat: number } {
  // Headroom factor 0..1 — how much of the protein gap to close at breakfast.
  const headroom = clamp(
    (dayCalories - BREAKFAST_PROTEIN_MIN_CAL) / (BREAKFAST_PROTEIN_FULL_CAL - BREAKFAST_PROTEIN_MIN_CAL),
    0, 1)
  const effGap = gapProtein * headroom
  if (effGap <= 2) return { items: [], fat: 0 }
  // Rotation options per diet.
  const vegCycle: Array<"dahi" | "paneer"> = ["dahi", "paneer", "dahi"]
  const eggCycle: Array<"dahi" | "paneer" | "egg"> = ["dahi", "egg", "paneer"]
  const cycle = diet === "veg" ? vegCycle : eggCycle
  const pick = cycle[dayIndex % cycle.length]

  if (pick === "egg") {
    const eggs = clamp(Math.round(effGap / 6), 1, 3)   // ~6g protein each
    return {
      items: [{ foodId: "EGG" as any, quantity: eggs, prepNote: { hi: "उबले", en: "boiled" } }],
      fat: eggs * 5,
    }
  }
  if (pick === "paneer") {
    const g = clamp(roundTo(effGap / 0.1886, 10), 30, 120)  // paneer 18.9% protein
    return {
      items: [{ foodId: "PANEER" as any, quantity: g, prepNote: { hi: "साथ में", en: "on the side" } }],
      fat: g * 0.2478,
    }
  }
  // dahi
  const g = clamp(roundTo(effGap / 0.0353, 25), 0, 200)    // dahi 3.53% protein
  return {
    items: g > 0 ? [{ foodId: "DAHI" as any, quantity: g, prepNote: { hi: "साथ में", en: "on the side" } }] : [],
    fat: g * 0.0308,
  }
}

function buildBreakfastMeal(
  macroMode: MacroMode, diet: DietType, dayIndex: number,
  targetProtein: number, targetFat: number,
  veg: { primary: string; vitaminC: string }, time: string,
  grainScale: number, dayCalories: number,
): ComposedMeal {
  const kind = pickBreakfastKind(macroMode, diet, dayIndex)
  const ingredients: ComposedIngredient[] = []
  let recipeId: string
  let dahiHasPaneer = false

  if (kind === "poha") {
    recipeId = "POHA_BREAKFAST"
    const pohaG = roundTo(50 * grainScale, 5)
    ingredients.push({ foodId: "POHA" as any, quantity: pohaG, prepNote: { hi: "धोकर", en: "rinsed" } })
    ingredients.push({ foodId: "PEANUT" as any, quantity: 15 })
    ingredients.push({ foodId: "ONION" as any, quantity: 30 })
    ingredients.push({ foodId: "MUTTER" as any, quantity: 30 })
    // Poha (rice flakes) carries almost no protein. A rotating protein side
    // (dahi / paneer / boiled egg by day) carries breakfast's protein share, so
    // it's not dahi every single morning and protein stays distributed.
    const pohaProtein = pohaG * 0.0744 + 15 * 0.25  // poha + peanut
    const side = breakfastProteinSide(diet, dayIndex, targetProtein - pohaProtein, dayCalories)
    for (const it of side.items) ingredients.push(it)
    ingredients.push({ foodId: "GHEE" as any, quantity: solveGhee(targetFat, pohaG * 0.0114 + 15 * 0.49 + side.fat) })
  } else if (kind === "upma") {
    recipeId = "VEG_UPMA"
    const soojiG = roundTo(50 * grainScale, 5)
    ingredients.push({ foodId: "SOOJI" as any, quantity: soojiG, prepNote: { hi: "भुनी", en: "roasted" } })
    ingredients.push({ foodId: "ONION" as any, quantity: 30 })
    ingredients.push({ foodId: "MUTTER" as any, quantity: 30 })
    ingredients.push({ foodId: "CAPSICUM" as any, quantity: 30 })
    const soojiProtein = soojiG * 0.1138 + 30 * 0.05  // sooji + peas
    const side = breakfastProteinSide(diet, dayIndex, targetProtein - soojiProtein, dayCalories)
    for (const it of side.items) ingredients.push(it)
    ingredients.push({ foodId: "GHEE" as any, quantity: solveGhee(targetFat, soojiG * 0.0074 + side.fat) })
  } else if (kind === "chilla") {
    recipeId = "BESAN_CHILLA"
    const besanG = roundTo(60 * grainScale, 5)
    ingredients.push({ foodId: "BESAN" as any, quantity: besanG, prepNote: { hi: "घोल", en: "batter" } })
    ingredients.push({ foodId: "ONION" as any, quantity: 30 })
    ingredients.push({ foodId: "TOMATO" as any, quantity: 30 })
    ingredients.push({ foodId: "CAPSICUM" as any, quantity: 30 })
    // Besan is protein-rich (~21%); a chilla often already meets breakfast's
    // share. Add a small dahi side only if it's still meaningfully short.
    const besanProtein = besanG * 0.2155
    const dahiG = besanProtein < targetProtein - 4
      ? clamp(roundTo((targetProtein - besanProtein) / 0.0353, 25), 0, 150) : 0
    if (dahiG > 0) ingredients.push({ foodId: "DAHI" as any, quantity: dahiG, prepNote: { hi: "साथ में", en: "on the side" } })
    ingredients.push({ foodId: "GHEE" as any, quantity: solveGhee(targetFat, besanG * 0.0531 + dahiG * 0.0308) })
  } else if (kind === "paneer_chilla") {
    // Besan chilla with folded paneer — a high-protein veg breakfast (~20-25g).
    // Besan batter carries protein + fibre; paneer folds in for the protein bump
    // the user asked for. Paneer sized to the protein gap after besan, fat-capped.
    recipeId = "PANEER_CHILLA"
    const besanG = roundTo(50 * grainScale, 5)
    ingredients.push({ foodId: "BESAN" as any, quantity: besanG, prepNote: { hi: "घोल", en: "batter" } })
    ingredients.push({ foodId: "ONION" as any, quantity: 30 })
    ingredients.push({ foodId: "TOMATO" as any, quantity: 30 })
    const besanProtein = besanG * 0.2155
    const paneerByProtein = Math.max(targetProtein - besanProtein, 0) / 0.1886
    const paneerByFat     = Math.max(targetFat - besanG * 0.0531, 0) / 0.2478
    const paneerG = clamp(roundTo(Math.min(paneerByProtein, paneerByFat), 10), 30, 100)
    ingredients.push({ foodId: "PANEER" as any, quantity: paneerG, prepNote: { hi: "क्रम्बल करके भरें", en: "crumbled, folded in" } })
    ingredients.push({ foodId: "GHEE" as any, quantity: solveGhee(targetFat, besanG * 0.0531 + paneerG * 0.2478) })
  } else if (kind === "paneer_bhurji") {
    // Scrambled paneer — high protein, very low carb. The keto/HPC breakfast.
    recipeId = "PANEER_BHURJI_BREAKFAST"
    const paneerByProtein = targetProtein / 0.1886
    const paneerByFat     = targetFat / 0.2478
    const paneerG = clamp(roundTo(Math.min(paneerByProtein, paneerByFat), 10), 60, 180)
    ingredients.push({ foodId: "PANEER" as any, quantity: paneerG, prepNote: { hi: "भुर्जी", en: "crumbled / scrambled" } })
    ingredients.push({ foodId: "ONION" as any, quantity: 30 })
    ingredients.push({ foodId: "TOMATO" as any, quantity: 40 })
    ingredients.push({ foodId: "GHEE" as any, quantity: solveGhee(targetFat, paneerG * 0.2478) })
  } else if (kind === "dahi") {
    recipeId = "DAHI_BOWL"
    const paneerByProtein = targetProtein / 0.1886
    const paneerByFat = targetFat / 0.2478
    const paneerG = clamp(roundTo(Math.min(paneerByProtein, paneerByFat), 10), 30, 150)
    ingredients.push({ foodId: "PANEER" as any, quantity: paneerG, prepNote: { hi: "क्यूब्स", en: "cubes" } })
    ingredients.push({ foodId: "DAHI" as any, quantity: 150, prepNote: { hi: "फेंटा", en: "whisked" } })
    // DAHI_BOWL's own recipe steps only cover curd (whisk, salt, serve) — they
    // have no idea paneer is being added alongside it. Flag it so the paneer
    // gets a real instruction via PANEER_TOPPER instead of appearing with
    // nothing telling the cook what to do with it.
    dahiHasPaneer = true
  } else {
    recipeId = "EGG_BREAKFAST"
    const eggsByProtein = Math.round(targetProtein / 6)
    const eggsByFat     = Math.floor(targetFat / 5)
    const eggs          = clamp(Math.min(eggsByProtein, eggsByFat), 2, 5)
    ingredients.push({ foodId: "EGG" as any, quantity: eggs, prepNote: { hi: "उबले/भुर्जी", en: "boiled/scrambled" } })
    const gap = targetProtein - eggs * 6
    const whites = gap > 4 ? clamp(Math.round(gap / 3.6), 0, 6) : 0
    if (whites > 0) ingredients.push({ foodId: "EGG_WHITE" as any, quantity: whites, prepNote: { hi: "अतिरिक्त प्रोटीन", en: "lean protein" } })
    ingredients.push({ foodId: "GHEE" as any, quantity: solveGhee(targetFat, eggs * 5) })
    ingredients.push({ foodId: "ONION" as any, quantity: 20 })
    ingredients.push({ foodId: "TOMATO" as any, quantity: 30 })
  }

  return {
    name: RECIPES[recipeId]?.name.en ?? recipeId, slot: "breakfast", time, recipeId,
    mealRole: "breakfast", ingredients,
    ...(dahiHasPaneer ? { extraRecipeIds: ["PANEER_TOPPER"] } : {}),
  }
}

// Growing-minor snack: banana + peanut + curd. Sized to its (small) calorie share.
function buildSnackMeal(targetCal: number, time: string): ComposedMeal {
  // Banana ~1.05 kcal/g, peanut ~5.6, curd ~0.61. A simple fixed-ish snack
  // scaled by target: more banana for bigger gaps.
  const bananaG = clamp(roundTo(targetCal * 0.5 / 1.05, 10), 60, 150)
  const peanutG = 20
  const dahiG   = 100
  return {
    name: "Banana + Peanuts + Curd", slot: "snack", time, recipeId: "GROWTH_SNACK", mealRole: "snack",
    ingredients: [
      { foodId: "BANANA" as any, quantity: bananaG },
      { foodId: "PEANUT" as any, quantity: peanutG },
      { foodId: "DAHI" as any,   quantity: dahiG },
    ],
  }
}

export function generateDayPlan(
  targets:   GeneratorTargets,
  dayIndex:  number,
  diet:      DietType = "eggetarian",
  macroMode: MacroMode = "KETO",
  schedule:  MealSchedule = LEGACY_IF_SCHEDULE,
  shape:     MealShapeKind = "two_plus_shake",
): GenerationResult {
  const veg = VEG_ROTATION[dayIndex % 7]
  const rotation = resolveRotation(diet, macroMode)

  // ── Build the two main meals (lunch/dinner) via the rotation switch. ────────
  // Extracted so both 2-meal and 3-meal shapes reuse it. Each main meal gets
  // its own protein/fat target and a grainScale (portion elasticity).
  function buildMains(
    p1: number, f1: number, t1: string, s1: number,
    p2: number, f2: number, t2: string, s2: number,
  ): [ComposedMeal, ComposedMeal] {
    let meal1: ComposedMeal, meal2: ComposedMeal
    switch (rotation.kind) {
      case "nonveg_keto": {
        const day = rotation.week[dayIndex % 7]
        meal1 = day.m1FoodId === "EGG_PANEER"
          ? buildEggetarianMeal(day.m1Recipe, "primary",   p1, f1, veg, t1)
          : buildProteinMeal(day.m1Recipe, "primary", day.m1FoodId, p1, f1, veg, t1)
        meal2 = day.m2FoodId === "EGG_PANEER"
          ? buildEggetarianMeal(day.m2Recipe, "secondary", p2, f2, veg, t2)
          : buildProteinMeal(day.m2Recipe, "secondary", day.m2FoodId, p2, f2, veg, t2)
        break
      }
      case "keto": {
        const day = rotation.week[dayIndex % 7]
        if (diet === "veg") {
          meal1 = buildVegMeal(day.m1Recipe, "primary",   p1, f1, veg, t1)
          meal2 = buildVegMeal(day.m2Recipe, "secondary", p2, f2, veg, t2)
        } else {
          meal1 = buildEggetarianMeal(day.m1Recipe, "primary",   p1, f1, veg, t1)
          meal2 = buildEggetarianMeal(day.m2Recipe, "secondary", p2, f2, veg, t2)
        }
        break
      }
      case "thali": {
        const day = rotation.week[dayIndex % 7]
        meal1 = buildThaliMeal(day.m1, "primary",   p1, f1, diet, veg, t1, s1)
        meal2 = buildThaliMeal(day.m2, "secondary", p2, f2, diet, veg, t2, s2)
        break
      }
      case "nonveg_thali": {
        const day = rotation.week[dayIndex % 7]
        meal1 = buildNonVegThaliMeal(day.m1, "primary",   p1, f1, veg, t1, s1)
        meal2 = buildNonVegThaliMeal(day.m2, "secondary", p2, f2, veg, t2, s2)
        break
      }
      case "dal": {
        const day = rotation.week[dayIndex % 7]
        meal1 = buildDalMeal(day.m1, "primary",   p1, f1, diet, veg, t1, s1)
        meal2 = buildDalMeal(day.m2, "secondary", p2, f2, diet, veg, t2, s2)
        break
      }
      case "rice_bowl": {
        const day = rotation.week[dayIndex % 7]
        meal1 = buildRiceBowlMeal(day.m1, "primary",   p1, f1, diet, veg, t1, s1)
        meal2 = buildRiceBowlMeal(day.m2, "secondary", p2, f2, diet, veg, t2, s2)
        break
      }
      case "nonveg_rice_bowl": {
        const day = rotation.week[dayIndex % 7]
        meal1 = buildNonVegRiceBowlMeal(day.m1, "primary",   p1, f1, veg, t1, s1)
        meal2 = buildNonVegRiceBowlMeal(day.m2, "secondary", p2, f2, veg, t2, s2)
        break
      }
      default: {
        const _exhaustive: never = rotation
        const day = EGGETARIAN_WEEK[dayIndex % 7]
        meal1 = buildEggetarianMeal(day.m1Recipe, "primary",   p1, f1, veg, t1)
        meal2 = buildEggetarianMeal(day.m2Recipe, "secondary", p2, f2, veg, t2)
      }
    }
    return [meal1, meal2]
  }

  const meals: ComposedMeal[] = []

  if (shape === "two_plus_shake") {
    // ── 2 meals + optional shake (fasting / legacy). Unchanged behaviour. ─────
    const includeShake = schedule.includeShake
    const shakeP = includeShake ? 25 : 0
    const shakeF = includeShake ? 1  : 0
    const remP = targets.proteinG - shakeP
    const remF = targets.fatG     - shakeF
    const m1P = roundTo(remP * 0.48, 1), m2P = remP - m1P
    const m1F = roundTo(remF * 0.50, 1), m2F = remF - m1F
    const m1Time = schedule.mealTimes[0] ?? LEGACY_IF_SCHEDULE.mealTimes[0]
    const m2Time = schedule.mealTimes[1] ?? LEGACY_IF_SCHEDULE.mealTimes[1]
    const shakeTime = schedule.shakeTime ?? LEGACY_IF_SCHEDULE.shakeTime!
    // Per-meal scale to hit ~half the day each (minus shake). grain modes only.
    const perMealCal = (targets.calories - (includeShake ? 120 : 0)) / 2
    const sc = computeMealScale(perMealCal)
    const [meal1, meal2] = buildMains(m1P, m1F, m1Time, sc, m2P, m2F, m2Time, sc)
    meals.push(meal1, meal2)
    if (includeShake) {
      meals.push({ name: "Whey Protein Shake", slot: "shake", time: shakeTime,
        recipeId: "WHEY_SHAKE", ingredients: [{ foodId: "WHEY" as any, quantity: 1 }] })
    }
  } else {
    // ── 3 meals (breakfast + lunch + dinner), optional growth snack. ──────────
    // Macro split: breakfast lighter (25% P / 20% F), lunch & dinner share the
    // rest. Snack (minors) takes a small slice off the top first.
    const hasSnack = shape === "three_plus_snack"
    const snackP = hasSnack ? roundTo(targets.proteinG * 0.10, 1) : 0
    const snackF = hasSnack ? roundTo(targets.fatG * 0.10, 1) : 0
    const snackCal = hasSnack ? Math.round(targets.calories * 0.12) : 0

    const afterSnackP = targets.proteinG - snackP
    const afterSnackF = targets.fatG     - snackF
    const bP = roundTo(afterSnackP * 0.18, 1)
    const bF = roundTo(afterSnackF * 0.20, 1)
    const restP = afterSnackP - bP
    const restF = afterSnackF - bF
    const lP = roundTo(restP * 0.5, 1), dP = restP - lP
    const lF = roundTo(restF * 0.5, 1), dF = restF - lF

    // Times: schedule provides 3 (breakfast/lunch/dinner). Snack mid-afternoon.
    const bTime = schedule.mealTimes[0] ?? "8:30 AM"
    const lTime = schedule.mealTimes[1] ?? "1:00 PM"
    const dTime = schedule.mealTimes[2] ?? "7:30 PM"
    const snackTime = "4:30 PM"

    // Per-meal calorie shares → scales. Breakfast lighter than the mains.
    const mainsCal = targets.calories - snackCal
    const bCal = mainsCal * 0.22
    const ldCal = mainsCal * 0.39
    const bScale  = computeMealScale(bCal)
    const ldScale = computeMealScale(ldCal)

    const breakfast = buildBreakfastMeal(macroMode, diet, dayIndex, bP, bF, veg, bTime, bScale, targets.calories)
    const [lunch, dinner] = buildMains(lP, lF, lTime, ldScale, dP, dF, dTime, ldScale)
    lunch.mealRole = "lunch"; dinner.mealRole = "dinner"
    meals.push(breakfast, lunch, dinner)
    if (hasSnack) meals.push(buildSnackMeal(snackCal, snackTime))
  }

  meals.sort((a, b) => parseClockToMinutes(a.time) - parseClockToMinutes(b.time))

  const plan: ComposedDayPlan = {
    meals,
    meta: {
      decisions: [
        `Diet: ${diet} | Mode: ${macroMode} | Day: ${dayIndex} | Veg: ${veg.primary}`,
        `Target: P${targets.proteinG}g F${targets.fatG}g C${targets.carbsG}g ${targets.calories}kcal`,
        `Shape: ${shape} | ${meals.map(m => m.time).join(" / ")}`,
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
  shape:     MealShapeKind = "two_plus_shake",
): GenerationResult[] {
  return Array.from({ length: 7 }, (_, i) => generateDayPlan(targets, i, diet, macroMode, schedule, shape))
}
