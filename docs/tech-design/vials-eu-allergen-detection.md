# Technical Design: EU Fragrance Allergen Detection (Phase 1 — Original 26-Substance Seed)
Spec: docs/specs/vials-eu-allergen-detection.md
Author: planner-agent
Date: 2026-08-05

## AI-SDLC Flags
```
backend_layer:  false
frontend_layer: true
infra_changes:  false
```

## 1. Architecture Overview

New, list-agnostic module `src/utils/allergenDetector.ts` reads a bundled seed asset
(`assets/eu_allergens_seed.json`) and scans `Product.fullIngredientText` with lowercase-normalized,
comma-tokenized substring matching — simpler than `ingredientParser.ts`'s regex/potency matchers, since
the source brief says exact/near-exact matching is enough. Two new optional `Product` fields
(`detectedAllergens`, `allergenListVersion`) cache the last result; `getProductAllergenMatches(product)`
trusts that cache only when `allergenListVersion` equals the JSON's current `list_version`, else
recomputes live — so a future JSON swap (26→82) or a pre-existing product both self-heal with no
migration. Display reuses the existing `Badge` component (`BadgeStatus` already has `'Cobalt'`/`'Amber'`
wired to the right tokens) via a thin `AllergenBadge` wrapper that resolves Cobalt-vs-Amber once and
renders a fixed 28×28 circle — a restricted match forces Amber for the whole badge (product-owner
decision, same precedent as conflict severities picking the stronger tier for display).

```
Product.fullIngredientText --> detectAllergens(text)              [utils/allergenDetector.ts]
                                   reads assets/eu_allergens_seed.json (list_version + entries[])
   getProductAllergenMatches(product) -- cache-aware (allergenListVersion), else live re-scan
        --> DetectedAllergenMatch[] --> AllergenBadge (src/components/ui/AllergenBadge.tsx, wraps Badge)
                                           used by ProductShelfCard.tsx + RoutineStepCard.tsx
                                    --> ProductDetailScreen.tsx "Allergens" card (full list + copy)
```

**Coordination hazard:** `src/types/index.ts`, `src/utils/ingredientParser.ts`,
`src/constants/labels.ts`, and `src/screens/ManualProductFormScreen.tsx` are being worked on right now by
the concurrent `vials-conflict-matrix-expansion` engineer session on this same branch. State flipped
mid-write of this very doc: `git diff` first showed all four modified (`Product` ending with that task's
new `isPhysicalExfoliant?: boolean`); minutes later the tree showed clean — that session had run
`git stash` (`git stash list` → `conflict-matrix-expansion-verify`). Treat every fact in this section as
already stale: re-run `git status`, `git diff`, AND `git stash list` again immediately before engineering
starts, not once at design time — a popped stash reintroduces the exact same collision.

## 2. API Contracts

N/A — local-only Expo/RN app (AsyncStorage + Zustand), no backend/API layer exists in Phase 1
(`CLAUDE.md`). New type shapes are covered under Implementation Tasks with real file paths below.

## 3. Implementation Tasks

### engineer (scope=frontend)
- FE-1: Populate `assets/eu_allergens_seed.json` (new) with the 26-entry original EU Annex III seed —
  `{ list_version: "eu-annex-iii-original", entries: [{ canonical, synonyms[], cas[], restricted }] }`
  per source brief §1, `restricted: true` only for Lilial and Lyral/HICC (§1.1). Add a top-level
  `$comment` disclaimer mirroring `assets/brandDictionary/brandDictionary.json`'s precedent, marking
  synonyms/CAS unverified pending the sign-off gate (spec §10). Files: `assets/eu_allergens_seed.json`.
- FE-2: Add `DetectedAllergenMatch` (`{ canonical: string; restricted: boolean }`) to `src/types/index.ts`,
  plus `Product.detectedAllergens?: DetectedAllergenMatch[]` and
  `Product.allergenListVersion?: string | null`, appended strictly after the current last field in the
  live file — no reordering/reformatting of anything above it (§1). Files: `src/types/index.ts`.
- FE-3: Create `src/utils/allergenDetector.ts`: `detectAllergens(fullIngredientText: string | null):
  DetectedAllergenMatch[]` (list-agnostic, reads the FE-1 JSON, zero hardcoded allergen names);
  `EU_ALLERGEN_LIST_VERSION` (read from the JSON's own `list_version`, never hand-typed separately);
  `getProductAllergenMatches(product)` (cache-aware, §1); `hasRestrictedAllergenMatch(matches)`; plus the
  two neutral copy constants (Assumption 5). Pure module — no React/store/fetch imports. Files:
  `src/utils/allergenDetector.ts`.
- FE-4: Create `src/components/ui/AllergenBadge.tsx` — takes `matches: DetectedAllergenMatch[]`; `null`
  when empty, else `<Badge status={hasRestrictedAllergenMatch(matches) ? 'Amber' : 'Cobalt'} type="Light"
  style={circle}>A</Badge>`, `circle` fixing a 28×28 size (matches `RoutineStepCard.tsx`'s zap
  `activeBadge`) with centered content, overriding `Badge`'s default pill padding.
  `accessibilityLabel` distinguishes the restricted case; no press handler. Files:
  `src/components/ui/AllergenBadge.tsx`.
- FE-5: Wire `<AllergenBadge matches={getProductAllergenMatches(product)} />` into `ProductShelfCard.tsx`'s
  `typeRow`, beside the existing type `Badge`. Files: `src/components/product/ProductShelfCard.tsx`.
- FE-6: Wire the same call into `RoutineStepCard.tsx`'s `badgesRow`, after the existing zap actives badge.
  Files: `src/components/routine/RoutineStepCard.tsx`.
- FE-7: Add an "Allergens" card to `ProductDetailScreen.tsx` (same `card`/`cardHeader`/`cardIconCircle`
  recipe as "Active Ingredients"), positioned after "Active Ingredients" and before "Full Ingredient List",
  rendered only when `getProductAllergenMatches(product).length > 0`. Each row: canonical name + the
  shared neutral one-liner; `restricted: true` rows additionally show the shared banned-note. Files:
  `src/screens/ProductDetailScreen.tsx`.
- FE-8: In `buildProductFromDraft`, compute `detectAllergens(draft.inciRaw)` and set it on the returned
  `Product` as `detectedAllergens`, with `allergenListVersion: EU_ALLERGEN_LIST_VERSION`. Files:
  `src/utils/productForm/saveProduct.ts`.

### engineer (unit tests, scope=frontend)
- FE-9: `src/utils/allergenDetector.test.ts` — one passing match per seed entry (canonical form, plus a
  synonym form where the entry has one); zero matches for allergen-free INCI text and for `null`;
  `restricted` propagates correctly for Lilial/Lyral vs. every other entry; `getProductAllergenMatches`
  returns the cached value when `allergenListVersion` matches, and recomputes live when it's stale or
  absent; `hasRestrictedAllergenMatch` precedence; a structural test asserting none of the 26 canonical
  seed names appear as string literals anywhere in `allergenDetector.ts`'s own source (list-agnostic
  guard, mirrors the intent of `rulesetIntegrity.test.ts`).

## 4. Assumptions

- All new logic/constants live in brand-new files (`allergenDetector.ts`, `AllergenBadge.tsx`), never
  extending `conflictEngine.ts`, `ingredientParser.ts`, or `labels.ts`.
  Alternative: extend those modules, per the brief's literal "(or a sibling parser)" and `labels.ts`'s
  usual home for display strings.
  Reason: all three are live-edited by the concurrent session right now (§1) — zero collision beats
  marginal reuse; the brief already sanctions a sibling module.
- `Product` gains exactly two additive optional fields, appended after the current last field; no
  `isPersonal`-shaped extension point is added.
  Alternative: pre-shape the record for source brief §3.3's personal-allergen follow-up.
  Reason: product-owner decision — personal allergens are fully descoped; designing the shape around an
  unbuilt feature is exactly what was ruled out, and a minimal diff reduces merge collision (§1).
- `getProductAllergenMatches` trusts the cached `detectedAllergens` only when `allergenListVersion` equals
  the JSON's current `list_version`; otherwise it recomputes live from `fullIngredientText`.
  Alternative: treat a present cache as always-authoritative (no live fallback).
  Reason: gives the brief's own `list_version` rationale (distinguishing stale from current detections) a
  real effect — every product self-heals on a JSON swap or if it predates this field, with no migration.
- Cache writes are wired only into `buildProductFromDraft` (FE-8); `ManualProductFormScreen.tsx`'s save
  path is not wired in this pass.
  Alternative: wire both product-save call sites so the cache is always populated at write time.
  Reason: `ManualProductFormScreen.tsx` is also live-edited by the concurrent session (§1); the live
  fallback above means correctness is unaffected — just recomputed instead of cached. Non-blocking
  follow-up.
- One shared neutral one-liner for all non-restricted entries, one shared restricted-note line — not 26
  hand-authored blurbs; FE-1's actual synonym/CAS values are populated by engineer from the brief's
  already-vetted name/restricted-flag list, not hand-authored by this planning pass.
  Alternative: unique copy per entry; planner pre-fills final CAS/synonym values now.
  Reason: the brief's own example line is generic/reusable; per-substance CAS accuracy is exactly what the
  GATED sign-off (spec §10) exists to check — authoring it here would front-run that gate.
- `AllergenBadge` wraps `Badge` (reusing its `Cobalt`/`Amber` token wiring) instead of hand-rolled colors,
  and is non-interactive.
  Alternative: bespoke component with its own styles, or inline a duplicate badge in each card (mirroring
  how the zap actives-badge is itself inlined, not extracted).
  Reason: `BadgeStatus` already maps `'Cobalt'`/`'Amber'` to exactly the right tokens, so reuse satisfies
  the no-hardcoded-color rule for free and avoids duplicating the precedence logic twice. No tooltip:
  unlike actives (which resolve a regional-alias ambiguity via `AttributionTooltip`), allergen names match
  near-exactly, and spec §5 keeps the card badge textless by design.
- Product detail screen's "Allergens" card shows an un-truncated plain list (no accordion widget), only
  when ≥1 match, placed between "Active Ingredients" and "Full Ingredient List".
  Alternative: build a literal collapsible/expandable accordion for source §3.2's "expandable list"
  wording.
  Reason: "expandable" read as "not truncated" (contrast with the card's deliberately-truncated badge),
  matching how "Active Ingredients" already renders its full tag list with no accordion.

## 5. Open Questions

- [ ] **GATED — pending regulatory-literate human verification before release**, same gate as
  `docs/tech-design/vials-conflict-matrix-expansion.md`'s pending clinical sign-off: FE-1's seed content
  (names/synonyms/CAS) is assembled from secondary sources plus the EMA appendix/SCCNFP opinion, not yet
  confirmed against the official regulation text. The mechanism (FE-2..FE-9) is implementable and
  testable now; the data must not be represented as release-ready until sign-off lands → owner: product
  owner (regulatory-literate reviewer to be assigned).
