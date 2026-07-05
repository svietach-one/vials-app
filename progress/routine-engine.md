Status: PR_REVIEW
Tech Design: docs/tech-design/routine-engine.md
Code: —

## Карточка задачи
- [x] Product requirements (planner) — docs/specs/2026-07-04-routine-engine.md
- [x] Technical design (planner) — docs/tech-design/routine-engine.md
- [x] QA tests (qa-lead)
- [x] Implementation (engineer)
- [x] Architecture review (tech-lead)

## Log
- 2026-07-03: Research pass completed (docs/research/routine-engine.md) —
  edge cases, JSON ruleset schemas, 8-stage pipeline. V1 decisions recorded.
- 2026-07-04: Product-owner V2 spec received and merged into research doc
  (symptom presets, dynamic skin cycling + lazy tracking, adaptation
  micro-dosing, Fitzpatrick 1–6 modifiers, weather-driven season masks,
  generate entry points + Diff Mode preview). Decision log §4 rewritten;
  §5 flags added (English-only copy, "AI Engine" naming, weather fallback,
  gamification boundary, migrations).
- 2026-07-04: Spec + tech design authored. Open items: generate-button copy
  (product owner), cities dataset sourcing (engineer, FE-7).
- 2026-07-04: Product owner finalized UI copy — generate action
  `✨ Generate Routine` (no "AI Engine" wording), check-in button
  "Complete My Routine" (supersedes "Applied My Routine" placeholder).
  Spec open question #1 closed; remaining open item: cities dataset (FE-7).
- 2026-07-04: V3 architectural audit (rehab shield widget + long-term
  decoupling) merged. Audit verdict: compatible — render-time mask design
  already isolates rehab from greedy admission and Draft Preview; Rule B was
  structurally satisfied by computeStatus. Spec Story 10 added; tech-design
  FE-10 added; plan step 8.9 added. FIRST CODE SHIPPED ahead of qa-lead by
  product-owner instruction: src/types/index.ts (TreatmentZone,
  RehabWidgetState, customRehabDays, affectedZones) +
  src/utils/routineEngine/rehabFilter.ts + 15 unit tests (green, tsc clean).
  Deviation note for tech-lead: applyRehabFilter takes a third `products`
  param vs the spec'd 2-arg signature — a Routine alone cannot resolve
  active classes; documented in research §1.5 V3 block.
- 2026-07-04: FE-1/FE-2 partially delivered (product-owner instruction).
  `src/constants/rulesets/actives.json` shipped: 15 classes with regex
  matchers/negativePatterns/potency, `legacyKeyMap`, 6 pair rules including
  the two new domain rules (rule_copper_peptides_acids avoid,
  rule_vitc_pure_acids caution + low-potency exception; both use array-`b`
  sides ["aha","bha"(,"pha")] instead of duplicated pairwise rules — engine
  resolver must support `a|b: key | key[]`). Old flat INCI_INGREDIENT_MAP
  deleted; parser rewired IN PLACE at `src/utils/ingredientParser.ts`
  (compiled regex + negative-pattern stripping + legacy-key normalization) so
  ConflictEngine/rehabFilter/catalog upgrade at once — no separate
  routineEngine/ingredientParser.ts to avoid two parsers drifting.
  ActiveIngredientKey union extended (canonical + legacy), conflictRulesDb
  and labels migrated to canonical keys. New rulesetIntegrity.test.ts guards
  the hand-edited JSON (unique ids, class refs, regex compile, vocab,
  self-pair ban). Verified: tsc clean; src/utils 9 suites / 200 tests green
  (worktree-baseline noise excluded). Remaining FE-2 scope: activeTags
  normalization audit in catalog filters + vitamin C infobox (FE-9).
- 2026-07-04: NEXT STEP SIGNED OFF (product owner): "State Schema Alignment
  & Persisted Migration Pass" — pure src/utils/routineEngine/migrations.ts +
  hydrate wiring in products/profile/settings/routines stores, schemaVersion
  scaffold, unit tests. No UI, no procedures.json/seasons.json (those follow
  next). Phototype ships transitional: keep grouped field, add synced
  numeric fitzpatrick 1–6 (1_2→1, 3_4→4, 5_6→6); UI flips in FE-9.
  Products migration persists canonical tags + a marker flag for the
  Story 9 vitamin C infobox.
- 2026-07-04: STATE SCHEMA ALIGNMENT & PERSISTED MIGRATION PASS shipped
  (engineer). Files:
  * src/types/index.ts — added FitzpatrickType (1–6), CityLocation,
    RoutineCycleType; UserProfile.fitzpatrick + UserProfile.city (required,
    null default; grouped phototype kept, transitional); Product.
    vitaminCAutoMigrated?; RoutineStep.userPinned?; AppSettings.
    routineCycleType.
  * src/utils/routineEngine/migrations.ts (pure — no React/store/AsyncStorage)
    — deriveFitzpatrick, migrateProfile (city null + numeric fitzpatrick via
    stricter-member map 1_2→1 / 3_4→4 / 5_6→6; grouped field untouched),
    migrateProductActiveKeys + migrateProducts (canonicalize activeTags &
    activeIngredients via ingredientParser.normalizeActiveKey/legacyKeyMap,
    de-dup collapsed keys, set vitaminCAutoMigrated on vitamin_c→pure),
    migrateRoutines (userPinned:false + scheduledDays:[] defaults). All return
    the SAME reference when unchanged → idempotent + change-detected persist.
  * src/services/storage.ts — STORAGE_KEYS.schemaVersion,
    CURRENT_SCHEMA_VERSION=2, BASELINE_SCHEMA_VERSION=1, loadSchemaVersion(),
    persistSchemaVersionIfBehind() (writes a constant → race-safe under the
    parallel Promise.all hydrate).
  * hydrate wiring: productsStore (migrateProducts), profileStore
    (migrateProfile + syncFitzpatrick in setProfile/updateProfile so grouped
    writes re-derive the numeric field), routinesStore (migrateRoutines
    replaces the old inline scheduledDays normalization; empty-seed path
    preserved), settingsStore (default-merge + routineCycleType 'fixed' default
    + setRoutineCycleType, persisted via pickSettings). proceduresStore
    unchanged — custom fields already typed, hydrate passes them through.
  Design note (deviation from a strict version-gated runner): migrations always
  run in-memory on hydrate (cheap, pure, idempotent) and persist only when the
  result reference differs from the loaded data; schemaVersion gates the
  one-time version write and records the storage-versioning finding from the
  2026-07-03 architecture review. This removes the cross-store race a shared
  version gate would introduce under Promise.all. In-memory state is always
  V2-shaped regardless of version-write ordering.
  Verified: `npx tsc --noEmit` clean; `npx jest src/utils
  --testPathIgnorePatterns="worktrees"` → 10 suites / 224 tests green (24 new
  in migrations.test.ts: all key mappings, marker flag, dedup, idempotency by
  reference, fitzpatrick derivation incl. null). No UI, no
  procedures.json/seasons.json, no weather/cycle stores (next steps).
  NEXT STEP per plan: procedures.json + seasons.json + rulesetTypes.ts
  (FE-1 remainder feeding FE-3 context).
- 2026-07-04: RULESETS + TYPED LOADERS shipped (engineer, FE-1 remainder /
  plan step 8.1). Files:
  * src/constants/rulesets/procedures.json — freeze windows as phased product
    rules for all 6 CosmeticProcedureKey procedures + custom_default. rehabDays
    kept consistent with CLINICAL_RULES_DB (botox 7, fillers 14, smas 14,
    meso 5, peel 14, facial 3). Action vocab freeze/require/prioritize/limit;
    property/class/productType targets; `custom_default` uses the "rehabEnd"
    sentinel resolved at context-build time from the log's customRehabDays.
  * src/constants/rulesets/seasons.json — 3 seasonal rules (summer SPF mandate,
    summer exfoliant limit, winter barrier priority) + `climate` block
    (hysteresis 15/20 °C, checkIntervalDays 7, staleAfterDays 14).
  * src/constants/rulesets/rulesetTypes.ts — schema types for all three
    rulesets (actives/procedures/seasons) + shared vocabulary (Potency, Period,
    Season, RuleAction, ResolutionStrategy, RuleTargets, ActiveProperties) +
    typed loaders ACTIVES_RULESET / PROCEDURES_RULESET / SEASONS_RULESET.
    Domain keys (ActiveIngredientKey, ProductType, ConflictSeverity) imported
    from @/types, not re-declared. Parser left untouched (its private
    interfaces stay; no rewire per constraint).
  * Integrity tests: proceduresRuleset.test.ts + seasonsRuleset.test.ts guard
    the hand-edited JSON (version stamp, action/period/severity/season vocab,
    valid class/property/productType refs, rehabDays vs CLINICAL_RULES_DB,
    rehabEnd only in custom_default, require-needs-period, unique season ids,
    valid hysteresis band).
  Assumptions (Type B/C technical, no API/DB impact → recorded, not blocking):
  (1) procedures beyond the research-specified chemical_peel_deep/botox/
  custom_default (fillers, smas_lifting, mesotherapy, mechanical_facial) get
  conservative property-based windows modeled on the same vocabulary —
  massage freeze for filler/SMAS, exfoliant/aggressive-active freeze + SPF
  mandate for meso, exfoliant freeze + barrier prioritize for mechanical
  facial. Reason: research only specced three; the rest need *some*
  defensible window and property targeting keeps them forward-compatible.
  (2) `massageRequired` is referenced by botox/filler/SMAS freezes but no
  actives.json class declares it yet, so those freezes match nothing today —
  intentional forward-compat; the property lands when massage-style products
  are modeled (research §1.5).
  DEFERRED to FE-3 (context / effective ruleset): actives.json `phototypeModifiers`
  (§2.4) and per-class `adaptation` blocks (§2.6) — kept out of this step so
  actives.json stays untouched and the shapes are validated against a real
  consumer (the effective-ruleset builder) rather than added speculatively.
  Verified: `npx tsc --noEmit` clean; `npx jest src/utils
  --testPathIgnorePatterns="worktrees"` → 12 suites / 240 tests green
  (16 new across the two integrity suites).
  NEXT STEP per plan: FE-3 (plan 8.3) — buildRoutineContext: procedure phase
  resolution (incl. custom_default + rehabEnd), phototypeModifiers +
  adaptation into actives.json, SeasonMask consumption.
- 2026-07-04: CONTEXT + EFFECTIVE RULESET shipped (engineer, FE-3 / plan 8.3).
  Files:
  * src/constants/rulesets/actives.json — added top-level `phototypeModifiers`
    (types 4–6: escalatePairSeverity caution→avoid when both sides irritancy
    ≥2 + tightenLimit exfoliant 1×/wk; types 1–2: non-skippable AM SPF mandate
    when a photosensitizer is present). Existing structure untouched.
  * src/constants/rulesets/rulesetTypes.ts — PhototypeModifier/PhototypeEffect
    union + SeasonMask type; ActivesRuleset gains optional phototypeModifiers.
  * src/utils/routineEngine/context.ts (pure) —
    matchesComparator (boolean / numeric / ">=n" comparator strings, shared
    with procedure/custom_default targets); buildEffectiveRuleset(fitzpatrick)
    → escalated pairRules + derived limits + derived mandates (type 3/null =
    baseline); resolveActiveProcedureRules(procedures, now) → phase-active
    freeze/require/prioritize/limit windows with resolved untilDate,
    custom→custom_default with rehabEnd from customRehabDays, overlap merge
    keeping max(toDay); buildRoutineContext(input) → RoutineContext { date
    (skincare 04:00 boundary via timeHelpers), fitzpatrick, seasonMask,
    procedureRules, effectiveRuleset }. Reuses getSkincareDateString; no
    React/store/AsyncStorage.
  * context.test.ts — 19 tests (comparator matrix; escalation fires only when
    both sides irritant; niacinamide non-escalation; exfoliant cap; SPF
    mandate; peel phase activation + untilDate; long-window survival; archived
    skip; custom rehabEnd; zero-day custom; overlap merge; determinism;
    context assembly).
  Deferred still: per-class `adaptation` blocks (§2.6) → FE-6 (plan 8.5, tied
  to application counters); season-rule *application* → FE-4 mandates (context
  only carries the SeasonMask, per research §3 step 2).
  Verified: `npx tsc --noEmit` clean; `npx jest src/utils
  --testPathIgnorePatterns="worktrees"` → 13 suites / 259 tests green.
  NEXT STEP per plan: FE-4/FE-5 (plan 8.4) — core pipeline
  (eligibility → slotting → greedy resolution → mandates → ordering) +
  generate/validate/substitute/dailyView entry points. Needs FE-2 ProductFacts
  (buildProductFacts) as its per-product input — confirm/finish that first.
- 2026-07-04: PRODUCTFACTS shipped (engineer, FE-2 remainder / pipeline
  step 1). Files:
  * src/utils/ingredientParser.ts — extended IN PLACE (per the standing
    single-parser decision): compiled matchers now retain per-pattern potency;
    new export parseActiveIngredientDetails(inciText) → { key, potency? }[]
    with strongest-potency-wins when multiple forms of one class match.
    parseActiveIngredientsFromInci now delegates to it — public API unchanged,
    all existing parser tests green.
  * src/utils/routineEngine/productFacts.ts (pure, injected now) —
    buildProductFacts(product, now) → ProductFacts { productId, classes
    (key + potency + source tag|parse, sorted by key), properties (OR-merged
    booleans + max irritancy), allowedPeriods (∩ of class periods ∩
    usageTime), eligible (!isHidden && !paoExpired via computePaoStatus) };
    buildShelfFacts(products, now) → Map keyed by productId. Wizard-confirmed
    activeTags ∪ activeIngredients (legacy-normalized) are authoritative;
    parse fills gaps + supplies potency evidence; unknown keys dropped.
  * productFacts.test.ts — 26 tests: attribution (tag wins, parse fills,
    legacy normalization, stable sort), potency (INCI evidence beats default,
    strongest-wins, tag-only → 'high', ceramides → undefined), §1.6
    false-positive fixtures (retinol-free, sodium lactate, ethyl ascorbic →
    derivative, willow bark → bha low), property merge, allowedPeriods
    (retinoid ∩ both → pm; retinoid ∩ morning → ∅; spf → am), eligibility
    (hidden, PAO-expired, in-window, missing PAO), determinism, shelf map.
  Assumption (Type B, recorded): tag-confirmed class with no INCI potency
  evidence defaults to 'high' — potency exceptions only downgrade severity on
  LOW potency, so an unknown form must not soften rules (safety-first,
  consistent with the stricter-member phototype mapping). Alternative:
  'medium' midpoint. rx is never assumed, only matched.
  Note: ProductFacts caching (research §2.5 cache key) intentionally NOT
  implemented — shelf < 30 products, O(n) rebuild is trivial; a memo layer
  belongs in the useDailyRoutineView hook (FE-8+) if profiling demands it.
  Verified: `npx tsc --noEmit` clean; `npx jest src/utils
  --testPathIgnorePatterns="worktrees"` → 14 suites / 285 tests green.
  NEXT STEP per plan: FE-4 (plan 8.4) — eligibility.ts + slotting.ts +
  resolve.ts (greedy admission + resolution ladder + stacking/adaptation
  caps) + mandates.ts + ordering; then FE-5 entry points.
- 2026-07-04: TECH-LEAD ARCHITECTURE REVIEW (Steps 1-4: State Schema Alignment,
  Rulesets+typed loaders, Context+effective ruleset, ProductFacts). Verdict: ACCEPT
  (0 BLOCKERS, 5 WARNINGS). Verified: tsc clean; jest src/utils 14 suites/285 tests
  green (test counts per file cross-checked against log claims: migrations 24,
  context 19, productFacts 26, proceduresRuleset+seasonsRuleset 16 -- all match).
  Layer purity clean (no React/AsyncStorage/fetch/store leakage in routineEngine or
  rulesets). Migrations verified idempotent + same-reference by source and by
  explicit test assertions. schemaVersion race-safety confirmed (constant-write
  design converges regardless of Promise.all ordering). Determinism verified
  (productFacts sorts classes by key; procedure-rule merge keyed by
  JSON.stringify(targets) is stable for all current single-key target shapes).
  Procedure phase math consistent between context.ts and the already-shipped
  rehabFilter.ts (same half-open [fromDay,toDay) window semantics); custom_default
  rehabEnd + zero-day edge case correct. Data-model fidelity matches tech design
  exactly for Step 1 fields; phototype stricter-member mapping (1_2->1,3_4->4,
  5_6->6) matches decision log. rulesetTypes.ts vs types/index.ts split is
  design-sanctioned and clean (no domain types re-declared).
  WARNINGS (non-blocking, recommend follow-up): (1) buildProductFacts
  (productFacts.ts:86-148, ~63 lines) exceeds the 50-line guideline -- split into
  attributeClasses()/aggregateProperties(). (2) elapsedDays (context.ts:184-188)
  duplicates rehabFilter.ts's getElapsedDays verbatim -- extract one shared helper.
  (3) context.ts's private rehabEndFor duplicates rehabFilter.ts's exported
  getRehabDays -- import instead of re-declaring. (4) context.ts's
  procedureDisplayName hand-rolls replace(/_/g,' ') instead of importing the
  canonical getProcedureDisplayName() from procedureLifespanHelpers.ts (the same
  anti-pattern already fixed once in commit 1deb202 for ClinicalRestrictionsBlock)
  -- will render an inconsistent string once FE-8/9 surfaces
  ActiveProcedureRule.procedureName. (5) mergeProcedureRules's
  JSON.stringify(targets) merge key is correct today (all colliding target shapes
  are single-key) but is key-order-sensitive; revisit if procedures.json grows
  multi-key targets.
- 2026-07-04: REVIEW WARNINGS 1–4 FIXED (engineer). (1) buildProductFacts
  split into attributeClasses() + aggregateProperties() — all functions now
  under 50 lines. (2) shared getElapsedDays() extracted to timeHelpers.ts;
  context.ts and rehabFilter.ts both import it (private duplicates deleted).
  (3) context.ts imports getRehabDays from rehabFilter.ts (private rehabEndFor
  deleted). (4) context.ts AND rehabFilter.ts now use getProcedureDisplayName()
  from procedureLifespanHelpers — predefined procedures render their canonical
  labels (e.g. "Deep Chemical Peel", not "chemical peel deep"); rehabFilter
  fixed too so the pattern is fully eradicated (reviewer had scoped it out but
  flagged perpetuation). Warning 5 (merge-key fragility): no action per review.
  Zero test changes needed. Verified: tsc clean; src/utils 14 suites /
  285 tests green.
- 2026-07-04: CORE PIPELINE shipped (engineer, FE-4 / plan 8.4) — pipeline
  steps 3–7. Files (all pure, no React/store/AsyncStorage):
  * src/constants/rulesets/actives.json — per-class `concerns` (goal-match
    scoring data) + `preferredPeriod` (vitamin_c ×2, copper_peptides,
    benzoyl_peroxide → am); rulesetTypes.ts typed both; rulesetIntegrity
    gained a vocab test (concerns ⊆ SkinConcern; preferredPeriod ∈
    allowedPeriods).
  * src/utils/routineEngine/context.ts — gap fix: procedures scoped to
    non-face zones (affectedZones without 'face') no longer constrain
    routines at generation (research V3 zone rule; was render-mask-only).
    +2 context tests.
  * planTypes.ts — shared stage outputs: PlannedStep, FrozenItem,
    PlaceholderSlot, DecisionLogEntry/DecisionAction.
  * targeting.ts — matchesRuleTargets(productType, facts, targets): AND
    within a selector, anyOf unions, empty never matches; comparator strings
    via context.matchesComparator. Shared by eligibility/mandates/resolve.
  * slotting.ts — LAYERING_ORDER (makeup_remover 0 → spf 13; serum=gel,
    lotion=cream=moisturizer share slots; other after serums),
    periodsForProduct (spf productType → am even without a parsed filter
    class), isTreatment (classes + irritancy≥1|photosensitizing|lowPh|spf),
    preferredPeriodFor (single allowed → it; class convention; else pm),
    orderSteps (slot → score → addedAt → id, stable).
  * eligibility.ts — applyEligibilityGates: fixed gate precedence hidden →
    pao_expired → clinical_freeze (procedure freeze rules via targeting,
    carries untilDate) → no_allowed_period; one cause per product.
  * mandates.ts — source-folding collectors (clinical + seasonal + phototype
    → flat lists): collectLimits, collectPrioritizeTargets (period-scoped),
    collectRequireMandates (planContainsProperty conditions, nonSkippable);
    applyMandates → ≤1 placeholder per period, productTypes merged,
    nonSkippable wins; every trigger logged.
  * resolve.ts — deterministic greedy admission (research §1.1/§1.3):
    score = prioritize(1000) + concernHits(100) + potency(10), ties addedAt
    desc → id asc; AM pass then PM pass, single relocation max (am loser →
    pm pool; pm loser → immediate retry vs final am set, freeze on reject);
    resolution ladder separate_periods → separate_days (loser Tue/Sat, single
    daily winner shrinks to complement; multi-partner uses free days) →
    freeze_lower_priority → keep_with_note (CAUTION-ONLY — avoid-level
    violations, incl. phototype-escalated ones, skip it and freeze on ladder
    exhaustion); stacking caps (maxPerPeriod/sharedCapWith) as avoid-level
    pseudo-rules [separate_days, freeze]; limit actions clamp scheduledDays
    (1/wk → Wed) inside the same loop; pair-rule exceptions honor orientation
    (whenPotencyAtMost side a/b), unknown potency never softens; periods
    returned layer-ordered.
  Deviations from the design file list (documented): +targeting.ts,
  +planTypes.ts — avoid circular imports (mandates↔resolve) and duplicated
  target matching; RoutinePlan assembly itself is FE-5 (generate).
  Assumptions (Type B, recorded): (1) concern→class map + preferredPeriod are
  dictionary data in actives.json, not code constants — rules stay reviewable.
  (2) Treatments (irritant/photosensitizing/lowPh/spf classes) place ONCE in
  a preferred period; benign products render in every allowed period —
  generating a retinoid into both periods would double exposure.
  (3) Day-split convention: loser [2,6] (Tue/Sat), daily winner shrinks to
  complement; 1×/week limit prefers Wednesday. (4) Cap/limit ladders are
  fixed [separate_days, freeze] — not rule-configurable until a ruleset needs
  it. Adaptation caps (§2.6) remain FE-6 as scoped.
  Verified: `npx tsc --noEmit` clean; `npx jest src/utils
  --testPathIgnorePatterns="worktrees"` → 19 suites / 341 tests green
  (56 new: targeting 7, slotting 11, eligibility 8, mandates 12, resolve 14,
  context +2, integrity +1; incl. determinism + shelf-order-insensitivity
  property tests).
  NEXT STEP per plan: FE-5 (plan 8.4 remainder) — entry points
  generate.ts (RoutinePlan assembly + rulesetVersion stamp), validate.ts
  (diff vs saved routines), substitute.ts, dailyView.ts (per-date mask:
  freezes + season + userPinned semantics).
- 2026-07-04: ENGINE ENTRY POINTS shipped (engineer, FE-5 / plan 8.4
  remainder). Files (pure, injected now):
  * resolve.ts — exported AdmittedEntry, findViolationsAgainst (pair + cap
    probe without the ladder) and scoreCandidate so validate/substitute share
    the exact detection + ranking paths with admission (no drift).
  * generate.ts — EngineInput { products, procedures, profile(fitzpatrick,
    concerns), seasonMask, now? }; generatePlan → RoutinePlan
    { rulesetVersion (actives.json stamp), generatedFor (skincare date),
    periods{morning,evening}, frozen, placeholders, decisions }. Gate
    rejections → frozen rows (clinical w/ until, pao, no_allowed_period);
    hidden products excluded silently (user choice, not an engine decision).
    Never writes — Draft Preview save lands in src/domain (FE-8).
  * validate.ts — validateRoutines(routines, input) → { findings,
    hasBlockingFindings (any avoid → Optimize strip), proposedPlan, diff }.
    Findings over SAVED state: pairwise via findViolationsAgainst
    (day-overlap-aware — day-separated pairs don't flag), rule copy attached,
    `pinned` flag when a userPinned step is involved; eligibility gates on
    routine products (clinical→avoid, pao→caution); unmet require mandates
    (nonSkippable→avoid else caution — phototype 1–2 SPF rule per research
    §2.4). diff = added/removed/moved/frozen vs proposedPlan membership.
  * substitute.ts — findSubstitute(plan, period, productId, input): eligible,
    same slotIndex, period-allowed, not already planned, conflict-free vs the
    REST of the period; ranked by scoreCandidate w/ addedAt/id tiebreaks.
  * dailyView.ts — getDailyView(routines, products, input) → per-routine
    { date, steps, frozen[stepId, reasonCode, until] }: skips hidden +
    unscheduled-today steps, masks clinical freezes (userPinned does NOT
    override — safety beats preference), deleted-product steps stay visible
    for the empty-slot UI. Cycling/adaptation join in FE-6 as scoped.
  * index.ts — public engine surface per tech-design §2 (entry points +
    plan types + rehabFilter + migrations re-exports).
  * entryPoints.test.ts — 23 tests across all four modes (assembly, gate
    freezes w/ expiry, hidden silence, placeholder, determinism; avoid/
    caution/pinned/clinical/mandate findings, day-separated non-finding,
    added/moved/frozen diff; substitute slot + conflict + null paths; daily
    view scheduling, hidden, freeze mask, pinned-vs-safety, orphan steps).
  Assumption (Type B, recorded): validate findings are detection-only over
  the saved state; pin ENFORCEMENT (engine never auto-removes pinned steps
  except avoid-severity clinical freeze) lands in the commit path
  (routinePlanActions, FE-8) + is already honored in dailyView masking —
  generate produces a fresh draft and cannot know pins.
  Verified: `npx tsc --noEmit` clean; `npx jest src/utils
  --testPathIgnorePatterns="worktrees"` → 20 suites / 364 tests green.
  NEXT STEP per plan: FE-6 (plan 8.5) — cycle state machine + application
  counters + adaptation phases (cycleState.ts, adaptation.ts, actives.json
  adaptation blocks, src/domain/trackingActions.ts, new STORAGE_KEYS) —
  OR qa-lead integration tests now that the engine surface is complete.
- 2026-07-04: QA INTEGRATION SUITE shipped (qa-lead). New folder
  tests/routine-engine/ (11 files + fixtures.ts), exercising the engine
  public surface (generatePlan, validateRoutines, findSubstitute,
  getDailyView, buildRehabWidgetState/applyRehabFilter, migrations) against
  spec §4 acceptance criteria, mapped 1:1 to Story number:
  * generate.test.ts (Story 1) — realistic multi-product shelf assembly,
    layering order, purity (no input mutation), empty-shelf draft; 3 UI
    ACs (empty-state card, Optimize strip) as it.todo (FE-8).
  * draft-preview.test.ts (Story 2) — PM-only-commit simulation composed
    directly against validate/generate (no domain code exists yet); Cancel =
    no write. 6 UI/commit-scope ACs as it.todo (FE-8, routinePlanActions).
  * custom-procedure.test.ts (Story 3) — all four presets' resolved
    customRehabDays (0/3/7/manual) through dailyView+generate incl. the exact
    day-boundary transition; 3 UI ACs (preset tiles, inline validation) as
    it.todo (FE-9).
  * clinical-freeze.test.ts (Story 4) — dailyView+generate+validate agree on
    a peel's freeze/expiry boundary; overlapping procedures keep the later
    untilDate; frozen row carries reasonCode+until. One it.todo: Botox
    massageRequired freeze is currently unexercisable (see gap below).
  * cycling-and-adaptation.test.ts (Story 5 + 6) — FE-6 not shipped, all
    11 ACs as it.todo (no engine/UI import — cycleState/adaptation modules
    don't exist yet).
  * phototype.test.ts (Story 7) — phototype 4-6 escalation forces a freeze
    (not co-layering) on a pair that would otherwise get keep_with_note;
    baseline (3/null) stays co-layered; single pre-formulated product never
    self-conflicts; phototype 1-2 non-skippable AM SPF mandate (finding +
    placeholder) vs phototype 6 (no mandate). 1 UI AC (onboarding cards)
    it.todo (FE-9).
  * seasonal-masks.test.ts (Story 8) — summer SPF mandate, summer 1x/week
    exfoliant limit (Wednesday clamp), winter barrier-priority score boost
    (ordering swap vs. baseline addedAt tie-break), validated end-to-end
    through generate/validate. 5 FE-7 (weather/city/hysteresis) ACs it.todo.
    Includes one deliberate "documents current (gap) behaviour" test — see
    gap list below.
  * vitamin-c-migration.test.ts (Story 9) — migrateProducts marker/tag
    canonicalization + its effect on rule_vitc_pure_acids matching before/
    after reclassification via validateRoutines. 1 UI AC (infobox) it.todo.
  * migrations-hydrate.test.ts — composes migrateProfile+migrateProducts+
    migrateRoutines the same way productsStore/profileStore/routinesStore
    call them on hydrate (no AsyncStorage mock needed — pure functions),
    covering the full v1->v2 snapshot in one pass, idempotency by reference,
    and the null-phototype no-op path.
  * rehab-widget.test.ts (Story 10 / V3) — buildRehabWidgetState +
    applyRehabFilter exercised TOGETHER with getDailyView as two independent
    render-time projections over the same procedure log; Day X of Y, window-
    end restoration (zero mutation), long-term-only Botox (no widget),
    zone-scoped no-mask, overlapping-window "latest end wins". 2 UI ACs
    (RehabWidget component, Clinic-only long-term display) it.todo (FE-10).
  * determinism-and-safety.test.ts (spec §9) — 100-seed randomized-shelf
    determinism property test; shelf-order-insensitivity; 100-seed avoid-pair
    no-co-schedule safety property test (rule-matrix, base actives.json avoid
    rules); 40-seed frozen/scheduled mutual-exclusion check; 15-seed
    generate->save->validate self-consistency check restricted to pairwise
    (2-productId) avoid findings — see gap note on why it's scoped that way.
  Counts: 45 real tests, 33 it.todo stubs (UI not built: FE-6 cycling/
  adaptation, FE-7 weather/city, FE-8 draft-preview commit + empty-state/
  optimize-strip UI, FE-9 presets/onboarding/infobox, FE-10 RehabWidget
  component), across 11 suites + fixtures.ts.
  Verified: `npx tsc --noEmit` clean; `npx jest tests/routine-engine` → 11/11
  suites green (45 passed, 33 todo); `npx jest src/utils
  --testPathIgnorePatterns="worktrees"` unchanged at 20 suites/364 tests
  green (engine untouched); `npx jest tests` → 19/32 suites green, the 13
  failures are pre-existing baseline noise (tests/catalog, tests/
  shelf-filtering AsyncStorage-native-module issues + stale .claude/worktrees/
  copies) — unrelated to this task, not grown, none of the new
  tests/routine-engine files are among them.
  Gaps/inconsistencies found while writing tests (handed off to engineer,
  NOT fixed — see progress/routine-engine-handoff.json for the same list):
  (1) `applyRehabFilter` (rehabFilter.ts) reads active classes via
  `getProductActiveKeys` (ingredientParser.ts), which only inspects
  `activeIngredients`/`fullIngredientText` — unlike `buildProductFacts`
  (productFacts.ts), it does NOT read `Product.activeTags`, even though
  activeTags is the wizard-confirmed, authoritative source everywhere else in
  the pipeline. A product tagged only via the wizard checkbox (no INCI text)
  is correctly frozen by generate/dailyView's main pipeline but NOT masked
  out of the RehabWidget's own `applyRehabFilter` steps list. Confirmed by
  rehabFilter.test.ts's own fixtures, which use activeIngredients exclusively
  — this is pre-existing, not introduced by this suite.
  (2) `procedures.json`'s botox/fillers/smas_lifting freeze rules all target
  `{ properties: { massageRequired: true } }`, but no class in actives.json
  declares massageRequired (already logged as an intentional forward-compat
  gap in this file's FE-1 entry) — so Story 4's "Botox massageRequired"
  freeze AC cannot be exercised against any real Product today; left as
  it.todo in clinical-freeze.test.ts.
  (3) `seasons.json`'s `summer_spf_mandate` declares `"severity": "avoid"`,
  but `collectRequireMandates` (mandates.ts) hardcodes `nonSkippable: false`
  for every seasonal require mandate and never reads `SeasonRule.severity`;
  `validate.ts`'s placeholder severity mapping only branches on
  `nonSkippable`. The declared "avoid" therefore currently renders as a
  "caution" finding — locked in as a regression-documenting test in
  seasonal-masks.test.ts pending an engineer decision on intent.
  (4) Spec Story 4 AC4 prose ("frozen on D+14 (rehab end)... visible on
  D+15") reads one day later than the engine's actual half-open [0,
  rehabDays) elapsed-days window (already unit-tested: entryPoints.test.ts's
  "Day 20: 14-day freezes are over" case), where the LAST frozen day is
  elapsed=rehabDays-1 and the FIRST free day is elapsed=rehabDays. Likely a
  1-indexed-vs-0-indexed wording gap between spec and engine, not a
  behavioural bug — flagged for confirmation, tests written to match the
  engine's actual (and already-reviewed) behaviour.
  NEXT STEP: engineer — FE-6 (cycle state machine + adaptation) or address
  the four gaps above, product owner's call per the handoff.
- 2026-07-04: QA FINDINGS 1 + 3 FIXED (engineer, product-owner instruction).
  (1) getProductActiveKeys (ingredientParser.ts) now also reads
  wizard-confirmed `activeTags` (normalized via legacyKeyMap), matching
  buildProductFacts' tags-are-authoritative contract. Structural typing
  propagates the fix to BOTH consumers: applyRehabFilter (tag-only products
  are now masked during rehab — regression test added to rehabFilter.test.ts)
  and ConflictEngine (tag-only actives now conflict-detected — an
  improvement, all existing tests green). Public API unchanged (optional
  field on the parameter type).
  (3) SeasonRule.severity is now wired through: RequireMandate +
  PlaceholderSlot gained `severity` ('avoid'|'caution'); seasonal mandates
  carry the rule's own declaration (summer_spf_mandate → avoid), phototype
  nonSkippable mandates are avoid by definition, clinical stay caution;
  applyMandates merges strictest-wins; validate.ts reports
  placeholder.severity. QA's gap-lock test in seasonal-masks.test.ts flipped
  to assert the wired behavior (avoid + hasBlockingFindings) — an
  intentional test change per the qa-lead's own framing.
  Findings 2 (massageRequired class — needs product data) and 4 (spec D+14
  wording — needs product-owner confirmation) remain open as documented.
  Verified: `npx tsc --noEmit` clean; `npx jest src/utils
  tests/routine-engine --testPathIgnorePatterns="worktrees"` → 31 suites /
  410 passed + 33 todo.
  NEXT STEP: FE-6 (plan 8.5) — cycle state machine + adaptation.
- 2026-07-05: TRACKING & ADAPTATION shipped (engineer, FE-6 / plan 8.5).
  Files:
  * src/types/index.ts — CyclePhaseIndex, CycleState, ProductApplicationStats.
  * src/services/storage.ts — STORAGE_KEYS.tracking ('@vials/tracking', one
    key holding { cycleState, applicationStats }).
  * src/constants/rulesets/actives.json — `adaptation` blocks on the three
    research-§2.6 classes (retinoid, aha, benzoyl_peroxide): ≤4 apps →
    2×/wk + 72h rest; ≤8 → 4×/wk; >8 → standard rules. rulesetTypes
    AdaptationPhase/AdaptationConfig; rulesetIntegrity gained a structural
    test (boundaries increase, capped phases carry caps, last phase is
    afterApplication, all three classes declared).
  * src/utils/routineEngine/cycleState.ts (pure) — CYCLE_PHASES
    [exfoliation, retinoid, recovery, recovery], INITIAL_CYCLE_STATE,
    getCyclePhaseForTonight (date-independent: pause-on-miss),
    isCheckedInToday (04:00 skincare boundary), checkInCycle (idempotent per
    skincare day, same-reference no-op, single-step advance — a gap never
    skips a phase).
  * src/utils/routineEngine/adaptation.ts (pure) — virtualApplicationCount
    (2/wk weeks 1–2, 4/wk after → phase 3 from week 5; 5+-week-old products
    start unthrottled), applicationCountFor (dynamic → tracked counter,
    untracked/fixed → virtual; engine never branches on source downstream),
    getAdaptationStatus (phase index, cap, Week 1–4 for the FE-9 callout,
    reasonCode adaptation_phase_N), collectAdaptationLimits → per-product
    caps. 72h rest satisfied structurally by the Tue/Sat split-day picks.
  * resolve.ts — ResolveInput.adaptationLimits?; product-scoped caps clamp
    scheduledDays inside the same admission loop as seasonal/phototype
    limits (research §2.6), logged as 'limit' decisions.
  * generate.ts — EngineInput.tracking? { cycleType, applicationStats };
    absent = fixed mode + virtual counts. validate/substitute inherit via
    EngineInput.
  * dailyView.ts — DailyViewInput.cycle? { type, state }; dynamic-mode
    evening mask: cycled actives (cycleClass) follow tonight's phase instead
    of scheduledDays (§1.4: cycling is not expressible in scheduledDays);
    off-phase steps land in a new `cycledOut` list (not frozen — "not
    tonight"); clinical freeze wins over the cycle mask; morning routines and
    non-cycled products unaffected.
  * src/store/trackingStore.ts — thin persisted holder (cycleState,
    applicationStats) + setters + resetCycleState (counters survive resets —
    they never decrement). Hydrated in App.tsx alongside the other stores.
  * src/domain/trackingActions.ts — performDailyCheckIn (dynamic-only;
    idempotent via checkInCycle; counts products visible in TONIGHT's
    pre-advance view; first-ever counter entries seeded from the virtual
    count so long-owned products are not retroactively re-throttled;
    calendar SeasonMask until FE-7), switchCycleType (any switch resets
    cycle state per §1.4 semantics; confirmation dialog is FE-9's concern).
  Assumptions (Type B, recorded): (1) tracking persists under ONE storage
  key (single hydrate, state is small). Alternative: separate keys per
  concern; rejected for simplicity. (2) Counter seeding from virtual count
  on first increment lives in the domain action, keeping the engine pure
  while honoring "no retroactive throttling". (3) Dynamic-mode counting uses
  tracked counts once an entry exists, virtual before that — a 5-week-old
  product doesn't regress to phase 1 on its first tracked check-in.
  Verified: `npx tsc --noEmit` clean; `npx jest src/utils
  tests/routine-engine --testPathIgnorePatterns="worktrees"` → 33 suites /
  440 passed + 33 todo (30 new: cycleState 11, adaptation 12, entryPoints +7
  incl. adaptation caps in generate and the 5-case dynamic mask matrix).
  Layer greps clean (no store imports in engine, no React in utils, no
  AsyncStorage outside storage.ts).
  NEXT STEP per plan: FE-7 (plan 8.6) — Open-Meteo weather client
  (src/services/weather/), seasonMask.ts, bundled cities.json + city
  autocomplete data (dataset sourcing is the one open item), profile city
  field wiring. Several qa-lead it.todo stubs in
  tests/routine-engine/cycling-and-adaptation.test.ts can now be activated
  by qa-lead or engineer next session.
- 2026-07-05: WEATHER & SEASON MASKS shipped (engineer, FE-7 / plan 8.6).
  Files:
  * src/utils/routineEngine/seasonMask.ts (pure) — SeasonMaskCache type;
    deriveSeasonFromTemperature (<15°C → winter family, >20°C → summer
    family, 15–20 inclusive = hysteresis band retaining the previous mask;
    within a family the calendar season wins when it agrees, so a cold
    October reads "autumn"); isWeatherCheckDue (7-day interval);
    isCacheUsable (≤14 days); resolveSeasonMask (usable weather cache, else
    calendar via getCurrentSeason — the §1.7 mandatory fallback chain);
    buildWeatherSeasonMask (hysteresis vs previous cache, skincare-date
    stamp). Thresholds/intervals read from seasons.json's climate block —
    no constants duplicated in code.
  * src/services/weather/index.ts — Open-Meteo client (keyless, no secret):
    fetchWeeklyAverageTemperatureC(lat, lon) → 7-day mean via
    daily=temperature_2m_mean; 5s AbortController timeout; null-gap
    tolerant averaging; returns null on timeout/non-2xx/malformed/network
    error — never throws, never surfaces to UI.
  * src/constants/cities.json — OPEN ITEM RESOLVED: 154 curated major
    cities (name with country, lat/lon to 2 decimals), 11.7 KB (budget was
    ≤500 KB). Hand-authored coordinate facts — no third-party dataset, no
    licensing/attribution obligations. Alternative: GeoNames dump (CC-BY,
    heavier, attribution required); rejected for Phase 1.
  * src/utils/citySearch.ts (pure) — searchCities(query, limit=8): ≥2 chars,
    case-insensitive, prefix matches rank before substring matches, offline
    (research §1.7: no GPS, no network to pick a city).
  * src/store/trackingStore.ts — seasonMaskCache: SeasonMaskCache | null +
    setter, persisted under the same @vials/tracking key (research §2.7
    placement). Hydrate defaults preserved.
  * src/domain/seasonActions.ts — getActiveSeasonMask(now) (sync resolve
    from the hydrated cache, for render paths) and refreshSeasonMaskIfDue
    (async: city set + interval elapsed → fetch → persist → return mask;
    every failure path returns the resolved fallback without touching the
    cache; ≤1 request per 7 days by construction; fire on app open).
  * src/domain/trackingActions.ts — performDailyCheckIn now consumes
    getActiveSeasonMask instead of the hardcoded calendar mask.
  * profileStore city wiring: no change needed — city field + generic
    updateProfile shipped in schema v2; UI autocomplete field is FE-9.
  NOT in scope (as designed): Diff View on threshold crossing (FE-8 UI) and
  the app-open refresh call site (FE-8/9 wiring — refreshSeasonMaskIfDue is
  ready to be called from App bootstrap or a hook).
  Verified: `npx tsc --noEmit` clean; `npx jest src/utils src/services
  tests/routine-engine --testPathIgnorePatterns="worktrees"` → 36 suites /
  469 passed + 33 todo (29 new: seasonMask 15 incl. threshold-boundary and
  flapping-prevention cases, weather service 7 w/ mocked fetch, citySearch +
  dataset integrity 7).
  ENGINE + DATA + STATE LAYERS NOW COMPLETE (FE-1…FE-7). Remaining:
  FE-8 (generation UX: GenerateCard, OptimizeStrip, DraftPreviewSheet,
  routinePlanActions), FE-9 (surrounding UX incl. symptom presets, check-in
  button, phototype cards, vitamin C infobox, cycle-type toggle, city
  autocomplete field), FE-10 (RehabWidget). qa-lead's UI it.todo stubs
  activate as those ship.
- 2026-07-05: GENERATION UX shipped (engineer, FE-8 / plan 8.7). Files:
  * src/utils/routineEngine/planApply.ts (pure) — buildStepsFromPlan
    (plan period → RoutineStep[]: reuses existing step ids + pin flags for
    surviving products; re-appends pinned steps the plan dropped UNLESS
    clinically frozen [frozen entry with until] — pin enforcement from the
    FE-5 assumption now implemented; hidden steps survive untouched;
    injected id factory keeps it deterministic) + buildDraftSummaryLines
    (≤3 quiet lines: day splits by name → "paused until Jul 17" → moves →
    additions; routineLabel-style copy helper precedent).
  * src/domain/routinePlanActions.ts — buildEngineInputFromStores (products/
    procedures/profile/seasonMask via getActiveSeasonMask/tracking),
    generateDraftPlan + validateCurrentRoutines (pure reads), applyRoutinePlan
    (plan, scope both|am|pm) — THE only write path from a draft into
    routinesStore; partial scopes leave the other routine untouched and the
    screen re-validates on next render (scope-induced conflicts light the
    strip, never a modal).
  * src/components/routine/GenerateCard.tsx — empty-state entry point A:
    primary "✨ Generate Routine" + secondary "Add Products Manually"
    (final product-owner copy; no "AI Engine" wording).
  * src/components/routine/OptimizeStrip.tsx — entry point B, very bottom of
    the populated routine view: "✨ Optimize or Regenerate Routine"; doubles
    as the validate finding indicator (amber tint + "Suggestions available"
    when hasBlockingFindings — quiet, token colors only).
  * src/components/routine/DraftPreviewSheet.tsx — Diff Mode bottom sheet
    (gorhom pattern incl. the present/dismiss guard from AddToRoutineSheet):
    ≤3 summary lines, Before → After columns per period, paused rows, 4-way
    commit "Save for Both (AM & PM)" / "Save for AM Only" / "Save for PM
    Only" / "Cancel / Discard Draft".
  * src/screens/RoutinesScreen.tsx — draft state (plan lives only in
    component state until commit), validation memo over routines/products/
    procedures, GenerateCard as ListEmpty when BOTH routines are empty
    (day-empty keeps the old EmptyRoutine), OptimizeStrip in the footer when
    populated, DraftPreviewSheet wiring; pencil edit mode untouched (stays
    strictly manual per spec).
  * App.tsx — refreshSeasonMaskIfDue() fired after store hydration
    (fire-and-forget; ≤1 req/week; silent fallback) — FE-7's call site.
  * tests/routines/routines-screen-hidden-filter.test.tsx — REGRESSION FIX
    (my change broke it): new FE-8 module graph (proceduresStore, domain
    actions, gorhom sheet) mocked at the boundary per the suite's existing
    pattern; suite back to green (verified fail-before/pass-after).
  * planApply.test.ts — 13 tests (id/pin reuse, plan schedule wins, pinned
    re-append, clinical-freeze-beats-pin, pair-freeze-spares-pin, hidden
    preservation, replacement drop; summary lines: split naming, paused
    date, moves/additions, 3-line cap, empty).
  Verified: `npx tsc --noEmit` clean; `npx jest src/utils src/services
  tests/routine-engine tests/routines --testPathIgnorePatterns="worktrees"`
  → 39 suites / 493 passed + 33 todo. No hardcoded hex in new components
  (tokens only), no console.log. qa-lead draft-preview it.todo stubs are now
  activatable.
  NEXT STEP per plan: FE-9 (plan 8.8) — surrounding UX: symptom presets +
  affectedZones picker in AddProcedureModal, "Complete My Routine" check-in
  button (Today, dynamic mode), adaptation step-card status line, frozen
  "Paused until" rows, vitamin C infobox, 6-card phototype onboarding,
  cycle-type settings toggle, city autocomplete field. Then FE-10
  RehabWidget (plan 8.9).
- 2026-07-05: SURROUNDING UX shipped (engineer, FE-9 / plan 8.8) — all eight
  sub-features. Files:
  * src/components/clinic/AddProcedureModal.tsx — symptom presets for custom
    procedures (Light Care 0d / Redness–Peeling 3d / Trauma–Laser 7d /
    Custom manual 0–90d input), mandatory recovery window (preset days
    AND/OR estimated return date — return date now optional when a preset
    is chosen, per research §1.5 V2), customRehabDays + status ('rehab' when
    days > 0) persisted; affectedZones picker (Face/Neck/Décolleté chips,
    default face, last zone cannot be deselected) on ALL procedures.
  * src/screens/TodayScreen.tsx — replaced the Phase-2 placeholder with a
    real daily view: per-routine step lists via getDailyView (paused +
    cycled-out rows included), tonight's-phase card and the
    "Complete My Routine" button in dynamic mode only (final copy; disabled
    after check-in — idempotency surfaced in UI; performDailyCheckIn wired).
  * src/components/routine/RoutineStepCard.tsx — adaptationWeek? prop →
    "⏳ Adaptation Phase (Week X of 4) — frequency managed to prevent
    purging" status line (informational styling, not a warning).
  * src/screens/RoutinesScreen.tsx — adaptation weeks computed per product
    (getAdaptationStatus + buildProductFacts) and passed to step cards;
    clinical "Paused until" rows (PausedSteps block from getDailyView.frozen)
    rendered above the footer actions.
  * src/screens/ProductDetailScreen.tsx — vitamin C infobox: shows when
    vitaminCAutoMigrated && vitamin_c_pure tagged; "This is a derivative"
    inline action swaps the tag to vitamin_c_derivative and clears the
    marker. DEVIATION (documented): the spec's "link into the tag wizard"
    became a one-tap in-place reclassification — the wizard is an add-flow
    step with no deep-link route; the in-place swap achieves the same
    outcome with less friction.
  * src/components/onboarding/PhototypeCard.tsx — new FitzpatrickCard
    (6 swatches + roman numerals ≥14px + full sun-reaction a11y labels);
    grouped 3-card component kept for any legacy callers.
  * SkinProfileEditModal + SkinProfileSetupScreen — flipped to the six-card
    numeric input writing profile.fitzpatrick.
  * src/store/profileStore.ts + migrations.ts — TWO-WAY phototype sync:
    new deriveGroupedPhototype (1|2→type_1_2, 3|4→type_3_4, 5|6→type_5_6);
    a patch touching fitzpatrick is authoritative and re-derives the grouped
    field; grouped-only writes still derive numeric (stricter member).
    +3 migration tests incl. group round-trip.
  * src/screens/ProfileScreen.tsx — "Dynamic Skin Cycling" settings toggle
    (dynamic→fixed shows the discard-progress confirmation Alert, then
    switchCycleType; counters kept), "Weather & Seasons" section with the
    offline CityField autocomplete (searchCities, ≥2 chars, 5 suggestions,
    selected-state row with clear); profile summary chip prefers the numeric
    Fitzpatrick label.
  * tests/routines/routines-screen-hidden-filter.test.tsx — extended
    boundary mocks for the new profile/settings/tracking/seasonActions
    imports (same pattern as FE-8's fix).
  Verified: `npx tsc --noEmit` clean; `npx jest src/utils src/services
  tests/routine-engine tests/routines --testPathIgnorePatterns="worktrees"`
  → 39 suites / 496 passed + 33 todo. No hardcoded hex outside the
  FitzpatrickCard skin-tone swatch data, no console.log. UI copy final +
  English-only; check-in appears ONLY in opt-in dynamic mode (gamification
  boundary holds — no streaks, no rewards).
  NEXT STEP per plan: FE-10 (plan 8.9) — RehabWidget on the Routines screen
  (buildRehabWidgetState + applyRehabFilter already shipped), absorb
  ClinicalRestrictionsBlock's product-facing role, wire getTimelineConfig
  custom rehabDays to customRehabDays (currently hardcodes 0). This closes
  the routine-engine feature; then tech-lead re-review of FE-8/9/10 UI.
- 2026-07-05: REHAB SHIELD WIDGET shipped (engineer, FE-10 / plan 8.9) —
  FEATURE IMPLEMENTATION COMPLETE (FE-1…FE-10). Files:
  * src/utils/procedureLifespanHelpers.ts — getTimelineConfig now reads the
    log's customRehabDays for custom procedures (was hardcoded 0; became
    REQUIRED once FE-9's AddProcedureModal started persisting real values).
    computeStatus therefore returns 'rehab' inside a user-resolved custom
    window. +2 helper tests (config + status paths).
  * src/components/routine/RehabWidget.tsx — top-anchored shield
    ("🩹 Rehabilitation: [Name]", "Day X of Y", barrier
    disrupted/sensitive copy). Pure render of RehabWidgetState — no store
    reads, self-destructs on day Y+1 with zero mutations; long-term effects
    (Botox month 2) never render here per Rule B (Clinic timeline only).
  * src/screens/RoutinesScreen.tsx — RehabWidget at the very top of the list
    header (buildRehabWidgetState in the existing derived-state memo);
    clinically frozen steps now LEAVE the visible/draggable list (frozen
    stepIds from the daily-mask projection filter amSteps/pmSteps) — the
    widget + FE-9's Paused rows explain them, so masking is never silent.
  * src/components/routine/ClinicalRestrictionsBlock.tsx — product-facing
    role retired: the "Gentle cleanser and barrier moisturizer OK" row
    removed; the block is lifestyle-only (sauna/massage/sleep-position) per
    the V3 audit. Custom procedures stay excluded from it (they have no
    lifestyle DB entries; their product freezes flow through the engine).
  Verified: `npx tsc --noEmit` clean; `npx jest src/utils src/services
  tests/routine-engine tests/routines --testPathIgnorePatterns="worktrees"`
  → 39 suites / 498 passed + 33 todo.
  STATE OF THE FEATURE: all ten tech-design tasks shipped. Remaining
  process steps: (1) tech-lead review of the UI phases FE-8/9/10 (engine
  FE-1…7 already ACCEPTED 2026-07-04); (2) qa-lead activation of the 33
  it.todo stubs now that every referenced surface exists; (3) spec wording
  fix for finding 4 (D+14 half-open window) + massageRequired class
  (finding 2) remain open product items.
- 2026-07-05: TECH-LEAD ARCHITECTURE REVIEW (FE-4 core pipeline + FE-5 entry
  points through FE-10 RehabWidget — everything shipped since the 2026-07-04
  Steps 1-4 review). Verdict: BLOCKED (1 BLOCKER, 4 WARNINGS).
  Verified clean: `npx tsc --noEmit`; `npx jest src/utils src/services
  tests/routine-engine tests/routines --testPathIgnorePatterns="worktrees"` →
  39 suites / 498 passed + 33 todo (matches log claim exactly). Layer-purity
  greps clean (no AsyncStorage outside services/storage.ts, no React in utils,
  no fetch outside services, no unresolved TODO/FIXME/console.log).
  BLOCKER: resolve.ts's tryAdmit (lines ~324-405) selects `primary =
  violations[0]` (first-encountered violation, ordered by admitted-partner
  insertion order) to pick BOTH the resolution ladder to walk AND the
  reasonCode/ruleId attributed to a freeze/day-split decision, while the
  `severity` gate used to guard keep_with_note and the final fallback is
  computed by scanning ALL violations. When one candidate has simultaneous
  violations of DIFFERENT severities against DIFFERENT already-admitted
  partners (concretely reachable today: an AHA product vs. a copper-peptides
  partner [avoid, rule_copper_peptides_acids, resolutions include
  separate_days] + a vitamin-C-pure partner [caution, rule_vitc_pure_acids] —
  both real pair rules in actives.json), the outcome depends purely on
  ADMISSION ORDER (an implementation artifact, not rule content): if the
  caution violation happens to be `primary`, its own (different) resolutions
  array is walked instead of the avoid rule's, `separate_days` is never
  attempted even though the avoid rule explicitly offers it, and the product
  is frozen citing the WRONG (caution) ruleId as the reason. The "no
  avoid-pair co-schedule" safety property still holds (the product ends up
  frozen either way), but this is a real correctness bug in
  decision-log/reasonCode accuracy and can cause unnecessary over-freezing —
  a valid day-split resolution offered by the actual violated (avoid) rule is
  silently never tried. Not covered by resolve.test.ts or the
  determinism/safety property suite (neither exercises a single candidate
  with 2+ violations of differing severity against 2+ distinct partners). No
  log entry documents this as an intentional simplification.
  validate.ts/substitute.ts do NOT share this bug — both use
  findViolationsAgainst directly and report/check every violation without any
  "primary" narrowing, confirming the issue is isolated to tryAdmit's
  ladder-selection logic. Fix direction: choose `primary` as the violation
  with the worst severity (or walk each distinct violated rule's own ladder /
  union their resolutions before falling back to freeze), and attribute the
  freeze's reasonCode/ruleId to the specific rule that actually forced it.
  WARNINGS: (1) tryAdmit (82 lines) and resolvePeriods (77 lines) in
  resolve.ts, and getDailyView (63 lines) in dailyView.ts, exceed the 50-line
  guideline (same category as the buildProductFacts warning fixed after the
  prior review) — tryAdmit's size likely contributed to the BLOCKER above.
  (2) CycleState/ProductApplicationStats (FE-6) live in types/index.ts while
  the structurally-analogous SeasonMaskCache (FE-7) lives in
  utils/routineEngine/seasonMask.ts — both are engine-computed,
  trackingStore-persisted shapes; not wrong (precedent exists for
  rulesetTypes.ts-style splits) but inconsistent between sibling features.
  (3) buildDraftSummaryLines/DraftPreviewSheet's "paused" line only covers
  until-bearing (clinical) freezes; a product dropped by resolve.ts's
  freeze_lower_priority ladder outcome (no until) gets no summary line and no
  paused-block entry — it disappears from the Before→After "After" column
  with no narrative explanation (partial gap against research §1.8's
  explainability principle; the underlying decision data is still correct and
  the diff view still shows the removal). (4) RoutinesScreen's
  adaptationWeeks/frozenRows/rehabState memo (RoutinesScreen.tsx:138-163) has
  no time-based dependency, so data can go stale across the 04:00
  skincare-day boundary if the screen stays mounted with no other input
  change (low severity, common trade-off, not unique to this PR).
  VERIFIED CORRECT (representative, not exhaustive): cycle state machine
  (idempotent check-in, pause-on-miss, switchCycleType semantics);
  performDailyCheckIn counts the PRE-advance daily view (the just-completed
  phase) — the semantically correct choice, confirmed deliberate; dailyView's
  cycle-phase gate correctly overrides scheduledDays only for cycled evening
  steps, clinical freeze takes precedence over the cycle mask, morning
  routines untouched; planApply.buildStepsFromPlan's pin enforcement
  (clinical until-freeze beats pin, pair freeze spares pin per the
  FrozenItem.until discriminator), hidden-step preservation, and step-id
  reuse all correct; applyRoutinePlan's routines-array iteration is safe given
  routinesStore's DEFAULT_ROUTINES seed invariant (always exactly one
  morning + one evening routine); weather layer (≤1 req/7d by construction,
  inclusive 15/20°C hysteresis band, 14-day staleness cutoff, client never
  throws — try/catch/finally + AbortController + malformed-payload guards, no
  fetch outside src/services/); data-model fields (CycleState/
  ProductApplicationStats/FitzpatrickType/CityLocation/RoutineCycleType) match
  the design and research doc exactly, no extra/missing fields; UI copy
  verbatim ("✨ Generate Routine", "✨ Optimize or Regenerate Routine",
  "Complete My Routine", the 4 Draft-Preview commit-scope labels);
  gamification boundary holds (check-in only in dynamic mode, no
  streaks/rewards); FitzpatrickCard hex swatches are documented
  representational data with careful non-racial a11y copy (consistent with
  the engineer's own log note); 14px+ fonts maintained throughout; no
  console.log/TODO/FIXME/HACK in any reviewed file; profileStore
  syncPhototypeFields — setProfile has zero live call sites (its theoretical
  drift path is unreachable), updateProfile's patch-key detection correctly
  re-derives whichever field wasn't explicitly patched at both live call
  sites; procedureLifespanHelpers.getTimelineConfig's
  `rehabDays: proc.customRehabDays ?? 0` correctly feeds computeStatus's
  `rehabDays > 0` gate, new tests cover both paths, ClinicalRestrictionsBlock
  explicitly excludes custom procedures so no consumer assumes
  rehabDays===0.
  NEXT STEP: engineer fixes the resolve.ts BLOCKER (WARNINGS 1-4 at
  discretion), re-runs the same verification commands, hands back to
  tech-lead.
- 2026-07-05: QA TODO ACTIVATION (qa-lead). Converted all 33 it.todo stubs
  from the 2026-07-04 QA suite into real tests now that FE-6…FE-10 have
  shipped. 31 activated as real tests (across 12 new files + edits to the 8
  files that held UI todos), 2 left as it.todo with updated comments (both
  genuinely untestable, unchanged from the original handoff): (1) Story 4
  Botox massageRequired freeze — still no actives.json class declares
  massageRequired (clinical-freeze.test.ts); (2) Story 8 "before/after Diff
  View transition screen" — FE-8 shipped no such screen, only
  GenerateCard/OptimizeStrip/DraftPreviewSheet (seasonal-masks.test.ts).
  New files: cycling-and-adaptation.test.ts (rewritten in place, 9 tests:
  Story 6 adaptation caps via generatePlan + Story 5 domain-level
  performDailyCheckIn/cycleState against REAL trackingStore/settingsStore/
  productsStore/routinesStore/proceduresStore/profileStore, AsyncStorage's
  official jest mock per .claude/rules/testing.md), routine-step-card.test.tsx
  (3, adaptation status line), today-screen.test.tsx (3, check-in button
  presence/absence + disabled-after-check-in), draft-preview.test.ts
  (extended, +5: applyRoutinePlan both/am/pm scopes + Cancel-performs-no-write,
  all against the real routinesStore; +1 pinned/pair-frozen-reinsertion ->
  Optimize-strip-lighting scenario), draft-preview-sheet.test.tsx (6: Before->
  After layout + all 4 commit actions, @gorhom/bottom-sheet + react-native-
  safe-area-context mocked at the boundary), routines-screen-generation-ux.
  test.tsx (3: empty-state GenerateCard, populated OptimizeStrip, pencil
  limited to manual edit), add-procedure-modal.test.tsx (3: 4 preset tiles,
  blocked save, successful preset save), routines-screen-paused-rows.test.tsx
  (1: dimmed paused row for an in-window custom_default match),
  fitzpatrick-card.test.tsx (2: six cards + no racial labels),
  product-detail-vitc-infobox.test.tsx (3: infobox visibility + one-tap
  reclassification), rehab-widget-ui.test.tsx (3: widget render/null +
  long-term-only Botox renders on Clinic's ProcedureLifespanCard instead),
  city-field.test.tsx (3: offline autocomplete, 2-char minimum, zero fetch
  calls), seasonal-masks.test.ts (extended, +6: weekly cache cadence,
  hysteresis-band retention, warm/cold mask derivation, and 3 calendar-
  fallback paths — no city / fetch failure / >14d-stale cache — all via
  refreshSeasonMaskIfDue/getActiveSeasonMask against real trackingStore/
  profileStore with the weather service mocked at the module boundary).
  Environment finding (not a product bug, documented inline at each call
  site): this project's installed @testing-library/react-native +
  react-test-renderer combination under-matches getByText/getByPlaceholderText
  when two host Text/TextInput nodes share identical content/placeholder
  strings (confirmed via screen.toJSON() showing both, but the query layer
  returning only one) — worked around with
  screen.UNSAFE_getAllByProps({children/placeholder: ...}) in the 3 affected
  suites (add-procedure-modal, product-detail-vitc-infobox, city-field). Not
  a src/ issue; no source file touched.
  Resolve-ladder BLOCKER cross-check (per the 2026-07-05 tech-lead review's
  finding on tryAdmit's primary-violation misattribution for candidates with
  2+ simultaneous violations of DIFFERING severity against DIFFERENT
  partners): NONE of the 31 newly-activated tests exercise that code path.
  Every fixture needing a "frozen by a pair rule" or "conflicting pair"
  scenario either (a) uses a single opposing rule/single partner (Story 6
  adaptation-cap tests, Story 7/8 already-existing tests untouched by this
  pass), or (b) hand-constructs the RoutinePlan/FrozenItem shape directly
  (typed against the real RoutinePlan/FrozenItem interfaces, so prop drift
  still fails tsc) rather than deriving it from generatePlan's admission
  ladder — e.g. draft-preview.test.ts's new pinned/pair-frozen-reinsertion
  test builds its own `frozen: [{ reasonCode: 'rule_retinol_aha', ruleId:
  'rule_retinol_aha' }]` entry to exercise planApply's pin-preservation logic
  and validateRoutines' finding, never calling generatePlan for that scenario.
  Multi-violation admission itself is exercised only by the PRE-EXISTING
  determinism-and-safety.test.ts (100-seed property tests, unmodified by this
  pass) and the engineer's own resolve.test.ts — neither is new qa-lead work,
  and both predate this activation pass.
  Verified: `npx tsc --noEmit` clean; `npx jest tests/routine-engine` → 21
  suites / 95 passed + 2 todo (97 total); `npx jest src/utils src/services
  --testPathIgnorePatterns="worktrees"` → 26 suites / 442 tests green
  (baseline intact, nothing broken); `npx jest src/utils src/services
  tests/routine-engine tests/routines --testPathIgnorePatterns="worktrees"` →
  49 suites / 548 passed + 2 todo (550 total).
  NEXT: engineer fixes the resolve.ts tryAdmit BLOCKER (still open per the
  tech-lead's 2026-07-05 review, unaffected by this activation pass per the
  cross-check above), then hands back to tech-lead for final FE-8/9/10 UI
  re-review; once that lands, only the 2 remaining it.todo stubs are open
  (both require new product/design decisions — massageRequired class data,
  Diff View screen scope — not engine work).
- 2026-07-05: REVIEW BLOCKER + WARNINGS 1–3 FIXED (engineer).
  BLOCKER (resolve.ts primary-violation selection): tryAdmit now selects
  `primary = violations.find(avoid) ?? violations[0]` — the forcing
  (avoid-level) rule drives the resolution ladder AND the freeze attribution
  regardless of partner admission order; severity now reads from primary
  (equivalent to the old any-avoid scan since primary is the avoid violation
  whenever one exists). Regression test added to resolve.test.ts using the
  reviewer's reachable scenario (willow-bark BHA violating admitted
  vitamin C [caution] AND copper peptides [avoid] simultaneously): asserts
  the freeze cites rule_copper_peptides_acids, verified FAIL-BEFORE /
  PASS-AFTER against the reverted line.
  WARNING 1 (function length): tryAdmit 82→15 (extracted applyFrequencyCaps
  29 + walkResolutionLadder 43 + resolveByDaySplit 29); resolvePeriods
  77→32 (extracted ResolveRun state + runPeriodPass 36 +
  retryRelocatedInAm 20); getDailyView 63→26 (extracted ProjectionContext +
  projectRoutine 41). All resolve.ts/dailyView.ts functions now ≤50 lines;
  behavior unchanged (suites prove it).
  WARNING 2 (type placement): documented on SeasonMaskCache why it cannot
  live in types/index.ts — it embeds rulesetTypes' SeasonMask, and
  rulesetTypes imports from types/index.ts (import cycle).
  WARNING 3 (silent pair-freezes): buildDraftSummaryLines gained a
  "set aside to avoid a conflict" line for frozen items without an expiry
  (+1 planApply test); DraftPreviewSheet's paused block now rows EVERY
  frozen item (clinical w/ date, pair-rule w/ conflict note) — research
  §1.8 explainability restored.
  WARNING 4 (memo staleness across the 04:00 boundary): ACCEPTED as-is per
  the reviewer's own low-severity assessment — the screen recomputes on any
  store change and on focus; a time-tick dependency would add complexity
  for a rare idle-overnight-mounted case. Documented here as the intentional
  trade-off.
  Verified: `npx tsc --noEmit` clean; `npx jest src/utils src/services
  tests/routine-engine tests/routines --testPathIgnorePatterns="worktrees"`
  → 49 suites / 550 passed + 2 todo (baseline 548 + 2 new tests: blocker
  regression, pair-freeze narration).
  STATUS: blocker resolved → requesting tech-lead RE-REVIEW of the fix
  (scope: resolve.ts refactor + planApply/DraftPreviewSheet narration).
- 2026-07-05: TECH-LEAD RE-REVIEW OF BLOCKER FIX (fix scope only, per
  protocol — verifying the engineer's "REVIEW BLOCKER + WARNINGS 1–3 FIXED"
  entry above, not redoing the full FE-4..FE-10 review). Verdict: ACCEPT.
  Verified by re-reading the actual refactored code, not by trusting the
  log's claims:
  - BLOCKER closed, both halves. walkResolutionLadder's
    `primary = violations.find(v => v.severity === 'avoid') ?? violations[0]`
    now drives BOTH the resolution ladder walked AND the frozen/day-split
    reasonCode attribution; `primary.severity` is an exact substitute for
    the old any-avoid scan (find() returns the avoid violation whenever one
    exists, else falls back to violations[0], which is then necessarily
    caution) — traced this equivalence by hand, holds in all cases. Hand-
    traced the new regression test ("attributes a mixed-severity
    multi-violation freeze to the avoid rule, not the first partner")
    against the real actives.json pair-rule data: admission order (vitC
    potency 30 -> copper 20 -> willow-bark BHA 10, all pm-only) genuinely
    produces `violations = [vitC-caution(rule_vitc_pure_acids),
    copper-avoid(rule_copper_peptides_acids)]` -- caution partner admitted
    first, exactly the ordering needed to have exposed the old
    `violations[0]`-only bug -- confirming this is a real regression test,
    not a coincidentally-passing one. Also confirmed the day-split path now
    correctly attempts the AVOID rule's own ladder (separate_periods ->
    separate_days, via resolveByDaySplit using `primary` = the avoid
    violation) before falling back to freeze, closing the "wrong ladder
    walked" half of the original finding, not just the attribution half.
  - WARNING 1 closed: tryAdmit (15 lines) / applyFrequencyCaps (29) /
    walkResolutionLadder (43) / resolveByDaySplit (29) / resolvePeriods (32)
    / runPeriodPass (36) / retryRelocatedInAm (20) in resolve.ts, and
    getDailyView (26) / projectRoutine (41) in dailyView.ts -- all <=50
    lines. Re-read dailyView.ts's ProjectionContext/projectRoutine split
    line-by-line: identical freeze-precedence-over-cycle-mask, isCycled
    gate, and deleted-product/hidden-step handling as the pre-refactor
    version -- behavior-preserving, not just shorter.
  - WARNING 2 closed: SeasonMaskCache's doc comment states the concrete
    reason it cannot move to types/index.ts (embeds rulesetTypes' SeasonMask,
    and rulesetTypes imports types/index.ts -- a real import cycle).
    Adequate technical justification.
  - WARNING 3 closed: buildDraftSummaryLines' new "set aside" branch (for
    plan.frozen items with no `until`) and DraftPreviewSheet's pausedNames
    map (now unfiltered across all frozen items, ternary'd on `f.until` for
    "paused until X" vs "set aside to avoid a conflict") both verified by
    direct read -- no "undefined" string risk, consistent copy between the
    summary line and the paused block.
  - WARNING 4: accepted as a documented trade-off, matching this reviewer's
    own original low-severity framing -- no further action expected.
  Re-ran verification independently: `npx tsc --noEmit` clean; `npx jest
  src/utils src/services tests/routine-engine tests/routines
  --testPathIgnorePatterns="worktrees"` -> 49 suites / 550 passed + 2 todo
  (552 total) -- matches the engineer's and qa-lead's claimed baseline
  exactly. No new concerns raised by this fix scope.
  FE-1 through FE-10 are now fully reviewed and ACCEPTED end-to-end (Steps
  1-4 on 2026-07-04; FE-4 through FE-10 across the 2026-07-05 review + this
  re-review). Remaining items are product-owner decisions, not engineering
  work, and do not block merge: (1) massageRequired product class/data
  (Story 4 gap, finding 2), (2) spec Story 4 AC4 D+14/D+15 wording vs. the
  engine's actual half-open [0,rehabDays) window (finding 4), (3) whether to
  build the seasonal Diff View transition screen (qa-lead's 1 remaining
  it.todo besides massageRequired).
