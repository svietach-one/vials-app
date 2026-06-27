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

1. **TAB 1: ROUTINE HUB (`Feather: calendar`)**
   * **Sub-View A: Today (Default):** Daily AM/PM execution checklist.
   * **Sub-View B: Weekly Plan (Toggle via "Edit Schedule" Header Button):** Core strategy view for scheduling specific product days and managing ingredient conflicts.
2. **TAB 2: CATALOG (`Feather: package`)**
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

## 2. Tab 1: Routine Hub (Super-Tab View)

### Sub-View A: Today Screen (Default)
* **`ClinicalRestrictionsBlock`:** Conditional card (`#FAF9F6`). If an active procedure is in `Rehab` status, displays restriction icons (No gym, No sun) rendered with **Rich Cabernet** highlights, alongside safe indicators using **Deep Bottle Green**.
* **`SeasonalNoticeBanner`:** Flat, dismissible container providing adaptive climate advice during seasonal cut-off dates.
* **`RoutineChecklistContainer`:** Split into collapsible AM and PM layout sheets. Displays only the product cards mapped to the active day of the week.
* **`RoutineStepCard`:** Displays Brand, Name, and Order. Contains a minimalist black structural checkbox on the right. When tapped with gamification ON, the box fills **Rich Cabernet** with a white checkmark; with gamification OFF, it simply toggles filled/unfilled black.
* **`EmptySlotPlaceholder`:** Renders if a linked item was deleted. Shows *"Step empty"* text with an outline secondary black button: `+ Add from catalog` and a flat text link: `Hide Step`.

### Sub-View B: Weekly Plan Screen (Toggled via "Edit Schedule" Header Button)
* **`AM_PM_SegmentedControl`:** Thin 1px border switch to swap between morning and evening structures.
* **`DraggableStepList`:** Native drag-and-drop hierarchy container to reorder application sequences.
* **`WeeklySchedulePicker` (`US-05`):** Day-picker element arrays (`[Mon] [Tue]...`) embedded inside product parameters. Toggles between *Every day* or *Specific days*.
* **`ConflictWarningInline`:** Mounts dynamically at the bottom of the column if ingredients overlap on the exact same day, per the full pairwise collision table in `conflictEngine.ts`, highlighted with a **Rich Amber** alert badge.

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