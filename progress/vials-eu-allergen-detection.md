Status: ACCEPTED (engineering complete; release still GATED on regulatory sign-off)
Tech Design: docs/tech-design/vials-eu-allergen-detection.md
Code: assets/eu_allergens_seed.json (new), src/types/index.ts (FE-2 additive),
src/utils/allergenDetector.ts (new, FE-3), src/utils/allergenDetector.test.ts (new, FE-9),
src/components/ui/AllergenBadge.tsx (new, FE-4), src/components/product/ProductShelfCard.tsx (FE-5),
src/components/routine/RoutineStepCard.tsx (FE-6), src/screens/ProductDetailScreen.tsx (FE-7),
src/utils/productForm/saveProduct.ts (FE-8)

## Карточка задачи
- [x] Product requirements (planner)
- [x] Technical design (planner)
- [x] QA tests (qa-lead)
- [x] Implementation (engineer)
- [x] Architecture review (tech-lead) — ACCEPT, 1 non-blocking follow-up logged
- [ ] GATED — regulatory-literate human verification of `assets/eu_allergens_seed.json` content, required
  before this feature is treated as release-ready (does NOT block development/QA/implementation — see
  spec §10, tech design §5, handoff.json `release_gate`)

## Log

2026-08-05 — planner: Read the source brief (`docs/tasks/vials-eu-allergen-detection-task.md`) plus
current `src/types/index.ts`, `src/utils/ingredientParser.ts`, `src/utils/conflictEngine.ts`,
`src/constants/tokens.ts`, `RoutineStepCard.tsx` (lightning-bolt "zap" actives badge — confirmed via grep
the ONLY `zap`-icon usage in the codebase: 28×28 circular, `colors.surfaceSunken` fill, tappable for
`AttributionTooltip`), `ProductShelfCard.tsx` (catalog card — actives render as text `Badge` pills, not a
circular glyph), `ProductDetailScreen.tsx`, `Badge.tsx` (confirmed `BadgeStatus` already defines
`'Cobalt'`/`'Amber'` variants wired to exactly `statusInfoTint`/`statusInfo` and
`statusWarningTint`/`statusWarning` — reused directly instead of hand-rolling new badge colors),
`productsStore.ts`, `saveProduct.ts`/`buildProductFromDraft`, `assets/brandDictionary/brandDictionary.json`
(precedent for a bundled, independently-updatable JSON seed with an unverified-content `$comment`
disclaimer — mirrored for the new seed file), and the sibling `docs/tech-design/vials-conflict-matrix-
expansion.md` + `progress/vials-conflict-matrix-expansion.md` for its gated-sign-off wording pattern,
before writing the spec and tech design.

Four scope decisions were already made by the product owner in a prior clarifying-questions round (not
re-asked here, baked directly into both docs):
1. Personal allergens (source §3.3) — fully descoped. The new `DetectedAllergenMatch`/`Product` fields are
   a plain per-product fact with no per-user dimension, deliberately not shaped for a future `isPersonal`
   flag. Filed as a follow-up in spec Non-Goals and handoff.json `non_goals_follow_up`.
2. Restricted entries (Lilial, Lyral/HICC) — SHOW the banned-in-new-products note, render Amber (not
   Cabernet); Amber takes visual precedence over Cobalt when a product has both restricted and
   non-restricted matches (one badge, singular, per source §3.1 — resolved explicitly in tech design §1
   and spec Story 2 rather than left open).
3. Seed verification — mechanism + seed JSON are built and shipped now; content is explicitly GATED
   pending regulatory-literate human sign-off before release. Filed in spec §10 + Story 4's AC, and
   mirrored in handoff.json `release_gate`, same wording pattern as the sibling conflict-matrix-expansion
   task's pending clinical sign-off gate.
4. CRITICAL coordination hazard — the concurrent `vials-conflict-matrix-expansion` engineer session is
   active on this same branch/working tree, mid-edit on `src/types/index.ts`, `src/utils/ingredientParser.ts`,
   `src/constants/labels.ts`, and `src/screens/ManualProductFormScreen.tsx`. Confirmed via live `git diff`
   immediately before writing the tech design's data-model section — and the state actually FLIPPED mid-
   session: a `git diff` first showed all four modified (`Product` ending with that task's new
   `isPhysicalExfoliant?: boolean`); minutes later, before this doc was finished, the tree showed clean
   because that session ran `git stash` (`git stash list` → `conflict-matrix-expansion-verify`). This is
   direct, empirical confirmation of exactly the risk flagged — a static read cannot be trusted. Tech
   design §1 documents this explicitly and instructs re-verifying `git status`/`git diff`/`git stash list`
   again immediately before engineering starts, not once at design time. All new logic/constants were
   designed to live in brand-new files (`src/utils/allergenDetector.ts`, `src/components/ui/AllergenBadge.tsx`,
   `assets/eu_allergens_seed.json`) specifically to avoid all four files; the only unavoidable touch is two
   additive fields appended to the end of `Product` in `src/types/index.ts` (tech design FE-2). See
   handoff.json `coordination_hazard` for the field-level restatement.

Key design decisions (tech design §1/§4): `AllergenBadge` wraps the existing `Badge` component (reuses its
already-defined `Cobalt`/`Amber` token wiring) rather than inventing new colors; `getProductAllergenMatches`
is cache-aware with a live fallback keyed on `allergenListVersion` vs. the JSON's own `list_version`, so a
future 26→82 JSON swap or a pre-existing product both self-heal with no migration pass; the cache write is
wired only into `buildProductFromDraft` (the wizard path) and deliberately NOT into
`ManualProductFormScreen.tsx` (coordination hazard above) — correctness is unaffected since the live
fallback means every product still renders the right badge either way, just recomputed instead of cached.
Actual seed JSON content (synonyms/CAS per entry) is left as an engineer task (FE-1), sourced from the
brief's already-vetted name/restricted-flag list, not hand-authored in this planning pass — see tech
design Assumptions for why.

No open product/business questions block implementation — ready for qa-lead. The one open item (GATED
regulatory verification) blocks RELEASE, not development; see spec §10 and handoff.json `release_gate`.

2026-08-05 — qa-lead: Wrote component/integration tests under `tests/vials-eu-allergen-detection/`
BEFORE any production code exists, per tech design §3 FE-4/FE-5/FE-6/FE-7 (FE-9's
`allergenDetector.test.ts` is explicitly engineer-owned, per `.claude/rules/testing.md`'s
unit-vs-component split, and is NOT duplicated here). Re-checked `git status` immediately
before starting per the tech design's coordination-hazard instruction: `src/types/index.ts`
was clean (not mid-edit) at read time, and `src/screens/ManualProductFormScreen.tsx` (out of
this task's FE list) was NOT touched.

Files written:
- `tests/vials-eu-allergen-detection/fixtures.ts` — typed `DetectedAllergenMatch` /
  `Product` factories (`makeProduct`, `NON_RESTRICTED_MATCH_A/B`, `RESTRICTED_MATCH_LILIAL`,
  `RESTRICTED_MATCH_LYRAL`), a `ProductShelfCardProps` factory, and two render-tree order
  helpers (`collectTestIdOrder`, `collectTextOrder`) used to assert relative render order
  without pixel-layout assertions.
- `AllergenBadge.test.tsx` (FE-4) — standalone component contract: `testID="allergen-badge"`,
  28×28 fixed size, Cobalt (statusInfoTint) for ≥1 non-restricted match, Amber
  (statusWarningTint) taking precedence whenever any match is restricted (single badge, never
  two), absent entirely (not an empty node) for zero matches, and a restricted-vs-non-restricted
  accessibilityLabel distinction (exact copy left open — only the distinguishing behavior is
  contractual).
- `ProductShelfCard.allergen-badge.test.tsx` (FE-5) — full Cobalt/Amber/no-badge matrix wired
  into the shelf card, including "no badge when fullIngredientText is null" (Story 1 AC3).
  `@/utils/allergenDetector` mocked as a passthrough of `product.detectedAllergens` so this
  suite is independent of the actual INCI-scanning algorithm (FE-9's scope).
- `RoutineStepCard.allergen-badge.test.tsx` (FE-6) — wiring-only: one Cobalt case, one Amber
  case, one zero-match case, plus a render-order assertion that the allergen badge follows the
  existing `active-badge-${key}` zap badge in the badges row (not a full color-matrix repeat).
- `ProductDetailScreen.allergens-card.test.tsx` (FE-7) — "Allergens" card presence only when
  ≥1 match; every matched canonical name listed with the shared neutral one-liner (adopted
  verbatim from the spec's own quoted example, "Fragrance component regulated in the EU as a
  potential allergen.", since the spec quotes it exactly rather than leaving it open);
  restricted entries additionally show a banned-in-new-products note (asserted by regex only —
  spec paraphrases this line, doesn't quote it verbatim, so exact wording is left to the
  engineer); card absent entirely on zero matches; and a render-order assertion placing
  "Allergens" strictly between "Active Ingredients" and "Full Ingredient List".

Verification — `npx tsc --noEmit`: 20 errors, ALL inside the 4 new test files above, and every
one directly attributable to the two still-missing production pieces (`DetectedAllergenMatch` /
`Product.detectedAllergens` from FE-2, `AllergenBadge` from FE-4) — zero errors anywhere else in
the tree (confirmed via `grep -v vials-eu-allergen-detection` on the tsc output). Verification —
`npx jest --testPathIgnorePatterns="worktrees" --testPathPattern="tests/vials-eu-allergen-detection"`:
all 4 suites fail to resolve ("Configuration error: Could not locate module @/utils/allergenDetector"
/ "@/components/ui/AllergenBadge"), 0 tests ran — expected red, same documented moduleNameMapper
behavior as `tests/inci-attribution-highlighting/DetectedActiveBadgeWiring.test.tsx`'s
`aliasOverrides.json` mock: a `jest.mock('@/...')` (or a real import) of a not-yet-existing file
under the `@/` alias fails to resolve entirely, regardless of the mock factory, until the engineer
creates the real file — at which point these tests start actually running with no test-file change
required. No production `src/` files were touched.

2026-08-05 — engineer: Implemented FE-1..FE-9 per the tech design. Re-verified the coordination hazard
immediately before touching `src/types/index.ts` (`git status`/`git diff`/`git stash list`): state was
identical to the tech design's snapshot — `isPhysicalExfoliant?: boolean` was still the live last field of
`Product`, no new stash — so the two new fields (`detectedAllergens`, `allergenListVersion`) were appended
strictly after it, plus the new `DetectedAllergenMatch` interface directly below `Product`'s closing brace.
Did not touch `src/utils/ingredientParser.ts`, `src/constants/labels.ts`, or
`src/screens/ManualProductFormScreen.tsx`, per the tech design's out-of-scope list.

Files created: `assets/eu_allergens_seed.json` (FE-1, 26 entries, `restricted: true` only on
"Butylphenyl Methylpropional"/Lilial and "Hydroxyisohexyl 3-Cyclohexene Carboxaldehyde"/Lyral-HICC,
`$comment` disclaimer mirroring `brandDictionary.json`'s unverified-seed pattern), `src/utils/allergenDetector.ts`
(FE-3), `src/utils/allergenDetector.test.ts` (FE-9, 88 tests), `src/components/ui/AllergenBadge.tsx` (FE-4).
Files modified: `src/types/index.ts` (FE-2, additive only), `src/components/product/ProductShelfCard.tsx`
(FE-5), `src/components/routine/RoutineStepCard.tsx` (FE-6), `src/screens/ProductDetailScreen.tsx` (FE-7),
`src/utils/productForm/saveProduct.ts` (FE-8).

Two deviations from the tech design, both logged here per architecture-review.md's rule:
1. **Detection algorithm — exact-token matching instead of whole-text substring matching.** While writing
   FE-9's per-entry tests I found that a naive `haystack.includes(name)` substring scan (as literally
   described in tech design §1/source brief §2) double-matches certain entry pairs where one seed name is,
   word-for-word, a substring of a different, more specific seed entry's own name (e.g. one 2-word entry
   contains a separate 1-word entry's full name as its second word) — a single printed ingredient would
   incorrectly register as two separate allergen matches. Fixed by comma-tokenizing `fullIngredientText`
   (same tokenization `parseActiveIngredientsFromInci` already uses) and matching on EXACT normalized-token
   equality instead of substring-anywhere-in-text. Still "exact/near-exact, no fuzzy/trigram" per spec Non-
   Goals — just token-scoped rather than whole-text-scoped. Regression-tested explicitly in
   `allergenDetector.test.ts`'s "exact-token matching avoids substring collisions" suite.
2. **Shared copy constants moved from `allergenDetector.ts` to `ProductDetailScreen.tsx`.** Tech design
   FE-3 lists "the two neutral copy constants" as living in `allergenDetector.ts`. qa-lead's
   `ProductDetailScreen.allergens-card.test.tsx` (written first, binding per the handoff) mocks
   `@/utils/allergenDetector` as `{ getProductAllergenMatches, hasRestrictedAllergenMatch }` only — any
   other export from that module resolves to `undefined` under that mock and crashes the screen at render
   time. Since `ProductDetailScreen.tsx` is the copy's only consumer, the two constants
   (`ALLERGEN_NEUTRAL_COPY`, `ALLERGEN_RESTRICTED_NOTE`) were defined locally in that screen file instead —
   same literal text (the neutral one-liner is still the spec's verbatim Story 3 AC1 quote), zero behavior
   change, no test file edited.

Quality gates: `npx tsc --noEmit` — clean, zero errors. `npx jest --testPathPattern="tests/vials-eu-
allergen-detection|src/utils/allergenDetector.test"` — 5 suites, 114 tests, all green (the 4 qa-lead suites
+ my own FE-9 unit suite). Sanity check on the concurrent session's in-flight files —
`npx jest --testPathPattern="ingredientParser|rulesetIntegrity|ConflictWarningInline"` — 3 suites, 97
tests, all green (unaffected by this task). Also ran `tests/product-shelf-card/ProductShelfCard.test.tsx`
(pre-existing suite touching `ProductShelfCard.tsx`, which FE-5 modifies): 41/69 tests fail with
`TypeError: getProductTypeBadgeStatus is not a function` — confirmed via `git stash` isolation (reverting
only my `ProductShelfCard.tsx` diff and re-running) that this exact failure count and message exist
identically without any of my changes present; it's a pre-existing mismatch between that test's
`jest.mock('@/constants/labels', ...)` factory (missing `getProductTypeBadgeStatus`) and current production
code, left by the concurrent session — not a regression introduced here. `saveProduct.test.ts` (FE-8's
existing suite) passes unmodified — its assertions use `toMatchObject`, tolerant of the two new additive
fields.

Not wired in this pass (per tech design Assumption 4, unchanged): `ManualProductFormScreen.tsx`'s save
path does not populate the allergen cache — `getProductAllergenMatches`'s live-recompute fallback means
correctness is unaffected, just recomputed instead of cached, for products saved via that screen.

Release gate unchanged and still open: `assets/eu_allergens_seed.json`'s specific names/synonyms/CAS
values are NOT verified against the official Regulation (EC) No 1223/2009 Annex III text — populated from
general knowledge for engineering/testing purposes only, same as the brief instructed. GATED pending a
regulatory-literate human reviewer sign-off before this feature is release-ready (spec §10, tech design
§5, handoff.json `release_gate`). Handing off to tech-lead for architecture review.

2026-08-05 — tech-lead: Architecture review performed directly (the dedicated `tech-lead` subagent's
Step-0 human-approval gate — recently hardened against instruction-source injection per commit
`24223d0` — cannot be satisfied through this pipeline's `SendMessage` relay channel, since it has no way
to distinguish a genuinely human-typed confirmation from a relayed one; two attempts both correctly
bounced. User approved doing the review inline instead of via that subagent.) Verified against
`.claude/rules/architecture-review.md`:

- **Design fidelity**: FE-1..FE-9 all present and match the tech design. Both logged deviations
  (exact-token matching; copy-constants relocated to `ProductDetailScreen.tsx`) are well-reasoned,
  regression-tested (the collision case is a real, verified bug the substring approach would have had),
  and don't change any user-facing behavior beyond what was specified — downgraded to non-blocking per
  architecture-review.md §6's "logged + reasoned deviation" rule.
- **Layer separation**: `allergenDetector.ts` confirmed pure — zero React/react-native/store imports, no
  AsyncStorage, no fetch. Clean.
- **List-agnostic guarantee**: confirmed no seed canonical/synonym name appears as a string literal in
  `allergenDetector.ts`'s own source; `EU_ALLERGEN_LIST_VERSION` is read from the JSON, never hand-typed.
- **`src/types/index.ts` diff hygiene**: read the live diff directly — the concurrent
  `vials-conflict-matrix-expansion` session's own `physical_exfoliant`/`isPhysicalExfoliant` additions are
  untouched; this task's `DetectedAllergenMatch` interface and the two `Product` fields are appended
  strictly after, no reordering. Clean.
- **Standard gates**: `npx tsc --noEmit` clean. `npx jest --testPathPattern="tests/vials-eu-allergen-
  detection|src/utils/allergenDetector.test"` → 5 suites, 114 tests, all green (independently re-run, not
  just taken from the engineer's report). Zero hardcoded hex colors in any new/modified file (`Badge`'s
  existing `Cobalt`/`Amber` token wiring is reused, per design). Zero TODO/FIXME/HACK/console.log/debugger
  residue. No function over 50 lines. Catalog/routine badge confirmed minimal — no count, no text, exactly
  one 28×28 circle, matches spec §3.1.
- **Pre-existing-failure claim spot-checked**: stashed all of this task's files (`git stash push
  --include-untracked` on the exact file list), re-ran `tests/product-shelf-card/ProductShelfCard.test.tsx`
  — identical 41-failed/13-passed result with none of this task's changes present, confirming the
  `getProductTypeBadgeStatus is not a function` failures are pre-existing damage from the concurrent
  session's `labels.ts` edits, not caused by FE-5. Popped the stash back cleanly; re-confirmed
  `git status` and the full task test suite afterward.
- **Release gate**: confirmed clearly logged as GATED (not silently marked done) in this file, the spec
  §10, the tech design §5, and `handoff.json`'s `release_gate` block.

**One finding, logged as a non-blocking follow-up rather than a review blocker:** `detectAllergens`'s
exact-token matching (`src/utils/allergenDetector.ts`) normalizes only whitespace/case
(`normalizeToken`) — it does not strip trailing punctuation. Real EU-labeled products commonly mark these
exact 26 allergens directly in the printed ingredient list with a trailing asterisk or footnote marker
(e.g. `"...Limonene*, Linalool*, Citronellol*"`) — that convention is itself how Annex III's "must be
individually declared" requirement is typically implemented on-pack. Against text captured verbatim that
way, `"limonene*"` will not equal `"limonene"` under the current `Set`-based exact-match, so the badge
would silently fail to appear on a meaningful share of real-world labels — precisely the substances this
feature exists to surface. This is not a violation of the tech design or the written acceptance criteria
(neither the source brief nor the spec mentions the asterisk convention, so no AC is technically failed,
and no test catches it), so it does not block this review. Recommended fix, cheap and localized: strip a
trailing run of non-alphanumeric marks (`*`, `†`, digits used as footnote refs) from each token in
`normalizeToken` before comparison, with a couple of `allergenDetector.test.ts` cases added for
asterisk-suffixed real-label-style input. Filed as a follow-up, not a merge blocker, given the feature is
already release-gated on regulatory content sign-off regardless.

**Verdict: ACCEPT.** Engineering scope (FE-1..FE-9) is complete, faithful to the tech design, and
correctly layered. Merge/commit is a code-quality green light; user-facing release still requires the
regulatory sign-off gate above, and the asterisk-matching follow-up is recommended before that release
(not before this review closes).

2026-08-05 — review (user-requested "review" pass, done inline, same session as tech-lead): took a second,
closer look at the finding already logged above and upgraded it from suspected to CONFIRMED by direct
execution against the real bundled seed:
- `detectAllergens('Aqua, Limonene*, Linalool*, Glycerin')` → `[]`. Complete failure, not "a meaningful
  share" as originally estimated — every asterisk-marked allergen is missed.
- `detectAllergens('Aqua, Parfum (Linalool, Limonene, Citronellol), Glycerin')` → only `Limonene` (the
  middle token) matches; the first and last entries in the parenthetical group are both dropped, merged
  into the surrounding "Parfum (" / ")" punctuation.

Fixed in `src/utils/allergenDetector.ts`'s `normalizeToken`: now strips a leading/trailing run of
non-alphanumeric characters (asterisks, footnote marks, a stray paren) after the existing
trim/lowercase/whitespace-collapse. This fully fixes the asterisk case and the *last* entry in a
parenthetical group. Deliberately does NOT fix the *first* entry in a parenthetical group (e.g. "Parfum
(Linalool" stays merged) — the "(" is internal to that token, not at its edge, and re-tokenizing on "("
as a new delimiter would incorrectly split seed entries whose own canonical name legitimately contains
parentheses (e.g. the oakmoss/treemoss extract entries). Documented as a known, narrower remaining
limitation in the function's own doc comment rather than silently left unmentioned.

Added 4 regression tests in `src/utils/allergenDetector.test.ts` ("tolerates common real-label
decoration" suite): asterisk-suffix now matches, parenthetical-group last-entry now matches, a test that
explicitly locks in the still-known first-entry limitation (so a future change either fixes it
intentionally or the test fails loudly, not silently), and a guard that entries with their own legitimate
internal parentheses still match unmodified. Had to rewrite the fix's own doc comment to avoid using real
seed canonical names as examples (used placeholder names like "SomeName*"/"First, Second, Third" instead)
— the Story 4 AC1 structural guard test (line ~318) reads `allergenDetector.ts`'s own source and correctly
failed the first time I wrote the comment with real names in it, which is exactly what that guard is for.

Verification: `npx tsc --noEmit` clean. `npx jest --testPathPattern="tests/vials-eu-allergen-
detection|src/utils/allergenDetector"` → 5 suites, 118 tests (114 prior + 4 new), all green.

**Unrelated but notable, discovered while re-verifying:** the concurrent `vials-conflict-matrix-expansion`
session committed its work as `0848668` during this review pass. Its `src/types/index.ts` diff (+51 lines)
is exactly the combined diff both tasks had pending in that file — it swept up this task's
`DetectedAllergenMatch`/`detectedAllergens`/`allergenListVersion` additions alongside its own
`isPhysicalExfoliant` field, under a commit message that only describes the latter. Confirmed via
`git show --stat 0848668` that no other allergen-detection file was included (only `src/types/index.ts`
was shared). No data lost, no regression — `tsc`/tests re-confirmed green after the sweep — but this
task's own future commit will not show a `src/types/index.ts` diff, since it already landed elsewhere.
User decision: leave `0848668` as-is (no history rewrite), and this task's own commit message should note
that the `Product`/`DetectedAllergenMatch` type additions already landed in `0848668`, not in this task's
commit.
