---
project: Vials
platform: Mobile (React Native / Expo SDK 52)
stack: Zustand + MMKV Storage + React Navigation v7
design_system: Tech-Clinical / Neo-Minimalist (Airbnb Vibe)
visual_theme: Monochrome with Apothecary Glass & Wine Accents (No Pink)
version: 1.1 (gap-fix revision)
---

# Vials — Product Requirements & Technical Specifications

> **Sync note (2026-07-07):** Audited the product-ingestion architecture
> (§4.3, Tab 2) against the delivered corpus integration
> (`handoff/INTEGRATION_GUIDE.md`, `src/services/corpus/`). Corrected the
> "proprietary Vials API / self-hosted PostgreSQL" description — there is no
> such API. Product data source is **only the Vials corpus**: a Turso/libSQL
> replica pulled onto the device and queried entirely locally via
> `expo-sqlite`. Also corrected §1's "global search / barcode scanning are
> online-only, degrade to manual input offline" claim — it's the opposite:
> barcode/search read the local replica and work fully offline once synced;
> only the background pull itself needs a network, and it silently no-ops
> without one.

## 1. Product Overview & USP
**Vials** is a premium, unisex personal skincare and aesthetic medicine management mobile app. It helps users track formulations, build dynamic morning/evening schedules (Skin Cycling), avoid ingredient conflicts, and safely navigate clinical cosmetic procedures (Botox, fillers, peels), with **all personal data stored locally on-device**.

* **The Core Value Intersection:** Daily skincare and medical cosmetic tracking combined into an inseparable local engine.
* **The Trust Anchor:** 100% data confidentiality. Personal data never leaves the device — no cloud backend, no analytics, no trackers.
* **Connectivity Architecture (The Hybrid Engine):** The application operates on a hybrid data model. The user's personal shelf (`catalogStore`), routine schedules/checklists (`routineStore`), and the ingredient conflict verification engine (`conflictEngine.ts`) run strictly offline-first and local-only (Zustand + MMKV).
Global search and barcode scanning read the on-device Vials product corpus (a Turso/libSQL embedded replica, see §4.3) and work fully offline once the device has synced at least once — no network needed at read time. Only the corpus's own background pull needs connectivity, and it silently no-ops without one. Label text recognition (OCR) and crowdsourced product suggestions remain unbuilt (see §4.3 sync note); when a lookup finds no match, the UI falls back to manual input.

---

## 2. Interaction Elements, Buttons & Color System

### 2.1. The Structural Monochrome Base
To enforce a premium, disciplined, and gender-neutral aesthetic, **all core structural UI elements and primary actions remain monochrome**.
* **Primary Buttons:** Pure black filled surfaces (`#09090B`) with subtle sharp/rounded corners (`borderRadius: 8`) and bold white text. Used for main flows, onboarding advancement, and final confirmations.
* **Secondary Buttons:** Transparent background with a thin black outline border (`borderWidth: 1`, `#09090B`) and black text. Used for alternative paths or optional steps.
* **Interactive Elements:** Active AM/PM controls and unselected checkboxes utilize grayscale parameters (`#09090B`, `#71717A`, `#FFFFFF`).

### 2.2. The Apothecary Glass Matrix (Contextual Color Rules)
Colors from this palette are **never** used for large background fills, app containers, or primary buttons. They are strictly reserved for text links, graphs, status indicators, and contextual badges:

* 🍷 **Cabernet (`#720626`):** Deep wine red. Active routine completed checkboxes, context links on missing fields, and acute 24–48h post-procedure rehab boundaries.
* 🫙 **Amber (`#9A3412`):** Deep apothecary amber glass. Chemical ingredient collision warnings, active Period-After-Opening (PAO) inventory expiration counters, the clinical fading zone tracks, and the **"Actives" biomarker filter pill** (see 4.3).
* 🍾 **Green (`#0F4C3A`):** Dark bottle-glass green. Restorative/soothing ingredient tags, safe-for-sun post-procedure indicators, non-active rest days in schedules, and the **"Soothing" biomarker filter pill** (see 4.3).
* 🧪 **Cobalt (`#1E3A8A`):** Vintage laboratory glass blue. 12-month calendar ribbon lines, active treatment lifespan metrics, raw INCI analytical tags, UV seasonal change banners, and the **"Hydration" biomarker filter pill** (see 4.3).

> **Rule of thumb:** each color maps to exactly one semantic meaning (warning/active-conflict = amber, completed/restricted = cabernet, safe/restorative = green, informational/analytical = cobalt). Any new UI element introduced later should be checked against this mapping before reusing a color, rather than inventing a new use case ad hoc.

---

## 3. Navigation Architecture (4-Tab Layout Consolidation)

The viewport system eliminates layout clutter by routing all configurations into 4 primary navigation nodes.
[ TAB 1: ROUTINE HUB ] -> [ TAB 2: CATALOG ] -> [ TAB 3: CLINIC ] -> [ TAB 4: PROFILE ]


1. **TAB 1: ROUTINE HUB (`Feather: calendar`)**
   * **Sub-View A: Today (Default):** Executable AM/PM routine checklist filtered for the active system day.
   * **Sub-View B: Weekly Plan (Header Toggle):** The operational core of Skin Cycling. Allows weekday product assignments and processes ingredient conflicts.
2. **TAB 2: CATALOG (`Feather: package`)**
   * **Purpose:** Physical product inventory list with proprietary Vials API integration, barcode/OCR scanning, and a strict manual fallback entry layer.
3. **TAB 3: CLINIC (`Feather: activity`)**
   * **Purpose:** A 12-month forecasting aesthetic timeline, lifecycle progress engine, and self-calibrating metabolism tracker.
4. **TAB 4: PROFILE (`Feather: user`)**
   * **Purpose:** Skin characteristics profile manager, gamification switches, data export/import, and storage warnings.

---

## 4. Comprehensive Screen Specifications & Functional Logic

### 4.1. Onboarding Flow (Pre-Navigation Stack)
* **`MarketingSlidesScreen`:** 3 text-driven, spacious swipeable cards detailing data privacy, safety logic, and cyclic planning. Contains a primary black button to advance.
* **`SkinProfileSetupScreen`:** Age/Gender select layers and Skin Type selectors.
  * **`PhototypeSelector` (`US-03`):** 3 geometric option cards based on UV sensitivity metrics. **Visually unlabeled** (icon/shade-only), but each card carries a full `accessibilityLabel` (e.g. "Light or fair skin tone, burns easily, high sensitivity") for screen readers — visual minimalism must not become an accessibility gap.
    1. *Card 1:* Light / Fair — Burns easily, high sensitivity.
    2. *Card 2:* Medium / Olive — Tans moderately, prone to dark spots.
    3. *Card 3:* Dark / Deep — Rarely burns, elevated laser/peel risk.
* **`FirstProductScreen`:** Embedded quick-search bar allowing users to input their first item to instantiate the store before unlocking the tabs. **Includes a secondary "Skip for now" outline button** — the store can instantiate empty, and `CatalogList` renders its standard empty-state on first launch of Tab 2.

### 4.2. Tab 1: Routine Hub (Super-Tab)
#### Sub-View A: Today Screen (Default)
* **`ClinicalRestrictionsBlock`:** Conditional bone-colored card (`#FAF9F6`). If an active procedure is in `Rehab` status, it displays lifestyle restriction icons (No gym, No sun) rendered with **Rich Cabernet** highlights, alongside safe indicators using **Deep Bottle Green**.
* **`SeasonalNoticeBanner`:** Flat, dismissible container providing adaptive climate advice during seasonal transition cut-offs (e.g., Jun 1 / Sep 1 via `timeHelpers.ts`).
* **`RoutineChecklistContainer`:** Split into collapsible AM and PM layout sheets. Displays only product steps mapped to the active day of the week.
* **`RoutineStepCard`:** Displays Brand, Name, and Sequence Order. Contains a minimalist black structural checkbox on the right. When tapped (and gamification is ON), the box fills with **Rich Cabernet** and displays a white checkmark.
* **`EmptySlotPlaceholder`:** Renders if a linked item was deleted. Shows *"Step empty"* text with an outline secondary black button: `+ Add from catalog` and a flat text link: `Hide Step`.

#### Sub-View B: Weekly Plan Screen (Toggled via Header Button)
* **`AM_PM_SegmentedControl`:** Thin 1px border monochrome switch to swap between morning and evening structures.
* **`DraggableStepList`:** Native drag-and-drop hierarchy container (`react-native-draggable-flatlist`) to reorder product sequences.
* **`WeeklySchedulePicker` (`US-05`):** Day-picker element arrays (`[Mon] [Tue]...`) embedded inside product parameters. Toggles between *Every day* or *Specific days*.
* **`ConflictWarningInline`:** Mounts dynamically at the bottom of the column if ingredients overlap on the exact same day, highlighted with a **Rich Amber** alert badge.

### 4.3. Tab 2: Catalog Screen (Inventory Warehouse)
* **`CatalogList`:** Vertical directory of cards showing owned formulas and Period-After-Opening (PAO) categories. When an item is within 30 days of expiration, a **Rich Amber** text label mounts inline.
* **`CatalogFilterHeader`:** A horizontal scrolling strip providing structural layout filtration:
  * *Level 1 (Category Pills):* `[All] [Serums] [Moisturizers] [SPF]`.
  * *Level 2 (Biomarker Toggles):* Filters by auto-parsed INCI categories: `[🍾 Soothing]` (Centella, Ceramides — Deep Bottle Green), `[🫙 Actives]` (Retinoids, Vitamin C — Rich Amber), `[🧪 Hydration]` (Hyaluronic Acid — Cobalt Apothecary).
* **`ProductHeaderAction`:** Top-right corner button context (`+ Add Product`), styled as a secondary black outline button to summon entry modules.
* **Product Ingestion (Vials Corpus Integration):** Instead of calling the third-party Open Beauty Facts API directly, the app queries **only our own Vials corpus** — a Turso/libSQL database pulled onto the device as a read-only embedded replica (`src/services/corpus/`) and queried locally via `expo-sqlite`. There is no Vials REST API and no PostgreSQL backend in the request path; reads never leave the device.
* **Universal Scanner Loop:** Barcode scanning (`BarcodeScannerScreen`) resolves against the local replica via `ProductRepository.findByBarcode()` — indexed, no network round-trip. Free-text catalog search (`AddProductHubScreen`) resolves via `ProductRepository.search()`, using SQLite FTS5 trigram matching ranked by `bm25` to tolerate OCR/typo noise, also entirely local. A unified camera OCR flow that recognizes product label text directly from the viewfinder is **not built** — text search today is a typed input field, not a camera recognition step.
* **Crowdsourcing & Manual Fallback:** If a product is missing from the corpus, the user fills out a manual form. The product is saved to `catalogStore` immediately (local-first), available for routines and conflict checks right away. Background submission of manually-added products back to a shared/community database (`POST /api/v1/products/suggest`, `pending` review) is **not built** — the corpus schema reserves a `'community'` source value for this, but the submission pipeline doesn't exist yet. See `handoff/INTEGRATION_GUIDE.md` §7: today's corpus is 100% dogfood `obf_import` data (ODbL-licensed, not Vials-owned) and must be purged before public release — "only our Vials DB" becomes fully accurate once `vials_seed`/`community` coverage replaces it.
* **`DeleteProductModal` (`US-08.1`):** Triggered on item deletion. If the item is active in Tab 1, it renders a confirmation prompt: *"Deleting will remove this step from your routine."* On click, it simultaneously purges the item from both stores.

### 4.4. Tab 3: Clinic Screen (Aesthetics Hub)
* **`12_MonthForecastTimeline`:** A structural data chart ribbon mapping out clinical lifecycles. Uses crisp **Cobalt Apothecary** blue timeline tracks to show monthly effectiveness horizons.
* **`ProcedureLifespanCard` (`US-17`):** Maps out clinical treatments (Botox, Fillers, Laser Peels). Calculates live states:
  1. *Phase 1 (Rehab):* 0–48 hours. Triggers the active restriction blocks on Tab 1.
  2. *Phase 2 (Active):* Stable treatment effectiveness.
  3. *Phase 3 (Fading):* Final month of expected duration. The progress bar path switches to **Rich Amber**. Contains an internal manual touch slider enabling users to fluidly adjust or override duration parameters.
* **`FadingInteractivePrompt` (`US-17`):** An inline analytical block mounted once the Fading Zone initiates (*"Effect fading? Muscle mobility returning."*). Offers a primary filled black button for `[Still holding]` (postpones prompt for 14 days) and a secondary black outline button for `[No, it faded]`. **Deferral cap:** after 3 consecutive "Still holding" deferrals (~6 weeks past expected fade), the card auto-transitions to an `Overdue` state — the prompt stays visible but no longer auto-snoozes, requiring an explicit answer to clear it.
* **`HiddenStepsManager`:** Expandable footer utility allowing users to review and restore muted step layers back to Tab 1.

### 4.5. Tab 4: Profile & Settings Screen
* **`SkinProfileEditor`:** Input form sheets updating age, gender metrics, skin issues, and hosting the 3 unlabeled phototype card selectors.
* **`GamificationToggle`:** System preference switcher to enable or disable checklist completion rewards and daily streaks (Default: OFF).
* **`ExportBackupUtility`:** A functional utility that parses the local `MMKV` database, formats all data blocks into a single stringified `.json` layout, and triggers the native system share-sheet for manual backups.
* **`ImportRestoreUtility` (new):** Counterpart to export. Accepts a previously exported `.json` file via the system document picker, validates its schema/version against the current `MMKV` schema, and presents two restore modes before writing: **Replace** (wipes current local store, loads the file as-is) and **Merge** (adds catalog/routine/clinic records from the file without deleting existing ones, skipping exact duplicates by ID). A pre-write summary screen ("This will add 12 products, 3 procedures...") confirms scope before the user commits — restore is irreversible without a separate backup.
* **`LocalDataWarningModal`:** High-visibility text warning anchored permanently in settings: *"Data is saved locally on this device. Deleting the app will erase your logs unless you've exported a backup."*

---

## 5. Local Core Engines & Rule-Based Matrices

### 5.1. Data Architecture (MMKV + Zustand)
All states run fully offline on the device hardware layer.
* **State Management:** Zustand slice-stores (`useCatalogStore`, `useRoutineStore`, `useClinicStore`).
* **Persistence Layer:** Fully backed by `react-native-mmkv` for ultra-fast, synchronous data serialization.
* **Core entities (minimum fields for store/schema design):**
  * `Product`: `id, brand, name, type, inciTags[], openedDate, paoMonths, source ('api'|'manual')`
  * `RoutineStep`: `id, productId, period ('AM'|'PM'), order, days[] ('mon'..'sun' | 'every'), hidden:boolean`
  * `Procedure`: `id, type, date, expectedDurationMonths, realDuration?, status ('rehab'|'active'|'fading'|'overdue'|'archived')`
  * `Profile`: `age, gender, phototype, skinIssues[], gamificationOn:boolean, individualDurationMonths: { [procedureType]: number }`

### 5.2. Local Conflict Matrix & INCI Parsing (`utils/conflictEngine.ts`)
When a raw ingredient text string (INCI) is inputted or loaded from the API, a regex scanner parses text sequences in lowercase to map unindexed internal biomarkers:
* `parseInciTags(inci: string)` targets groups: `RETI` (Retinoids), `ACID` (AHA/BHA/PHA), `VIT_C` (Ascorbic Acid), `PEPT` (Copper Peptides).
* **Collision Verification Matrix — full pairwise table (all 6 combinations of the 4 tags):**

| Pair | Same-day result | Severity |
|---|---|---|
| `RETI` + `ACID` | Conflict | High (Rich Amber) |
| `VIT_C` + `RETI` | Conflict | High (Rich Amber) |
| `PEPT` + `VIT_C` | Conflict | Medium (Rich Amber) |
| `ACID` + `VIT_C` | Conflict (pH instability) | Medium (Rich Amber) |
| `ACID` + `PEPT` | Conflict (acidic environment degrades peptides) | Medium (Rich Amber) |
| `RETI` + `PEPT` | **No conflict** — compatible, no warning rendered | — |

  Any tag combined with itself (e.g. two `RETI` products same day) is **not** flagged by this engine — that's a dosing/layering question, not an ingredient-class collision, and is out of scope for `conflictEngine.ts` v1.

### 5.3. Business & Clinical Safety Boundaries (`conflictRulesDb.ts`)
* **Seasonal Procedure Blocking:** Logging a deep chemical peel or invasive laser procedure during high-UV summer cycles index-matched via device time metadata automatically forces a blocking warning component: *"Summer hyperpigmentation risk. Clinical guidelines advise against deep resurfacing treatments during peak UV seasons."*
* **Procedure Collision Checks — default spacing matrix:**

| Procedure A | Procedure B | Minimum gap | Notes |
|---|---|---|---|
| Deep chemical peel | Injectable filler | 14 days | either order |
| Deep chemical peel | Botox | 14 days | either order |
| Laser resurfacing | Injectable filler | 14 days | either order |
| Laser resurfacing | Botox | 14 days | either order |
| Microneedling | Deep chemical peel | 7 days | either order |
| Botox | Injectable filler | No restriction | commonly done same-day; flagged compatible, no warning |

  > **Caveat:** these spacing values are sensible defaults for v1, not verified clinical guidance. Before launch, this table should be reviewed and signed off by a licensed dermatologist/aesthetic practitioner — the app surfaces these as scheduling guardrails, not medical advice, and copy should make that distinction clear to users.
* **The Metabolism Feedback Loop:** If a user selects `[No, it faded]` (from the standard Fading prompt or the `Overdue` state), the active timer terminates, the log archives with a `realDuration` stamp, and `profileStore` adjusts a rolling average variable `individualDurationMonths` for that specific category. Subsequent entries automatically launch with the user's custom calibrated baseline.

---

## 6. Open Items for Clinical/Legal Review Before Launch
* Section 5.3 procedure-spacing table needs sign-off from a licensed practitioner.
* Confirm in-app copy clearly disclaims the app is not a substitute for professional medical advice, particularly on `ClinicalRestrictionsBlock` and `FadingInteractivePrompt`.
* Confirm the Vials API moderation queue workflow (admin review of `pending` crowdsourced suggestions) is defined and staffed before launch.