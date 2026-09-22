# Technical Design: Product Profile — Milestone 1
Spec: docs/specs/2026-08-05-product-profile-m1.md
Design source (locked): docs/tasks/product_profile/00-overview.md through 06-open-questions.md
Author: tech-designer
Date: 2026-08-05

## 1. Architecture Overview

New pure module `src/utils/productProfile/` (no React, no store, no I/O — mirrors
`src/utils/routineEngine/`'s purity convention). Reads two existing sources:
`ACTIVES_RULESET` (`src/constants/rulesets/rulesetTypes.ts`) for per-class facts,
and either raw `Product` fields or a pre-resolved `activeKeys[]` for the ingredient
basis. `LAYERING_ORDER`/`RINSE_OFF_TYPES`/`DEFAULT_PERIOD_BY_TYPE` move out of
`routineEngine/`-private files into `constants/rulesets/` as data so this module
never imports `routineEngine/` internals (binding rule, `02-profile-builder.md` §10).
Consumed by a new "Product Insights" section on `ProductDetailScreen.tsx`.

```
Product (activeTags/fullIngredientText)  ──┐
                                             ├──► resolve.ts (stage 1) ──► join.ts (stage 2, ACTIVES_RULESET)
resolvedActiveKeys[] (corpus, pre-parsed) ──┘                                    │
                                                                                   ▼
                                                                capabilities.ts (stage 3, barrierRepair+exfoliating only)
                                                                irritation.ts (stage 5, max_of_present)
                                                                sensitivity.ts (stage 6, null this milestone)
                                                                routinePosition.ts (stage 7, uses relocated tables)
                                                                                   │
                                                                                   ▼
                                                                     buildProductProfile() → ProductProfile
```

## 2. API Contracts

No HTTP endpoints (local app). Module contract:

### `src/utils/productProfile/index.ts`
- `buildProductProfileFromProduct(product: Product): ProductProfile` — entry
  point A (raw INCI text path), reuses `ingredientParser.ts` unchanged.
- `buildProductProfileFromActiveKeys(input: { productId, productType, brand, name, activeKeys: ActiveIngredientKey[] }): ProductProfile` — entry point B (corpus path). Both converge into one internal `buildFromResolved()` after stage 1.
- Pure, synchronous, no `now` dependency (profile has no time-sensitive field in this milestone).
- Errors: never throws for a well-typed `Product`/input — worst case is `overallConfidence: 'insufficient_data'` with empty `capabilities`/`unresolvedIngredientTokens` populated. A malformed input (missing `productId`) throws `TypeError` at the call boundary, same convention as other `routineEngine/` entry points.

## 3. Implementation Tasks

### engineer (scope=frontend — this app is frontend-only)

- FE-1: `ProductProfile` types — file: `src/types/index.ts` (append
  `ProfileConfidence`, `ConfidenceNote`, `CapabilityKey` (all 10 keys declared now,
  only 2 scored this milestone), `CapabilityScore`, `IrritationProfile`,
  `SensitivityCompatibility`, `RoutinePosition`, `ProfileStrengthsWeaknesses`,
  `ProductProfile`, per `01-product-profile.md` §5 verbatim). Domain types belong
  here, not re-declared per-file (`.claude/rules/architecture-review.md` §3).

- FE-2: Relocate layering/rinse-off/period-default data — files:
  `src/constants/rulesets/productFacts.ts` (new, data-only: `LAYERING_ORDER`,
  `RINSE_OFF_TYPES`, `DEFAULT_PERIOD_BY_TYPE`, typed against `ProductType`/`Period`
  from `rulesetTypes.ts`); update `src/utils/routineEngine/slotting.ts` and
  `src/utils/routineEngine/productFacts.ts` to import from the new location and
  delete the local `const` declarations. **Mechanical move only — zero logic
  change.** Existing `routineEngine` tests (`slotting.test.ts`, `productFacts.test.ts`
  if present, plus any integrity/fixture suites) must pass unmodified after the move.

- FE-3: Resolution + join — files: `src/utils/productProfile/resolve.ts` (stage 1:
  reuses `ingredientParser.ts`'s `parseActiveIngredientDetails`/`normalizeActiveKey`
  for the raw-INCI path; normalizes the pre-resolved path through the same
  `legacyKeyMap`; outputs `resolvedActiveKeys[]` + `unresolvedIngredientTokens[]`),
  `src/utils/productProfile/join.ts` (stage 2: `activeKey` → `ACTIVES_RULESET.classes[key]`
  lookup, one record per present key, no data copied — pure read).
  Verify at this task's start whether `ingredientParser.ts`'s `POTENCY_RANK` and
  `routineEngine/resolve.ts`'s `POTENCY_RANK` have since been unified; if not,
  this is a blocking prerequisite for this task (`02-profile-builder.md` §4), not
  parallel work — resolve by importing one canonical source, do not add a third copy.

- FE-4: Capability aggregation (Barrier Repair + Exfoliation only) — file:
  `src/utils/productProfile/capabilities.ts`. Both read `properties.barrierRepair`/
  `properties.exfoliating` booleans directly (per `03-capabilities.md` §1–2) →
  `confidence: 'deterministic'`, `score = min(1, presentCount / 3)` (placeholder
  saturation constant, `06-open-questions.md` Q2), `sourceRefs: ['actives.json:properties.barrierRepair']`
  (or `.exfoliating`). The other 8 `CapabilityKey` entries are present in the
  `capabilities` record (required object, per spec §3) with `score: null`,
  `confidence: 'insufficient_data'`, `caveat: 'Not modeled in Milestone 1'`.
  `primaryFunctions` stays `[]` this milestone (stage 4 activates in Milestone 2
  per `05-roadmap.md`).

- FE-5: Irritation + sensitivity — file: `src/utils/productProfile/irritation.ts`.
  `max_of_present` per class's `resolveIrritancy(properties, potency)` (reuse
  `rulesetTypes.ts`'s exported helper, do not reimplement — this is exactly the
  `isStrongActive()` duplication pattern this design exists to stop);
  `photosensitizing`/`lowPh` = OR across present classes. `confidence: 'heuristic'`
  minimum always (per `01-product-profile.md` §7). `sensitivityCompatibility`
  returns `{ compatible: null, thresholdUsed: null, confidence: 'insufficient_data',
  sourceRefs: [], caveat: 'Sensitivity threshold not yet clinically defined (spec §3/Q3)' }`
  unconditionally this milestone — do not invent a numeric cutoff.

- FE-6: Routine position — file: `src/utils/productProfile/routinePosition.ts`.
  `eligiblePeriods` = intersection of `allowedPeriods` across present classes;
  `preferredPeriod` = the single value if all present classes with a
  `preferredPeriod` agree, else `null` (no requirement/preference field exists
  today — see spec §10 finding; do not infer one). `layeringOrder` = relocated
  `LAYERING_ORDER[productType]` or `null` if absent from the table.
  `rinseOff` = relocated `RINSE_OFF_TYPES.includes(productType)`.

- FE-7: Orchestration — file: `src/utils/productProfile/index.ts`. Wires FE-3→FE-6
  in strict stage order (`02-profile-builder.md` §3), computes `overallConfidence`
  as the worst tier among all required fields, sets `builderVersion: '1.0.0'`,
  `builtAt: new Date().toISOString()`, `strengthsWeaknesses: null` (Milestone 3).

- FE-8: Product Insights UI — files: `src/screens/ProductDetailScreen.tsx` (new
  section, calls `buildProductProfileFromProduct` on the loaded `Product`, no
  store/cache required this milestone — a `useMemo` keyed on `product.id` is
  sufficient), new presentational component(s) under `src/components/product/`
  (e.g. `ProductInsightsPanel.tsx`) using `src/constants/tokens.ts` only, per
  spec §5. Insufficient-data and loading states per spec §5 ACs.

### engineer (unit tests, both scopes)
- Each FE task above includes unit tests co-located per `.claude/rules/testing.md`
  (`src/utils/productProfile/*.test.ts`), pure inputs, no React/store imports.
  Required fixtures: zero-known-ingredient product, single-class product,
  multi-class product with disagreeing `preferredPeriod`, product type absent
  from `LAYERING_ORDER`.

## 4. Assumptions

- `LAYERING_ORDER`/`RINSE_OFF_TYPES`/`DEFAULT_PERIOD_BY_TYPE` relocate into a new
  `src/constants/rulesets/productFacts.ts` file (not merged into `rulesetTypes.ts`
  or `actives.json`).
  Alternative: fold them into `actives.json` as new per-class/per-type fields.
  Reason: they are keyed by `ProductType`, not by active class — a separate
  small data file keeps the ruleset's per-class schema unpolluted and matches
  this design's explicit instruction to relocate as "data," not merge into an
  unrelated schema.
- `preferredPeriod` disagreement with no `allowedPeriods`-derived requirement
  resolves to `null`, not a priority order between classes.
  Alternative: define an explicit class-priority list to break ties.
  Reason: no such priority data exists anywhere in the codebase today; inventing
  one would be exactly the kind of unbacked heuristic `01-product-profile.md` §6
  already anticipates and explicitly permits shipping as `null` instead.
- Screen-level `useMemo` is sufficient caching for Milestone 1; no store/cache
  entity is added.
  Alternative: a dedicated `productProfileStore.ts` keyed by `productId`.
  Reason: `06-open-questions.md` Q5 marks persistence as "low-risk to change
  later" and out of scope for the first UI surface; avoids speculative store
  plumbing before a second consumer exists.

## 5. Open Questions

No open questions blocking implementation start. Q3 (sensitivity threshold) and
Q9 (capability taxonomy sign-off owner) remain open per the source design but are
explicitly non-blocking for Milestone 1 (spec §10; `06-open-questions.md`).
