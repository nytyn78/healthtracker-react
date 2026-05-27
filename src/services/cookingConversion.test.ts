// ── cookingConversion.test.ts ─────────────────────────────────────────────────
// Covers: raw↔cooked conversion, household-unit conversion, atta/roti math.
//
// Run:  npm test

import { describe, it, expect } from "vitest"
import {
  RAW_TO_COOKED_RICE,
  RAW_TO_COOKED_DAL,
  ATTA_PER_ROTI_G,
  COOKED_ROTI_G,
  KATORI_COOKED_G,
  GLASS_LIQUID_G,
  rawToCookedG,
  cookedToRawG,
  householdUnitToFoodQuantity,
  rotisToAttaG,
  attaToRotis,
} from "./cookingConversion"

// ── Constants sanity ──────────────────────────────────────────────────────────
// These guard against accidental tuning of the named ratios. The values are
// conventional Indian household figures; changing them should be a deliberate
// commit, not a drive-by edit.

describe("conversion constants", () => {
  it("rice expands threefold", () => {
    expect(RAW_TO_COOKED_RICE).toBe(3.0)
  })
  it("dal expands 2.5×", () => {
    expect(RAW_TO_COOKED_DAL).toBe(2.5)
  })
  it("standard roti is 25g atta", () => {
    expect(ATTA_PER_ROTI_G).toBe(25)
  })
  it("standard roti weighs 40g cooked", () => {
    expect(COOKED_ROTI_G).toBe(40)
  })
  it("standard katori holds 150g cooked", () => {
    expect(KATORI_COOKED_G).toBe(150)
  })
  it("standard glass is 200ml liquid", () => {
    expect(GLASS_LIQUID_G).toBe(200)
  })
})

// ── rawToCookedG ──────────────────────────────────────────────────────────────

describe("rawToCookedG", () => {
  it("triples rice mass", () => {
    expect(rawToCookedG("RICE_WHITE_RAW", 50)).toBe(150)
    expect(rawToCookedG("RICE_BROWN_RAW", 50)).toBe(150)
  })

  it("scales dal by 2.5×", () => {
    expect(rawToCookedG("TOOR_DAL",  60)).toBeCloseTo(150)
    expect(rawToCookedG("MOONG_DAL", 60)).toBeCloseTo(150)
    expect(rawToCookedG("RAJMA",     60)).toBeCloseTo(150)
  })

  it("handles atta via roti math (25g → 40g cooked)", () => {
    expect(rawToCookedG("ATTA",  25)).toBe(40)
    expect(rawToCookedG("ATTA",  50)).toBe(80)
    expect(rawToCookedG("ATTA", 100)).toBe(160)
  })

  it("treats oats and sooji like rice (3×)", () => {
    expect(rawToCookedG("OATS_RAW", 40)).toBe(120)
    expect(rawToCookedG("SOOJI",    50)).toBe(150)
  })

  it("treats whole grains (bajra/jowar/ragi/barley) as 3×", () => {
    expect(rawToCookedG("BAJRA",  40)).toBe(120)
    expect(rawToCookedG("JOWAR",  40)).toBe(120)
    expect(rawToCookedG("RAGI",   40)).toBe(120)
    expect(rawToCookedG("BARLEY", 40)).toBe(120)
  })

  it("rehydrates poha 2× (already pre-cooked)", () => {
    expect(rawToCookedG("POHA", 30)).toBe(60)
  })

  it("returns null for foods without a raw/cooked distinction", () => {
    // Vegetables, meats, dairy — caller uses raw mass directly.
    expect(rawToCookedG("PANEER",   100)).toBeNull()
    expect(rawToCookedG("SPINACH",   80)).toBeNull()
    expect(rawToCookedG("EGG",        2)).toBeNull()
    expect(rawToCookedG("COW_MILK", 200)).toBeNull()
    expect(rawToCookedG("GHEE",       1)).toBeNull()
  })
})

// ── cookedToRawG (inverse) ────────────────────────────────────────────────────

describe("cookedToRawG", () => {
  it("inverts rice 3× ratio", () => {
    expect(cookedToRawG("RICE_WHITE_RAW", 150)).toBe(50)
  })

  it("inverts dal 2.5× ratio", () => {
    expect(cookedToRawG("TOOR_DAL", 150)).toBe(60)
  })

  it("inverts atta/roti math", () => {
    // 1 cooked roti (40g) is built from 25g atta.
    expect(cookedToRawG("ATTA", 40)).toBe(25)
    expect(cookedToRawG("ATTA", 80)).toBe(50)
  })

  it("is the inverse of rawToCookedG for all supported foods", () => {
    const samples: Array<[Parameters<typeof rawToCookedG>[0], number]> = [
      ["RICE_WHITE_RAW", 50],
      ["TOOR_DAL", 60],
      ["ATTA", 75],
      ["OATS_RAW", 40],
      ["BAJRA", 30],
      ["POHA", 30],
    ]
    for (const [foodId, raw] of samples) {
      const cooked = rawToCookedG(foodId, raw)
      expect(cooked).not.toBeNull()
      const back = cookedToRawG(foodId, cooked!)
      expect(back).toBeCloseTo(raw, 5)
    }
  })

  it("returns null for foods without conversion", () => {
    expect(cookedToRawG("PANEER",   100)).toBeNull()
    expect(cookedToRawG("CHICKEN_BREAST", 200)).toBeNull()
  })
})

// ── householdUnitToRawG ───────────────────────────────────────────────────────

describe("householdUnitToFoodQuantity — katori", () => {
  it("1 katori rice = 50g dry", () => {
    // 150g cooked / 3.0 = 50g raw
    expect(householdUnitToFoodQuantity("katori", 1, "RICE_WHITE_RAW")).toBe(50)
  })

  it("1 katori dal = 60g dry", () => {
    // 150g cooked / 2.5 = 60g raw
    expect(householdUnitToFoodQuantity("katori", 1, "TOOR_DAL")).toBe(60)
    expect(householdUnitToFoodQuantity("katori", 1, "MOONG_DAL")).toBe(60)
  })

  it("1.5 katori rice = 75g dry", () => {
    expect(householdUnitToFoodQuantity("katori", 1.5, "RICE_WHITE_RAW")).toBe(75)
  })

  it("returns null for foods that aren't served by katori", () => {
    expect(householdUnitToFoodQuantity("katori", 1, "PANEER")).toBeNull()
    expect(householdUnitToFoodQuantity("katori", 1, "EGG")).toBeNull()
    expect(householdUnitToFoodQuantity("katori", 1, "COW_MILK")).toBeNull()
  })
})

describe("householdUnitToFoodQuantity — roti", () => {
  it("1 roti = 25g atta", () => {
    expect(householdUnitToFoodQuantity("roti", 1, "ATTA")).toBe(25)
  })

  it("2 rotis = 50g atta", () => {
    expect(householdUnitToFoodQuantity("roti", 2, "ATTA")).toBe(50)
  })

  it("rejects roti for non-atta foods (category error)", () => {
    expect(householdUnitToFoodQuantity("roti", 1, "RICE_WHITE_RAW")).toBeNull()
    expect(householdUnitToFoodQuantity("roti", 1, "SOOJI")).toBeNull()
    expect(householdUnitToFoodQuantity("roti", 1, "MAIDA")).toBeNull()
  })
})

describe("householdUnitToFoodQuantity — glass", () => {
  it("1 glass milk = 200g (cow or buffalo)", () => {
    expect(householdUnitToFoodQuantity("glass", 1, "COW_MILK")).toBe(200)
    expect(householdUnitToFoodQuantity("glass", 1, "BUFFALO_MILK")).toBe(200)
  })

  it("scales linearly", () => {
    expect(householdUnitToFoodQuantity("glass", 0.5, "COW_MILK")).toBe(100)
    expect(householdUnitToFoodQuantity("glass", 2,   "COW_MILK")).toBe(400)
  })

  it("rejects glass for non-liquid foods", () => {
    expect(householdUnitToFoodQuantity("glass", 1, "PANEER")).toBeNull()
    expect(householdUnitToFoodQuantity("glass", 1, "RICE_WHITE_RAW")).toBeNull()
  })
})

describe("householdUnitToFoodQuantity — tsp/tbsp on per-tsp foods", () => {
  // Foods stored as unitType: "tsp" in foodDatabase. The household unit
  // matches the food's native unit, so tsp count passes through directly
  // and 1 tbsp = 3 tsp.

  it("2 tsp ghee = 2 (tsp count, GHEE's native unit)", () => {
    expect(householdUnitToFoodQuantity("tsp", 2, "GHEE")).toBe(2)
  })

  it("1 tbsp ghee = 3 tsp", () => {
    expect(householdUnitToFoodQuantity("tbsp", 1, "GHEE")).toBe(3)
  })

  it("works for butter, coconut oil, cream, half-and-half, coconut milk", () => {
    expect(householdUnitToFoodQuantity("tsp",  1, "BUTTER")).toBe(1)
    expect(householdUnitToFoodQuantity("tsp",  1, "COCONUT_OIL")).toBe(1)
    expect(householdUnitToFoodQuantity("tsp",  1, "CREAM")).toBe(1)
    expect(householdUnitToFoodQuantity("tsp",  1, "HALF_AND_HALF")).toBe(1)
    expect(householdUnitToFoodQuantity("tbsp", 1, "COCONUT_MILK_THICK")).toBe(3)
  })

  it("scales linearly", () => {
    expect(householdUnitToFoodQuantity("tsp",  4, "GHEE")).toBe(4)
    expect(householdUnitToFoodQuantity("tbsp", 2, "GHEE")).toBe(6)
  })
})

describe("householdUnitToFoodQuantity — tsp/tbsp on per-gram foods", () => {
  // Foods stored as unitType: "grams" but meaningfully measurable by tsp/tbsp
  // (e.g. atta-for-tadka, sooji-for-poha). 1 tsp ≈ 5g, 1 tbsp ≈ 15g.

  it("1 tsp sooji = 5g raw", () => {
    expect(householdUnitToFoodQuantity("tsp", 1, "SOOJI")).toBe(5)
  })

  it("1 tbsp atta = 15g raw", () => {
    expect(householdUnitToFoodQuantity("tbsp", 1, "ATTA")).toBe(15)
  })

  it("scales linearly", () => {
    expect(householdUnitToFoodQuantity("tsp",  3, "SOOJI")).toBe(15)
    expect(householdUnitToFoodQuantity("tbsp", 2, "ATTA")).toBe(30)
  })
})

describe("householdUnitToFoodQuantity — tsp/tbsp on per-count foods", () => {
  // Eggs (count) and whey (scoop) don't take tsp/tbsp meaningfully — return null.

  it("returns null for per-count foods", () => {
    expect(householdUnitToFoodQuantity("tsp",  1, "EGG")).toBeNull()
    expect(householdUnitToFoodQuantity("tbsp", 1, "EGG")).toBeNull()
  })

  it("returns null for per-scoop foods", () => {
    expect(householdUnitToFoodQuantity("tsp", 1, "WHEY")).toBeNull()
  })
})

// ── Convenience helpers ───────────────────────────────────────────────────────

describe("rotisToAttaG / attaToRotis", () => {
  it("3 rotis cost 75g atta", () => {
    expect(rotisToAttaG(3)).toBe(75)
  })

  it("100g atta makes 4 rotis", () => {
    expect(attaToRotis(100)).toBe(4)
  })

  it("inverse round-trip is exact", () => {
    expect(attaToRotis(rotisToAttaG(2))).toBe(2)
    expect(rotisToAttaG(attaToRotis(50))).toBe(50)
  })
})
