# Vials — Complete User Stories & Acceptance Criteria

This document defines the complete functional requirements and behavior specifications for Phase 1 features.

> **Sync note (this revision):** Fixed a calibration bug in US-17 (rolling average was re-anchoring to the static baseline every time instead of accumulating), standardized the block-vs-warning behavior between US-17/US-18, aligned component names with the screen spec, and added US-19–21 to cover Import/Restore, Catalog filtering, and onboarding skip — all of which exist in the PRD/screen specs but had no acceptance criteria yet.
>
> **Sync note (2026-07-02, tech-designer):** Audited US-05, US-08.1, and US-09
> against the shipped `RoutinesScreen` on `feature-routine-redesign`. Added
> "Implementation note" callouts where the delivered behavior has diverged
> from these acceptance criteria (day-navigation replacing the checklist
> model, `EmptySlotPlaceholder` never built, conflict warnings rendering
> per-card instead of via `ConflictWarningInline`). See
> `docs/tech-design/routine-redesign.md` for the full as-built design.
>
> **Sync note (2026-07-07):** Audited US-22 against the delivered product
> corpus integration (`handoff/INTEGRATION_GUIDE.md`, `src/services/corpus/`).
> The product source is now **only the Vials corpus** — a Turso/libSQL
> replica synced onto the device and read locally via `expo-sqlite`. There is
> no Vials REST API and no server-side lookup/search request; barcode and
> text search both resolve entirely on-device, offline-capable after first
> sync. Added an "Implementation note" to US-22 with the corrected
> architecture and the still-unbuilt pieces (camera OCR product search,
> crowdsourcing submission).

---

### US-03 · Skin Profile Setup (Onboarding)

**As a** new app user
**I want to** configure my skin characteristics during onboarding
**So that** the app can safely assess ingredient conflicts and suggest correct routines.

**Acceptance criteria:**
* Phototype selection must use 3 distinct, completely unlabeled visual cards to classify UV sensitivity with no racial labels:
  1. **Light / Fair (Types I–II):** Burns easily, high sensitivity.
  2. **Medium / Olive (Types III–IV):** Tans moderately, prone to dark spots.
  3. **Dark / Deep (Types V–VI):** Rarely burns, elevated laser/peel risk.
* Each card must carry a full `accessibilityLabel` describing its meaning in plain language (e.g. "Light or fair skin tone, burns easily, high sensitivity") — the *visual* minimalism must not remove the information for screen-reader users.
* Profile initialization must save directly to the local `profileStore` without requiring an account or network connection.

---

### US-05 · Weekly Product Scheduling & Skin Cycling

**As a** user with a dynamic skincare routine
**I want to** assign products to specific days of the week
**So that** my daily checklist only displays what I need to use today.

**Acceptance criteria:**
* When adding or modifying a product inside an AM/PM routine, the user can switch scheduling from `Every day` to `Specific days`.
* Selecting specific days exposes a day-picker component interface: `[Mon] [Tue] [Wed] [Thu] [Fri] [Sat] [Sun]`.
* The `Today` screen must fetch the current system day via `timeHelpers.ts` and filter the checklist. If a product is not scheduled for today, its step card is completely hidden.

> **Implementation note (2026-07-02):** The day-picker (`[Mon]...[Sun]`) exists
> as `WeeklySchedulePicker`, used when scheduling a product inside
> `AddToRoutineSheet` / `RoutineSchedulerSheet` — matches this criterion. The
> "Today screen filters by current system day" criterion is now generalized:
> `RoutinesScreen`'s `PlannerBlock` lets the user navigate to **any** day of
> the week (not just today), defaulting to today on screen focus, and filters
> the visible steps to whichever day is selected — a superset of what this
> story describes, not filed as a separate story.

---

### US-08.1 · Safe Product Deletion with Routine Cascade

**As a** user organizing my catalog
**I want to** be warned when deleting a product linked to routines
**So that** I don't accidentally break my daily checklists.

**Acceptance criteria:**
* Before executing a deletion, the system must check if the `productId` exists in any active AM or PM routine.
* If the product is linked, a modal alert must display: *"Deleting will remove this step from your routine."*
* On confirmation, the ID is immediately deleted from `catalogStore` and purged from all instances in `routineStore`.
* If a scheduled routine step becomes empty as a result of the cascade, an `EmptySlotPlaceholder` component appears showing text *"Step empty"* with two operational targets: `+ Add from catalog` and `Hide step`.

> **Implementation note (2026-07-02):** Not fully built. `removeProduct` on
> `productsStore` deletes the product but does **not** purge the matching
> `RoutineStep` records from `routinesStore` — the step is left in place with
> a `productId` pointing at a now-missing product. `RoutinesScreen` happens to
> filter out any step whose product can't be resolved, so the net visible
> effect is similar (the step disappears from the list), but there is no
> `EmptySlotPlaceholder`, no "Deleting will remove this step from your
> routine" cascade confirmation copy tied to routine membership specifically
> (the actual confirm copy, in `DeleteProductModal`, is generic: *"Any
> routine steps linked to it will become empty slots"*), and no `+ Add from
> catalog` / `Hide step` recovery actions. This needs a product decision:
> either build `EmptySlotPlaceholder` + real cascade purge, or rewrite this
> story to match the current silent-filter behavior.

---

### US-09 · Contextual Ingredient Conflict Mitigation

**As a** user combining active ingredients
**I want to** see conflict warnings only when ingredients are used on the exact same day
**So that** I don't get false alerts for products used on alternating days.

**Acceptance criteria:**
* The local `conflictEngine.ts` must parse active INCI ingredients within a routine and evaluate collisions strictly on a *per-day basis*, against the full pairwise table:

  | Pair | Result |
  |---|---|
  | `RETI` + `ACID` | Conflict (High) |
  | `VIT_C` + `RETI` | Conflict (High) |
  | `PEPT` + `VIT_C` | Conflict (Medium) |
  | `ACID` + `VIT_C` | Conflict (Medium) |
  | `ACID` + `PEPT` | Conflict (Medium) |
  | `RETI` + `PEPT` | **No conflict** |

* If two conflicting ingredients (e.g., Retinol and Glycolic Acid, i.e. `RETI`+`ACID`) are in the same routine but scheduled on different days, **no warning** is generated.
* If they overlap on the same day, an inline `ConflictWarningInline` component must mount directly beneath those steps in the routine configuration view, severity-colored per Rich Amber.

> **Implementation note (2026-07-02):** The per-day, per-pair detection logic
> (`ConflictEngine.detectConflicts`) is implemented and correctly scoped to
> `RoutinesScreen`'s currently-selected day, matching the negative-test-case
> requirement. The presentation differs from this story: there is no separate
> `ConflictWarningInline` component mounted in the routine view. Instead,
> `RoutineStepCard` itself renders an inline amber "Conflicts with {other
> product name}" row directly under the affected card when it has an active
> conflict. Same severity color (amber), same per-day scoping, different
> component boundary.
* **Negative test case:** a `RETI` product and a `PEPT` product scheduled on the same day must **not** trigger `ConflictWarningInline` — this pair is explicitly compatible and must not produce a false positive.
* Two products sharing the *same* tag (e.g. two `RETI` items same day) are out of scope for this engine in v1 — that's a dosing/layering question, not a class collision, and must not be flagged.

---

### US-17 · Self-Calibrating Clinical Timeline & Metabolism Tracker

**As a** cosmetic procedure patient
**I want to** track my treatment lifecycle on a predictive timeline and manually adjust it to fit my individual body response
**So that** the system adapts its future forecasts to my custom metabolism.

**Acceptance criteria:**
* **Phase 1 (Rehab, 0–48h):** Logging a new treatment triggers "SOS Mode" on the Today screen — highlighting soothing products and rendering a `ClinicalRestrictionsBlock` with explicit lifestyle restriction icons (No gym, No sauna, No alcohol, No direct sun).
* **Phase 2 (Active):** Standard progress display on the timeline; no special prompts or restrictions.
* **Phase 3 (Fading):** Upon reaching the preset fading threshold, a `FadingInteractivePrompt` survey card anchors to the timeline displaying: *"Effect fading (4 months elapsed). Muscle mobility returning. Still holding?"*
* **Feedback Loop Calibration:**
  * Tapping `[Still holding]` snoozes the prompt for **14 days**, incrementing a `deferralCount`.
  * After the **3rd consecutive** `[Still holding]` tap (~6 weeks past the expected fade point), the card auto-transitions to an `Overdue` state: it remains visible and stops auto-snoozing, requiring an explicit `[No, it faded]` answer to clear.
  * Tapping `[No, it faded]` (from either the standard prompt or the `Overdue` state) terminates the timer, archives the entry with a `realDuration` stamp, and recalculates `individualDurationMonths` for that procedure type as a **cumulative moving average**, not a static two-point blend:
    ```
    newAverage = ((currentIndividualDurationMonths * sampleCount) + realDuration) / (sampleCount + 1)
    sampleCount += 1
    individualDurationMonths = newAverage
    ```
    On the *first* calibration for a procedure type, `currentIndividualDurationMonths` initializes from the clinical default and `sampleCount` starts at `0`, so the first calculation is equivalent to `(default + realDuration) / 2`. On every subsequent calibration, it averages against the user's own accumulated history rather than resetting to the clinical default — otherwise the system can never learn beyond a single data point. *(Example: default 4 months; user reports 3 months three times in a row. Old formula: stuck at 3.5 forever. New formula: 3.5 → 3.33 → 3.25, correctly converging toward 3.)*
* **Manual Override:** The user must be able to fluidly override or stretch the timeline graph manually at any point via an "Edit Estimated Lifespan" slider on the card. A manual override does **not** affect `individualDurationMonths` — only an actual `[No, it faded]` event recalibrates the baseline, since a manual stretch is a one-off adjustment, not a confirmed real-world data point.
* **Predictive Adaptation:** Future logs of the same procedure type must automatically initialize using the custom calibrated `individualDurationMonths` baseline instead of generic medical presets.

---

### US-18 · Season & Collision Clinical Safety Matrix

**As a** user planning clinical cosmetic treatments
**I want to** be blocked from adding procedures that are dangerous due to weather or overlapping healing windows
**So that** I avoid hyperpigmentation and deep skin tissue damage.

**Acceptance criteria:**
* **Seasonal Blocking:** Attempting to save a deep chemical peel or invasive fractional laser treatment during high-UV summer cycles (calculated via `timeHelpers.ts`) must trigger a blocking modal alert: *"Summer hyperpigmentation risk. Clinical guidelines advise against deep resurfacing treatments during peak UV seasons."*
* **Procedure Collision:** The system must check new procedures against the existing log using the minimum-gap matrix below, and trigger the same style of blocking modal if violated:

  | Procedure A | Procedure B | Minimum gap |
  |---|---|---|
  | Deep chemical peel | Injectable filler | 14 days |
  | Deep chemical peel | Botox | 14 days |
  | Laser resurfacing | Injectable filler | 14 days |
  | Laser resurfacing | Botox | 14 days |
  | Microneedling | Deep chemical peel | 7 days |
  | Botox | Injectable filler | No restriction |

* **Block behavior (applies to both seasonal and collision checks):** the modal blocks the default `Save` action and requires an explicit secondary action — *"I understand the risk, log anyway"* — to override and proceed. This is a deliberate guardrail, not a silent warning users can swipe past, but it is not a hard dead-end either, since users may be acting under their own practitioner's guidance. **Flagging for clinical/product sign-off:** confirm this override pattern (block + explicit acknowledgment) is the right balance, per the open items already listed in PRD §6.

---

### US-19 · Local Data Export & Restore

**As a** user who wants to preserve my data across reinstalls or devices
**I want to** export my data to a file and later restore it
**So that** I'm not permanently dependent on this one app install for my history.

**Acceptance criteria:**
* `ExportBackupUtility` serializes the full MMKV store (`catalogStore`, `routineStore`, `clinicStore`, `profileStore`) into one stringified JSON file, tagged with a schema version, and triggers the native share-sheet.
* `ImportRestoreUtility` accepts a JSON file via the system document picker and validates its schema version before proceeding; an incompatible or corrupted file produces a clear error and aborts without touching existing data.
* On a valid file, the user must choose **Replace** (wipes current local store, loads file as-is) or **Merge** (adds records from the file that don't already exist locally, matched by ID; skips exact duplicates).
* Before committing either mode, a summary screen states the scope of the change (e.g. "This will add 12 products, 3 procedures, and replace your profile settings") and requires explicit confirmation — the action is irreversible without a separate prior backup.

---

### US-20 · Catalog Filtering by Category & Biomarker

**As a** user with a large product catalog
**I want to** filter my catalog by type and ingredient function
**So that** I can quickly find a specific product without scrolling the full list.

**Acceptance criteria:**
* `CatalogFilterHeader` renders two filter levels: Category pills (`[All] [Serums] [Moisturizers] [SPF]`) and Biomarker toggle pills (`[Soothing] [Actives] [Hydration]`), both horizontally scrollable.
* Category and biomarker filters are combinable (AND logic) — e.g. selecting `Serums` + `Actives` shows only serums whose parsed INCI tags include `RETI` or `VIT_C`.
* Biomarker pill mapping to parsed tags: Soothing → Centella/Ceramide-class ingredients, Actives → `RETI`/`VIT_C`, Hydration → Hyaluronic Acid.
* Clearing all filters returns to the unfiltered `CatalogList` state; an empty result set (no products match the combination) shows a dedicated empty state, not a blank screen.

---

### US-21 · Onboarding Skip Path

**As a** new user who doesn't have a product on hand yet
**I want to** skip adding my first product during onboarding
**So that** I'm not blocked from entering the app.

**Acceptance criteria:**
* `FirstProductScreen` includes a secondary "Skip for now" outline button alongside the quick-search input.
* Tapping skip instantiates `catalogStore` empty and proceeds directly into the main tab navigator.
* On first arrival at Tab 2 with an empty catalog, `CatalogList` renders its standard empty state (not an error or blank screen), prompting the user to add their first product via `ProductHeaderAction`.

---

### US-22 · Universal Scanning & Database Crowdsourcing

**As a** user who owns a product without a barcode (or with a discarded outer box)
**I want to** point my camera at the vial to automatically extract the brand and name, or suggest my product to the global database
**So that** I don't have to manually type out long INCI ingredient lists.

**Acceptance criteria:**

* The camera view combines barcode scanning and text OCR into a single unified screen (using Google ML Kit / expo-ocr).
* If a barcode is found, the app queries `GET /api/v1/products/lookup`. If no barcode is detected but a stable block of brand/product text is visible in the viewfinder, it sends the string to `GET /api/v1/products/search`.
* The server processes the OCR string using fuzzy trigram search (`pg_trgm`), returning the top 20 most relevant matches, even if the text contains typos.
* If `GET /api/v1/products/search` or `/lookup` returns an empty array, the app presents a *"Product Not Found. Add Manually"* button.
* Clicking it transitions the user to `ProductForm`, which is pre-filled with whatever text the OCR camera managed to extract (e.g., the recognized brand and name), minimizing typing friction.
* Saving the manual form adds the product to the user's shelf instantly (local-first), while queuing a background request to the global database.
* When saved manually, the newly created item instantly appears in the local `catalogStore` with `source: 'manual'`, while a copy is dispatched to the server via `POST /api/v1/products/suggest` with `status: 'pending'` for admin review.

> **Implementation note (2026-07-07):** Barcode and text search are built,
> but on a different architecture than described above — there is no Vials
> REST API. `BarcodeScannerScreen` and `AddProductHubScreen` query
> `ProductRepository` (`src/services/corpus/ProductRepository.ts`) directly
> against the on-device Turso/libSQL replica: `findByBarcode()` for the
> barcode path, `search()` (SQLite FTS5 trigram, ranked by `bm25`) for the
> text path — both fully local and offline-capable, not `GET
> /api/v1/products/lookup` / `/search` against a Postgres `pg_trgm` backend.
> "Not found" degrades to the manual-entry form exactly as specified. Two
> pieces of this story are **not built**: (1) the unified camera OCR search
> — only barcode scanning exists; the free-text search is a separate input
> field, not a camera viewfinder recognizing on-package text; (2) the
> crowdsourcing submission path (`source: 'manual'`, `POST
> /api/v1/products/suggest`, `pending` review) — manually-added products save
> locally only, with no server suggestion queue. The corpus schema already
> reserves a `'community'` source value for this, but the submission pipeline
> itself is unbuilt. See `handoff/INTEGRATION_GUIDE.md` for the as-built
> corpus architecture, including the `source='obf_import'` cutover: today's
> corpus is 100% dogfood OBF-import data (ODbL-licensed, not Vials-owned) —
> "the global database" this story refers to is not yet populated with
> genuinely-owned (`vials_seed`/`community`) records.