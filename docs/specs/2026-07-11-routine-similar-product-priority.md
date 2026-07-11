# Routine Similar-Product Priority
Date: 2026-07-11
Author: planner-agent
Jira: N/A
Status: APPROVED
Task-Slug: routine-similar-product-priority

```yaml
# AI-SDLC flags
backend_layer: false     # local-only app; all logic in src/utils/routineEngine + stores
frontend_layer: true
infra_changes: false
```

## 1. Problem Statement
Users can currently add two products of the same category (e.g. two different moisturizers, or two SPFs) to the same routine, and the app does nothing: `upsertProductStep` in `src/store/routinesStore.ts` dedupes only by exact `productId`, and the routine engine's resolution step (`src/utils/routineEngine/resolve.ts`) rejects steps only for ingredient pair-rule or active-stacking violations — never for category duplication. The result is routines with redundant layers (double SPF, double cream) that are wasteful, potentially irritating to skin, and confusing: the user gets no signal about which product the app considers the better fit, and no guided way to resolve the duplication. The only related mechanism, `findSubstitute()` (`src/utils/routineEngine/substitute.ts`), is a manual replace action that does not detect or resolve the "two similar products already in the routine" case.

## 2. Goals
- Detect when a routine (per period, AM/PM) contains two or more products sharing the same layering slot (`LAYERING_ORDER` in `src/utils/routineEngine/slotting.ts`), and surface this to the user within the routine context.
- When the user manually adds a product to a routine that already has a same-slot product, prompt the user to choose an outcome (replace / keep both / cancel) before the step is committed — zero silent data loss.
- When the deterministic routine engine generates or resolves a routine, admit at most one product per slot per period, chosen by the existing `scoreCandidate()` ranking (`resolve.ts`), and expose the non-admitted same-slot products as visible alternatives — not silently discarded.
- Ranking is fully deterministic and local (reuses `scoreCandidate` ordering: SOS/prioritize boost → concern match → potency → addedAt → id); given the same shelf and profile, the same winner is always chosen.
- 100% of duplicate-slot states in a routine display a warning consistent with the existing `ConflictWarning` pattern (warnings shown only in routine context, never on catalog cards).

## 3. Non-Goals (explicitly out of scope)
- No automatic deletion or archiving of products from the user's shelf or from a routine the user built manually — the user always confirms removal.
- No warnings or priority badges on product catalog / My Shelf cards (per CLAUDE.md: conflict-style warnings live only in routines).
- No new AI/Anthropic dependency for ranking — scoring reuses the existing deterministic `scoreCandidate` logic; no network calls.
- No new user-editable "priority" field on `Product` in this iteration (no data-model change to `src/types/index.ts` `Product`); priority is derived, not stored.
- No changes to ingredient pair-rule or active-stacking conflict detection — this feature adds a parallel category-duplication check, it does not modify `findPairViolations` / `findCapViolations`.
- No cross-routine dedup (a moisturizer may legitimately appear in both AM and PM routines).

## 4. User Stories

### Story 1: Warned on manual duplicate add
As a user manually editing my routine, I want to be warned when I add a product whose category slot is already filled so that I don't unknowingly double up on similar products.

**Acceptance Criteria:**
- [ ] Given an AM routine containing moisturizer A, when the user adds a different product B whose `productType` shares A's slot index (e.g. `cream`, `lotion`, or `moisturizer`), then a choice sheet appears before B is committed, naming both products and offering "Replace [A]", "Keep both", and "Cancel".
- [ ] Given the choice sheet, when the user taps "Replace [A]", then A's step is removed from that routine period, B is inserted at the slot position, and A remains untouched on the shelf.
- [ ] Given the choice sheet, when the user taps "Keep both", then both steps remain and a persistent duplicate-slot warning (Story 3) is shown on that routine.
- [ ] Given the choice sheet, when the user taps "Cancel" (or dismisses the sheet), then the routine is unchanged and B is not added.
- [ ] Given a product B with the exact same `productId` as an existing step, when the user adds it, then the existing exact-id upsert behavior applies unchanged (no sheet).

### Story 2: Engine picks one winner per slot
As a user generating a routine with the rule engine, I want the engine to include only the best product per category slot so that my generated routine has no redundant layers.

**Acceptance Criteria:**
- [ ] Given a shelf with two SPFs eligible for AM, when the engine resolves the AM routine, then exactly one SPF is admitted — the one ranked first by `scoreCandidate` ordering — and the outcome is identical on repeated runs with the same inputs.
- [ ] Given a slot with a non-admitted same-slot product, when the user views the generated routine, then the non-admitted product is listed as an alternative for that step (e.g. "Also on your shelf: [name]") with a one-tap swap action reusing the substitute pattern.
- [ ] Given a same-slot loser, when resolution completes, then the losing product is not deleted from the shelf and not removed from any other routine.
- [ ] Given a slot where the top-ranked candidate is later rejected by an ingredient pair-rule or cap violation, when resolution continues, then the next-ranked same-slot candidate is considered for admission.

### Story 3: See and resolve existing duplicates
As a user with a routine that already contains duplicate-slot products, I want to see a warning and resolve it in place so that I can clean up my routine without rebuilding it.

**Acceptance Criteria:**
- [ ] Given a routine period containing two or more steps sharing a slot index, when the user opens that routine, then a non-blocking warning row appears on the affected steps (visual language consistent with `ConflictWarning`, severity below ingredient conflicts) stating e.g. "2 similar products (moisturizers) in this routine".
- [ ] Given the duplicate-slot warning, when the user taps it, then a resolution sheet lists the competing products ranked by `scoreCandidate` order, marks the top-ranked one as "Recommended", and lets the user remove any of them from the routine (with confirmation) or keep all.
- [ ] Given the user chose "Keep both" (here or in Story 1), when they reopen the routine, then the warning is still visible but never blocks viewing, editing, or completing the routine.
- [ ] Given a routine with no shared-slot steps, when the user opens it, then no duplicate warning UI is rendered.

## 5. UX / Behaviour
- **Similarity definition:** two products are "similar" iff `getSlotIndex(productType)` is equal (per `LAYERING_ORDER`): e.g. `serum`/`gel`; `lotion`/`cream`/`moisturizer`; `oil`/`balm`; `spf`/`spf`. `other` (slot 7) is exempt from duplicate detection — it is a catch-all, not a category.
- **Manual add flow:** on add-to-routine, before committing the step, check the target period's steps for a shared slot. If found → bottom sheet: title "You already have a [category label] in this routine", both product names/brands shown, actions "Replace [existing]" (primary), "Keep both" (secondary), "Cancel" (tertiary/dismiss). Exact-`productId` re-add keeps today's upsert behavior with no sheet.
- **Engine generation flow:** during resolution, same-slot candidates compete; one winner admitted per slot per period via `scoreCandidate` ordering. Losers appear under the step as a collapsed "alternatives" affordance with a swap action (reuses `findSubstitute`-style replacement). Nothing is deleted.
- **Existing-duplicate state:** duplicate-slot warning rendered inline on the routine screen only (never Today-card summaries beyond an optional count, never catalog). Warning is informational (advisory severity), visually distinct from ingredient-conflict warnings.
- **Error/empty states:** if slot lookup fails for an unknown `productType`, treat as non-duplicating (fail open, no warning, no crash). If the resolution sheet's remove action fails to persist, show the standard storage-error toast and leave the routine unchanged. Empty routines and single-product slots render no new UI.
- **Copy:** English only. Category labels are human-friendly slot names ("moisturizer", "SPF", "serum"), not raw `productType` values.

## 6. Data Requirements
- New data needed: none on `Product`. Routine step may need a derived/ephemeral `duplicateOfSlot` flag or the warning can be computed at render time from steps + `LAYERING_ORDER` (preferred: computed, not persisted). A per-routine dismissal/acknowledgement record is explicitly deferred (see Open Questions).
- Existing data consumed: `Product.productType`, `Product.addedAt`, `Product.id`, concern/potency/SOS inputs already used by `scoreCandidate`; routine steps from `routinesStore`; `LAYERING_ORDER` slot map.
- Data retention: no new persisted data; all detection is computed locally from existing AsyncStorage-backed state. "Keep both" is represented simply by both steps existing (no extra flag in v1).

## 7. Dependencies
- Depends on spec: none formally; behavior builds on `docs/research/routine-engine.md` (§ "multiple products per slot are allowed; they compete in step 5") — this spec narrows that: they compete, and category duplication itself now has an outcome.
- Blocks: any future "smart shelf priority" or per-product user-set priority feature should build on this slot-competition mechanism.
- External services: none. No network, no AI. Fully deterministic and offline.

## 8. Security & Privacy
- Authentication required: no (local-only app, Phase 1).
- Data sensitivity: routine/product data is personal wellness data; it never leaves the device — this feature adds no new storage keys and no transmission.
- Compliance considerations: none new; consistent with the existing local-only data posture and Profile screen's local-data warning.

## 9. Success Metrics
- 0 silent removals: no code path deletes or drops a user-added routine step without an explicit user confirmation (verified by QA tests).
- Determinism: engine-generated routines contain ≤ 1 product per slot per period, and 100 repeated runs on a fixed fixture shelf produce an identical winner set (engine test assertion).
- Detection coverage: 100% of shared-slot pairs across the `ProductType` union (excluding `other`) trigger the manual-add sheet and the inline warning in component tests.
- Interaction proxy (dev/manual QA, no analytics backend in Phase 1): in dogfooding, duplicate-slot warnings on a seeded duplicate shelf are resolvable to zero warnings in ≤ 2 taps from the routine screen.

## 10. Open Questions
- [x] ~~Should "Keep both" be allowed for the `spf` slot, or is double SPF always forced to replace/cancel?~~ **Resolved (2026-07-11, product owner):** "Keep both" is allowed uniformly for every slot, including `spf` — no per-slot forced replace. Rationale: two same-slot SPF products can be a legitimate intentional pairing (e.g. an SPF cream applied in the AM routine plus an SPF stick used for a midday reapplication), not necessarily user error. The manual-add sheet and the existing-duplicate warning still surface the situation, but never force removal — consistent with the "0 silent removals" success metric in §9.
- [x] ~~Should similarity ever be refined beyond shared slot index (e.g. same slot + overlapping actives treated as "stronger" duplicates with higher warning severity)?~~ **Resolved (2026-07-11, product owner):** No severity escalation based on active-ingredient overlap. All same-slot duplicates get the same flat, advisory-level warning and the same Replace / Keep both / Cancel choice — the app never assumes a stronger duplicate is "worse" or nudges the user toward removal; the choice is always the user's to make.
- [x] ~~Do pre-existing routines with duplicates get a one-time migration prompt on first open after update, or only the passive inline warning?~~ **Resolved (2026-07-11, planner default — no strong preference from product owner):** Passive inline warning only, no forced migration prompt. Rationale: a migration prompt would require new "has this routine been checked" persisted state, and would interrupt users the moment they open the app after an update — including users whose duplicate is a deliberate choice (per Q1's SPF-reapplication case). Treating pre-existing and newly-created duplicates identically (same passive warning, Story 3) is simpler and avoids surprise interruptions. Can be revisited if analytics/dogfooding show users don't discover the warning organically.
- [x] ~~Should the user be able to dismiss/acknowledge a duplicate warning permanently per routine?~~ **Resolved (2026-07-11, planner default — no strong preference from product owner):** No persistent dismiss flag in v1. Rationale: the warning is already advisory and non-blocking (Story 3), so repeated visibility costs little; adding a dismiss flag means new persisted state, which §6 explicitly avoids for v1. Choosing "Keep both" in the manual-add sheet already functions as the user's acknowledgement — the follow-up passive badge is low-friction, not a nag screen. Flag as a candidate v2 enhancement if user feedback reports the warning as annoying.
