# Spirit Tracker — React PWA

## Setup
```bash
npm install
npm run dev        # dev server at localhost:5173
npm run build      # production build → dist/
npm run typecheck  # TypeScript check without building
```

## Deployment (GitHub Pages)
```bash
npm run build
# Push dist/ contents to repository root, or configure GitHub Actions
```

## File → Prompt Mapping
Paste each implementation from the chained prompts into the corresponding stub file.

### src/utils/
| File | Prompt |
|------|--------|
| dateHelpers.ts | All prompts — already complete |

### src/services/
| File | Prompt | Layer |
|------|--------|-------|
| storage.ts | next_prompt_2.txt | Layer 3 |
| firebaseSync.ts | next_prompt_2.txt | Layer 8 |
| historySnapshot.ts | next_prompt_3.txt | Layer 7 |
| foodSearch.ts | next_prompt_2.txt | Layer 1 |
| barcodeSearch.ts | next_prompt_5.txt | Layer 10 |
| adaptiveTDEE.ts | next_prompt_9.txt | Layer 19 |
| weightForecast.ts | next_prompt_10.txt | Layer 20 |
| plateauDetection.ts | next_prompt_11.txt | Layer 22 |
| metabolicAdaptation.ts | next_prompt_12.txt | Layer 24 |
| weightDecomposition.ts | next_prompt_13.txt | Layer 26 |

### src/store/
| File | Prompt | Layer |
|------|--------|-------|
| useHealthStore.ts | next_prompt_3.txt | Layer 4 (final version) |

### src/hooks/
| File | Prompt | Layer |
|------|--------|-------|
| useMacros.ts | next_prompt_2.txt | Layer 5 |

### src/components/
| File | Prompt | Layer |
|------|--------|-------|
| App.tsx | next_prompt_4.txt | Layer 8 |
| BottomNav.tsx | next_prompt_4.txt | Layer 8 |
| Settings.tsx | next_prompt_4.txt | Layer 9 |
| FoodLog.tsx | next_prompt_5.txt | Layer 10 (final) |
| WeightLog.tsx | next_prompt_3.txt | Layer 6 |
| BarcodeScanner.tsx | next_prompt_5.txt | Layer 10 |
| AIWeeklyReport.tsx | next_prompt_5.txt | Layer 11 |
| ProgressCharts.tsx | next_prompt_5.txt | Layer 11 (final) |
| FastingTimer.tsx | next_prompt_7.txt | Layer 14 |
| FastingStreak.tsx | next_prompt_7.txt | Layer 15 |
| WorkoutLog.tsx | next_prompt_8.txt | Layer 16 |
| WorkoutHistory.tsx | next_prompt_8.txt | Layer 17 |
| BehaviorFeedback.tsx | next_prompt_9.txt | Layer 18 |
| TDEECard.tsx | next_prompt_9.txt | Layer 19 |
| WeightForecastCard.tsx | next_prompt_10.txt | Layer 21 |
| PlateauAdvisor.tsx | next_prompt_11.txt | Layer 23 |
| MetabolicAdaptationCard.tsx | next_prompt_12.txt | Layer 25 |
| WeightDecompositionCard.tsx | next_prompt_13.txt | Layer 27 |
| dashboard/MacroProgressBars.tsx | next_prompt_3.txt | Layer 5 |

### public/
| File | Notes |
|------|-------|
| manifest.json | Already complete |
| service-worker.js | Already complete |
| foods.json | Copy from existing repo: https://github.com/nytyn78/nytyn78.github.io/blob/main/foods.json |
| icon-192.png | Copy from existing repo |
| icon-512.png | Copy from existing repo |

## localStorage Keys (app data)
| Key | Contents |
|-----|----------|
| hlog_history | Array of daily summary entries (newest-first) |
| hlog_YYYY-MM-DD | Full day object with entries, weight, water, fasting, workouts |
| health_tracker_store | Zustand food log store |
| fb_config | Firebase config JSON |
| fb_push_queue | Offline sync queue |
| fb_last_sync | Last Firebase sync timestamp |
| macro_targets | { calories, protein, carbs, fat } |
| user_profile | { name, age, heightCm, goalWeight } |
| goal_weight | number |
| activity_level | "sedentary"|"light"|"moderate"|"active" |
| start_weight | number |

## Known Issues to Fix Before Going Live
1. Import all actual implementations — stubs are placeholders only
2. Copy foods.json, icon-192.png, icon-512.png from existing repo to public/
3. Run `npm run typecheck` after pasting implementations — fix any type errors
4. Test Firebase connection in Settings before deploying
5. Test barcode scanner on real Android device (camera APIs differ from desktop)
