# Spirit Tracker / Health Tracker — TODO

Living list of open items. Add freely. Updated as commits land.

---

## Active Bugs

### Parallel macro-split storage (Commit 5)
The engine reads `settings.macroSplit`. The Meals page dropdown writes to
`dietConfig.mode`. These don't sync, so the dropdown can show "Balanced" while
the engine produces keto macros (or vice versa). Surfaced as the original
"eggetarian keto for vegetarian balanced user" report — root cause finally
identified. Fix:
- Onboarding Screen 6 writes the chosen approach to `settings.macroSplit`
- Meals page dropdown reads/writes `settings.macroSplit`, not `dietConfig.mode`
- One-time migration on app load to align stale values

### Setup "75% complete" never reaches 100% (Commit 8)
Optional tasks (medications, blood tests) are counted in the completion
percentage. Users without medications can never hit 100%. Fix: make optional
tasks dismissible, or exclude them from the calculation entirely.

### Default workout plan is developer's personal routine (Phase 3)
The squats/pushups/Australian-pull-ups/etc. plan is calibrated to one specific
user, not generated per profile. Inappropriate for older users, postpartum
women, beginners, anyone with knee or shoulder issues, or users without
equipment access. Needs a real per-profile generator — see Phase 3 below.

### Onboarding Screen 3 sublabels still say clamp-era text (Commit 8)
"We'll avoid keto-style recommendations" etc. on the Quick Health Check screen.
Settings versions were updated in Commit 3 but onboarding's strings weren't.
Update to match the "surfaces warnings for..." style.

### Child protein multiplier only applies to BALANCED branch (Commit 8)
Active 11yo gets 57g protein on balanced but only 53g on keto. The
PROTEIN_MULTIPLIER_CHILD table needs to be applied across KETO, VERY_LOW_CARB,
and LOW_CARB branches too. Patch already prepped at
/mnt/user-data/outputs/commit-4-prep/adaptiveTDEE.ts.

### Vegetarian users get eggs in their generated meal plan (Phase 3 prep)
The meal generator only has "non-veg" and "eggetarian" branches. Vegetarian
users get the eggetarian branch by fallback. The labels and stored dietTag on
each entry are correct, but the actual generated meals can include eggs.
Needs a true vegetarian branch in mealGenerator.ts.

### Fasting silently defaulted to 16:8 during onboarding (Commit 6)
Same anti-pattern as the now-fixed silent keto default. Users never picked IF
but get an "eating window 12pm-8pm" set up automatically. Fix in Commit 6 with
a new onboarding screen asking whether the user wants to use IF, with honest
evidence summary.

---

## Planned Commits

### Commit 5 — Eliminate parallel macro-split storage
Estimated: 30 min
- Onboarding Screen 6 writes macro split to `settings.macroSplit`
- Meals page dropdown reads/writes `settings.macroSplit`
- Migration block in store init to sync stale `dietConfig.mode`
- `dietConfig.mode` kept for one release for backwards compat, removed in Commit 9 or later

### Commit 6 — Fasting onboarding screen + Settings toggle
Estimated: 45 min
- New onboarding screen between Screen 5 and Screen 6 asking about IF
- Options: Skip, Light 12:12, Moderate 16:8, Time-restricted 14:10
- Brief evidence summary per option (Cochrane / TREAT trial level — modest weight loss benefit, adherence dependent)
- Maternal modes auto-disable IF (already enforced in BottomNav, extend to onboarding)
- Settings → IF section adds "Use intermittent fasting" toggle at top
- If toggled off, fasting tab hides, no eating window applied

### Commit 7 — Collapsible Settings sections
Estimated: 1 hour
- Each Settings section header is tappable to collapse/expand
- Default open: Profile, Goals, Health Context, Macro Split, Goal Mode
- Default collapsed: IF Protocol, Calculated Targets, Medications, Blood Tests, Today Tab, AI & Voice, Break Periods, Workout Plan
- Collapse state persists per user in localStorage

### Commit 8 — Polish bundle
Estimated: 30 min
- Fix 75% complete bug (dismissible optional tasks)
- Update Onboarding Screen 3 sublabels to current "warnings" language
- Apply child protein multiplier across all macro mode branches
- Nav restructure: replace Settings tab with top-right gear icon (only if Commit 7 isn't enough on its own)

### Commit 9+ — Remove `dietConfig.mode` entirely
Estimated: 30 min
- Once a release has passed and Commit 5's migration has run
- Strip `dietConfig.mode` from useHealthStore types and storage
- Strip the Meals dropdown's mode selector (now redundant with Settings macro split)
- Search for any remaining reads of `dietConfig.mode` and remove

---

## Phases (Multi-session work)

### Phase 2 — Body Composition Tracking
Estimated: 1 session (~1 week)
- New `BodyComposition` type: { bodyFatPct, leanMassKg, fatMassKg, measuredOn, source: "dexa" | "inbody" | "bia" | "skinfold" | "manual" }
- Settings section for manual entry
- Validation: warn below 10% (M) / 16% (F), refuse below 5% (M) / 12% (F)
- Engine branch: when recent (<6mo) body comp exists, use Katch-McArdle BMR (370 + 21.6 × LBM) instead of ABW path
- LBM-based protein floor replaces ABW floor
- Falls back cleanly to current ABW logic when no body comp data
- Body comp does NOT affect adaptive TDEE in Phase 2 (deferred)

### Phase 3 — Per-Profile Exercise Generator
Estimated: 2-3 sessions (the biggest single item on the list)
- New onboarding section: equipment access, experience level, injuries, schedule, goal
- Exercise database (~50-80 exercises) tagged by: muscle group, equipment needed, difficulty, contraindicated conditions
- Plan generator that picks exercises matching profile, balances muscle groups across the week, applies basic progression
- Per-exercise: swap, mark too hard/easy, skip
- Maternal-mode considerations: postpartum 6-week rest period, no high-impact during pregnancy, no breath-holding (Valsalva)
- Geriatric considerations: balance work, fall prevention, no flat-back loaded squats
- Replace the current "developer's personal calisthenics routine" default

### Phase 4 — Adaptive TDEE × Body Composition (deferred from Phase 2)
- With known LBM, lean-mass loss vs fat-mass loss can be detected separately
- Refine adaptive TDEE to account for which mass is changing
- Lots of edge cases — defer until Phase 2 is in production for a while

### Phase 5 — PDF Parsing of DEXA Reports (deferred from Phase 2)
- Tier 2 of body composition: instead of manual entry, parse a DEXA PDF
- Most DEXA scanners produce standardized report layouts
- Could auto-populate body fat %, LBM, regional fat distribution
- Nice to have, not urgent

### Phase 6 — HealthKit / Google Fit Sync (deferred from Phase 2)
- Tier 3: auto-pull weight, body comp from connected scales/wearables
- iOS HealthKit and Android Google Fit have different APIs
- Significant native bridging work
- Defer until app has user volume justifying the effort

---

## Smaller Items (no commit assigned yet)

- **Test matrix scenario 29 mismatch:** matrix shows 53g protein for child on keto, but after Commit 8 (child multiplier across all modes) it should be 57g. Update assertion.
- **Body Comp Phase 2 Tier 1 placement decision:** new section between Profile and Health Context, or its own collapsible section?
- **Audit other silent defaults in the codebase:** keto and 16:8 were both silent. Workout plan is silent. Task bubbles probably are too. Worth one careful pass.
- **Maternal mode "Active Fat Loss" + "Maternal Health" both showing teal:** check whether two goal modes can be selected simultaneously in UI (probably display bug, not data bug).
- **Body comp Phase 2 → Tier 1 placement in Settings:** where? Probably between Profile and Health Context.
- **DIETFITS statistics:** verify the % adherence numbers we cite on Screen 6 against actual paper. Quoted from memory.
- **`balanced-floor-escape` warning may be dead code:** doesn't fire on any matrix scenario. Either remove or keep as safety net. Documented in Commit 3.1 notes.

---

## Notes

- All work is tested via the engine matrix (`src/services/engineMatrix.test.ts`) — 35 scenarios as of Commit 3.5. Add new scenarios when behavior changes.
- Each commit's output files live under `/mnt/user-data/outputs/commit-X/` during a session — historical record.
- Conversation transcripts at `/mnt/transcripts/` preserve session-by-session reasoning.
