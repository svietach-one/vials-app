# Vials — Ingredient Conflict Matrix Expansion
Date: 2026-08-04
Author: planner-agent
Jira: N/A (kebab-case task slug per agent-layer-protocol.md: `vials-conflict-matrix-expansion`)
Status: DRAFT

## AI-SDLC Flags
```
backend_layer:  false
frontend_layer: true
infra_changes:  false
```

## 1. Problem Statement

The conflict engine only warns a user when a routine pairs two products whose active-ingredient classes
have an explicit rule defined between them. Two clinically common actives — benzoyl peroxide and
niacinamide — currently have little to no explicit coverage against the classes the matrix already
tracks (retinoids, AHA/BHA/PHA acids, vitamin C, peptides): a user layering a benzoyl-peroxide spot
treatment with an AHA toner, or a niacinamide serum with a retinoid, gets no signal either way today,
even though both classes are already reliably detected from ingredient labels. Separately, the app has
no way to represent "this product physically abrades the skin" (a scrub, an exfoliating cleansing tool)
at all — unlike a chemical active, that fact cannot be read off an ingredient list, so today it is
invisible to every conflict check no matter what the label says.

## 2. Goals

- All 15 pairwise combinations among the six active-ingredient classes the conflict engine already
  tracks (retinoids; AHA/BHA/PHA acids; vitamin C, pure and derivative forms; copper peptides; benzoyl
  peroxide; niacinamide) resolve to an explicit, tested classification — a defined conflict with a
  severity, or an explicitly asserted "no conflict" — instead of silently defaulting to "no conflict"
  because the pair was simply never defined.
- A product can carry a "physical exfoliant" signal that is independent of its ingredient list, and that
  signal is checked for conflicts the same way an ingredient-derived active is.
- Detection of benzoyl peroxide and niacinamide from ingredient-label text stays reliable across
  representative real-world label strings (regression target — this detection already exists and must
  not be weakened by this change).
- None of the conflict pairs or "no-conflict" pairs already defined before this task change in severity,
  trigger condition, or explanation/suggestion copy.

## 3. Non-Goals (explicitly out of scope)

- A new color or visual treatment for conflict warnings. Every severity keeps rendering through the
  existing amber warning styling; severities differ in copy only.
- Fragrance / essential-oil conflict detection. Deliberately excluded — fragrance appears in most
  products, so flagging it here would make the warning system noisy enough that users stop trusting it.
  Fragrance information belongs to the separate EU allergen badge, not this matrix.
- Backfilling or re-parsing ingredient tags already cached on products added before this ships. There is
  no production install base yet, so there is nothing to backfill; revisit the next time this matrix
  changes after launch.
- Adding the physical-exfoliant toggle to the primary `AddProductScreen` accordion wizard. It ships only
  on the manual product form (the screen already used to create and edit any product) this pass.
- Finalizing production copy for any new severity tier or pair. Placeholder copy is acceptable for the
  first implementation pass.
- Turning any new pair "live" for end users. This spec defines the intended design; going live is gated
  on the clinical/product sign-off in §10 and is explicitly not decided by this document.

## 4. User Stories

### Story 1: Warned when combining benzoyl peroxide with a conflicting active
As a user, I want to be warned when my routine schedules a benzoyl-peroxide product alongside another
active known to interact with it, so I don't unknowingly reduce either product's effectiveness or
over-irritate my skin.

**Acceptance Criteria:**
- [ ] Given a routine with a benzoyl-peroxide product and a retinoid product scheduled for an overlapping
  day, when conflicts are computed, then the existing amber conflict warning appears for that pair (draft
  severity: strong/"High" tier — pending clinical sign-off, §10).
- [ ] Given a routine with a benzoyl-peroxide product and an AHA or BHA product scheduled for an
  overlapping day, when conflicts are computed, then the amber conflict warning appears (draft severity:
  moderate/"Medium" tier — pending §10).
- [ ] Given a routine with a benzoyl-peroxide product and a niacinamide product, when conflicts are
  computed, then no conflict warning appears for that pair (proposed as compatible, but flagged as the
  single lowest-confidence call in this spec — pending priority review, §10).

### Story 2: Niacinamide's interactions are explicit, not silent
As a user, I want the app to tell me clearly whether niacinamide conflicts with the other actives in my
routine, rather than staying silent because the pair was never defined.

**Acceptance Criteria:**
- [ ] Given a routine with a niacinamide product and a vitamin C product, when conflicts are computed,
  then no conflict warning appears (niacinamide + vitamin C is a well-documented non-issue, historically
  miscited as a conflict).
- [ ] Given a routine with a niacinamide product and a retinoid product, when conflicts are computed,
  then no conflict warning appears (niacinamide is commonly paired with retinoids specifically to buffer
  irritation).
- [ ] Given a routine with a niacinamide product and an AHA or BHA product scheduled for an overlapping
  day, when conflicts are computed, then the amber conflict warning appears using the app's existing
  `caution` tier and its "Possible conflict — " copy (RESOLVED 2026-08-05: no third severity tier is
  introduced — see §10 — exact severity for this specific pair is still pending sign-off, §10).

### Story 3: Flagging a product as a physical exfoliant
As a user who owns a scrub or another product with abrasive particles, I want to mark it as a physical
exfoliant so the app can warn me about over-exfoliation risk with my other actives, even though nothing
in the ingredient list says so.

**Acceptance Criteria:**
- [ ] Given I am adding or editing a product on the manual product form, when I reach the
  ingredients/usage section, then I see a "Physical exfoliant" toggle, off by default.
- [ ] Given I turn the toggle on and save, when I view a routine that schedules that product alongside a
  retinoid product on an overlapping day, then the amber conflict warning appears (draft severity:
  strong/"High" tier — pending §10).
- [ ] Given the toggle is off (the default) for a product whose ingredient list happens to mention
  exfoliating-sounding ingredients, when conflicts are computed, then no physical-exfoliant conflict is
  triggered — the toggle, never the ingredient text, is the sole signal for this specific check.

### Story 4: No regression to already-defined pairs
As an existing user, I want the conflict pairs the app already warns me about today to keep behaving
exactly the same after this update, so a routine I've already reviewed doesn't silently change meaning.

**Acceptance Criteria:**
- [ ] Given the set of conflict and no-conflict pairs already defined before this change, when conflicts
  are computed before and after this change ships, then severity, trigger condition, and
  explanation/suggestion copy are identical for every one of them.
- [ ] Given a range of real-world ingredient-label strings containing "benzoyl peroxide" or
  "niacinamide"/"nicotinamide" in different phrasings, when ingredient parsing runs, then both are still
  detected exactly as reliably as before this task (this detection already exists; the AC is a regression
  guard, not new parsing work).

## 5. UX / Behaviour

All conflict rows continue to render through the existing amber (`InlineAlert tone="warning"`) styling on
the Routines screen — no new color is introduced for any severity. The one visible change is copy: each
row today shows only the rule's own explanation/suggestion text with no severity indicator; this task
adds a short severity-derived prefix ahead of that text — exactly two prefixes, "Strong conflict — " for
`avoid` and "Possible conflict — " for `caution` (RESOLVED 2026-08-05: no third "Low"/minor tier is
introduced; see §10), so two amber rows of different real severity read differently even though they
share a color.

The "Physical exfoliant" toggle is a plain on/off switch on the manual product form (the same screen
already used to create a product manually and to edit any existing product), placed near the other
product-attribute fields. No new screen, modal, or navigation entry point is introduced. There is no
loading state (the toggle is a local field on an already-loaded form) and no distinct error state beyond
the form's existing save-failure handling.

## 6. Data Requirements

- New data needed: a "physical exfoliant" yes/no flag stored on the product record; new conflict-rule
  entries (pair + severity + explanation + suggestion) for the pairs enumerated in Stories 1–2, gated on
  §10.
- Existing data consumed: a product's ingredient list and confirmed active-ingredient tags (already used
  to detect every other active class); a routine's scheduled steps and days.
- Data retention: identical to the rest of the product record — local, on-device only, no new retention
  policy, per the app's existing local-only storage model.

## 7. Dependencies

- Depends on spec: none. Builds entirely on the already-shipped ingredient-detection and conflict-matrix
  system; no other in-flight spec is a prerequisite.
- Blocks: none identified.
- External services: none. Ingredient detection and conflict checks are fully local; no third-party API
  is involved.

## 8. Security & Privacy

- Authentication required: no (the app has no accounts in Phase 1).
- Data sensitivity: none beyond what the product catalog already stores locally (ingredient lists,
  product attributes). The physical-exfoliant flag is a plain product attribute, not health data about
  the user.
- Compliance considerations: none new. No data leaves the device as part of this feature.

## 9. Success Metrics

The app has no production install base and no in-feature analytics pipeline yet, so this feature's
success is measured as engineering/QA completeness rather than usage:
- Every one of the 15 pairwise combinations named in Goals, plus the two physical-exfoliant pairs, has an
  explicit automated test asserting its status (defined conflict + severity, or asserted "no conflict") —
  zero pairs left silently undefined.
- 100% of pre-existing `conflictEngine` and ruleset-integrity test assertions continue to pass unmodified
  (zero regressions).
- `npx tsc --noEmit` and the full `npm test` suite are clean, per `.claude/rules/testing.md`.

## 10. Open Questions

**Resolved 2026-08-05 (product decisions, no clinical input needed — architecture/data-model calls, not
efficacy claims):**
- [x] `isPhysicalExfoliant` is a boolean flag, not a dedicated product type/category — physical-exfoliant-
  ness is orthogonal to product type, same relationship the existing `sensitive` flag has to skin type.
  Non-blocking gap filed: how the flag is populated for non-manual (API/DB-sourced) products is still
  open, since INCI text generally can't reveal abrasive particles — the manual-form path this task ships
  is unaffected.
- [x] No third "Low"/minor severity tier is introduced. The engine's severity scale stays two-level
  (`avoid`/`caution`) — the codebase documents this as deliberately never extended to a third tier. Every
  pair this task adds, including niacinamide+acid (previously drafted as "Low"), resolves onto `avoid` or
  `caution` with distinct copy only. A softer visual treatment within `caution` remains open as a future
  display-only follow-up, not a data-model change.

**Still open — blocks the actual conflict-pair sign-off, not the mechanical implementation:**
- [ ] Severities/existence for every new or reconciliation-flagged pair (benzoyl-peroxide/acid,
  niacinamide/acid, benzoyl-peroxide/retinoid — the last two already ship in code and need *retroactive*
  confirmation, not fresh approval) → owner: product/clinical reviewer, same gate as `PRD_Spec.md` §6.
  **Read this in light of the blast-radius note below before signing off.**
- [ ] Priority individual review (not a batch approval) for the two lowest-confidence pairs: copper
  peptide + benzoyl peroxide, and benzoyl peroxide + niacinamide (the "no conflict" claim here is
  contested, not settled) → owner: product/clinical reviewer.
- [ ] Whether the gentler PHA acid class is included alongside AHA/BHA in the new benzoyl-peroxide and
  niacinamide pairs — bundled into the same sign-off as a single yes/no; implementation defaults to
  **excluding** PHA if this goes unanswered, rather than guessing → owner: product/clinical reviewer.

**Blast-radius note:** these severities are consumed by both the conflict-warning display *and* the
routine auto-scheduling engine (`routineEngine/resolve.ts`) — a pair marked `avoid`/`caution` can cause
the app to automatically split, freeze, or relocate steps in a user's routine, not just show a warning.
Full per-pair table with current shipped status is in
`progress/vials-conflict-matrix-expansion-handoff.json` and `docs/tech-design/vials-conflict-matrix-expansion.md` §5.
