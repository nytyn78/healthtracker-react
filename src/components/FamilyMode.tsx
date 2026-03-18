/**
 * FamilyMode.tsx
 * Family mode management — members, shared meal planning, shopping list.
 * Accessed from Settings → Family and from MealPlanBuilder's Family tab.
 */

import { useState } from "react"
import {
  FamilyMember, FamilySettings, loadFamilySettings, saveFamilySettings,
  makeMemberId, getDefaultColour, getDefaultEmoji,
  canEat, getCompatibleMembers, estimateMemberCalorieTarget, estimateMemberTDEE,
  buildShoppingList,
} from "../services/familyMode"
import { GOAL_MODE_INFO, GoalMode } from "../services/goalModeConfig"
import { DietTag, DIET_TAG_LABELS, loadMealPlan, MealPlanEntry } from "../store/useHealthStore"

const STANDARD_MODES: GoalMode[] = ["fat_loss","recomposition","maintenance","geriatric"]
const MATERNAL_MODES: GoalMode[] = ["pre_conception","pregnancy_t1","pregnancy_t2","pregnancy_t3","postpartum","breastfeeding"]

const inputCls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-teal-500"

// ── Member Avatar ─────────────────────────────────────────────────────────────
function MemberAvatar({ member, size = 40 }: { member: FamilyMember; size?: number }) {
  return (
    <div className="rounded-full flex items-center justify-center font-bold text-white shrink-0"
         style={{ width: size, height: size, backgroundColor: member.colour, fontSize: size * 0.45 }}>
      {member.emoji}
    </div>
  )
}

// ── Member Card ───────────────────────────────────────────────────────────────
function MemberCard({ member, onEdit, onRemove }: {
  member: FamilyMember
  onEdit: () => void
  onRemove: () => void
}) {
  const tdee    = estimateMemberTDEE(member)
  const target  = estimateMemberCalorieTarget(member)
  const modeInfo = GOAL_MODE_INFO[member.goalMode]

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-3 mb-2 flex items-center gap-3">
      <MemberAvatar member={member} size={44} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-bold text-gray-800">{member.name}</span>
          {member.role === "primary" && (
            <span className="text-[9px] bg-teal-100 text-teal-700 font-bold px-1.5 py-0.5 rounded-full">Primary</span>
          )}
        </div>
        <div className="text-[10px] text-gray-400 mt-0.5">
          {member.age}y · {member.sex} · {DIET_TAG_LABELS[member.dietTag]}
        </div>
        <div className="text-[10px] text-gray-500 mt-0.5">
          {modeInfo.icon} {modeInfo.shortLabel}
          {target ? ` · ${target} kcal/day` : ""}
        </div>
        {member.notes && (
          <div className="text-[9px] text-amber-600 mt-0.5 italic">⚠️ {member.notes}</div>
        )}
      </div>
      <div className="flex flex-col gap-1 shrink-0">
        <button onClick={onEdit} className="text-xs text-teal-600 border border-teal-200 rounded-lg px-2 py-1">Edit</button>
        {member.role !== "primary" && (
          <button onClick={onRemove} className="text-xs text-red-400 border border-red-100 rounded-lg px-2 py-1">Remove</button>
        )}
      </div>
    </div>
  )
}

// ── Member Editor ─────────────────────────────────────────────────────────────
function MemberEditor({ member, index, allCount, onSave, onCancel }: {
  member: Partial<FamilyMember>
  index: number
  allCount: number
  onSave: (m: FamilyMember) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<Partial<FamilyMember>>({
    id: makeMemberId(),
    role: "member",
    colour: getDefaultColour(allCount),
    emoji: getDefaultEmoji(allCount),
    goalMode: "fat_loss",
    dietTag: "veg",
    sex: "male",
    activityLevel: "moderately_active",
    ...member,
  })
  const [showMaternalDropdown, setShowMaternalDropdown] = useState(
    MATERNAL_MODES.includes(form.goalMode as GoalMode)
  )

  function save() {
    if (!form.name?.trim() || !form.age) return
    onSave(form as FamilyMember)
  }

  const EMOJIS = ["👤","👨","👩","👦","👧","🧔","👴","👵","🧑","🧒","👲","🧕","🧑‍🦳","🧑‍🦱"]
  const COLOURS = ["#0d9488","#7c3aed","#dc2626","#d97706","#2563eb","#059669","#db2777","#9333ea","#0891b2","#65a30d"]

  return (
    <div className="bg-gray-50 rounded-2xl p-4 mb-3 border border-gray-200">
      <div className="text-sm font-bold text-gray-800 mb-3">
        {member.id ? "Edit member" : "Add family member"}
      </div>

      {/* Avatar picker */}
      <div className="mb-3">
        <label className="text-xs text-gray-500 block mb-1.5">Avatar</label>
        <div className="flex gap-2 flex-wrap mb-2">
          {EMOJIS.map(e => (
            <button key={e} onClick={() => setForm(f => ({ ...f, emoji: e }))}
              className={`w-9 h-9 rounded-full text-lg flex items-center justify-center border-2 transition-colors
                ${form.emoji === e ? "border-teal-500 bg-teal-50" : "border-gray-200 bg-white"}`}>
              {e}
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          {COLOURS.map(c => (
            <button key={c} onClick={() => setForm(f => ({ ...f, colour: c }))}
              className={`w-7 h-7 rounded-full border-2 transition-all
                ${form.colour === c ? "border-gray-800 scale-110" : "border-transparent"}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>

      {/* Name */}
      <div className="mb-2">
        <label className="text-xs text-gray-500 block mb-1">Name</label>
        <input className={inputCls} placeholder="e.g. Meera, Rahul, Grandpa"
          value={form.name ?? ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
      </div>

      {/* Age + Sex */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Age</label>
          <input className={inputCls} type="number" placeholder="e.g. 45" min={1} max={110}
            value={form.age ?? ""} onChange={e => setForm(f => ({ ...f, age: Number(e.target.value) }))} />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Sex</label>
          <select className={inputCls} value={form.sex}
            onChange={e => setForm(f => ({ ...f, sex: e.target.value as "male"|"female" }))}>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
      </div>

      {/* Diet tag */}
      <div className="mb-2">
        <label className="text-xs text-gray-500 block mb-1">Diet preference</label>
        <div className="flex gap-2">
          {(["veg","eggetarian","non_veg"] as DietTag[]).map(tag => (
            <button key={tag} onClick={() => setForm(f => ({ ...f, dietTag: tag }))}
              className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 transition-colors
                ${form.dietTag === tag ? "border-teal-500 bg-teal-50 text-teal-700" : "border-gray-200 text-gray-500"}`}>
              {tag === "veg" ? "🌱 Veg" : tag === "eggetarian" ? "🥚 Eggetarian" : "🍗 Non-veg"}
            </button>
          ))}
        </div>
      </div>

      {/* Goal mode */}
      <div className="mb-2">
        <label className="text-xs text-gray-500 block mb-1">Goal</label>
        <div className="space-y-1.5">
          {STANDARD_MODES.map(m => (
            <button key={m} onClick={() => { setForm(f => ({ ...f, goalMode: m })); setShowMaternalDropdown(false) }}
              className={`w-full text-left px-3 py-2 rounded-xl border-2 text-sm transition-colors
                ${form.goalMode === m && !showMaternalDropdown
                  ? "border-teal-500 bg-teal-50 text-teal-700 font-semibold"
                  : "border-gray-200 text-gray-700"}`}>
              {GOAL_MODE_INFO[m].icon} {GOAL_MODE_INFO[m].label}
            </button>
          ))}
          {/* Maternal toggle */}
          <div className={`px-3 py-2.5 rounded-xl border-2 transition-colors
            ${showMaternalDropdown ? "border-rose-400 bg-rose-50" : "border-gray-200"}`}>
            <div className="flex items-center justify-between">
              <span className={`text-sm ${showMaternalDropdown ? "text-rose-700 font-semibold" : "text-gray-700"}`}>
                🌸 Maternal Health
              </span>
              <button
                onClick={() => {
                  const next = !showMaternalDropdown
                  setShowMaternalDropdown(next)
                  setForm(f => ({ ...f, goalMode: next ? "pre_conception" : "fat_loss" }))
                }}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors
                  ${showMaternalDropdown ? "bg-rose-500" : "bg-gray-200"}`}>
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform
                  ${showMaternalDropdown ? "translate-x-4.5" : "translate-x-0.5"}`} />
              </button>
            </div>
            {showMaternalDropdown && (
              <select className={inputCls + " mt-2"} value={form.goalMode}
                onChange={e => setForm(f => ({ ...f, goalMode: e.target.value as GoalMode }))}>
                {MATERNAL_MODES.map(m => (
                  <option key={m} value={m}>{GOAL_MODE_INFO[m].icon} {GOAL_MODE_INFO[m].label}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Optional: weight/height for calorie estimate */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Weight kg (optional)</label>
          <input className={inputCls} type="number" placeholder="e.g. 65" step={0.5}
            value={form.weightKg ?? ""} onChange={e => setForm(f => ({ ...f, weightKg: Number(e.target.value) || undefined }))} />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Height cm (optional)</label>
          <input className={inputCls} type="number" placeholder="e.g. 160"
            value={form.heightCm ?? ""} onChange={e => setForm(f => ({ ...f, heightCm: Number(e.target.value) || undefined }))} />
        </div>
      </div>

      {/* Notes */}
      <div className="mb-3">
        <label className="text-xs text-gray-500 block mb-1">Dietary restrictions / notes</label>
        <input className={inputCls} placeholder="e.g. lactose intolerant, no onion-garlic, nut allergy"
          value={form.notes ?? ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
      </div>

      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2.5 bg-gray-100 text-gray-500 rounded-xl text-sm font-bold">Cancel</button>
        <button onClick={save} disabled={!form.name?.trim() || !form.age}
          className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-bold disabled:opacity-40">
          {member.id ? "Save changes" : "Add member"}
        </button>
      </div>
    </div>
  )
}

// ── Family Meal Plan Tab ──────────────────────────────────────────────────────
function FamilyMealView({ members }: { members: FamilyMember[] }) {
  const meals = loadMealPlan()
  const [activeDay, setActiveDay] = useState("Any day")
  const days = ["Any day","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]

  const filteredMeals = meals.filter(m => activeDay === "Any day" || !m.day || m.day === activeDay || m.day === "Any day")

  // Build shopping list from all meals
  const allIngredients: { ingredient: string; meal: string }[] = []
  for (const meal of meals) {
    for (const ing of (meal.ingredients || [])) {
      allIngredients.push({ ingredient: ing, meal: meal.name })
    }
  }
  const shoppingList = buildShoppingList(allIngredients)

  const [showShopping, setShowShopping] = useState(false)

  if (members.length === 0) {
    return (
      <div className="text-center py-6 text-gray-400">
        <div className="text-3xl mb-2">👨‍👩‍👧‍👦</div>
        <div className="text-sm">Add family members first in Settings → Family</div>
      </div>
    )
  }

  return (
    <div>
      {/* Day filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3">
        {days.map(d => (
          <button key={d} onClick={() => setActiveDay(d)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors
              ${activeDay === d ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-500"}`}>
            {d === "Any day" ? "All" : d.slice(0,3)}
          </button>
        ))}
      </div>

      {/* Meal compatibility grid */}
      {filteredMeals.length === 0 && (
        <div className="text-center text-gray-400 text-xs py-4">No meals for this day</div>
      )}

      {filteredMeals.map(meal => {
        const compatible = getCompatibleMembers(members, meal.tag)
        const incompatible = members.filter(m => !compatible.find(c => c.id === m.id))
        return (
          <div key={meal.id} className="bg-white rounded-xl border border-gray-100 p-3 mb-2">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-800 leading-tight">{meal.name}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">
                  {meal.time && `${meal.time} · `}P {meal.protein}g · C {meal.carbs}g · F {meal.fat}g · {meal.cal} kcal
                </div>
              </div>
              <div className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0
                bg-green-100 text-green-700">
                {compatible.length}/{members.length} can eat
              </div>
            </div>

            {/* Who can eat it */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {members.map(m => {
                const ok = canEat(m.dietTag, meal.tag)
                return (
                  <div key={m.id} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold
                    ${ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-500 line-through opacity-60"}`}>
                    <span>{m.emoji}</span>
                    <span>{m.name}</span>
                    {!ok && <span>✗</span>}
                  </div>
                )
              })}
            </div>

            {/* Incompatible warning */}
            {incompatible.length > 0 && (
              <div className="mt-1.5 text-[10px] text-amber-600">
                ⚠️ {incompatible.map(m => m.name).join(", ")} cannot eat this —
                consider a {incompatible.some(m => m.dietTag === "veg") ? "vegetarian" : "egg-free"} alternative
              </div>
            )}
          </div>
        )
      })}

      {/* Shopping list */}
      <button onClick={() => setShowShopping(s => !s)}
        className="w-full mt-2 py-3 border border-teal-300 text-teal-600 rounded-xl text-sm font-bold">
        🛒 {showShopping ? "Hide" : "Show"} weekly shopping list ({shoppingList.length} items)
      </button>

      {showShopping && (
        <div className="mt-2 bg-white rounded-xl border border-gray-100 p-3">
          <div className="text-xs font-bold text-gray-700 mb-2">Weekly Shopping List</div>
          <p className="text-[10px] text-gray-400 mb-2">
            Based on all meals in the plan. Quantities not included — adjust for your family size.
          </p>
          <div className="columns-2 gap-3">
            {shoppingList.map((item, i) => (
              <div key={i} className="flex items-start gap-1.5 mb-1.5 break-inside-avoid">
                <span className="text-gray-300 text-xs mt-0.5 shrink-0">□</span>
                <div className="min-w-0">
                  <div className="text-xs text-gray-700 capitalize leading-tight">{item.ingredient}</div>
                  <div className="text-[9px] text-gray-400 leading-none">
                    {item.meals.slice(0,2).join(", ")}{item.meals.length > 2 ? ` +${item.meals.length-2}` : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Calorie Summary ───────────────────────────────────────────────────────────
function FamilyCalorieSummary({ members }: { members: FamilyMember[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-3 mb-3">
      <div className="text-xs font-bold text-gray-700 mb-2">👨‍👩‍👧 Daily targets per member</div>
      {members.map(m => {
        const target = estimateMemberCalorieTarget(m)
        const tdee = estimateMemberTDEE(m)
        return (
          <div key={m.id} className="flex items-center gap-2.5 py-2 border-b border-gray-50 last:border-0">
            <MemberAvatar member={m} size={32} />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-gray-800">{m.name}</div>
              <div className="text-[10px] text-gray-400">
                {GOAL_MODE_INFO[m.goalMode].icon} {GOAL_MODE_INFO[m.goalMode].shortLabel} · {DIET_TAG_LABELS[m.dietTag]}
              </div>
            </div>
            <div className="text-right shrink-0">
              {target ? (
                <>
                  <div className="text-sm font-bold text-teal-700">{target} kcal</div>
                  {tdee && tdee !== target && (
                    <div className="text-[9px] text-gray-400">TDEE {tdee}</div>
                  )}
                </>
              ) : (
                <div className="text-xs text-gray-400">Add stats</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
interface Props {
  view?: "settings" | "meals"
}

export default function FamilyMode({ view = "settings" }: Props) {
  const [settings, setSettings] = useState<FamilySettings>(loadFamilySettings)
  const [editingMember, setEditingMember] = useState<Partial<FamilyMember> | null>(null)
  const [activeTab, setActiveTab] = useState<"members" | "meals" | "summary">(
    view === "meals" ? "meals" : "members"
  )

  function persist(updated: FamilySettings) {
    setSettings(updated)
    saveFamilySettings(updated)
  }

  function toggleEnabled() {
    persist({ ...settings, enabled: !settings.enabled })
  }

  function saveMember(member: FamilyMember) {
    const exists = settings.members.find(m => m.id === member.id)
    const updated = exists
      ? settings.members.map(m => m.id === member.id ? member : m)
      : [...settings.members, member]
    persist({ ...settings, members: updated })
    setEditingMember(null)
  }

  function removeMember(id: string) {
    persist({ ...settings, members: settings.members.filter(m => m.id !== id) })
  }

  if (!settings.enabled && view === "settings") {
    return (
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <h2 className="text-sm font-semibold text-teal-700 uppercase tracking-wide mb-1">👨‍👩‍👧 Family Mode</h2>
        <p className="text-xs text-gray-500 mb-3">
          Track multiple family members, see who can eat which meals, and generate a shared shopping list — all from one kitchen.
        </p>
        <button onClick={toggleEnabled}
          className="w-full py-3 bg-teal-600 text-white rounded-xl font-bold text-sm">
          Enable Family Mode
        </button>
      </div>
    )
  }

  return (
    <div className={view === "settings" ? "bg-white rounded-xl shadow-sm p-4 mb-4" : ""}>
      {view === "settings" && (
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-teal-700 uppercase tracking-wide">👨‍👩‍👧 Family Mode</h2>
          <button onClick={toggleEnabled}
            className="text-xs text-red-400 border border-red-100 rounded-lg px-2 py-1">
            Disable
          </button>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex bg-gray-100 rounded-xl p-1 gap-1 mb-3">
        {([
          { id: "members",  label: `Members (${settings.members.length})` },
          { id: "meals",    label: "Meal plan" },
          { id: "summary",  label: "Targets" },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors
              ${activeTab === t.id ? "bg-white text-teal-700 shadow-sm" : "text-gray-500"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Members tab */}
      {activeTab === "members" && (
        <div>
          {settings.members.length === 0 && !editingMember && (
            <div className="text-center text-gray-400 py-4 mb-2">
              <div className="text-3xl mb-1">👨‍👩‍👧‍👦</div>
              <div className="text-sm">Add your family members</div>
              <div className="text-xs mt-1">Each member can have their own diet, goal and calorie target</div>
            </div>
          )}

          {settings.members.map((m, i) =>
            editingMember?.id === m.id ? (
              <MemberEditor key={m.id} member={m} index={i} allCount={settings.members.length}
                onSave={saveMember} onCancel={() => setEditingMember(null)} />
            ) : (
              <MemberCard key={m.id} member={m}
                onEdit={() => setEditingMember(m)}
                onRemove={() => removeMember(m.id)} />
            )
          )}

          {editingMember && !editingMember.id && (
            <MemberEditor member={editingMember} index={0} allCount={settings.members.length}
              onSave={saveMember} onCancel={() => setEditingMember(null)} />
          )}

          {!editingMember && (
            <>
              <button onClick={() => setEditingMember({})}
                className="w-full py-3 border-2 border-teal-500 text-teal-600 rounded-xl text-sm font-bold mt-1">
                + Add Family Member
              </button>

              {/* Kitchen notes */}
              <div className="mt-3">
                <label className="text-xs text-gray-500 block mb-1">Kitchen notes (allergies, restrictions)</label>
                <input
                  className={inputCls}
                  placeholder="e.g. No beef, peanut allergy in household, no onion-garlic on Tuesdays"
                  value={settings.kitchenNotes}
                  onChange={e => persist({ ...settings, kitchenNotes: e.target.value })}
                />
              </div>

              {settings.kitchenNotes && (
                <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
                  <div className="text-[10px] font-bold text-amber-700 mb-0.5">🏠 Kitchen rules</div>
                  <div className="text-xs text-amber-700">{settings.kitchenNotes}</div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Meal plan tab */}
      {activeTab === "meals" && (
        <FamilyMealView members={settings.members} />
      )}

      {/* Calorie summary tab */}
      {activeTab === "summary" && (
        settings.members.length > 0
          ? <FamilyCalorieSummary members={settings.members} />
          : <div className="text-center text-gray-400 text-sm py-4">Add members to see calorie targets</div>
      )}
    </div>
  )
}
