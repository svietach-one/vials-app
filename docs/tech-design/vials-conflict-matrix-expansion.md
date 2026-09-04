# Technical Design: Ingredient Conflict Matrix Expansion
Spec: docs/specs/vials-conflict-matrix-expansion.md
Author: tech-designer
Date: 2026-08-04

## AI-SDLC Flags
```
backend_layer:  false
frontend_layer: true
infra_changes:  false
```

## 1. Architecture Overview

The source brief (`docs/tasks/vials-conflict-matrix-expansion-task.md`) describes `conflictEngine.ts` as
holding a hardcoded 4-tag/6-pair matrix plus a `parseInciTags` function. Neither exists anymore. Conflict
data now lives entirely in `ACTIVES_RULESET.pairRules` (`src/constants/rulesets/actives.json`, typed by
`rulesetTypes.ts`), and INCI detection is per-class regex `matchers` in the same file, run by
`parseActiveIngredientDetails`/`getProductActiveKeys` (`src/utils/ingredientParser.ts`). `benzoyl_peroxide`
and `niacinamide` already exist as canonical `ActiveIngredientKey` classes with working matchers — the
brief's "add BPO/NIAC parsing" ask is already shipped. `ConflictSeverity` is `'avoid' | 'caution'` (two
tiers), not High/Medium/Low.

`pairRules` feeds two consumers, not one: `ConflictEngine` (`conflictEngine.ts`, rendered by
`ConflictWarningInline.tsx` on the Routines screen) and the routine-generation engine
(`routineEngine/resolve.ts`'s `findPairViolations`/`resolvePeriods`), which auto-splits days, freezes, or
relocates steps around a pair rule. New pairs therefore change auto-generated routine composition, not
just warning display — a materially larger blast radius than the brief's "existing amber styling, no new
color" framing assumes.

```
Product{fullIngredientText, activeTags, isPhysicalExfoliant} -> getProductActiveKeys()
   -> ActiveIngredientKey[] -> ConflictEngine.matchPairRule()        [display]
                             -> routineEngine/resolve.ts findPairViolations()  [scheduling]
        both read ACTIVES_RULESET.pairRules (actives.json) — single source, never duplicated
```

## 2. API Contracts

N/A — local-only Expo/RN app (AsyncStorage + Zustand), no backend/API layer exists in Phase 1
(`CLAUDE.md`). Data-shape changes are covered under Implementation Tasks with real file paths below.

## 3. Implementation Tasks

### engineer (scope=frontend)
- FE-1: Add `'physical_exfoliant'` to `ActiveIngredientKey` and `isPhysicalExfoliant?: boolean` to
  `Product` (flag-only signal, never derived from INCI text — mirrors the brief's `EXFOL_PHYS` intent).
  Files: `src/types/index.ts`.
- FE-2: In `getProductActiveKeys()`, add `'physical_exfoliant'` to the returned key set whenever
  `product.isPhysicalExfoliant === true`, alongside the existing `activeIngredients`/`activeTags`/parsed-
  INCI union — never sourced from `parseActiveIngredientsFromInci`. Files: `src/utils/ingredientParser.ts`.
- FE-3: Add a `physical_exfoliant` entry to `actives.json`'s `classes` (properties/`allowedPeriods` only,
  zero INCI matchers — it must never regex-match) so it can appear in `pairRules` through the existing
  mechanism instead of a second, parallel rule table. Extend `rulesetIntegrity.test.ts`'s "every class
  declares ≥1 matcher" rule with one explicit, named, documented exemption for this key (not a blanket
  weakening). Files: `src/constants/rulesets/actives.json`, `src/utils/routineEngine/rulesetIntegrity.test.ts`.
- FE-4 (BLOCKED — do not implement until §5's bounded decision list is answered): add the approved
  `pairRules` entries at the confirmed severities, using the real class keys from the reconciliation table
  in §5. Default to excluding `pha` from the new `benzoyl_peroxide`/`niacinamide` acid pairs unless the
  reviewer explicitly opts it in (§5 item 5). Files: `src/constants/rulesets/actives.json`.
- FE-5 (UNBLOCKED 2026-08-05 — no third tier, see §5 decision 1): Add severity-driven copy prefixes to
  `ConflictRow` in `ConflictWarningInline.tsx` — exactly two prefixes, "Strong conflict — " for `avoid`,
  "Possible conflict — " for `caution` (today the row renders `rule.explanation` verbatim with no
  severity-derived prefix at all). Keep `tone="warning"` (amber) unchanged for every severity — no new
  color, no third prefix. Files: `src/components/routine/ConflictWarningInline.tsx`.
- FE-6: Add a "Physical exfoliant" `Switch` toggle to `ManualProductFormScreen.tsx`, near the
  ingredients/usage section, mirroring the existing `OpenedDateField`/`isOpened` `Switch` pattern; wire to
  `Product.isPhysicalExfoliant` on load/save. `AddProductScreen`'s wizard (`AddProductDraft`) is explicitly
  out of scope this pass (Assumption 4). Files: `src/screens/ManualProductFormScreen.tsx`.

### engineer (unit tests, scope=frontend)
- FE-7: `ingredientParser.test.ts` — `isPhysicalExfoliant: true` yields `'physical_exfoliant'` in
  `getProductActiveKeys()` regardless of ingredient-text content; `false`/absent never does, even when the
  INCI text contains exfoliant-sounding terms.
- FE-8: `conflictEngine.test.ts` — full before/after snapshot of the 6 pre-existing pairs (exact severity
  + explanation + suggestion) — UNBLOCKED, proceeds now. The second half (one test per newly-approved
  pair) stays BLOCKED alongside FE-4 until §5's bounded decision list is answered.
- FE-9: `rulesetIntegrity.test.ts` — confirm the new matcher exemption covers only `physical_exfoliant`;
  every other class still requires ≥1 real matcher.

## 4. Assumptions

- Brief's short tags map onto real canonical classes: `RETI`=`retinoid`, `BPO`=`benzoyl_peroxide`,
  `NIAC`=`niacinamide` (1:1, already shipped/parsed).
  Alternative: reintroduce short-key aliases as a parallel taxonomy.
  Reason: the 2026-07-17 ruleset migration retired short tags (`legacyKeyMap` normalizes old ones); a new
  alias layer would fork `ActiveIngredientKey`.
- Brief's `High`/`Medium` map onto the shipped two-tier `ConflictSeverity` (`avoid`≈High, `caution`≈Medium)
  — the same equivalence already documented for `AdvisorySeverity` elsewhere in the codebase.
  Alternative: add numeric sub-tiers inside `avoid`/`caution`.
  Reason: keeps the matrix on its one existing scale; avoids touching phototype-escalation logic that
  hardcodes a binary `caution`→`avoid` step.
- Brief's `PEPT` maps to `copper_peptides` only (never `peptide_signal`/`peptide_neuro`) for any pair this
  task adds.
  Alternative: apply new PEPT pairs to all three peptide classes.
  Reason: 100% precedent — every existing PEPT-adjacent rule and every asserted-compatible pair in
  `rulesetIntegrity.test.ts` already scopes "peptide conflicts" to `copper_peptides` alone.
- `isPhysicalExfoliant` toggle ships only on `ManualProductFormScreen.tsx`, not `AddProductScreen`'s
  wizard.
  Alternative: add it to `AddProductDraft`/`buildProductFromDraft` too.
  Reason: `ManualProductFormScreen` is reachable for every product (edit action from
  `CatalogScreen`/`ProductDetailScreen`, plus corpus-prefill/blank-manual creation), so the flag stays
  settable for any product; keeps the touched surface to what the brief scoped ("ProductForm").
- `isPhysicalExfoliant` is a plain boolean flag, not a dedicated `ProductType` value (RESOLVED 2026-08-05,
  product decision, no clinical input needed).
  Alternative: model it as a `ProductType`/category instead.
  Reason: physical-exfoliant-ness is orthogonal to product type — a cleanser, toner, or scrub can each be
  abrasive or not — the same relationship the existing `sensitive` flag already has to skin type. Non-
  blocking gap filed (not a blocker for this task): how the flag gets populated for non-manual, API/DB-
  sourced products is unresolved, since INCI text generally can't reveal abrasive particles; the manual-
  form path this task ships is unaffected.
- The brief's third "Low" severity tier is dropped; every pair this task adds resolves onto the existing
  two-tier `ConflictSeverity` only (RESOLVED 2026-08-05, product decision, no clinical input needed).
  Alternative: extend `ConflictSeverity` to a 3-tier scale to give "Low" a real home.
  Reason: architecture-consistency call — the shipped scale is documented as deliberately never extended
  to a third tier (phototype escalation hardcodes a binary `caution`→`avoid` step); "Low" was a copy
  nuance drafted against the brief's imagined 3-tier matrix, not a clinical distinction, so nothing
  clinical is lost by collapsing it into `caution`. A softer visual treatment within `caution` remains
  open as a future display-only follow-up, not a data-model change.
- `physical_exfoliant` becomes a real (matcher-less) `actives.json` class rather than a second rule table.
  Alternative: a separate physical-exfoliant-only table, e.g. in `conflictRulesDb.ts`.
  Reason: `conflictRulesDb.ts` itself documents that ingredient pair rules were deliberately consolidated
  into `actives.json` as the one source "never duplicated"; forking that for one class would reintroduce
  exactly the split the codebase already retired.

## 5. Open Questions

Three of the original four open questions are RESOLVED (2026-08-05, product decision) and no longer block
implementation: **Low severity tier** dropped, no third tier (§4 Assumptions; FE-5 unblocked).
**`isPhysicalExfoliant`** confirmed as a flag (§4 Assumptions; FE-1/2/3/6 unblocked). **`pha` inclusion**
folded into the bounded decision list below as a single yes/no, defaulting to exclude if unanswered.

**Still blocked (Type A/D per `.claude/rules/tech-design-template.md`'s gap table):** the actual
`pairRules` severities/existence (FE-4) and the corresponding new-pair tests (second half of FE-8), owner
product/clinical reviewer, same gate as `PRD_Spec.md` §6. Bounded decision list, not an open audit — every
row needs "confirm" or "correct," nothing more. Full table (brief's claim vs. real class keys vs. shipped
status vs. the ask) lives in `progress/vials-conflict-matrix-expansion-handoff.json` under
`still_blocked.bounded_decision_list`, to avoid duplicating a 13-row table in two documents.

> **Blast-radius note for the reviewer:** `pairRules` entries are not display-only. They're read directly
> by `routineEngine/resolve.ts` (`findPairViolations`/`resolvePeriods`), which auto-splits routine days,
> freezes steps, or relocates products around any pair marked `avoid`/`caution`. A severity choice changes
> what the app automatically does to a user's routine, not just what warning text they see — if this
> matrix was previously reviewed as display-only, that assumption no longer holds.

Two rows are flagged **priority review** (do not batch-approve alongside the rest): `copper_peptides`+
`benzoyl_peroxide` and `benzoyl_peroxide`+`niacinamide` — lowest-confidence per source brief §7.3. Two
rows need only retroactive confirmation, not fresh approval, since they're already shipped:
`benzoyl_peroxide`+`retinoid` (`avoid`) and `vitamin_c_derivative`+`benzoyl_peroxide` (`caution`).
