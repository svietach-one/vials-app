---
project: Vials
platform: Mobile (React Native / Expo SDK 52)
stack: Zustand + MMKV Storage + React Navigation v7
design_system: Tech-Clinical / Neo-Minimalist (Airbnb Vibe)
visual_theme: Monochrome with Apothecary Glass & Wine Accents (No Pink)
version: 1.2 (skin-condition / density / SPF-adequacy revision)
---

# Vials — Product Requirements & Technical Specifications

> **Sync note (v1.1 → v1.2):** Adds three related, additive extensions to the routine
> engine, none of which change existing v1.1 behavior for users who don't opt into them:
> (1) optional skin-condition risk modifiers (eczema, seborrheic dermatitis, rosacea) that
> escalate existing warning severity; (2) same-active "density" insights when multiple
> products in one routine share an active ingredient; (3) a phototype- and season-aware
> SPF adequacy recommendation. Full acceptance criteria in `USER_STORIES.md` US-23–US-29.
> Full technical design and phased tasks in `IMPLEMENTATION_PLAN.md` Phases 8–10. The
> collision-matrix extension in §5.2 is a **research proposal pending clinical sign-off**,
> matching the existing caveat already applied to §5.3 — see §6.

## 1. Product Overview & USP
**Vials** is a premium, unisex personal skincare and aesthetic medicine management mobile app. It helps users track formulations, build dynamic morning/evening schedules (Skin Cycling), avoid ingredient conflicts, and safely navigate clinical cosmetic procedures (Botox, fillers, peels), with **all personal data stored locally on-device**.

* **The Core Value Intersection:** Daily skincare and medical cosmetic tracking combined into an inseparable local engine.
* **The Trust Anchor:** 100% data confidentiality. Personal data never leaves the device — no cloud backend, no analytics, no trackers.
* **Connectivity Architecture (The Hybrid Engine):** The application operates on a hybrid data model. The user's personal shelf (`catalogStore`), routine schedules/checklists (`routineStore`), and the ingredient conflict verification engine (`conflictEngine.ts`) run strictly offline-first and local-only (Zustand + MMKV).
Global search, barcode scanning, label text recognition (OCR), and crowdsourced product suggestions function strictly online-only. In the absence of a network connection, these features gracefully degrade, forcing the UI into manual input mode.

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
* **`ConditionSelector` (v1.2, NEW, `US-23`):** Optional step immediately after
  `PhototypeSelector`, skippable like `FirstProductScreen`'s skip path. Multi-select
  picker for three optional, self-reported skin conditions — Eczema/Atopic Dermatitis,
  Seborrheic Dermatitis, Rosacea — each with a plain-language description (not clinical
  shorthand) and a persistent, non-diagnostic disclaimer. Defaults to none selected;
  writes to `profileStore.skinConditions`. Also editable later from `SkinProfileEditor`
  (§4.5). See §4.2.2 for what these flags actually change in the app.
* **`FirstProductScreen`:** Embedded quick-search bar allowing users to input their first item to instantiate the store before unlocking the tabs. **Includes a secondary "Skip for now" outline button** — the store can instantiate empty, and `CatalogList` renders its standard empty-state on first launch of Tab 2.

### 4.2. Tab 1: Routine Hub (Super-Tab)
#### Sub-View A: Today Screen (Default)
* **`ClinicalRestrictionsBlock`:** Conditional bone-colored card (`#FAF9F6`). If an active procedure is in `Rehab` status, it displays lifestyle restriction icons (No gym, No sun) rendered with **Rich Cabernet** highlights, alongside safe indicators using **Deep Bottle Green**. **(v1.2)** During Rehab for an aggressive procedure type (deep peel, laser resurfacing, microneedling — same set as §5.3), if the user has eczema and/or rosacea selected, appends one additive Amber advisory line, e.g. *"Recovery may take a bit longer than usual — keep an eye on how your skin responds."* Copy-only; does not change the underlying rehab timeline. See §4.2.2.
* **`SeasonalNoticeBanner`:** Flat, dismissible container providing adaptive climate advice during seasonal transition cut-offs (e.g., Jun 1 / Sep 1 via `timeHelpers.ts`). **(v1.2)** Also surfaces the SPF adequacy recommendation described in §4.2.1 below, using the same dismissible/seasonal-reset mechanism, rendered Cobalt.

#### 4.2.1 SPF Adequacy Recommendation (v1.2, NEW)

If the user's phototype is Light/Fair, the current season is summer (same seasonal
boundary already used for procedure blocking in §5.3), and the lowest known `spfValue`
among SPF-type products in their AM routine is below 30, `SeasonalNoticeBanner` surfaces a
Cobalt, non-blocking recommendation, e.g.: *"Your scheduled sunscreen is SPF 20. For light
or fair skin during summer, dermatology guidelines generally recommend SPF 30 or higher —
many recommend SPF 50+ for regular outdoor exposure. Consider switching to a higher-SPF
product."* This rests on mainstream, non-contested dermatological consensus (AAD/FDA SPF
30 baseline, SPF 30–50+ commonly recommended for Fitzpatrick I–II), so it can be phrased
more directly than the hedged condition-risk copy in §4.2.2 — but it still never blocks
anything and is dismissible per-season, not permanently. Requires `Product.spfValue` to be
filled in (§5.1); silently skips the check if unknown rather than assuming the worst.
Scoped to Light/Fair phototype only in v1 — the SPF 30 baseline arguably applies to all
phototypes, and "no SPF scheduled at all" is arguably a higher-priority finding, but both
are explicitly deferred rather than bundled into this pass.

#### 4.2.2 Skin Condition Risk Modifiers (v1.2, NEW)

Three optional, self-reported profile flags — Eczema/Atopic Dermatitis, Seborrheic
Dermatitis, Rosacea (`ConditionSelector`, §4.1) — that make existing warnings *more
conservative*, never more permissive, and never blocking. These are risk modifiers layered
on top of the existing engine, not a parallel rule system, and a user who selects no
condition sees zero behavioral change (`US-27`).

**What they do:**
- **Pairwise severity escalation:** if a condition's target tags overlap either tag in an
  existing pairwise conflict (§5.2), the rendered severity escalates exactly one level
  (`Low→Medium→High`), capped at `High`. Multiple matching conditions still only escalate
  once — no stacking.
- **Single-ingredient advisory:** independently of pairwise conflicts, a relevant tag
  present in the day's routine (even alone) surfaces a `Low`/`Medium` advisory row in
  `ConflictWarningInline`, visually distinct from a pairwise conflict row and never using
  the word "conflict."
- **Recovery caution:** extends `ClinicalRestrictionsBlock` (Rehab) and
  `ProcedureLifespanCard`/`FadingInteractivePrompt` (Fading) with an additive caution line
  for eczema/rosacea after aggressive procedures (§5.3's categories).

**Ingredient risk mapping** (subject to the same clinical-review caveat as §5.2/§5.3):

| Condition | Escalates severity for | Single-ingredient advisory (no penalty for) |
|---|---|---|
| Eczema / Atopic Dermatitis | `RETI`, `ACID`, `VIT_C`, `BPO` (High-tier escalation); `AZA` (Low, no escalation) | — (no penalty: `CERA`, `PANT`, `GLYC`, `NIAC`) |
| Rosacea | `RETI`, `ACID`, `BPO` | — |
| Seborrheic Dermatitis | *(not tag-based)* — soft Low-severity note only for very rich/occlusive product formats | No penalty: `NIAC`, `AZA`, `ZPCA`, `CERA`, `PANT` |

**Hard requirements (`US-26`):** no condition-derived copy may ever use absolute/prohibitive
language ("cannot," "forbidden," "do not use"). All templates use escalating-not-certain
phrasing ("higher irritation risk," "consider introducing gradually," "monitor your skin
response") and are lint-tested against a banned-phrase list. A `RETI`+`PEPT` pair remains
explicitly non-conflicting regardless of any selected condition.
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
* **Product Ingestion (Proprietary Database Integration):** Instead of calling the third-party Open Beauty Facts API directly, the app queries the dedicated Vials API connected to a self-hosted PostgreSQL dump.
* **Universal Scanner Loop:** Product lookup is triggered via a unified camera button. The system scans the frame pipeline simultaneously for a barcode (`GET /api/v1/products/lookup`) and product label text/OCR (`GET /api/v1/products/search`). Barcode recognition takes absolute priority. Text search utilizes server-side trigram matching to handle and compensate for OCR recognition typos.
* **Crowdsourcing & Manual Fallback:** If a product is missing from the global database, the user fills out a manual form. Upon saving:
  * **Instant Local Activation:** The product is immediately saved to `catalogStore` with `source: 'manual'`, making it available for routines and ingredient conflict checks without waiting for server approval.
  * **Asynchronous Background Sync:** The app dispatches a `POST /api/v1/products/suggest` request to the server in the background with `status: 'pending'` for admin review. The user is never blocked by a "waiting for moderation" screen.
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
  * `Product`: `id, brand, name, type, inciTags[], openedDate, paoMonths, source ('api'|'manual'), spfValue: number | null` — `spfValue` is NEW (v1.2), only meaningful when `type === 'SPF'`; powers the SPF adequacy check in §4.2.1
  * `RoutineStep`: `id, productId, period ('AM'|'PM'), order, days[] ('mon'..'sun' | 'every'), hidden:boolean`
  * `Procedure`: `id, type, date, expectedDurationMonths, realDuration?, status ('rehab'|'active'|'fading'|'overdue'|'archived')`
  * `Profile`: `age, gender, phototype, skinIssues[], gamificationOn:boolean, individualDurationMonths: { [procedureType]: number }, skinConditions: SkinConditionType[]` — `skinConditions` is NEW (v1.2), default `[]`, deliberately kept separate from the generic `skinIssues[]` field (see open item below)
  * `SkinConditionType` (NEW, v1.2): `'eczema' | 'seborrheic_dermatitis' | 'rosacea'` — optional, self-reported, presence-only (no severity level in v1). Not a diagnosis; see §4.2.2 for UI/copy requirements.

> **Open item:** confirm `skinIssues[]`'s existing intended semantics don't already
> overlap with the three `SkinConditionType` values above. Kept as two separate fields
> until that's resolved.

### 5.2. Local Conflict Matrix & INCI Parsing (`utils/conflictEngine.ts`)
When a raw ingredient text string (INCI) is inputted or loaded from the API, a regex scanner parses text sequences in lowercase to map unindexed internal biomarkers:
* `parseInciTags(inci: string)` targets conflict-grade groups: `RETI` (Retinoids), `ACID` (AHA/BHA/PHA), `VIT_C` (Ascorbic Acid), `PEPT` (Copper Peptides), and — **new in v1.2** — `BPO` (Benzoyl Peroxide), `AZA` (Azelaic Acid).
* `parseBarrierTags(inci: string)` (**new in v1.2**, separate function/output — never merged into the conflict-tag array) targets non-conflict, presence-only groups used by the recommendation layer only: `CERA` (Ceramides), `PANT` (Panthenol), `GLYC` (Glycerin), `NIAC` (Niacinamide), `ZPCA` (Zinc PCA), `HYAL` (Hyaluronic Acid / Sodium Hyaluronate — also finally backs the `Hydration` biomarker pill in §4.3, which referenced Hyaluronic Acid without a detection rule until now).
* **Severity scale (v1.2):** explicit three-level ordered scale, `Low < Medium < High`, replacing the previously implicit Medium/High-only scale. Existing matrix values map directly (`High`→`High`, `Medium`→`Medium`); `Low` is new, used by the density-insight feature below.
* **Collision Verification Matrix — pairwise table:**

| Pair | Same-day result | Severity |
|---|---|---|
| `RETI` + `ACID` | Conflict | High (Rich Amber) |
| `VIT_C` + `RETI` | Conflict | High (Rich Amber) |
| `PEPT` + `VIT_C` | Conflict | Medium (Rich Amber) |
| `ACID` + `VIT_C` | Conflict (pH instability) | Medium (Rich Amber) |
| `ACID` + `PEPT` | Conflict (acidic environment degrades peptides) | Medium (Rich Amber) |
| `RETI` + `PEPT` | **No conflict** — compatible, no warning rendered | — |
| `BPO` + `RETI` *(proposed, v1.2)* | Conflict — oxidizer degrades the retinoid, plus compounded irritation | High (Rich Amber) |
| `BPO` + `VIT_C` *(proposed, v1.2)* | Conflict — oxidizer neutralizes ascorbic acid | High (Rich Amber) |
| `BPO` + `ACID` *(proposed, v1.2)* | Conflict — additive over-exfoliation/irritation risk | Medium (Rich Amber) |
| `BPO` + `PEPT` *(proposed, v1.2)* | Conflict — oxidizes/deactivates copper peptide function | Medium (Rich Amber) |
| `AZA` + `ACID` *(proposed, v1.2)* | Conflict — additive irritation risk | Medium (Rich Amber) |
| `AZA` + `RETI` *(proposed, v1.2)* | **No conflict** in the base matrix — evidence is mixed rather than consistently cautionary; surfaced instead as a soft, gradual-introduction note via the condition-modifier layer (§4.2.2), not a pairwise block | — |
| `AZA` + `VIT_C` *(proposed, v1.2)* | **No conflict** — complementary, well-tolerated | — |
| `AZA` + `PEPT` *(proposed, v1.2)* | **No conflict** — different, non-competing mechanisms | — |

  Any tag combined with itself (e.g. two `RETI` products same day) is still **not**
  flagged by *this* pairwise matrix — that remains a dosing/layering question, not an
  ingredient-class collision. It's now handled by a **separate, additive check** instead
  of being folded into the matrix — see the Active Ingredient Density Insights subsection
  immediately below.

  > **The four `BPO`/`AZA` rows marked "proposed" are a research proposal, not yet
  > approved for production.** Sourced primarily from consumer-facing dermatology content
  > (with some backing from real clinical/formulation literature — see the full source
  > list in the implementation task tracker), at the same confidence level already
  > flagged as insufficient for the §5.3 procedure-spacing table. Ship `BPO`/`AZA` tag
  > detection for single-ingredient condition-risk checks (§4.2.2) first; gate these four
  > pairwise rows behind the same clinical review pass already required for §5.3, per §6.

#### Active Ingredient Density Insights (v1.2, NEW)

Distinct from the pairwise matrix above: when **two or more products in the same AM or PM
period** (same boundary `RoutineChecklistContainer` already uses) share the *same*
ingredient tag, the engine surfaces a density finding — tiered by how much dermatological
evidence supports a real dose-stacking concern, rather than a flat rule:

| Tier | Tags | Rendering | Behavior |
|---|---|---|---|
| **Ignore** | `NIAC`, `CERA`, `PANT`, `GLYC`, `ZPCA`, `HYAL` | Nothing rendered | Humectant/barrier ingredients with no established stacking-irritation risk; duplication is a spend question, not a skin-safety one |
| **Insight** | `VIT_C`, `AZA`, `PEPT` | **Cobalt** — informational, not a caution | Mild actives where duplication mainly means diminishing returns, e.g. *"Several products in this routine contain Vitamin C. This likely won't add extra benefit."* |
| **Warning** | `RETI`, `ACID`, `BPO` | Amber — same visual family as the pairwise conflict rows above | Ingredients with a well-established dose-response irritation curve (efficacy plateaus, irritation keeps climbing); e.g. *"Multiple exfoliating products are scheduled together. Consider reducing frequency if irritation occurs."* |

`PEPT` sits in Insight, not Ignore, because Vials's `PEPT` tag specifically denotes
**copper peptides**, which carry a real (if mild) stacking consideration distinct from
generic peptides. Nothing in this feature blocks saving a routine step; the
Insight/Warning split exists specifically so a mild note doesn't get visually
overstated as a caution, or vice versa — see full design and code sketch in
`IMPLEMENTATION_PLAN.md` Phase 9.

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
* **(v1.2)** The four "proposed" `BPO`/`AZA` collision-matrix rows in §5.2 need the same
  clinical sign-off as the §5.3 spacing table — route as one combined review pass, not two.
  Do not merge those four rows into `conflictEngine.ts`'s production matrix until reviewed.
* **(v1.2)** The skin-condition ingredient risk mapping in §4.2.2, and the active-density
  tier assignments (Ignore/Insight/Warning), rest on the same class of consumer-dermatology
  sourcing as the two items above — same combined review pass.
* **(v1.2)** Confirm the onboarding disclaimer copy for `ConditionSelector` ("this is a
  self-reported flag, not a diagnosis...") meets the regulatory bar for the target markets
  (PL/BY, per the business plan's regional focus).
* **(v1.2)** Confirm `skinIssues[]` vs. new `skinConditions[]` field overlap with the
  product owner (§5.1).