# Product Profile — Milestone 1 (Deterministic Core)
Date: 2026-08-05
Author: planner-agent
Jira: N/A
Status: APPROVED

Source design (authoritative, do not duplicate further than this spec needs):
`docs/tasks/product_profile/00-overview.md` through `06-open-questions.md` (Status: LOCKED).
This spec scopes Milestone 1 only, per `docs/tasks/product_profile/05-roadmap.md` §"Milestone 1".

## 1. Problem Statement

Ingredient knowledge in Vials lives at two levels today: the *class* level (`src/constants/rulesets/actives.json`, 20 active-ingredient classes with safety/routine properties) and the *corpus* level (per-product `activeKeys` in `src/services/corpus/`). Nothing composes the two into "what this specific product is." Every feature that needs product-level facts — Product Detail, a future recommendation engine, a similarity search — would otherwise re-derive the same aggregation independently. This codebase has already hit that failure mode three times (`isStrongActive()` reimplemented inline in 5 files, `POTENCY_RANK` duplicated in 2 files, ingredient-function taxonomy hand-authored in 5 disagreeing places). Product Profile exists to make a sixth recurrence structurally impossible for anything product-level.

## 2. Goals

- Ship a `ProductProfile` builder that composes a single product's `resolvedActiveKeys` against `actives.json` into: irritation profile, sensitivity compatibility (may be `null`, see Non-Goals), routine position, and the two capabilities (Barrier Repair, Exfoliation) that can ship at `deterministic` confidence today.
- Relocate `LAYERING_ORDER` (`src/utils/routineEngine/slotting.ts`) and `RINSE_OFF_TYPES`/`DEFAULT_PERIOD_BY_TYPE` (`src/utils/routineEngine/productFacts.ts`) into `src/constants/rulesets/` as data, with zero behavior change to the routine engine, so the builder can read them without importing routine-engine-internal files.
- Surface the first real `ProductProfile` objects to users via a "Product Insights" panel on the existing `ProductDetailScreen`.
- Every produced field carries a `ConfidenceNote` (`confidence`, `sourceRefs`, and `caveat` when non-deterministic), per `docs/tasks/product_profile/01-product-profile.md` §5–§7.

## 3. Non-Goals (explicitly out of scope)

- The remaining 8 capability keys (Hydration, Brightening, Pigmentation, Acne Control, Sebum Regulation, Antioxidant Protection, Soothing, Anti-aging) — Milestone 2, blocked on capability-taxonomy sign-off (`06-open-questions.md` Q9).
- Strengths/weaknesses synthesis (builder stage 8) — Milestone 3; requires a broader capability set to avoid synthesizing prose from near-empty input.
- Any Decision Engine stage (Similarity, Gap Coverage, Routine Impact, Recommendation) — Milestones 4–7.
- A real numeric `sensitivityCompatibility` threshold — this is a clinical/product decision (`06-open-questions.md` Q3), not invented here. `compatible` and `thresholdUsed` ship as `null` in this milestone; the field itself is still required and populated with `confidence: 'insufficient_data'`.
- Any change to Routine Engine sequencing logic (`resolve.ts`, `skeleton.ts`, `slotting.ts` algorithms) or Conflict Engine's pairwise rules — only `LAYERING_ORDER`'s and `RINSE_OFF_TYPES`'s *data* moves; consumer logic in `slotting.ts`/`productFacts.ts` is updated only to import from the new location, not rewritten.
- Profile persistence beyond the in-memory build — this milestone builds a `ProductProfile` on read and returns it; wiring it into a cache/store keyed by `productId` is `06-open-questions.md` Q5's "low-risk to change later" item and may land as a fast-follow, not blocking this milestone's UI surface (a screen-level in-memory cache via existing screen state is sufficient for Milestone 1).

## 4. User Stories

### Story 1: View product insights on Product Detail
As a user viewing a product's detail screen, I want to see its routine placement, available capability badges, and an irritation indicator, so that I understand what the product does without reading raw ingredient lists.

**Acceptance Criteria:**
- [ ] Given a product with `activeTags` and/or `fullIngredientText` that resolve to at least one known active class, when I open its Product Detail screen, then a "Product Insights" panel shows: eligible periods (AM/PM), layering position (or "not placed" if the product type has no layering entry), an irritation indicator (0–5 scale or "not enough data"), and badges for Barrier Repair / Exfoliation if the product qualifies.
- [ ] Given a product whose ingredient text/tags resolve to zero known active classes, when I open its Product Detail screen, then the panel shows an explicit "not enough ingredient data" state — never a blank panel and never a `0`/false capability score presented as a confident claim.
- [ ] Given a product that does not qualify for Barrier Repair or Exfoliation, when I view the panel, then those badges are simply absent (a `0`/false score is a real claim distinct from missing data — see AC above).
- [ ] Given the product's active classes disagree on `preferredPeriod` with no class-level requirement resolving the disagreement, when the panel renders, then it shows both eligible periods without asserting a single preferred one.

### Story 2: Matcher gaps stay visible, not silently dropped
As an engineer or QA reviewer, I want unresolved INCI tokens surfaced on the profile, so that gaps in the ingredient matcher table are a visible signal, not a silent loss.

**Acceptance Criteria:**
- [ ] Given a product's `fullIngredientText` contains a token that matches no `actives.json` class, when the profile is built, then that token appears in `unresolvedIngredientTokens` on the resulting `ProductProfile`.
- [ ] Given `resolvedActiveKeys` is supplied directly (corpus path, no raw INCI text), when the profile is built, then `unresolvedIngredientTokens` is `[]` (nothing to flag — there was no free text to parse).

## 5. UX / Behaviour

- **Location:** new "Product Insights" section on `src/screens/ProductDetailScreen.tsx`, positioned per existing screen conventions (below the ingredient list, per `docs/SCREENS.md`'s existing layout for this screen — engineer confirms exact placement against the current screen during implementation).
- **Loading state:** the panel shows a skeleton (existing skeleton pattern used elsewhere on this screen) while the profile builds; the build is synchronous/pure-function fast for a single product (no network call — corpus `activeKeys` are already loaded by the time this screen has a product to show), so this should be near-instant, but the state must exist for consistency with the rest of the screen.
- **Empty/insufficient-data state:** see Story 1's AC — an explicit caveat-bearing message, never an empty panel or a misleading `0`.
- **Error state:** if the builder throws (should not happen for valid `Product` input — this is pure computation, no I/O), the panel fails closed to the insufficient-data state and logs via the existing `__DEV__`-guarded warning pattern (see `productFacts.ts` for the convention) — it must never crash the whole Product Detail screen.
- **Design tokens:** irritation indicator and capability badges use `src/constants/tokens.ts` only — no hardcoded colors, no pink hues, minimum 14px font, per `CLAUDE.md` and `.claude/rules/architecture-review.md` §5.

## 6. Data Requirements

- **New type:** `ProductProfile` and its nested types (`ConfidenceNote`, `CapabilityScore`, `IrritationProfile`, `SensitivityCompatibility`, `RoutinePosition`, `ProfileStrengthsWeaknesses`) — exact shape frozen in `docs/tasks/product_profile/01-product-profile.md` §5, scoped down for this milestone (only `barrierRepair`/`exfoliation` keys of `capabilities` populated; `strengthsWeaknesses` always `null`).
- **New data relocation (no new data, existing constants moved):**
  - `LAYERING_ORDER` (`Record<ProductType, number>`) from `src/utils/routineEngine/slotting.ts` → `src/constants/rulesets/` as a data file/export consumed by both `slotting.ts` and the new builder.
  - `RINSE_OFF_TYPES` (`readonly ProductType[]`) and `DEFAULT_PERIOD_BY_TYPE` (`Partial<Record<ProductType, Period[]>>`) from `src/utils/routineEngine/productFacts.ts` → same location.
- **Existing data consumed, read-only:** `ACTIVES_RULESET` / `actives.json` classes (`properties.barrierRepair`, `properties.exfoliating`, `properties.irritancy`/`irritancyByPotency`, `properties.photosensitizing`, `properties.lowPh`, `allowedPeriods`, `preferredPeriod`) via `src/constants/rulesets/rulesetTypes.ts`; `Product.activeTags`, `Product.activeIngredients`, `Product.fullIngredientText`, `Product.productType`, `Product.usageTime` from `src/types/index.ts`; `ingredientParser.ts`'s existing INCI-to-`activeKey` matching.
- **Data retention:** none — a `ProductProfile` is derived, not persisted user input. If a screen-level cache is added it is a computed-value cache with no independent retention policy (invalidated by remount or product-id change).

## 7. Dependencies

- Depends on: `docs/database/db-product-spec.md`, `docs/database/db-tech-design.md` (corpus shape), and the full `docs/tasks/product_profile/` design set (architecture is locked there; this spec narrows it to Milestone 1's slice).
- Blocks: Milestones 2–7 of the same roadmap (`docs/tasks/product_profile/05-roadmap.md`) — none of them can start without this milestone's builder skeleton and join helper.
- External services: none. Fully local/offline, consistent with `CLAUDE.md`'s "local-only storage" constraint — no network calls added.

## 8. Security & Privacy

- Authentication required: no (no change to auth surface).
- Data sensitivity: none beyond what `ProductDetailScreen` already displays (product/ingredient data, not user health/PII). No new field carries user-identifying or clinical data.
- Compliance considerations: none new. Confidence/caveat text must stay factual about *ingredient data gaps*, not phrased as medical advice — consistent with existing product copy conventions.

## 9. Success Metrics

- `npx tsc --noEmit` clean after implementation.
- 100% of `ProductProfile`-required fields (per `01-product-profile.md` §6) populated (never `undefined`) across the unit test suite's product fixtures, including the zero-known-ingredient edge case.
- QA integration tests (written by qa-lead against this spec + the tech design) pass for both entry paths (raw INCI text, resolved corpus `activeKeys`) and the insufficient-data path.
- `ProductDetailScreen` renders the Product Insights panel for a real seeded product without a console error/warning outside the sanctioned `__DEV__` gate.

## 10. Open Questions

- [x] Q3 (sensitivity compatibility numeric threshold) → owner: product/clinical (per `docs/tasks/product_profile/06-open-questions.md`). Resolved for *this* milestone by shipping `null`/`insufficient_data` rather than inventing a number — not blocking, per the source doc's explicit caution.
- [x] Q8 (relocation ownership for `LAYERING_ORDER`/`RINSE_OFF_TYPES`) → owner: this task's engineer, reviewed by tech-lead as the current owner of `routineEngine/`. Resolved: in-scope for this milestone (Goal 2 above), mechanical data move only.
- [ ] Requirement-vs-preference distinction on `ActiveClass` (referenced by `06-open-questions.md` Q4 as "verify during Milestone 1") → owner: engineer, to confirm during tech design. **Verified during spec-writing: no such field exists today** — `rulesetTypes.ts`'s `ActiveClass` has only `allowedPeriods: Period[]` and an optional `preferredPeriod?: Period`, no separate "hard requirement" flag. The tech design must treat a class whose `allowedPeriods` contains a single period as the de-facto hard requirement (already enforced via intersection) and treat `preferredPeriod` purely as the soft signal; when present classes' `preferredPeriod` values disagree with no `allowedPeriods`-derived requirement to break the tie, `routinePosition.preferredPeriod` is `null` per `01-product-profile.md` §6 (already an explicitly sanctioned outcome, not a gap this milestone needs to close).
- [ ] Screen-level cache vs. no cache for the Product Insights panel → owner: engineer, low-risk, may ship either way per Non-Goals §3.
