# Vials — Complete Screen & Component Specifications (4-Tab Optimized)

> **Sync note:** This revision reconciles the screen spec with PRD v1.1 (the gap-fix pass). Five items that had been fixed at the PRD level were missing here and have been restored: import/restore utility, catalog biomarker filters, phototype accessibility labels, onboarding skip path, and the fading-prompt deferral cap.

This document defines the interface architecture, component state-machines, and layout hierarchies for Phase 1.

---

## UI Color & Button System (Tech-Clinical Guidelines)

* **Primary Buttons:** Pure black filled surfaces (`#09090B`) with white text.
* **Secondary Actions:** Black line outline borders (`borderWidth: 1`, `#09090B`) with transparent backgrounds and black text.
* **Apothecary Accent System:** Core structural actions remain monochrome. Colors from the Apothecary Glass Matrix are strictly reserved for **badges, status tags, context links, data boundaries, and chart metrics**:
  * 🍷 **Cabernet (`#720626`):** Active routine indicators, hard restrictions/blocks (acute rehab states, seasonal procedure blocking), and the completed-checkbox fill state.
  * 🫙 **Amber (`#9A3412`):** Cautions and counters — expiration counts (PAO), ingredient-conflict warnings, and clinical timeline fading zones.
  * 🍾 **Green (`#0F4C3A`):** Recovery indicators, safe-skin days, and soothing product tags.
  * 🧪 **Cobalt (`#1E3A8A`):** Calendar grids, 12-month charts, and ingredient check tags.

  > Semantic split, made explicit: **Amber = caution/warning** (something to be aware of), **Cabernet = restriction/block** (something you can't or shouldn't do right now, or a completed action). Seasonal procedure blocking uses Cabernet under this rule, same family as the rehab restriction icons — both are hard "don't do this" states, not soft warnings.

---

## Navigation Architecture (React Navigation v7)

The application consolidates navigation into 4 high-priority bottom tabs.

1. **TAB 1: ROUTINES** (tab bar label `"Routines"`, screen `RoutinesScreen`)
   * **Single scroll, no sub-views.** Day navigation (Mo–Su chips), Morning/
     Evening toggle, step list, and drag-to-reorder edit mode all live on one
     screen — see §2 below. There is no separate "Weekly Plan" screen or
     "Edit Schedule" header toggle; edit mode is a header icon
     (pencil ⇄ checkmark) that toggles reordering inline.
2. **TAB 2: CATALOG** (tab bar label `"My Shelf"`, `Feather: package`)
   * **Purpose:** Physical product inventory list with biomarker/category filtering, proprietary Vials API search via barcode/OCR scanning, and a standalone manual entry form.
3. **TAB 3: CLINIC (`Feather: activity`)**
   * **Purpose:** 12-month interactive aesthetic procedure timeline and longevity calculator.
4. **TAB 4: PROFILE (`Feather: user`)**
   * **Purpose:** Skin characteristics editor, preferences, data export/import, and offline storage warning notices.

---

## 1. Onboarding Flow (Pre-Navigation Stack)

* **`MarketingSlidesScreen`:** 3 text-driven, airy sliding cards detailing local data privacy, safety logic, and cyclic planning. Contains a primary black button to advance.
* **`SkinProfileSetupScreen`:** Age/Gender select layers and Skin Type selectors.
  * **`PhototypeSelector` (`US-03`):** 3 visually unlabeled option cards based on UV sensitivity guidelines. Each card carries a full `accessibilityLabel` (e.g. "Light or fair skin tone, burns easily, high sensitivity") so the visual minimalism doesn't become a screen-reader gap.
* **`FirstProductScreen`:** Embedded quick-search bar allowing users to input their first item to instantiate the database. Includes a secondary **"Skip for now"** outline button — the store can instantiate empty, and `CatalogList` renders its standard empty state on first launch of Tab 2.

---

## 2. Tab 1: Routines Screen

> **Rewritten 2026-07-02** to match `RoutinesScreen.tsx` on
> `feature-routine-redesign`. The previous "Today / Weekly Plan sub-view"
> model described here no longer exists in the delivered code — see
> `docs/tech-design/routine-redesign.md` for the full as-built design and
> deviation history.

Single `DraggableFlatList` screen, header-toggled between view mode and edit
(reorder) mode. No checklist/completion state — this is a scheduling and
sequencing view, not a "mark done" tracker.

* **`AppHeader`** — title "Routines"; right actions are two icon buttons:
  `+` (opens `AddToRoutineSheet`) and pencil/checkmark (toggles edit mode).
* **`PlannerBlock`** (list header) — date label (e.g. "Today, Wednesday, 2 Jul")
  + Morning/Evening icon toggle on row 1; a 7-chip Mo–Su day selector on row
  2 where exactly one day is active. Selecting a day filters which steps are
  visible (day-navigation calendar), it does not itself edit any step's
  `scheduledDays`.
* **`RoutineStepCard`** (per step) — brand/name + product-type and active-
  ingredient badges. **No checkbox, no completion state, no gamification
  accent** — tapping the card in view mode navigates to `ProductDetail`. In
  edit mode the card swaps to a drag-handle (left, dot grid, long-press to
  drag) + trash icon (right, opens `RemoveStepModal`); tap-to-navigate is
  disabled while editing. A conflicting product's name renders inline under
  the card ("Conflicts with X", amber) rather than via a separate banner
  component.
* **`AddToRoutineSheet`** — `@gorhom/bottom-sheet` `BottomSheetModal`, two
  steps: search/filter and pick a product, then set Morning/Evening +
  `WeeklySchedulePicker` days and save. Opened from either header `+` icon or
  the "Add product" list footer button.
* **`RemoveStepModal`** — RN `Modal` confirm sheet with "Remove from
  {Weekday}s" (this day only) vs. "Remove from all days" vs. "Cancel".
  Opened from the trash icon on a step card in edit mode.
* **Empty state:** "No products scheduled for today." (inbox icon), shown
  when the active period + day combination has zero visible steps.

**Not present on this screen** (present in earlier designs / `USER_STORIES.md`
but not wired into the current build — see `docs/tech-design/routine-redesign.md`
§4 "Orphaned components"): `ClinicalRestrictionsBlock`, `SeasonalNoticeBanner`,
a dedicated `ConflictWarningInline` banner, `EmptySlotPlaceholder`, and any
`WeeklyPlanView` / "Edit Schedule" screen swap. Deleting a product from the
catalog does not surface an empty-slot UI — its orphaned `RoutineStep` is
silently filtered out of the visible list (see `USER_STORIES.md` US-08.1 note).

---

## 3. Tab 2: Catalog Screen (Inventory Warehouse)

* **`CatalogList`:** Vertical directory of cards showing owned formulas, custom types, and Period-After-Opening (PAO) categories. When an item is within 30 days of expiration, a **Rich Amber** text label mounts.
* **`CatalogFilterHeader`:** Horizontal scrolling filter strip:
  * *Level 1 (Category Pills):* `[All] [Serums] [Moisturizers] [SPF]`.
  * *Level 2 (Biomarker Toggles):* `[🍾 Soothing]` (Centella, Ceramides — Deep Bottle Green), `[🫙 Actives]` (Retinoids, Vitamin C — Rich Amber), `[🧪 Hydration]` (Hyaluronic Acid — Cobalt Apothecary).
* **`ProductHeaderAction`:** Top-right corner button (`+ Add Product`) rendered as a clean secondary black outline button to invoke creation modes.
* **Universal Scanner Screen (Overlay):** A single full-screen camera overlay featuring a central rectangular focus bracket (viewfinder).
  * Helper Placeholder Text: *"Focus camera on the barcode or product name on the vial"*.
  * Loading State (OCR Indicator): When the system detects a static block of text, the viewfinder frame pulses in **Cobalt** (`#1E3A8A`), signaling active text processing.
  * Offline State: If the device loses its internet connection, a system banner appears above the viewfinder frame: *"Offline Mode. Scanning unavailable. Switch to manual entry"*. The scanning trigger is disabled, and the UI automatically forces a transition to an empty `ProductForm` for manual data entry.
* **`ProductForm` (Manual Fallback):** Text inputs for Brand, Name, Type dropdown, and a multi-line raw INCI ingredient field. Triggers automatically when the API returns no match, when the user selects no match from results, **or immediately when the device is offline** — this path is always available regardless of network state.
  * **Pre-fill State:** If accessed via a failed Universal Scan, `brand` and `name` fields are automatically populated with strings extracted by the OCR layer, minimizing typing friction.
  * **Ingredient Input Field:** A large text area for pasting or typing the raw INCI ingredients (`inci_raw`).
  * **Submission UI Feedback:** Upon pressing "Save", the screen dismisses immediately to the user's Shelf with a success toast ("Product added to your shelf"). No loader or blocking state is shown for the background server sync.
* **`DeleteProductModal` (`US-08.1`):** Triggered on item deletion. If the item is active in Tab 1, it renders a confirmation prompt: *"Deleting will remove this step from your routine."* On click, it simultaneously purges the item from both stores.

---

## 4. Tab 3: Clinic Screen (Aesthetics Timeline)

* **`12_MonthForecastTimeline`:** A structural calendar chart ribbon using **Cobalt Apothecary** lines to visualize past and upcoming procedural milestones over a 12-month horizon.
* **`ProcedureLifespanCard` (`US-17`):** Renders the treatment lifespan with a minimal progress indicator. The card highlights the active **"Fading Zone"** using a **Rich Amber** boundary track. Contains an overlay adjustment slider for the user to tweak duration values manually.
* **`FadingInteractivePrompt`:** Text-driven survey block mapped inside the timeline once fading starts (*"Effect fading? Muscle mobility returning."*). Contains a primary black button for `[Still holding]` (snoozes 14 days) and a secondary outline button for `[No, it faded]`. After 3 consecutive `[Still holding]` taps (~6 weeks past expected fade), the card auto-transitions to an `Overdue` state: it stays visible and stops auto-snoozing, requiring an explicit answer to clear.
* **`AddProcedureModal`:** Form input capturing treatment metrics. Triggers two safety checks before allowing save:
  1. **Seasonal check** — blocks deep chemical peels / laser resurfacing during peak-UV summer months with a **Rich Cabernet** alert box.
  2. **Spacing check** — cross-references the procedure-pair minimum-gap matrix (PRD §5.3, e.g. 14-day gap between a deep peel and a filler) against existing logged procedures, and blocks save with a **Rich Cabernet** alert box if violated.
* **`HiddenStepsManager`:** Expandable footer utility allowing users to review and restore muted step layers back to Tab 1.

---

## 5. Tab 4: Profile & Settings Screen

* **`SkinProfileEditor`:** Input form sheets updating age, gender metrics, and skin issues. Houses the 3 phototype card selectors (see accessibility note in Section 1).
* **`GamificationToggle`:** System preference switcher to enable or disable checklist completion rewards and daily streaks (Default OFF).
* **`ExportBackupUtility`:** Parses the local MMKV database, serializes all data blocks to a single `.json` file, and triggers the native share-sheet for manual backup.
* **`ImportRestoreUtility`:** Accepts a previously exported `.json` via the system document picker, validates its schema/version, and offers **Replace** (wipe + load) or **Merge** (add non-duplicate records by ID) before a confirmation summary screen ("This will add 12 products, 3 procedures...") and final commit.
* **`LocalDataWarningModal`:** High-visibility text warning anchored in settings: *"Data is saved locally on this device. Deleting the app will erase your logs unless you've exported a backup."*