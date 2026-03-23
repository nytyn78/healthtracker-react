import { KEYS } from "./storageKeys"
/**
 * familyMode.ts
 * Family mode — multiple members, shared kitchen, unified meal planning.
 *
 * Architecture:
 *   - Each family member has a profile (name, age, sex, goal mode, diet tag)
 *   - One member is the "primary" user (existing app user)
 *   - Shared meal plan shows which meals suit which members
 *   - Family meal filter: given a recipe, which members can eat it?
 *   - Shopping list generated from the shared weekly meal plan
 *   - Each member's individual calorie/macro targets are calculated and shown
 *
 * Storage: localStorage key "family_members"
 * Primary user's data stays in existing ht-react-store (unchanged)
 */

import type { GoalMode } from "./goalModeConfig"
import type { DietTag } from "../store/useHealthStore"

// ── Types ─────────────────────────────────────────────────────────────────────

export type MemberRole = "primary" | "member"

export interface FamilyMember {
  id: string
  name: string
  age: number
  sex: "male" | "female"
  role: MemberRole
  dietTag: DietTag            // veg / eggetarian / non_veg
  goalMode: GoalMode
  weightKg?: number
  heightCm?: number
  activityLevel?: "sedentary" | "lightly_active" | "moderately_active" | "very_active"
  targetCalories?: number     // optional override
  conditions?: string[]       // health condition IDs from healthConditions.ts
  notes?: string              // e.g. "lactose intolerant", "no mushrooms"
  colour: string              // avatar colour for UI
  emoji: string               // avatar emoji
}

export interface FamilySettings {
  enabled: boolean
  members: FamilyMember[]
  sharedMealPlanEnabled: boolean
  kitchenNotes: string        // e.g. "No beef, nut allergy in family"
}

// ── Default colours and emojis for member avatars ────────────────────────────

const MEMBER_COLOURS = [
  "#0d9488", // teal
  "#7c3aed", // purple
  "#dc2626", // red
  "#d97706", // amber
  "#2563eb", // blue
  "#059669", // green
  "#db2777", // pink
  "#9333ea", // violet
]

const MEMBER_EMOJIS = ["👤","👨","👩","👦","👧","🧔","👴","👵","🧑"]

export function getDefaultColour(index: number): string {
  return MEMBER_COLOURS[index % MEMBER_COLOURS.length]
}
export function getDefaultEmoji(index: number): string {
  return MEMBER_EMOJIS[index % MEMBER_EMOJIS.length]
}

// ── Diet compatibility ────────────────────────────────────────────────────────

/**
 * Can a member with a given diet tag eat a meal with a given tag?
 * veg can eat veg only.
 * eggetarian can eat veg and eggetarian.
 * non_veg can eat everything.
 */
export function canEat(memberTag: DietTag, mealTag: DietTag): boolean {
  if (memberTag === "non_veg") return true
  if (memberTag === "eggetarian") return mealTag === "veg" || mealTag === "eggetarian"
  return mealTag === "veg"
}

/**
 * Which members can eat a given meal?
 */
export function getCompatibleMembers(members: FamilyMember[], mealTag: DietTag): FamilyMember[] {
  return members.filter(m => canEat(m.dietTag, mealTag))
}

/**
 * What is the most restrictive diet tag that all members can eat?
 * Returns null if no common ground exists.
 */
export function getCommonDietTag(members: FamilyMember[]): DietTag | null {
  if (members.every(m => m.dietTag === "veg")) return "veg"
  if (members.every(m => m.dietTag === "veg" || m.dietTag === "eggetarian")) return "eggetarian"
  if (members.length > 0) return "non_veg"
  return null
}

// ── Simple TDEE estimate per member ──────────────────────────────────────────

const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
}

export function estimateMemberTDEE(member: FamilyMember): number | null {
  if (!member.weightKg || !member.heightCm || !member.age) return null
  // Mifflin-St Jeor
  const bmr = member.sex === "male"
    ? 10 * member.weightKg + 6.25 * member.heightCm - 5 * member.age + 5
    : 10 * member.weightKg + 6.25 * member.heightCm - 5 * member.age - 161
  const multiplier = ACTIVITY_MULTIPLIERS[member.activityLevel ?? "moderately_active"]
  return Math.round(bmr * multiplier)
}

export function estimateMemberCalorieTarget(member: FamilyMember): number | null {
  if (member.targetCalories) return member.targetCalories
  const tdee = estimateMemberTDEE(member)
  if (!tdee) return null
  // Basic adjustments per goal mode
  if (member.goalMode === "fat_loss") return tdee - 500
  if (member.goalMode === "recomposition") return tdee - 250
  if (member.goalMode === "geriatric") return tdee - 150   // very gentle deficit
  if (member.goalMode === "pregnancy_t2") return tdee + 300
  if (member.goalMode === "pregnancy_t3") return tdee + 450
  if (member.goalMode === "breastfeeding") return tdee + 450
  return tdee
}

// ── Shopping list generation ──────────────────────────────────────────────────

export interface ShoppingItem {
  ingredient: string
  meals: string[]    // which meals need this
}

export function buildShoppingList(ingredients: { ingredient: string; meal: string }[]): ShoppingItem[] {
  const map = new Map<string, string[]>()
  for (const { ingredient, meal } of ingredients) {
    const key = ingredient.toLowerCase().trim()
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(meal)
  }
  return Array.from(map.entries())
    .map(([ingredient, meals]) => ({ ingredient, meals: [...new Set(meals)] }))
    .sort((a, b) => a.ingredient.localeCompare(b.ingredient))
}

// ── localStorage helpers ──────────────────────────────────────────────────────

const FAMILY_KEY = KEYS.FAMILY_SETTINGS

export function loadFamilySettings(): FamilySettings {
  try {
    const raw = localStorage.getItem(FAMILY_KEY)
    return raw
      ? JSON.parse(raw)
      : { enabled: false, members: [], sharedMealPlanEnabled: true, kitchenNotes: "" }
  } catch {
    return { enabled: false, members: [], sharedMealPlanEnabled: true, kitchenNotes: "" }
  }
}

export function saveFamilySettings(s: FamilySettings) {
  try { localStorage.setItem(FAMILY_KEY, JSON.stringify(s)) } catch {}
}

export function makeMemberId(): string {
  return `member-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}
