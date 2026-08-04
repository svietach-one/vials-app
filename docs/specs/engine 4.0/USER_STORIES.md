# Vials — Complete User Stories & Acceptance Criteria

This document defines the complete functional requirements and behavior specifications for Phase 1 features.

> **Sync note (this revision):** Fixed a calibration bug in US-17 (rolling average was re-anchoring to the static baseline every time instead of accumulating), standardized the block-vs-warning behavior between US-17/US-18, aligned component names with the screen spec, and added US-19–21 to cover Import/Restore, Catalog filtering, and onboarding skip — all of which exist in the PRD/screen specs but had no acceptance criteria yet.
>
> **Sync note (v1.2):** Added US-23–US-27 (optional skin-condition risk modifiers),
> US-28 (active ingredient density insights), US-29 (phototype-aware SPF adequacy
> recommendation), and US-30–US-33 (skin goals, goal-coverage hints, pregnancy/lactation
> safety guard, and the safety-outranks-coverage rule), matching the new `PRD_Spec.md`
> v1.2 sections 4.2.1–4.2.3 and 5.2.

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

---

### US-23 · Optional Skin Condition Selection

**As a** user setting up or editing my profile
**I want to** optionally flag that I have eczema, seborrheic dermatitis, and/or rosacea
**So that** the app can be more conservative in its warnings without me having to
re-explain it every time.

**Acceptance criteria:**
* A new optional step appears in `SkinProfileSetupScreen` during onboarding, after the
  `PhototypeSelector` step, and as an editable section in `SkinProfileEditor` (Tab 4).
* The picker is multi-select (a user can select any combination of the three, or none)
  and defaults to none selected.
* The step is skippable in onboarding — skipping is equivalent to selecting none and does
  not block progress to `FirstProductScreen`, consistent with the skip pattern in US-21.
* Each option is labeled in plain language (not clinical shorthand) and is accompanied by
  a short, non-diagnostic description, e.g. "Rosacea — skin that flushes or reacts easily."
* The screen displays a persistent disclaimer: this is a self-reported flag, not a
  diagnosis, and does not replace advice from a dermatologist.
* Selections write directly to `profileStore.skinConditions` (new field, see
  `PRD_Spec.md` §5.1) without requiring an account or network connection, consistent with
  the local-first pattern already established by US-03.

---

### US-24 · Condition-Aware Ingredient Warning Severity

**As a** user with a selected skin condition
**I want to** see stronger cautionary language on ingredient combinations relevant to my
condition
**So that** I'm not caught off guard by irritation the base engine wouldn't have flagged
as strongly.

**Acceptance criteria:**
* For each pairwise conflict the existing `conflictEngine.detectConflicts()` already
  returns (per the matrix in `PRD_Spec.md` §5.2), if the user has a condition whose target-
  tag list (`PRD_Spec.md` §4.2.2) includes either tag in the pair, the rendered severity is
  escalated by exactly one level (`Low → Medium`, `Medium → High`), capped at `High` — a
  pair already at `High` renders unchanged.
* If the user has more than one condition and multiple conditions target the same tag,
  only a single one-level escalation applies — escalations from different conditions do
  not stack additively.
* Independently of pairwise conflicts, a new single-ingredient check surfaces a `Low` or
  `Medium` severity advisory when a scheduled product contains a tag relevant to the
  user's condition(s), even with no second ingredient present that day. This renders as a
  distinct row in `ConflictWarningInline` (`condition-advisory`), visually distinguishable
  from a pairwise conflict row, and never uses the word "conflict" for a single-ingredient
  advisory.
* All condition-derived warning copy uses escalating, non-absolute language only — see the
  banned-phrase list in US-26. No condition-derived warning may ever block saving a
  routine step or completing a checklist item.
* A `RETI` + `PEPT` pair remains explicitly non-conflicting regardless of any selected
  condition.

---

### US-25 · Condition-Aware Recovery Caution

**As a** user with eczema or rosacea who has recently had an aesthetic procedure
**I want to** see extra recovery caution during rehab and fading phases
**So that** I don't push my skin too hard while it's already more reactive than usual.

**Acceptance criteria:**
* While a procedure is in `Rehab` status (0–48h) and the user has eczema and/or rosacea
  selected, `ClinicalRestrictionsBlock` appends one additional advisory line beyond the
  existing lifestyle-restriction icons, e.g. "Recovery may take a bit longer than usual —
  keep an eye on how your skin responds." Rendered in the existing Amber caution style;
  this is additive text, not a new restriction icon and not a Cabernet block.
* This advisory only appears for procedures already classified as aggressive under the
  existing spacing/seasonal rules (deep chemical peel, laser resurfacing, microneedling —
  per `PRD_Spec.md` §5.3). It does not appear for Botox or filler-only rehab periods.
* The same condition-aware caution line appears on `ProcedureLifespanCard` / the
  `FadingInteractivePrompt` copy during the Fading phase for the same procedure
  categories.
* This advisory never changes the underlying rehab/fading timeline, the 3-deferral cap
  from US-17, or any seasonal/spacing block from US-18 — it is copy-only.

---

### US-26 · Non-Absolute Language Guarantee

**As the** product team
**I want to** guarantee that no condition-derived or density-derived warning ever uses
prohibitive language
**So that** the feature stays advisory and doesn't create a false impression of medical
authority or liability exposure.

**Acceptance criteria:**
* All condition-derived and active-density warning message templates (US-24, US-25, US-28)
  are defined in one central template file/table per feature, not inlined ad hoc across
  components.
* A test (unit or lint step, run as part of the Phase 7-style polish pass) scans every
  template string against a banned-phrase list including at minimum: "cannot," "can't,"
  "must not," "forbidden," "unsafe," "do not use," "you should not," "never use." The
  build fails if any template matches.
* Every condition-derived or density-derived warning, wherever rendered, is visually and
  textually distinguishable from a `Cabernet` hard-block warning (e.g. the
  seasonal/spacing blocks from US-18) — a user should never be able to confuse an
  advisory or insight with a block.

---

### US-27 · No-Op Guarantee for Users Without Conditions

**As a** user who has not selected any skin condition
**I want to** experience the app exactly as it behaved before this feature shipped
**So that** this change carries zero regression risk for the majority of users.

**Acceptance criteria:**
* With `profileStore.skinConditions === []` (the default), `detectConflicts()`'s output —
  including severity values — is byte-identical to its pre-feature output for every case
  in the existing test suite covering `PRD_Spec.md` §5.2's collision matrix.
* With `skinConditions === []`, the new single-ingredient advisory check (US-24) returns
  an empty result set for all inputs.
* With `skinConditions === []`, `ClinicalRestrictionsBlock` and `ProcedureLifespanCard`
  render with no additional line beyond what US-17/US-18 already specify.
* This is enforced as an explicit regression test: the existing `conflictEngine` test
  suite is run twice per test case — once with the user's actual profile and once with
  `skinConditions` forced to `[]` — and the two outputs are asserted equal whenever the
  actual profile also has no conditions selected.

---

### US-28 · Active Ingredient Density Insights

**As a** user building or editing my weekly routine
**I want to** be told when several of my products contain the same active ingredient
**So that** I understand when I'm getting diminishing returns versus real irritation risk,
without every duplicate being treated as an equally serious problem.

**Acceptance criteria:**
* When two or more products scheduled in the **same AM or PM period, same day** share an
  ingredient tag (via `parseInciTags`/`parseBarrierTags`), the engine evaluates it against
  the three-tier map in `PRD_Spec.md` §5.2 (Active Ingredient Density Insights):
  Ignore (`NIAC`, `CERA`, `PANT`, `GLYC`, `ZPCA`, `HYAL`), Insight (`VIT_C`, `AZA`, `PEPT`),
  Warning (`RETI`, `ACID`, `BPO`).
* Ignore-tier duplication produces no UI at all.
* Insight-tier duplication renders a **Cobalt**, non-alarming row in `ConflictWarningInline`
  (`density-insight`), distinct in color and copy from any Amber conflict/warning row —
  e.g. "Several products in this routine contain Vitamin C. This likely won't add extra
  benefit." This must never render in Amber — using the warning color for an insight
  defeats the purpose of the tier distinction.
* Warning-tier duplication renders an Amber row (`density-warning`), visually consistent
  with the existing pairwise conflict rows, e.g. "Multiple exfoliating products are
  scheduled together. Consider reducing frequency if irritation occurs."
* The check only fires at 2+ products sharing a tag within one period — a single product
  containing that tag never triggers a finding regardless of tier.
* Two products sharing a tag across different periods (e.g. one AM, one PM) do **not**
  trigger a finding — periods are scoped independently.
* If the user has a selected skin condition (US-23) whose target tags include an
  Insight-tier finding's tag, the finding escalates from `density-insight` to
  `density-warning` (Cobalt → Amber) — same one-level, no-stacking escalation rule as
  US-24, applied through the same shared mechanism.
* Nothing in this feature blocks saving a routine step, and it is scoped to the Weekly
  Plan (Tab 1B) only — it does not render on the Today screen (Tab 1A).
* Message templates are subject to the same banned-phrase lint as US-26.

---

### US-29 · Phototype-Aware SPF Adequacy Recommendation

**As a** user with a light/fair phototype
**I want to** be told when my scheduled sunscreen's SPF is likely too low for summer
**So that** I can make an informed decision to switch to stronger protection.

**Acceptance criteria:**
* `Product` gains a `spfValue: number | null` field (`PRD_Spec.md` §5.1), settable via a
  conditional numeric input in `ProductForm` when `Type` is `SPF`. Optional — a product can
  be saved without it; the recommendation check simply cannot evaluate that product until
  it's filled in.
* If the user's `profile.phototype` is Light/Fair, the current season (via
  `timeHelpers.getCurrentSeason()`) is summer, and the lowest known `spfValue` among
  `SPF`-type products scheduled in the AM routine is below 30, `SeasonalNoticeBanner`
  surfaces a recommendation, e.g.: "Your scheduled sunscreen is SPF 20. For light or fair
  skin during summer, dermatology guidelines generally recommend SPF 30 or higher — many
  recommend SPF 50+ for regular outdoor exposure. Consider switching to a higher-SPF
  product."
* This recommendation renders in the existing **Cobalt** informational style (matching
  the "UV seasonal change banners" color mapping already defined for `SeasonalNoticeBanner`
  in `PRD_Spec.md` §2.2), not Amber — this is proactive information, not a caution about an
  interaction.
* The recommendation is dismissible using the existing `settingsStore.dismissedBanners`
  mechanism (`IMPLEMENTATION_PLAN.md` Phase 0), but the dismiss key is season-and-year-
  scoped (e.g. `spf-upgrade-summer-2026`) — dismissing it this summer must not suppress it
  in a future summer.
* The check never blocks anything and is skipped entirely (no false positive) when no
  `SPF`-type product is scheduled, or when a scheduled `SPF`-type product's `spfValue` is
  unset — missing data means "can't check," not "assume the worst."
* Out of scope for this story (tracked, not forgotten): applying the same check to
  Medium/Olive and Dark/Deep phototypes, a separate "no SPF scheduled at all" finding, and
  PA-rating (UVA) evaluation for Asian/European-labeled sunscreens.
---

### US-30 · Skin Goal Selection

**As a** user setting up or editing my profile
**I want to** optionally select the skincare goals I care about (wrinkles, pores, dryness,
pigmentation, sebum control, restoration, protection)
**So that** the app can tell me whether my routine actually addresses what I'm trying to
improve.

**Acceptance criteria:**
* An optional multi-select goal step appears in onboarding and is editable in
  `SkinProfileEditor` (Tab 4), defaulting to none selected and skippable like other
  optional onboarding steps.
* Selections write to `profileStore.skinGoals` (new field, `PRD_Spec.md` §5.1) — no
  account or network required.
* Goals are presented in plain language; selecting none disables all goal-coverage hints
  (US-31) entirely (no-op).

---

### US-31 · Goal-Coverage Hints

**As a** user who has stated skincare goals
**I want to** be gently told when nothing in my routine addresses one of my goals
**So that** I can decide whether to adjust my routine — without being nagged or sold to.

**Acceptance criteria:**
* For each stated goal, the engine maps it to relevant ingredient tags (or the `SPF`
  product type for `protection`) per the table in `PRD_Spec.md` §4.2.3, and checks the
  user's catalog and routine.
* If a matching product is scheduled in the routine, no hint is shown (goal is covered).
* If a matching product exists on the shelf but is not scheduled, a Cobalt, dismissible
  informational hint surfaces after routine creation, worded as a reminder that the user
  already owns something relevant.
* If no product on the shelf addresses the goal, the softest-worded Cobalt hint surfaces —
  never framed as an error, never pushing a specific purchase.
* Hints render on the Today screen after routine creation and may optionally appear as a
  passive note during Weekly Plan editing ("this routine is built from what you have;
  nothing here targets your 'pores' goal yet").
* All hint copy obeys the US-26 banned-phrase rules and never uses Cabernet or any blocking
  UI. Dismissal uses the existing `settingsStore.dismissedBanners` mechanism.
* With `skinGoals === []`, no hint is ever produced (no-op).

---

### US-32 · Pregnancy/Lactation Safety Guard

**As a** pregnant or breastfeeding user
**I want to** be flagged when my routine contains actives that are usually set aside during
pregnancy, and be pointed to a professional
**So that** I can make a safe, informed decision.

**Acceptance criteria:**
* The guard is driven by the existing `UserProfile.pregnantOrBreastfeeding` flag (already
  shown as a `ListRow` with hint "We'll flag retinoids and other restricted actives" in the
  Edit Skin Profile sheet). When the flag is false, the guard produces no output at all.
* Restricted-tier actives (`RETI`, `HYDRO`) scheduled in the routine trigger a soft Amber
  advisory that MUST include an explicit plain-language redirect to a doctor or
  dermatologist. This is never a hard block — the user may be acting on their own
  practitioner's guidance.
* Caution-tier actives (`ACID`, `BPO`) scheduled in the routine produce a milder note
  acknowledging that some forms are used with caution during pregnancy and that a
  professional can advise — because the app cannot read ingredient concentration, this copy
  stays deliberately non-specific.
* The engine flags at least `RETI` and `HYDRO`, satisfying the shipped hint's promise of
  "retinoids and other restricted actives" — a test asserts the hint text and actual
  behavior agree.
* No safety copy diagnoses, uses absolute/prohibitive language (US-26), or states the
  product is unsafe — it frames actives as "usually set aside during pregnancy" and defers
  to a professional.

---

### US-33 · Safety Outranks Goal Coverage

**As a** pregnant or breastfeeding user with a stated goal whose only matching product is a
restricted active
**I want to** be shown pregnancy-safe alternatives for that goal instead of being told I
have nothing
**So that** the app never nudges me toward a product I should be cautious about.

**Acceptance criteria:**
* When `pregnantOrBreastfeeding` is set and the only shelf products matching a stated goal
  are Restricted-tier actives, the goal-coverage hint MUST NOT report the goal as
  "uncovered / nothing on shelf" — doing so would nudge the user toward the restricted
  product.
* Instead, a `safety_redirect` finding surfaces that names the pregnancy-safe alternatives
  relevant to that goal (e.g. Vitamin C, azelaic acid, niacinamide for wrinkles/pigmentation)
  and includes the mandatory professional-redirect line.
* When both restricted and safe-tier products for a goal exist on the shelf, the safe-tier
  product is used as the covering match and normal coverage logic applies; any restricted
  product scheduled is still separately flagged per US-32.
* This precedence is covered by explicit tests: the pregnant + goal + only-restricted-shelf
  case must produce `safety_redirect`, not a plain "not on shelf" hint.
