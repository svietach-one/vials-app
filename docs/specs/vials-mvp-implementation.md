# Vials MVP — Product Specification
Date: 2026-06-19
Author: planner-agent
Status: APPROVED

## AI-SDLC Flags
```
backend_layer:  false
frontend_layer: true
infra_changes:  false
```

---

## 1. Problem Statement

Users who manage both daily skincare routines and clinical cosmetic procedures (Botox, fillers, peels) have no dedicated local tool to do both safely in one place. Existing skincare apps are cloud-dependent, lack clinical procedure tracking, and do not warn users about ingredient or procedure conflicts. Vials solves this with a fully offline, privacy-first mobile app. The current codebase has a working navigation shell, design tokens, and business logic engines, but all screen implementations hold hardcoded mock data — the app is not usable by real users yet. The storage layer also uses AsyncStorage, which is async and slower than the synchronous MMKV required by the final architecture.

---

## 2. Goals

- Users can complete onboarding and have their skin profile persisted locally before accessing the main app
- Users can add real skincare products (via Open Beauty Facts search or manual entry) and have them saved across app restarts
- Users can build AM/PM routines with day-of-week scheduling and receive inline ingredient conflict warnings
- Users can see their daily routine checklist on the Today screen, with clinical restrictions shown when a procedure is in rehab
- Users can log clinical procedures and track their lifecycle (rehab, active, fading, overdue) on the Clinic timeline
- Users can export their full local data as a JSON backup and import/restore it from a file
- All 5 Zustand stores persist data via react-native-mmkv (synchronous, high-performance) instead of AsyncStorage

---

## 3. Non-Goals

- No cloud sync, user accounts, or backend server in Phase 1
- No AI routine suggestion feature (Anthropic API stub exists but is not wired)
- No push notifications or reminders
- No multi-device sync
- No monetization, paywalls, or subscription logic
- No localization beyond English
- No Android-specific tablet layout optimization
- No App Store submission process (out of scope for this task)

---

## 4. User Stories

### Story 1: First-time onboarding
As a new user, I want to be guided through a privacy intro and skin profile setup so that the app knows my skin characteristics from the start.

**Acceptance Criteria:**
- Given the app is launched for the first time, when `profileStore.onboardingCompleted` is false, then the app routes to the onboarding stack (not the main tabs)
- Given the user is on MarketingSlidesScreen, when they swipe or tap the primary CTA on slide 3, then they advance to SkinProfileSetupScreen
- Given the user is on SkinProfileSetupScreen, when they complete age, gender, skin type, and phototype selection and tap "Continue", then their profile is saved to profileStore and they advance to FirstProductScreen
- Given the user is on FirstProductScreen, when they tap "Skip for now", then `profileStore.onboardingCompleted` is set to true and the app navigates to the main tab view with an empty catalog
- Given phototype cards are rendered, when a screen reader is active, then each card exposes a full accessibilityLabel ("Light or fair skin tone, burns easily, high sensitivity" / "Medium or olive skin tone, tans moderately, prone to dark spots" / "Dark or deep skin tone, rarely burns, elevated laser and peel risk")

### Story 2: Add a product via Open Beauty Facts search
As a user, I want to search for a product by name and have its ingredients auto-filled so that I do not have to type long INCI lists manually.

**Acceptance Criteria:**
- Given the device is online, when the user types at least 3 characters in the product search field, then a debounced query is sent to the Open Beauty Facts API and results appear below the input
- Given OBF returns a match, when the user selects a result, then brand, name, product type, and full ingredient text are pre-filled in the product form
- Given the device is offline or OBF returns no results, when the user attempts a search, then the manual entry form is shown immediately with no blocking error state
- Given the user submits a valid manual or OBF-prefilled form, when they tap "Save", then the product is added to productsStore and appears in the catalog list

### Story 3: Build a routine with conflict detection
As a user, I want to assign products to AM/PM slots on specific days of the week so that my skin cycling plan is structured, and I want to see a warning if two conflicting ingredients are scheduled on the same day.

**Acceptance Criteria:**
- Given the user is on the Weekly Plan view, when they drag a step row, then the order is saved to routinesStore via `updateRoutine`
- Given a step row is visible, when the user taps the day picker, then they can toggle between "Every day" and specific days of the week
- Given two or more steps are assigned to the same day and their products contain conflicting ingredient pairs (per the 6-pair matrix in PRD §5.2), then `ConflictWarningInline` renders below the step list with an amber InlineAlert identifying the conflicting pair
- Given no conflicts exist, then no ConflictWarningInline is rendered

### Story 4: Today checklist with clinical restrictions
As a user, I want to see today's AM and PM steps as a checklist, and if I just had a procedure, I want to see rehab restrictions so I know what to avoid.

**Acceptance Criteria:**
- Given the current day is Tuesday and a step has `days: ['mon', 'tue', 'thu']`, then that step appears in today's checklist
- Given gamification is ON and the user taps a step checkbox, then the checkbox fills with Cabernet color and a white checkmark
- Given gamification is OFF and the user taps a step checkbox, then the checkbox fills solid black (no Cabernet accent)
- Given a procedure in proceduresStore has `status: 'rehab'`, then ClinicalRestrictionsBlock renders the restriction list from `ConflictEngine.getRehabRestrictions()` with Cabernet highlights on restriction icons
- Given no procedures are in rehab status, then ClinicalRestrictionsBlock is not rendered

### Story 5: Clinic procedure lifecycle
As a user, I want to log a cosmetic procedure and track when it enters the fading zone, so I can decide whether to rebook.

**Acceptance Criteria:**
- Given the user opens AddProcedureModal and selects "chemical_peel_deep" during summer months, then a Cabernet blocking alert is shown: "Summer hyperpigmentation risk. Clinical guidelines advise against deep resurfacing treatments during peak UV seasons." and the save button is disabled
- Given the user selects a procedure that violates the minimum spacing matrix (PRD §5.3) against an existing active procedure, then a Cabernet blocking alert is shown and the save button is disabled
- Given a procedure is saved and its age (in months) reaches `CLINICAL_RULES_DB[type].fadeTriggerMonth`, then its status updates to 'fading' and FadingInteractivePrompt renders
- Given the user taps "Still holding" 3 times, then the prompt transitions to `Overdue` state and no longer auto-snoozes — it persists until the user selects "No, it faded"
- Given the user taps "No, it faded", then the procedure status is set to 'archived', `realDuration` is stamped, and `profileStore.individualDurationMonths` for that procedure type is updated with a rolling average

### Story 6: Export and import data backup
As a user, I want to export my data to a file and restore it later so that I do not lose my logs if I change devices.

**Acceptance Criteria:**
- Given the user taps "Export Backup" in Profile, then all MMKV store data is serialized to a single JSON string and the native share sheet is triggered
- Given the user taps "Import Restore" and selects a valid backup file, then the app validates the JSON schema/version, shows a summary ("This will add N products, M procedures..."), and offers two buttons: "Replace" (wipe and load) and "Merge" (add non-duplicate records by ID)
- Given the user selects "Merge" and confirms, then existing records are preserved and new non-duplicate records from the file are added
- Given the imported file has an invalid schema or incompatible version, then an error message is shown and no data is written

### Story 7: Storage migration to MMKV (Phase 0)
As a developer, I want all store persistence to use react-native-mmkv so that reads and writes are synchronous and performant.

**Acceptance Criteria:**
- Given the app is built with a custom Expo dev client, when any store action writes data, then the write completes synchronously (no await required) via MMKV
- Given the app is cold-started, when all stores hydrate, then data is available before the first render frame (synchronous read from MMKV)
- Given `src/services/storage.ts` is opened, then it no longer imports AsyncStorage — it imports MMKV from react-native-mmkv
- Given the existing STORAGE_KEYS constants, then they remain unchanged (no key renames, no data migration needed for a fresh install)

---

## 5. UX / Behaviour

**Onboarding stack:**
- Three marketing slides are swipeable horizontally; a dot indicator shows position; the primary black CTA advances slides; on the final slide it reads "Get Started"
- Skin type selection uses text-labeled cards (oily / dry / combination / normal)
- Phototype cards show shade-only visuals (no text labels in the card body) but carry full accessibilityLabel attributes
- "Skip for now" on FirstProductScreen is a secondary outline button, not a text link, to meet the 44pt touch target minimum

**Today screen empty state:**
- If routinesStore is empty (no steps), the checklist area shows: "Your routine is empty. Add products in Catalog and build your schedule in the Weekly Plan." with a teal text link to Tab 2

**Catalog PAO expiry:**
- PAO expiry date = `openedDate + paoMonths` in calendar months
- Within 30 days of expiry: amber label "Expires in Xd" appears inline on the catalog card
- Past expiry: amber label "Expired Xd ago"

**Seasonal banner:**
- Shown from June 1 to August 31 (summer) advising on SPF and avoiding resurfacing
- Shown from September 1 to November 30 (autumn transition) advising on adding heavier moisturizers
- Dismissed state stored in settingsStore per season string (e.g. `banner_dismissed_2026_summer`)

**Fading prompt deferral:**
- Each "Still holding" tap adds 14 days to the expected fade date and increments a `deferralCount` field on the procedure record
- At `deferralCount === 3` the status becomes 'overdue' — the prompt renders with a distinct Cabernet badge "Overdue" and the "Still holding" button is removed

---

## 6. Data Requirements

**New fields on `UserProcedureLog` (extending existing type):**
- `deferralCount: number` (default 0) — counts "Still holding" taps
- `realDuration?: number` — months, stamped when user confirms fade
- `status` extends to include `'overdue'` (already in PRD but not in current type definition)

**New field on `UserProfile`:**
- `individualDurationMonths: Partial<Record<CosmeticProcedureKey, number>>` — rolling average per procedure type

**New field on `AppSettings`:**
- `dismissedBanners: string[]` — list of banner keys the user has dismissed (e.g. `['banner_2026_summer']`)

**Storage keys:** unchanged — all 5 existing STORAGE_KEYS values are preserved.

---

## 7. Dependencies

- Depends on: existing ConflictEngine (`src/utils/conflictEngine.ts`) — complete, no changes needed
- Depends on: existing DS component library (`src/components/ui/`) — complete, must be used exclusively (no new ad-hoc styled components)
- Depends on: existing design tokens (`src/constants/tokens.ts`) — complete, must be used exclusively
- Blocks: AI routine suggestion feature — cannot ship without a working routine store (Phase 3)
- External services: Open Beauty Facts API (`https://world.openbeautyfacts.org/cgi/search.pl`) — read-only, no API key required

---

## 8. Security & Privacy

- Authentication required: no
- Data sensitivity: personal health and cosmetic data (skin type, age, procedure logs) — all stored exclusively on-device, never transmitted
- The OBF product search call sends only the search query string — no user identity data is included in the request
- Export file contains all user data as plaintext JSON — the UI must display a clear disclosure: "Your export file contains all your personal data. Store it securely."
- No analytics SDK, crash reporting service, or third-party tracker is permitted in Phase 1

---

## 9. Success Metrics

- 100% of screens pass the four-state rule audit (loading / empty / error / data) before task closes
- Zero TypeScript compilation errors (`npx tsc --noEmit`) before handoff
- All 5 stores hydrate correctly on cold start after MMKV migration (verified manually on simulator)
- Export produces a valid JSON file that can be re-imported without data loss on a fresh install
- Ingredient conflict detection triggers correctly for all 5 conflicting pairs in the matrix (verified via unit tests on conflictEngine)

---

## 10. Open Questions

- [x] Storage migration timing: proceed as Phase 0 alongside DS component ports — RESOLVED (confirmed by user 2026-06-19)
- [ ] OBF API rate limits and terms of use confirmation for production scale — owner: product owner (Svietlana)
- [ ] Clinical safety copy review: disclaimer text on ClinicalRestrictionsBlock and FadingInteractivePrompt needs sign-off from a licensed practitioner before App Store submission — owner: product owner (Svietlana)
- [ ] Expo dev client build pipeline: confirm CI/CD or local build process for MMKV native module — owner: engineer
