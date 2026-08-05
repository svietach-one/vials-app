# EU Fragrance Allergen Detection (Phase 1 — Original 26-Substance Seed)
Date: 2026-08-05
Author: planner-agent
Jira: N/A (kebab-case task slug per agent-layer-protocol.md: `vials-eu-allergen-detection`)
Status: DRAFT

## AI-SDLC Flags
```
backend_layer:  false
frontend_layer: true
infra_changes:  false
```

## 1. Problem Statement

Users currently have no way to know, from inside Vials, whether a product they own contains an
EU-regulated fragrance allergen. Fragrance is present in most cosmetic products, and a defined set of its
allergenic components must be individually declared on EU labels above a concentration threshold — but
Vials' catalog, routine cards, and product detail screen today surface only active-ingredient tags and
PAO/expiry state, with no equivalent signal for these declared allergens. A user with a known fragrance
sensitivity, or one who is simply label-conscious, has to read and cross-reference the full INCI text
themselves for every product, even though the app already captures and displays that text.

## 2. Goals

- Every product's `fullIngredientText` is scanned against a bundled, swappable list of EU-regulated
  fragrance allergens, with zero hardcoded allergen names in the detection code.
- A user can tell, at a glance from the catalog card or a routine card, whether a product contains ≥1
  matched allergen, without any extra taps.
- A user can see the exact matched allergen name(s) and a short neutral explanation on the product's
  detail screen.
- A product containing a `restricted: true` entry (Lilial, Lyral/HICC — banned in new EU products since
  2021–2022) is visually distinguishable from a product with only ordinary allergen matches, because a
  restricted match is a genuinely actionable "this may be aged stock, check expiry" signal, not merely
  informational.
- The seed list can later be swapped for the full 82-substance Annex III list with a JSON edit only — no
  code change.

## 3. Non-Goals (explicitly out of scope)

- **Personal allergens** (marking specific allergens as personally relevant in `profileStore`, Cabernet
  rendering for a personal match). Fully descoped from this task by product-owner decision. The
  detected-allergen data shape introduced here is a plain per-product fact (which allergens are present,
  and whether restricted) with no per-user dimension — it is deliberately NOT shaped to anticipate a
  future `isPersonal` flag, since designing around an unbuilt feature is exactly what was ruled out.
  Separate follow-up task, not started here.
- **Expanding to the full 82-substance Annex III list.** This task ships the original/legacy 26-substance
  seed only. Swapping the JSON and bumping `list_version` is an explicitly separate, data-only follow-up
  (source brief §5), including the "group name" (one label covering multiple CAS substances) complexity
  the 82-list introduces, which the original 26-item set does not have.
- **Treating the seed list as final / release-ready.** The mechanism and seed content are built and
  shipped to the codebase now, but the specific allergen names, synonyms, and CAS numbers are NOT to be
  treated as verified until a regulatory-literate human explicitly signs off — see §10 and the GATED
  criterion under Story 4. Mirrors the pending-sign-off gating pattern already used in
  `docs/tech-design/vials-conflict-matrix-expansion.md` for its own `pairRules` severities.
- **A hazard/risk score, or any framing beyond "this is a legally declared fragrance component."** These
  are legal, common cosmetic ingredients — the badge and detail copy are neutral information, not a
  warning about danger.
- **Fuzzy/trigram matching.** Allergen label names are standardized; exact/near-exact, lowercase-normalized
  matching is sufficient (mirrors `parseActiveIngredientsFromInci`'s approach, not the fuzzy OCR
  brand-matching layer).
- **An "attribution tooltip" for allergen matches** (the "which raw label text matched" popover that
  active-ingredient badges have). Allergen names match near-exactly; there is no regional-alias ambiguity
  to resolve for this feature in Phase 1.

## 4. User Stories

### Story 1: Spotting a fragrance allergen at a glance
As a user browsing my catalog or a routine, I want to see a small, unobtrusive badge on any product
containing an EU-regulated fragrance allergen, so I can notice it without leaving the list.

**Acceptance Criteria:**
- [ ] Given a product whose `fullIngredientText` contains the canonical name or a synonym of ≥1 seed
  allergen entry (all `restricted: false`), when the catalog card or a routine card renders, then a small
  round "A" badge appears in Cobalt, with no count and no text alongside it.
- [ ] Given a product whose `fullIngredientText` matches zero seed allergen entries, when the catalog card
  or a routine card renders, then no allergen badge appears at all (not an empty/hidden badge slot).
- [ ] Given a product with no `fullIngredientText` (null), when the catalog card or a routine card
  renders, then no allergen badge appears.

### Story 2: Restricted entries read as more actionable than ordinary matches
As a user, I want a product containing a since-banned fragrance allergen (Lilial or Lyral/HICC) to look
visually different from a product with only ordinary allergen matches, so I get a hint that the product
might be older stock worth checking for expiry.

**Acceptance Criteria:**
- [ ] Given a product matching ≥1 entry with `restricted: true`, when the catalog card or a routine card
  renders, then the single "A" badge renders in Amber, not Cobalt — regardless of how many other,
  non-restricted entries also matched on the same product (restricted takes visual precedence; one badge,
  never two).
- [ ] Given a product matching only entries with `restricted: false`, when the catalog card or a routine
  card renders, then the badge renders in Cobalt.
- [ ] Given a product with zero matches, when rendered, then there is no severity to resolve — no badge
  (Story 1, case 2).

### Story 3: Seeing the full matched list and what it means
As a user who taps into a product, I want to see exactly which allergens were detected and a short,
neutral explanation, so I understand what the catalog badge was referring to.

**Acceptance Criteria:**
- [ ] Given a product with ≥1 matched allergen, when I open its product detail screen, then I see an
  "Allergens" section listing every matched entry's canonical name, each with a short neutral one-line
  description (e.g. "Fragrance component regulated in the EU as a potential allergen.").
- [ ] Given a product with zero matched allergens, when I open its product detail screen, then no
  "Allergens" section appears.
- [ ] Given a matched entry with `restricted: true`, when I view it in the "Allergens" section, then I
  additionally see a short neutral note that it is no longer permitted in new EU products (banned
  2021–2022), without hazard/danger framing.

### Story 4: The list can grow without a code change
As the team maintaining Vials, I want the allergen list to live entirely in a bundled JSON file, so that
expanding from the original 26 to the full 82-substance Annex III list later is a data edit, not an
engineering task.

**Acceptance Criteria:**
- [ ] Given the detection code in `src/utils/allergenDetector.ts`, when I search it for any of the 26
  seed allergen names, then none appear as string literals — every name is read from the bundled JSON at
  runtime.
- [ ] Given a product whose stored `allergenListVersion` does not match the JSON's current `list_version`
  (or is absent), when its allergen matches are read, then they are recomputed live from
  `fullIngredientText` rather than trusting a stale cached value.
- [ ] **GATED — pending regulatory-literate human verification before release.** Given the seed JSON is
  bundled and detection is wired end-to-end, when this task is marked complete for engineering purposes,
  then the seed's allergen names/synonyms/CAS data is still explicitly flagged as unverified against the
  official regulation text (Regulation (EC) No 1223/2009 Annex III) and MUST NOT be represented as
  release-ready until a regulatory-literate reviewer signs off (same gate as
  `docs/tech-design/vials-conflict-matrix-expansion.md`'s pending clinical sign-off).

## 5. UX / Behaviour

**Catalog card (My Shelf) and routine card:** a 28×28 circular badge — same size/shape as the existing
lightning-bolt "actives" indicator on the routine card — showing a bold "A" glyph. Cobalt fill/text for an
ordinary match, Amber fill/text when any matched entry on that product is `restricted: true`. No count, no
label text next to it. Non-interactive (tapping it does nothing extra; the surrounding card already
navigates to the product detail screen). Absent entirely — not a faded/empty circle — when a product has
zero matches.

**Product detail screen:** a new "Allergens" card (same visual recipe as the existing "Active
Ingredients"/"Full Ingredient List" cards — icon circle, title, content), positioned after "Active
Ingredients" and before "Full Ingredient List". Only rendered when there is ≥1 match. Each matched
allergen renders as its canonical name plus the shared neutral one-liner; `restricted: true` entries
additionally show the neutral "no longer permitted in new EU products" note. Not a collapsible/accordion
widget — the full list always renders, same as the existing "Active Ingredients" tag list.

**No loading state** — detection runs synchronously against already-loaded, on-device data (no network
call). **No error state** — a product with unparseable or missing `fullIngredientText` simply yields zero
matches, which is indistinguishable from "genuinely has none" and requires no special-cased messaging.

## 6. Data Requirements

- New data needed: a bundled seed file `assets/eu_allergens_seed.json` (`list_version` + array of
  `{ canonical, synonyms[], cas[], restricted }` entries, per source brief §1) for the original 26 EU
  Annex III fragrance allergens. Two new optional fields on `Product` (`detectedAllergens`,
  `allergenListVersion`) cache the last-computed match result and the list version it was computed
  against.
- Existing data consumed: `Product.fullIngredientText` (already collected today via OCR/paste/manual
  entry) is the sole input to detection — no new user-facing data entry.
- Data retention: identical to the rest of the product record — local, on-device only (AsyncStorage), no
  new retention policy, no data leaves the device.

## 7. Dependencies

- Depends on spec: none. Builds on the already-shipped product catalog / INCI-text capture; no other
  in-flight spec is a prerequisite.
- Blocks: the future "expand to 82-substance Annex III list" follow-up (source brief §5) depends on this
  task's list-agnostic mechanism shipping first.
- External services: none. Detection is fully local, synchronous, and offline — no third-party API.

## 8. Security & Privacy

- Authentication required: no (the app has no accounts in Phase 1).
- Data sensitivity: none new. The seed list is a public regulatory reference table bundled with the app;
  per-product match results are a plain product attribute, not health data about the user (this task does
  not touch personal-allergen/user-health data — see Non-Goals).
- Compliance considerations: none new. No data leaves the device. The feature is itself a small step
  toward the EU's cosmetic-allergen labelling intent, applied to a product a user already owns.

## 9. Success Metrics

The app has no production install base and no in-feature analytics pipeline yet (same baseline as the
sibling `vials-conflict-matrix-expansion` task), so success is measured as engineering/QA completeness:
- 100% of the 26 seed allergen entries have at least one passing detection test against a representative
  INCI string (canonical name, plus a synonym form for entries that have one).
- Zero hardcoded allergen-name string literals in `src/utils/allergenDetector.ts` (structural test,
  Story 4).
- `npx tsc --noEmit` and the full `npm test` suite are clean, per `.claude/rules/testing.md`.

## 10. Open Questions

- [ ] **GATED — pending regulatory-literate human verification before release.** The seed JSON's specific
  allergen names, synonyms, and CAS numbers are assembled from multiple secondary sources plus the EMA
  appendix and SCCNFP opinion (source brief §1), not yet confirmed against the official Regulation (EC)
  No 1223/2009 Annex III text. The mechanism (detection, badge, detail screen) is implemented and testable
  now; the seed content must NOT be treated as final or release-ready until this sign-off lands → owner:
  product owner (regulatory-literate reviewer to be assigned), same gating pattern as
  `docs/tech-design/vials-conflict-matrix-expansion.md`'s pending clinical sign-off on `pairRules`
  severities.
