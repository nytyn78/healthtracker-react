// ── mealGenerator.ts ────────────────────────────────────────────────────────────
// Generates a ComposedDayPlan matching the user's macro targets.
//
// Diet-aware: eggetarian uses eggs+paneer+whey. Non-veg rotates chicken/mutton/fish/prawns.
// 7-day variety guaranteed — no two consecutive days use the same protein source.
// Macros computed from ingredients upward — never stored as fixed values.
//
// ⚠ STRUCTURAL DEBT — addressed in future commits 11.3 and 11.4:
//   - Meal shape is hardcoded to 2 meals + shake (2 PM / 4:30 PM / 6:30 PM).
//     This is a 19:5 IF schedule baked into the function with no toggle. A
//     KETO user who eats breakfast at 8 AM is served a 2-meal plan that
//     ignores morning food. Decoupling meal count + meal times from the
//     macro mode is commit 11.4.
//   - BALANCED / LOW_CARB / HPC / RECOMPOSITION modes still get the keto-
//     shaped meal template — no rice, no roti, no dal-as-staple. Mode-aware
//     meal templates is commit 11.3.
//
// Commit 11.0 added: macroMode threaded through to validateNutrition.
// Commit 11.1 added: pure-veg branch (buildVegMeal) using PANEER + HUNG_CURD
//   + optional TOFU. Vegetarian users no longer silently get eggs.
// Commit 11.2a added: dispatch by recipe.compatibleFoods. EGG-only recipes
//   (ANDHRA_EGG_MASALA, ANDA_CURRY, MASALA_OMELETTE, SAAG_ANDA,
//   BAINGAN_EGG_BHARTA, KARELA_ANDA, EGG_MUSHROOM_STIR_FRY) now route to
//   buildEggOnlyMeal instead of getting paneer added. PANEER-only recipes
//   (PANEER_BHURJI, KADHAI_PANEER) route to buildPaneerOnlyMeal instead of
//   getting eggs added. EGG+PANEER recipes (PANEER_EGG_BHURJI,
//   METHI_PANEER_BHURJI, ANDA_PANEER_MASALA) keep the existing builder.
//   Also fixed a pre-existing dispatch bug where non-veg meal1 looked at
//   m2FoodId instead of m1FoodId. Also renamed 3 misnamed recipe IDs
//   (KARELA_EGG_PANEER → KARELA_ANDA, PALAK_PANEER_EGGS → SAAG_ANDA,
//   EGG_PANEER_MASALA → ANDA_PANEER_MASALA).

import type { ComposedDayPlan, ComposedMeal, ComposedIngredient, GeneratorTargets } from "./composedTypes"
import { validateNutrition } from "./constraintEngine"
import type { ValidationResult } from "./constraintEngine"
import { RECIPES } from "./recipeRegistry"
import type { MacroMode } from "./adaptiveTDEE"

// Re-export for callers that previously imported GeneratorTargets from here.
// The canonical home is composedTypes.ts (moved in 11.0 to break a circular
// type import between mealGenerator.ts and constraintEngine.ts).
export type { GeneratorTargets } from "./composedTypes"

export type DietType = "eggetarian" | "non-veg" | "veg"

// ── Weekly rotation plans ──────────────────────────────────────────────────────

// Eggetarian week (commit 11.2a). 14 slots across 7 days, 13 distinct
// dishes — each dish now actually shows the ingredients its name promises
// because dispatch routes by recipe compatibleFoods (see resolveBuilder
// below). The pre-11.2a rotation routed every recipe through
// buildEggPaneerMeal regardless of its compatibleFoods, which is why
// "Andhra Egg Masala" used to come out with paneer cubes on the plate.
//
// Three recipe IDs were renamed in 11.2a for honesty:
//   EGG_PANEER_MASALA → ANDA_PANEER_MASALA (still uses both eggs + paneer)
//   PALAK_PANEER_EGGS → SAAG_ANDA          (eggs only post-10.2 rework)
//   KARELA_EGG_PANEER → KARELA_ANDA        (eggs only post-10.2 rework)
const EGGETARIAN_WEEK: Array<{ m1Recipe: string; m2Recipe: string }> = [
  { m1Recipe: "PANEER_EGG_BHURJI",    m2Recipe: "ANDA_CURRY" },             // Mon
  { m1Recipe: "ANDHRA_EGG_MASALA",    m2Recipe: "METHI_PANEER_BHURJI" },    // Tue
  { m1Recipe: "MASALA_OMELETTE",      m2Recipe: "KADHAI_PANEER" },          // Wed
  { m1Recipe: "SAAG_ANDA",            m2Recipe: "PANEER_BHURJI" },          // Thu
  { m1Recipe: "ANDA_PANEER_MASALA",   m2Recipe: "BAINGAN_EGG_BHARTA" },     // Fri
  { m1Recipe: "EGG_MUSHROOM_STIR_FRY",m2Recipe: "KARELA_ANDA" },            // Sat
  { m1Recipe: "ANDA_CURRY",           m2Recipe: "PANEER_EGG_BHURJI" },      // Sun
]

// Non-veg: rotate different proteins — chicken, mutton, fish, prawns
const NON_VEG_WEEK: Array<{ m1Recipe: string; m2Recipe: string; m1FoodId: string; m2FoodId: string }> = [
  { m1Recipe: "CHICKEN_HANDI",      m2Recipe: "ANDA_PANEER_MASALA",   m1FoodId: "CHICKEN_THIGH",  m2FoodId: "EGG_PANEER" },
  { m1Recipe: "MUTTON_KEEMA_MASALA",m2Recipe: "CHICKEN_SAAG",         m1FoodId: "MUTTON_KEEMA",   m2FoodId: "CHICKEN_BREAST" },
  { m1Recipe: "PRAWN_MASALA",       m2Recipe: "CHICKEN_TIKKA_DRY",    m1FoodId: "PRAWNS",         m2FoodId: "CHICKEN_BREAST" },
  { m1Recipe: "CHICKEN_KALI_MIRCH", m2Recipe: "MUTTON_KEEMA_PALAK",   m1FoodId: "CHICKEN_BREAST", m2FoodId: "MUTTON_KEEMA" },
  { m1Recipe: "FISH_CURRY_SIMPLE",  m2Recipe: "CHICKEN_HANDI",        m1FoodId: "FISH_ROHU",      m2FoodId: "CHICKEN_THIGH" },
  { m1Recipe: "CHICKEN_SAAG",       m2Recipe: "PRAWN_MASALA",         m1FoodId: "CHICKEN_BREAST", m2FoodId: "PRAWNS" },
  { m1Recipe: "MUTTON_KEEMA_PALAK", m2Recipe: "CHICKEN_TIKKA_DRY",    m1FoodId: "MUTTON_KEEMA",   m2FoodId: "CHICKEN_BREAST" },
]

// Pure veg: keto-compatible recipes only (commit 11.1).
//
// Keto-veg is genuinely narrow. The only 10.x recipes whose ingredient
// composition stays within KETO carb limits without eggs or meat are:
//   - PALAK_PANEER_VEG (paneer + spinach)
//   - PANEER_BHURJI    (pure paneer crumble)
//   - KADHAI_PANEER    (paneer + capsicum)
// These cycle across 7 days. Vegetable variety (different leafy/vitamin-C
// pick each day via VEG_ROTATION) makes the same recipe taste distinct day
// to day. Mid-carb veg recipes like MATAR_PANEER, ALOO_MUTTER, DAL_TADKA
// are deliberately excluded — their ingredient costs would blow keto carb
// limits, and the user-visible meal card must match what's actually cooked.
//
// 11.3 (mode-aware templates) will expand this rotation for LOW_CARB /
// BALANCED users where dal and rice become appropriate.
const VEG_WEEK: Array<{ m1Recipe: string; m2Recipe: string }> = [
  { m1Recipe: "PALAK_PANEER_VEG", m2Recipe: "PANEER_BHURJI" },     // Mon
  { m1Recipe: "KADHAI_PANEER",    m2Recipe: "PALAK_PANEER_VEG" },  // Tue
  { m1Recipe: "PANEER_BHURJI",    m2Recipe: "KADHAI_PANEER" },     // Wed
  { m1Recipe: "PALAK_PANEER_VEG", m2Recipe: "KADHAI_PANEER" },     // Thu
  { m1Recipe: "PANEER_BHURJI",    m2Recipe: "PALAK_PANEER_VEG" },  // Fri
  { m1Recipe: "KADHAI_PANEER",    m2Recipe: "PANEER_BHURJI" },     // Sat
  { m1Recipe: "PALAK_PANEER_VEG", m2Recipe: "PANEER_BHURJI" },     // Sun
]

// Vegetable rotation for the day
const VEG_ROTATION: Array<{ primary: string; vitaminC: string }> = [
  { primary: "SPINACH",     vitaminC: "TOMATO" },
  { primary: "MUSHROOM",    vitaminC: "CAPSICUM" },
  { primary: "BROCCOLI",    vitaminC: "BROCCOLI" },
  { primary: "BHINDI",      vitaminC: "BHINDI" },
  { primary: "CAULIFLOWER", vitaminC: "TOMATO" },
  { primary: "ZUCCHINI",    vitaminC: "CAPSICUM" },
  { primary: "CABBAGE",     vitaminC: "TOMATO" },
]

// ── Macro constants ────────────────────────────────────────────────────────────
// Protein per unit for each source (matches foodDatabase.ts values)
const PROTEIN_PER_UNIT: Record<string, { unit: "grams" | "count"; proteinPerUnit: number; fatPerUnit: number }> = {
  EGG:           { unit: "count",  proteinPerUnit: 6,    fatPerUnit: 5 },
  PANEER:        { unit: "grams",  proteinPerUnit: 0.18, fatPerUnit: 0.20 },
  CHICKEN_BREAST:{ unit: "grams",  proteinPerUnit: 0.31, fatPerUnit: 0.036 },
  CHICKEN_THIGH: { unit: "grams",  proteinPerUnit: 0.26, fatPerUnit: 0.085 },
  MUTTON_KEEMA:  { unit: "grams",  proteinPerUnit: 0.20, fatPerUnit: 0.18 },
  FISH_ROHU:     { unit: "grams",  proteinPerUnit: 0.17, fatPerUnit: 0.018 },
  PRAWNS:        { unit: "grams",  proteinPerUnit: 0.20, fatPerUnit: 0.013 },
}

function clamp(n: number, min: number, max: number) { return Math.min(max, Math.max(min, n)) }
function roundTo(n: number, step: number) { return Math.round(n / step) * step }

// ── Meal builder ───────────────────────────────────────────────────────────────

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

  // Get recipe name from registry
  const recipe = RECIPES[recipeId]
  const name = recipe?.name.en ?? recipeId

  return { name, slot, time, recipeId, ingredients }
}

// ── buildEggOnlyMeal (commit 11.2a) ──────────────────────────────────────────
// Egg-only meal builder for recipes whose compatibleFoods is EGG (no PANEER).
// Pre-11.2a these recipes (ANDHRA_EGG_MASALA, ANDA_CURRY, MASALA_OMELETTE,
// SAAG_ANDA, BAINGAN_EGG_BHARTA, KARELA_ANDA, EGG_MUSHROOM_STIR_FRY) all
// silently routed through buildEggPaneerMeal, which appended paneer to a
// plate where paneer doesn't belong. Now the meal-card plate matches the
// dish identity.
//
// Eggs scale to hit protein target. Each egg gives ~6g protein and ~5g fat
// (matches PROTEIN_PER_UNIT). Cap at 6 eggs per meal (~36g protein from
// eggs alone); above that, the day's whey shake + the other meal must
// cover the rest.
//
// High-egg split presentation (≥5 eggs for most recipes, ≥4 for KARELA_ANDA):
// the same total mass of eggs is shown as two ingredient lines with
// different prepNotes so the meal card reads as a varied plate. Macros are
// identical to a single-line presentation. Recipe-specific split rules
// match each dish's traditional presentation.

type EggSplitRule = {
  threshold:     number       // split when egg count >= threshold
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
  // Recipe identity overrides the day's vegetable rotation where the
  // recipe name implies a specific vegetable (mirrors buildVegMeal logic).
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

  // Egg count: scale to hit protein, cap at 6 (above that the meal feels
  // unreasonable on a single plate).
  const eggs           = clamp(Math.round(targetProtein / 6), 2, 6)
  const fatFromEggs    = eggs * 5
  const gheeNeeded     = clamp(roundTo((targetFat - fatFromEggs) / 5, 0.5), 0.5, 4)

  // Build egg ingredient line(s) — split into two forms if recipe rules
  // apply and egg count meets the threshold.
  const splitRule = EGG_SPLIT_RULES[recipeId]
  const ingredients: ComposedIngredient[] = []
  if (splitRule && eggs >= splitRule.threshold) {
    const firstForm  = Math.floor(eggs / 2)
    const secondForm = eggs - firstForm
    ingredients.push({ foodId: "EGG" as any, quantity: firstForm,  prepNote: splitRule.firstFormPrep })
    ingredients.push({ foodId: "EGG" as any, quantity: secondForm, prepNote: splitRule.secondFormPrep })
  } else {
    const defaultPrep =
      recipeId === "MASALA_OMELETTE"      ? { hi: "ऑमलेट के लिए फेंटे", en: "whisked for omelette" } :
      recipeId === "SAAG_ANDA"            ? { hi: "साग में पोच किए", en: "poached in saag" } :
      recipeId === "BAINGAN_EGG_BHARTA"   ? { hi: "बीच में फोड़े", en: "cracked into wells" } :
      recipeId === "EGG_MUSHROOM_STIR_FRY"? { hi: "हल्के स्क्रैंबल", en: "soft scramble" } :
      recipeId === "ANDA_CURRY"           ? { hi: "उबले — मसाले में", en: "boiled, in gravy" } :
      recipeId === "ANDHRA_EGG_MASALA"    ? { hi: "उबले — मसाले में", en: "boiled, in gravy" } :
      recipeId === "KARELA_ANDA"          ? { hi: "भुर्जी", en: "scrambled" } :
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

// ── buildPaneerOnlyMeal (commit 11.2a) ────────────────────────────────────────
// Paneer-only meal builder for recipes whose compatibleFoods is PANEER
// (no EGG). Pre-11.2a, eggetarian-tagged PANEER_BHURJI and KADHAI_PANEER
// silently routed through buildEggPaneerMeal and got eggs added; now they
// don't.
//
// Paneer scales to hit protein target, capped at 200g per meal. Above that
// the protein target needs adjustment (this is a single keto-veg-style
// limit; 11.3's mode-aware templates will let LOW_CARB users add dal to
// spread protein over more sources at lower per-source mass).

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
  // PANEER_BHURJI accepts any rotation veg.

  // Paneer at 18.86% protein. To hit ~35g protein from paneer alone:
  // 35 / 0.1886 = ~186g. Cap at 200g per meal for realism.
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

// ── Dispatch helper (commit 11.2a) ────────────────────────────────────────────
// Routes a recipe to the right builder based on its compatibleFoods.
// This is what makes the meal-card honest: ANDHRA_EGG_MASALA (compatibleFoods
// has EGG, no PANEER) now routes to buildEggOnlyMeal instead of getting
// paneer added to the plate.
//
// "EggPaneer" = recipe has BOTH EGG and PANEER in compatibleFoods.
// "EggOnly"   = recipe has EGG but not PANEER.
// "PaneerOnly"= recipe has PANEER but not EGG.

type EggetarianBuilder = "EggPaneer" | "EggOnly" | "PaneerOnly"

function resolveEggetarianBuilder(recipeId: string): EggetarianBuilder {
  const recipe = RECIPES[recipeId]
  if (!recipe) return "EggPaneer"  // fallback — legacy behavior
  const hasEgg    = recipe.compatibleFoods.includes("EGG" as any)
  const hasPaneer = recipe.compatibleFoods.includes("PANEER" as any)
  if (hasEgg && hasPaneer) return "EggPaneer"
  if (hasEgg)              return "EggOnly"
  if (hasPaneer)           return "PaneerOnly"
  return "EggPaneer"  // fallback — shouldn't happen for eggetarian recipes
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

// ── buildVegMeal (commit 11.1) ────────────────────────────────────────────────
// Pure-veg meal builder — no eggs, no meat. Uses PANEER + HUNG_CURD as the
// core keto-compatible co-protein pair, with TOFU added when protein needs
// exceed what paneer+curd can deliver at reasonable portions.
//
// Recipe-name awareness: PALAK_PANEER_VEG forces SPINACH as the vegetable
// regardless of the day's VEG_ROTATION; KADHAI_PANEER forces CAPSICUM;
// PANEER_BHURJI takes whatever the rotation picked. This keeps the meal-
// card name honest — a meal called "Palak Paneer" must contain spinach.
//
// Protein math: typical keto-veg target is ~35-40g protein per meal (after
// whey shake covers 25g of the daily ~100g). Paneer at 18.86% protein +
// hung curd at 9.7% protein hit this comfortably:
//   - 120g paneer = 22.6g P, 80g hung curd = 7.8g P → 30.4g protein
//   - 150g paneer + 80g hung curd → 36.1g protein
// Tofu is added only when protein needs exceed ~38g (paneer cap is ~180g
// per meal to keep portion realistic).

function buildVegMeal(
  recipeId: string,
  slot: "primary" | "secondary",
  targetProtein: number,
  targetFat: number,
  veg: { primary: string; vitaminC: string },
  time: string,
): ComposedMeal {
  // Recipe identity overrides the day's vegetable rotation for recipes
  // whose names imply a specific vegetable. PANEER_BHURJI accepts any veg.
  let effectiveVeg = veg
  if (recipeId === "PALAK_PANEER_VEG") {
    effectiveVeg = { primary: "SPINACH", vitaminC: "TOMATO" }
  } else if (recipeId === "KADHAI_PANEER") {
    effectiveVeg = { primary: "CAPSICUM", vitaminC: "CAPSICUM" }
  }

  // Hung curd contributes both protein and meal identity (replaces the
  // role eggs play in the eggetarian builder). 80g is the standard portion.
  const hungCurdG       = 80
  const proteinFromCurd = hungCurdG * 0.097  // HUNG_CURD per-g protein

  // Paneer scales to cover remaining protein, capped at 180g per meal to
  // keep the plate realistic. Above that, tofu picks up the slack.
  const paneerNeeded    = (targetProtein - proteinFromCurd) / 0.1886  // PANEER per-g protein
  const paneerG         = clamp(roundTo(paneerNeeded, 10), 80, 180)
  const proteinFromPaneer = paneerG * 0.1886

  // If paneer hit its cap and we still need more protein, add tofu.
  const proteinGapAfterPaneer = targetProtein - proteinFromCurd - proteinFromPaneer
  const tofuG = proteinGapAfterPaneer > 5
    ? clamp(roundTo(proteinGapAfterPaneer / 0.081, 10), 0, 150)  // TOFU_FIRM per-g protein
    : 0

  // Fat budget: account for paneer's high fat (24.8%) and hung curd (5%),
  // top up with ghee.
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

  // Add hung curd for marinated recipes
  if (["CHICKEN_HANDI","CHICKEN_TIKKA_DRY","CHICKEN_KALI_MIRCH","CHICKEN_SAAG"].includes(recipeId)) {
    ingredients.push({ foodId: "HUNG_CURD" as any, quantity: 60,
      prepNote: { hi: "मैरिनेड के लिए", en: "for marinade" } })
  }

  const recipe = RECIPES[recipeId]
  const name = recipe?.name.en ?? recipeId

  return { name, slot, time, recipeId, ingredients }
}

// ── Public API ────────────────────────────────────────────────────────────────

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
): GenerationResult {
  const veg      = VEG_ROTATION[dayIndex % 7]
  const shakeP   = 25
  const shakeF   = 1
  const remP     = targets.proteinG - shakeP
  const remF     = targets.fatG     - shakeF
  const m1P      = roundTo(remP * 0.48, 1)
  const m2P      = remP - m1P
  const m1F      = roundTo(remF * 0.50, 1)
  const m2F      = remF - m1F

  let meal1: ComposedMeal
  let meal2: ComposedMeal

  if (diet === "non-veg") {
    const day = NON_VEG_WEEK[dayIndex % 7]
    // 11.2a fix: meal1 dispatches on m1FoodId (was incorrectly checking
    // m2FoodId pre-11.2a, which caused day 0's meal1 to silently become
    // egg-paneer when m2 was egg-paneer — no chicken at all on day 0).
    meal1 = day.m1FoodId === "EGG_PANEER"
      ? buildEggetarianMeal(day.m1Recipe, "primary", m1P, m1F, veg, "2:00 PM")
      : buildProteinMeal(day.m1Recipe, "primary", day.m1FoodId, m1P, m1F, veg, "2:00 PM")
    meal2 = day.m2FoodId === "EGG_PANEER"
      ? buildEggetarianMeal(day.m2Recipe, "secondary", m2P, m2F, veg, "6:30 PM")
      : buildProteinMeal(day.m2Recipe, "secondary", day.m2FoodId, m2P, m2F, veg, "6:30 PM")
  } else if (diet === "veg") {
    // Pure-veg branch (11.1). Uses paneer + hung curd + optional tofu as
    // the keto-compatible co-protein stack. No eggs, no meat.
    const day = VEG_WEEK[dayIndex % 7]
    meal1 = buildVegMeal(day.m1Recipe, "primary",   m1P, m1F, veg, "2:00 PM")
    meal2 = buildVegMeal(day.m2Recipe, "secondary", m2P, m2F, veg, "6:30 PM")
  } else {
    // Eggetarian branch — uses buildEggetarianMeal which dispatches to one
    // of buildEggPaneerMeal / buildEggOnlyMeal / buildPaneerOnlyMeal based
    // on the recipe's compatibleFoods (commit 11.2a). Pre-11.2a every
    // eggetarian recipe routed to buildEggPaneerMeal regardless, which
    // caused "Andhra Egg Masala" etc. to be served with paneer that the
    // dish doesn't traditionally contain.
    const day = EGGETARIAN_WEEK[dayIndex % 7]
    meal1 = buildEggetarianMeal(day.m1Recipe, "primary",   m1P, m1F, veg, "2:00 PM")
    meal2 = buildEggetarianMeal(day.m2Recipe, "secondary", m2P, m2F, veg, "6:30 PM")
  }

  const shake: ComposedMeal = {
    name: "Whey Protein Shake",
    slot: "shake",
    time: "4:30 PM",
    recipeId: "WHEY_SHAKE",
    ingredients: [{ foodId: "WHEY" as any, quantity: 1 }],
  }

  const plan: ComposedDayPlan = {
    meals: [meal1, shake, meal2],
    meta: {
      decisions: [
        `Diet: ${diet} | Mode: ${macroMode} | Day: ${dayIndex} | Veg: ${veg.primary}`,
        `Target: P${targets.proteinG}g F${targets.fatG}g C${targets.carbsG}g ${targets.calories}kcal`,
      ],
    },
  }

  // Validator now receives the user's actual macro mode and target macros —
  // see constraintEngine.ts. Pre-11.0 this was hardcoded "keto" with a
  // single-user calorie/protein band, which misfired for every non-keto
  // user and every keto user whose target wasn't 95-105g protein.
  const validation = validateNutrition(plan, macroMode, targets)
  return { plan, validation, dayIndex }
}

export function generateWeekPlan(
  targets:   GeneratorTargets,
  diet:      DietType = "eggetarian",
  macroMode: MacroMode = "KETO",
): GenerationResult[] {
  return Array.from({ length: 7 }, (_, i) => generateDayPlan(targets, i, diet, macroMode))
}
