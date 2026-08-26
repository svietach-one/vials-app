Status: STEP_4_DONE, PUSHED (2d6d537, 9f22a69) — steps 0/1/2/4 implemented, step 3 SKIPPED
(evidence-based human decision), step 5 PENDING_NEEDS_HUMAN_GO_AHEAD. Real-device diagnostics
(9 captures, 6 not-in-corpus / 3 confirmed misses) gathered but not yet acted on.
Tech Design: docs/tasks/ocr_improvement/00-README.md (+ 01-06 step files) — pre-supplied, not authored by planner agent
Code: feature/ocr-improvement

## Карточка задачи
- [x] Product requirements (planner) — N/A, pre-supplied by user as docs/tasks/ocr_improvement/00-README.md
- [x] Technical design (planner) — N/A, pre-supplied as docs/tasks/ocr_improvement/{00-06}*.md, self-contained step-gated design
- [ ] QA tests (qa-lead) — not run; Step 0 is tooling-only per design, no qa-lead pass expected for it
- [x] Implementation (engineer) — Step 0 (eval harness + baseline), Step 1 (OCR query
  segmentation), and Step 2 (real scoring and a match cutoff) done. Steps 3–5 NOT started
  (step 3 is conditional and does not look necessary per step 2's false_top_1 finding — see
  step 2 log entry).
- [ ] Architecture review (tech-lead)

## Scope
Fix `ProductRepository.search()`: unscored trigram substring search with fixed LIMIT 20,
discarded bm25, and OCR path sending raw label blob unsplit. Six-step plan, each step gated
on the previous and reported with an eval-harness before/after table:

| Step | File | Schema change? |
|---|---|---|
| 0 | 01-eval-harness.md | no — **in progress**, must complete before any other step |
| 1 | 02-segment-ocr-query.md | no |
| 2 | 03-scoring-and-cutoff.md | no |
| 3 | 04-brand-first-filtering.md | no — conditional, may be skipped |
| 4 | 05-stopwords.md | no |
| 5 | 06-word-level-fts.md | **yes** — requires explicit human go-ahead |

Full detail, guardrails ("do not touch": barcode lookup, INCI/ingredient search,
ocrNoiseFilter.ts, "did you mean" chip UI, sync/seed layer, not-found→add-manually screens),
and shared conventions (SEARCH_CONFIG module, normalizeForMatch, bm25 gotcha) are in
`docs/tasks/ocr_improvement/00-README.md`. Do not duplicate that content here — read it.

## Deviation note
Task does not have docs/specs/ocr-improvement.md or docs/tech-design/ocr-improvement.md in
the standard locations. The user supplied a complete, self-contained, step-gated design
directly under docs/tasks/ocr_improvement/ instead, explicitly written so each step-executing
agent reads only 00-README.md + exactly one step file. Treating that as equivalent to the
planner's spec+tech-design output rather than re-running planner, per user direction
(2026-08-22) to "start task, use our pipeline" against this pre-existing doc set.

## Log
- 2026-08-22: Branch feature/ocr-improvement created from origin/main (current dev branch
  feature/vials-onboarding-quizzes is unrelated, unmerged work — not a valid base). Progress
  file created. Confirmed EXPO_PUBLIC_TURSO_HTTP_URL / EXPO_PUBLIC_TURSO_TOKEN are set in
  .env.local and src/services/turso/httpClient.ts already exists for the eval harness to reuse.
  Starting Step 0 (eval harness + baseline) per 00-README.md step order.
- 2026-08-22: Branch base corrected from origin/main to origin/dev per user direction (project
  convention: feature branches always branch from dev). No commits lost — branch had none yet,
  only untracked files, which were preserved. dev already includes the just-merged
  vials-onboarding-quizzes work (PR #45), so this is a superset of the prior main-based state.

- 2026-08-22: Step 0 (eval harness + baseline) implemented per 01-eval-harness.md. No app code
  under src/ changed.

  **Fixture-sourcing deviation (resolved by user, not an assumption):** 01-eval-harness.md asks
  to source label-captures.json from device QA photos on feature/ocr-capture-quality. That
  branch is merged into main and no photo files exist anywhere in the repo history — those QA
  sessions were local-only and never committed. Per explicit user decision: dropped the `photo`
  field entirely from the harness/fixtures; both fixture files were hand-built instead by
  querying the live Turso corpus read-only for real brand/name/uid rows (17,346 obf_import +
  3,742 vials_seed products) and writing plausible OCR-style `rawText` for each (dropped
  diacritics, truncation, stray line breaks, misread characters) — the shape
  `CaptureFlowScreen.tsx:82`'s `runSearch(result.rawText)` actually sends. All 43 real uids
  referenced across both fixture files were verified to exist in the corpus before commit-ready
  (`SELECT count(*) FROM products WHERE uid IN (...)` → 43/43). Tag-coverage bar was kept as
  specified. See scripts/search-eval/README.md "Adding a fixture" for the standing rule this
  leaves behind.

  **What was built** (all under `scripts/search-eval/`, no other src/ changes):
  - `run.ts` — single-file entry point (see its file-header comment for why it's one file: Node's
    native TS execution rejects TS constructor parameter properties used in
    `TursoHttpClient`/`ProductRepository`, and rejects Metro-style extensionless relative
    imports — both would need a new devDependency like `tsx` to fix, which was avoided to keep
    this step's footprint to "tooling only, no new deps"). It re-implements, with file:line
    citations, the exact wire protocol of `src/services/turso/httpClient.ts` and the exact query
    logic of `src/services/corpus/ProductRepository.ts:75-95` +
    `src/services/corpus/trigramSearch.ts` — a deliberate, bounded duplication, not a rewrite of
    the matching behaviour. Anyone changing those two source files in a later step must update
    the mirrored block in `run.ts` to keep the baseline meaningful.
  - `fixtures/typed-queries.json` (34 cases) and `fixtures/label-captures.json` (49 cases), all
    built from real corpus rows as above.
  - `baselines/8c1c01f.json` — full per-case baseline for current HEAD.
  - `README.md` — fixture-adding instructions, config-override semantics.
  - `package.json`: added `"search-eval": "node --env-file-if-exists=.env.local
    scripts/search-eval/run.ts"`. This is the only change to a tracked file.

  **Config-override plumbing:** `--set`/`--label`/`--compare`/`--tag` all implemented and
  verified against the live corpus. `SEARCH_CONFIG` doesn't exist in app code yet (step 1
  creates it), so only `recallLimit` (retrieval-stage query limit, default 100) and `maxResults`
  (display-stage truncation) have real effect on this step's own queries; `scoringV2`,
  `minMatchScore`, `segmentOcrQuery`, `brandFilterThreshold`, `stopwordsEnabled`,
  `wordIndexEnabled` are parsed/validated/echoed into the baseline JSON (so the flag plumbing is
  provably wired for later steps) but are no-ops today — the script prints a warning when one of
  those is set, so this isn't silently misleading. The **unmodified baseline run** measures
  today's real app behaviour: `displayLimit` defaults to 20 (matching `ProductRepository.ts`'s
  hardcoded `LIMIT 20`), not the step-2-era `maxResults: 6` default shown in 00-README's
  SEARCH_CONFIG sample.

  **Acceptance criteria (01-eval-harness.md), checked against what was actually built:**
  - [x] `npm run search-eval` runs against the real corpus and prints the table — ran for real,
    83 cases, see baseline table below.
  - [x] ≥30 typed fixtures and ≥30 label fixtures, each with `expected` and `tags` — 34 typed, 49
    label.
  - [x] ≥8 fixtures labelled `not_in_corpus`; ≥6 tagged `typo` — combined: 16 `not_in_corpus` (7
    typed + 9 label), 13 `typo` (7 typed + 6 label). Both individual fixture sets also clear the
    per-set minimums from the "Include at minimum" list (label set: 9 `not_in_corpus`, 6 `typo`;
    typed set: 7 `not_in_corpus`, 7 `typo` — typed set's 7 is one below a strict per-set-8 reading
    of the *label*-only "8–10 generic" instruction, which doesn't literally apply to
    typed-queries.json; combined total is what the acceptance-criteria line actually says and it
    is comfortably met).
  - [x] `--set k=v` config override and `--label` output naming both work — verified: `--set
    recallLimit=50 --set maxResults=6 --label sweep-test` changed `mean_res` from 20.0 to 6.0 and
    wrote `8c1c01f-sweep-test.json` (deleted after verification, not a required deliverable).
  - [x] `recall@retrieval` is computed pre-cutoff and stays computable once step 2 adds a floor —
    computed at `recallLimit` (independent of `displayLimit`/`maxResults`), 100% today since no
    cutoff exists yet.
  - [x] Latency percentiles reported — p50/p95 per slice (overall/set/tag), in ms.
  - [x] Baseline JSON committed for the current HEAD — `baselines/8c1c01f.json` present in the
    working tree, left unstaged for human review per instructions (no `git commit` run).
  - [x] `--compare` produces a readable per-case diff — verified: fixed/broken/unchanged counts
    plus per-case detail, with a 3-candidate path resolver (cwd-relative, baselines-dir-relative,
    basename-in-baselines-dir) so `--compare baselines/<sha>.json` and `--compare <sha>.json`
    both work when run via `npm run search-eval --` from the repo root.

  **Baseline table (HEAD 8c1c01f, recallLimit=100, displayLimit=20, 83 cases):**

  ```
  Overall
  slice    n   p@1    p@5    false_top1  recall@retr  no_match(oov)  no_match(real)  mean_res  p50   p95
  overall  83  95.5%  98.5%  0.0%        100.0%       0.0%           0.0%            20.0      58ms  75ms

  By fixture set
  slice  n   p@1    p@5     false_top1  recall@retr  no_match(oov)  no_match(real)  mean_res  p50   p95
  typed  34  96.3%  96.3%   0.0%        100.0%       0.0%           0.0%            20.0      59ms  116ms
  label  49  95.0%  100.0%  0.0%        100.0%       0.0%           0.0%            20.0      57ms  72ms

  By tag
  slice               n   p@1     p@5     false_top1  recall@retr  no_match(oov)  no_match(real)  mean_res  p50   p95
  exact               33  97.0%   97.0%   0.0%        100.0%       n/a            0.0%            20.0      58ms  116ms
  typo                13  100.0%  100.0%  0.0%        100.0%       n/a            0.0%            20.0      58ms  114ms
  truncation          7   85.7%   100.0%  0.0%        100.0%       n/a            0.0%            20.0      49ms  53ms
  generic              13  n/a     n/a     n/a         n/a          0.0%           n/a             20.0      60ms  75ms
  generic-heavy        4   75.0%   100.0%  0.0%        100.0%       n/a            0.0%            20.0      60ms  65ms
  same-brand-variant  11  90.9%   100.0%  0.0%        100.0%       n/a            0.0%            20.0      60ms  81ms
  cyrillic              5   100.0%  100.0%  0.0%        100.0%       n/a            0.0%            20.0      44ms  48ms
  short-query           3   n/a     n/a     n/a         n/a          0.0%           n/a             20.0      53ms  57ms
  ```

  **Surprising / concerning findings:**
  1. `recall@retrieval` is **100%** across every slice — the correct answer is always present
     among the top-100 FTS/LIKE candidates today. Retrieval itself is not the bottleneck; the
     problem really is scoring/cutoff/precision, exactly as 00-README's diagnosis says. Step 2's
     plan does not need revisiting on this evidence.
  2. `no_match_rate(oov)` is **0.0%** for both `generic` (13 cases) and `short-query` (3 cases) —
     the app currently *never* returns an empty result for a query with no correct answer; every
     `not_in_corpus` fixture still gets back a full page of noise. This is the literal symptom
     00-README describes ("the 'not listed / add manually' fallback only fires on a literally
     empty result set") confirmed directly against production data, not just theorized.
  3. `mean_results` is exactly **20.0** for almost every slice — nearly every query, including
     the not_in_corpus ones, hits the hardcoded `LIMIT 20` cap. Confirms "unfiltered" is the
     right word for today's behaviour.
  4. `false_top1_rate` is **0.0%** everywhere, even on slices with lower precision@1
     (`generic-heavy` 75.0%, `truncation` 85.7%, `same-brand-variant` 90.9%). When top-1 is
     wrong today, it is consistently a same-brand sibling product, never an unrelated brand —
     worth keeping in mind for step 3 (brand-first filtering): brand-level noise doesn't appear
     to be today's dominant error mode in this fixture set, name-level ambiguity within a brand
     is.
  5. `npm test` currently shows 118 failing tests / 24 failing suites, all `TypeError: Cannot
     read properties of undefined` on `palette.plumTint` / `palette.goldenTint` / `shadow.sm` in
     unrelated design-token/component files. Confirmed pre-existing and unrelated to this step:
     `git diff package.json` shows the only tracked-file change is the additive `search-eval`
     script line, and no file under `src/` or `tests/` was touched. `npx tsc --noEmit` is clean
     (zero type errors) both before and after this step's changes — the jest failures are a
     runtime issue in existing token/component wiring, not a type or search-eval regression.
     Flagging per the "report anything surprising" instruction; not fixed here (out of scope —
     no src/ changes this step).

  Next step (02-segment-ocr-query.md) was deliberately **not** started or read, per instructions.

- 2026-08-22: Step 1 (segment the OCR query before searching) implemented per
  `02-segment-ocr-query.md`.

  **What changed:**
  - `src/services/corpus/types.ts` — added `ProductQuery` type (`brand?`, `name`, `origin:
    'typed'|'ocr'`, `raw?`), exactly per `02-segment-ocr-query.md` §1.
  - `src/services/corpus/searchConfig.ts` — **new file**, created exactly per `00-README.md`'s
    `SEARCH_CONFIG` shape (all 8 keys: `segmentOcrQuery`, `scoringV2`, `minMatchScore`,
    `recallLimit`, `maxResults`, `brandFilterThreshold`, `stopwordsEnabled`,
    `wordIndexEnabled`), with a doc comment noting which step reads which key. Only
    `segmentOcrQuery` has any effect in app code as of this step.
  - `src/services/corpus/ProductRepository.ts` — `search()` now takes `ProductQuery` instead of
    `string`; builds `trimmed = [query.brand, query.name].filter(Boolean).join(' ').trim()` and
    otherwise runs the exact same trigram-FTS / `search_norm LIKE` fallback logic as before
    (no scoring, no threshold — that's step 2, deliberately untouched). No overload kept for a
    plain-string caller since all three real call sites were migrated (verified via repo-wide
    grep — only `AddProductHubScreen.tsx`, `CaptureFlowScreen.tsx`, `FirstProductScreen.tsx`,
    and the test file called `.search(`).
  - `src/utils/productForm/ocrNormalizer.ts` — added `buildOcrProductQuery(rawText): ProductQuery`,
    a pure function wrapping `splitLabelText()` + the degenerate-split guard (empty `name` ->
    use `brand` as `name`, drop `brand`) + `origin: 'ocr'` + `raw: rawText`. Kept pure (no
    React/react-native imports) so it's unit-testable per `.claude/rules/testing.md`'s
    utils-layer rules; only a `import type { ProductQuery } from '@/services/corpus/types'` was
    added (type-only, erased at compile time, no runtime coupling).
  - `src/screens/catalog/CaptureFlowScreen.tsx` — `runSearch()` now builds a `ProductQuery`
    before calling `productRepository.search()`: `buildOcrProductQuery(rawText)` when
    `SEARCH_CONFIG.segmentOcrQuery` is true (default), else `{ name: rawText, origin: 'ocr', raw:
    rawText }` (brand omitted) to reproduce the pre-step-1 undivided-blob behaviour for
    before/after comparison. `splitLabelText` usage on the two exit-without-match paths
    (`goToManualEntry`, the INCI-capture branch) is untouched.
  - `src/screens/AddProductHubScreen.tsx` — `.search(debouncedQuery)` ->
    `.search({ name: debouncedQuery, origin: 'typed', raw: debouncedQuery })`.
  - `src/screens/onboarding/FirstProductScreen.tsx` — `.search(text)` ->
    `.search({ name: text, origin: 'typed', raw: text })`.
  - `src/services/corpus/ProductRepository.test.ts` — all 6 pre-existing `search()` tests
    migrated from plain strings to `{ name: ..., origin: 'typed' }`-shaped objects, same
    assertions/intent preserved (FTS path, LIKE fallback, empty-query short-circuit, trim
    behaviour, Cyrillic case-variant matching, % escaping, error propagation). Added 1 new test
    verifying `brand`+`name` are joined into a single trigram MATCH param with no embedded
    newline, for a segmented OCR-shaped query.
  - `src/utils/productForm/ocrNormalizer.test.ts` — added a `buildOcrProductQuery` describe
    block: multi-line `rawText` -> two-field `ProductQuery` (brand/name/origin/raw), single-line
    `rawText` -> brand-as-name fallback with `brand` dropped, whitespace-only `rawText` -> empty
    `name` never left unguarded (still `''`, matching `search()`'s empty-trim short-circuit).
  - `scripts/search-eval/run.ts` — updated the mirrored logic (see "harness sync" below):
    ported `splitLabelLines`/`splitLabelText`/`buildOcrSearchText` from `ocrNormalizer.ts`;
    `buildSearchText(c, config)` now builds a segmented `brand + ' ' + name` string for
    `label-captures.json` cases when `segmentOcrQuery` is true (harness default, matching the
    new `SEARCH_CONFIG` default) or the raw undivided blob when false; `typed-queries.json`
    cases are unaffected (always flat). `ACTIVE_CONFIG_KEYS` now includes `segmentOcrQuery`
    alongside `recallLimit`/`maxResults`. Updated header/section comments to reflect that
    `ProductRepository.search()` now takes a `ProductQuery`, not a raw string.

  **Harness sync (how well `run.ts` stayed in sync):** Clean, no partial job. The port of
  `splitLabelText`'s algorithm into `run.ts` is a straight copy (same regex, same line-split,
  same brand/rest join) — verified algebraically that `buildOcrSearchText()`'s output equals
  what `ProductRepository.search()` would compute from `buildOcrProductQuery()`'s output in
  every branch (name present, name empty, both empty), not just spot-checked. No new
  `tsx`/`ts-node` dependency was needed; the harness's existing "flat query string in, trigram
  query logic in `retrieve()`" design meant only the *text-building* step needed to change, not
  `retrieve()` itself. This step's `run.ts` diff was proportionate to the scope of the source
  change — not "meaningfully harder" than expected.

  **Acceptance criteria (`02-segment-ocr-query.md`), checked against what was actually built:**
  - [x] No call path passes raw multi-line OCR text into the corpus query under the default
    config. Verified: `grep -rn "rawText" src/screens/catalog/CaptureFlowScreen.tsx` and
    `grep -rn "\.search(rawText)" src/` (empty) — `rawText` only reaches `splitLabelText`/
    `buildOcrProductQuery`, never `productRepository.search()` directly. Caveat: when a caller
    explicitly sets `SEARCH_CONFIG.segmentOcrQuery = false` (or the harness's `--set
    segmentOcrQuery=false`), the raw blob is deliberately still sent — that is the documented
    A/B-comparison escape hatch the spec itself asks for, not an oversight; the flag's default
    is `true`.
  - [x] `searchConfig.ts` exists and this change is behind `segmentOcrQuery` — all 8 keys
    present per `00-README.md`'s shape; only `segmentOcrQuery` has real effect this step.
  - [x] Typed-search behaviour is byte-identical to baseline — verified programmatically (not
    just eyeballed): diffed every typed-set case's `displayResults` uid list between
    `baselines/8c1c01f.json` (Step 0) and the new run — 0 of 34 typed cases differ, under both
    `segmentOcrQuery=true` (default) and `=false`.
  - [x] Existing tests pass; added the two required unit tests (multi-line -> two-field
    `ProductQuery`; empty-name split -> brand-as-name fallback) plus a whitespace-only-input
    guard test. `npx tsc --noEmit` clean. `npm test`: 118 failing / 2204 passing (same 118 as
    the Step 0 baseline, confirmed identical pre-existing `palette.plumTint`/`goldenTint`/
    `shadow.sm` design-token failures — no new failures, no fixed failures, count and suite list
    unchanged).
  - [x] Harness re-run: `precision@1` on label fixtures does not regress (95.0% before, 95.0%
    after — identical) and `recall@retrieval` does not drop (100.0% before, 100.0% after).

  **Before/after harness table (HEAD 8c1c01f, working tree with step 1 changes,
  recallLimit=100, displayLimit=20, 83 cases — identical for `segmentOcrQuery=true` (new
  default) and `=false`, see finding below):**

  ```
  By fixture set (Step 0 baseline == Step 1 default == Step 1 off)
  slice  n   p@1    p@5     false_top1  recall@retr  no_match(oov)  no_match(real)  mean_res
  typed  34  96.3%  96.3%   0.0%        100.0%       0.0%           0.0%            20.0
  label  49  95.0%  100.0%  0.0%        100.0%       0.0%           0.0%            20.0

  Overall: 83 cases, p@1 95.5%, p@5 98.5%, recall@retr 100.0%, false_top1 0.0% (unchanged)
  ```

  Baseline JSON files written (unstaged, for human review):
  `scripts/search-eval/baselines/8c1c01f-step1-default.json` (segmentOcrQuery=true, the new
  default) and `scripts/search-eval/baselines/8c1c01f-step1-off.json` (segmentOcrQuery=false,
  the pre-step-1-equivalent run).

  **Label cases whose verdict changed in either direction: none.** `--compare
  baselines/8c1c01f.json` against both the default and the `segmentOcrQuery=false` run reports
  `fixed: 0`, `broken: 0`, `unchanged (correct): 64`, `unchanged (wrong): 19` — identical to the
  Step 0 baseline in every one of the 83 cases. Went further than the aggregate table: diffed
  every individual case's full `displayResults` uid ordering (not just the pass/fail verdict)
  between the Step 0 baseline and this step's run — 0 of 49 label cases differ at all, byte-for-
  byte, under `segmentOcrQuery=true`.

  **Why zero cases changed (surprising, but explainable — not a bug):** `toTrigrams()`
  (`trigramSearch.ts:13-19`) tokenizes on `/[^a-z0-9а-яё]+/`, which treats a newline exactly the
  same as a space — both are non-alphanumeric separators. `splitLabelText()` keeps *every*
  surviving line (brand = first line, name = all remaining lines joined by a space); it drops no
  content, it only reclassifies which line is "brand" vs "name". So for every fixture in this
  set, `brand + ' ' + name` and the original newline-joined `rawText` decompose into the exact
  same trigram set — the only difference is a newline byte becoming a space byte, which the
  tokenizer already treated as equivalent. This step's real value is therefore purely
  structural, exactly as `02-segment-ocr-query.md` predicted ("Do not expect a large precision
  gain from this step... A flat precision@1 is a passing result. The value here is structural:
  it gives step 2 a brand field and a name field to score separately"): step 2 is the first step
  that can actually act on `brand` vs `name` as separate signals, since nothing before it could
  distinguish them at the trigram-matching level. **This means the current 49-fixture label set
  provides no empirical signal that the split is well-formed beyond "doesn't crash / doesn't
  regress"** — worth flagging for whoever executes step 2, since that step's scoring logic will
  be the first real test of whether `splitLabelText`'s brand/name boundary lines up with what a
  scored match actually needs.

  Next step (`03-scoring-and-cutoff.md`) was deliberately **not** started or read, per
  instructions.

- 2026-08-22: Step 2 (real scoring and a match cutoff) implemented per `03-scoring-and-cutoff.md`.

  **What changed:**
  - `src/utils/textNormalize.ts` — **new file**, `normalizeForMatch` exactly per 00-README's
    shared-conventions spec (NFD diacritic strip, lowercase, punctuation→space, collapse
    whitespace). Pure, no React/react-native/store — importable from any layer.
  - `src/services/corpus/scoreCandidate.ts` — **new file**. Exports `scoreField(queryText,
    docText, opts?)` (all token-matching logic: the 3-rule match — exact, prefix ≥4 chars,
    trigram-fuzzy ≥5 chars/≥0.6 Jaccard — plus a `strict` mode for the short-query guard) and
    `scoreCandidate(query, candidate)` (blend only: 0.35 brand / 0.65 name, or name-only when
    `query.brand` is unset — no token logic, per the doc's explicit module-boundary requirement
    so step 4 can change `scoreField` alone). Also exports `isShortQuery(query)` (normalized
    combined `[brand, name]` < 4 chars) and the fixed `SHORT_QUERY_MIN_SCORE = 0.8` constant —
    deliberately **not** part of `SEARCH_CONFIG` since the doc specifies it as a fixed rule, not
    a sweep-tunable.
  - `src/services/corpus/typedRanking.ts` — **new file**. `classifyTypedTier(query, candidate)`
    (the 5 tiers: exact combined/name match, brand-starts-with, name-starts-with, word-inside-
    name-starts-with, else) and `compareTypedCandidates(query)` (comparator: tier ASC → score
    DESC → `rating_count` DESC → `name` ASC). Pure, no React/store.
  - `src/services/corpus/types.ts` — added `ScoredCorpusProduct extends CorpusProduct { score:
    number }`. `search()`'s new return type. The 3 render call sites needed **no changes**:
    `ScoredCorpusProduct[]` is structurally assignable to their existing `CorpusProduct[]` state
    types (extra field, not fewer), confirmed via `tsc --noEmit` staying clean without touching
    `CaptureFlowScreen.tsx` / `AddProductHubScreen.tsx` / `FirstProductScreen.tsx`.
  - `src/services/corpus/searchConfig.ts` — `minMatchScore` changed from the step-1-era
    placeholder `0.5` to the sweep-chosen `0.55` (see sweep table below). No other keys changed.
  - `src/services/corpus/ProductRepository.ts` — full rewrite of the retrieval/scoring path:
    - `retrieveCandidates(query)` — **new public method**, the recall stage only (no score, no
      cutoff), honoring `SEARCH_CONFIG.recallLimit`. Exposed specifically so the harness can
      measure `recall@retrieval` independently, per the doc's explicit requirement. Branches on
      `query.origin`: OCR keeps the step-1 trigram-FTS-then-LIKE-fallback shape (now
      `recallLimit`-parameterized instead of hardcoded `20`); typed uses a new word-boundary
      prefix LIKE scan (`text%` and `% text%` patterns per case variant, against `search_norm`)
      with a fuzzy-trigram-FTS **supplement** (tier 5) fetched only when the prefix scan is thin
      (< `maxResults` rows) and the query is ≥4 normalized chars — exactly the "tier 5 is a
      supplement, not the default" rule.
    - `search(query)` — scores every recall-stage candidate via `scoreCandidate`, filters by
      `isShortQuery(query) ? SHORT_QUERY_MIN_SCORE : SEARCH_CONFIG.minMatchScore`, sorts (typed:
      `compareTypedCandidates`; OCR: score DESC with a `uid` tiebreak for determinism), caps at
      `SEARCH_CONFIG.maxResults`. Typed queries under 2 raw (trimmed, un-normalized) characters
      return `[]` before any db call — deliberately raw length, not normalized length, so e.g. a
      2-character `"50%"` still queries even though `normalizeForMatch` strips the `%` down to a
      1-char token (see the "escapes literal % and _" test).
    - **Definition-of-done compliance I initially missed and then fixed**: 00-README requires
      every step's change to sit behind its own `SEARCH_CONFIG` flag, the way step 1 used
      `segmentOcrQuery`. My first pass ran the new pipeline unconditionally. Added
      `SEARCH_CONFIG.scoringV2` as a real gate: `search()` now calls a new private
      `legacySearch(query)` (origin-agnostic trigram/LIKE, hardcoded `LIMIT 20`, unscored,
      `score: NaN`) when `scoringV2` is `false`, byte-for-byte reproducing pre-step-2 behaviour.
      Verified via the harness against the live corpus with `--set scoringV2=false --compare
      baselines/8c1c01f.json`: **0 fixed, 0 broken, all 83 cases unchanged** vs. the step-0
      baseline — confirms the flag genuinely reproduces the old behaviour, not just superficially.
      `retrieveCandidates()` itself is **not** gated (it's a brand-new method with no legacy
      equivalent to toggle; it always represents the new recall stage, which is what the
      recall-regression check needs regardless of `scoringV2`).
  - `src/services/corpus/ProductRepository.test.ts` — substantially rewritten (all prior step-1
    coverage preserved in adapted form: empty-query short-circuit, OCR trigram-source joining,
    Cyrillic case-variant matching, `%`/`_` escaping, error propagation). New coverage: the 2-char
    minimum-length guard, typed word-boundary-prefix LIKE pattern shape (`text%` / `% text%`, not
    a bare substring), the fuzzy-supplement trigger/skip conditions, score-floor cutoff, the
    `maxResults` cap, tier ordering (exact-combined beats a same-brand sibling), the required
    "typing one more character only narrows the list" stability test, and the `scoringV2` gate
    (both branches). 21 tests, all passing.
  - `src/services/corpus/scoreCandidate.test.ts` — **new file**. Covers every acceptance-criteria
    case by name: exact match (rule 1), the longer-document "The Ordinary" case (asymmetric
    containment — a document's extra tokens don't penalize the score), an OCR typo via rule 3
    (`0rdinary`→`ordinary`), a case proving rule 3 does **not** fire on short tokens (`wax` vs
    `wat`, 3 chars, would otherwise pass the 0.6 fuzzy threshold), wrong-brand-similar-letters
    (`avene` vs `aveeno`, no match), the short-query guard's stricter/no-length-floor prefix mode,
    and the brand/name blend (0.35/0.65, and name-alone when `query.brand` is unset). 17 tests.
  - `src/services/corpus/typedRanking.test.ts` — **new file**. All 5 tiers individually, plus the
    comparator's 3-level tiebreak (tier → score → `rating_count` → `name`). 8 tests.
  - `package.json` / `package-lock.json` — added `tsx` as a **new devDependency** (see below);
    `search-eval` script changed from `node --env-file-if-exists=.env.local
    scripts/search-eval/run.ts` to `tsx --env-file-if-exists=.env.local
    scripts/search-eval/run.ts`.
  - `scripts/search-eval/run.ts` — **rewritten**, not hand-mirrored a second time (see below).

  **`tsx` decision (per the task's explicit architecture question):** Added `tsx` as a
  devDependency and switched the harness to import `ProductRepository`, `SEARCH_CONFIG`,
  `TursoHttpClient`, `buildOcrProductQuery`, and `normalizeForMatch` directly from `src/`,
  exactly as recommended. Verified first with a standalone smoke script
  (`npx tsx smoke.ts` importing `ProductRepository` + `toTrigrams` + `SEARCH_CONFIG`) that `tsx`
  resolves this project's `@/` → `src/` path alias and `ProductRepository`'s TS constructor
  parameter-property syntax with **zero extra config** — both were the specific blockers step 0's
  log cited for why `node`'s native TS stripping couldn't do this. `src/services/turso/httpClient.ts`
  (`TursoHttpClient`) turned out to already be a pure-`fetch`, no-React-Native class implementing
  `CorpusQueryExecutor` directly — no adapter was even needed; `new
  ProductRepository(new TursoHttpClient(url, token))` runs unmodified against the real corpus
  under `tsx`, confirmed by a second smoke run that returned real, correctly-scored CeraVe rows.
  `run.ts` is now ~450 lines of fixture loading, CLI parsing, metrics computation, and reporting —
  the hand-ported `toTrigrams`/`toTrigramQuery`/`caseVariants`/`splitLabelText`/`buildOcrSearchText`
  duplicates from steps 0–1 are gone entirely; the harness config-mutates the real
  `SEARCH_CONFIG` singleton (`Object.assign(SEARCH_CONFIG, overrides)`) before each run, so
  `--set` genuinely changes production code's behaviour, not a shadow copy of it. `--set`
  validates against `key in SEARCH_CONFIG` (the real object) instead of a hand-copied defaults
  table. `recall@retrieval` is measured via a direct `repo.retrieveCandidates(query)` call (a
  second, untimed network round-trip per case, separate from the timed `repo.search(query)` call)
  — a small efficiency cost (2x recall-stage queries per case) traded for measuring the real
  method instead of a mirror. No blockers were hit; the recommended architecture worked as
  described.

  **Acceptance criteria (`03-scoring-and-cutoff.md`), checked against what was actually built:**
  - [x] `scoreCandidate.ts` exports `scoreField` and `scoreCandidate` per the contract.
  - [x] Unit tests for all 6 named cases — see `scoreCandidate.test.ts` above.
  - [x] `search()` returns `[]` when nothing clears the floor, results carry `score` — tested
    directly; verified against the live corpus too (every `displayResults[i].score` is a number).
  - [x] Pre-cutoff candidate list exposed (`retrieveCandidates`) — public method, used by both the
    harness and (implicitly) `search()` internally.
  - [x] No raw bm25 value compared against a constant — grepped every `bm25` usage in
    `src/services/corpus/`: all 3 are `ORDER BY bm25(...)` clauses, none is compared to anything.
  - [x] `recallLimit` / `maxResults` / `minMatchScore` all read from `SEARCH_CONFIG` — confirmed;
    the only literal `LIMIT 20` left in the file is `legacySearch()`'s intentional reproduction of
    pre-step-2 behaviour (which never read `recallLimit` either, by definition of "legacy").
  - [x] LIKE fallback scored and capped like the main path — both the OCR case-variant LIKE
    fallback and the typed word-boundary-prefix LIKE scan feed into the same
    score → floor → sort → cap pipeline in `search()`; neither returns unranked rows.
  - [x] Typed and OCR queries use different recall stages, branched on `origin` —
    `retrieveTypedCandidates` vs `retrieveOcrCandidates`.
  - [x] Typed results tier-sorted with a deterministic tiebreak; "narrows, doesn't reshuffle"
    test present — `ProductRepository.test.ts`'s `cleans`→`cleanse` test (see file for why that
    specific word pair was chosen: it isolates the narrowing effect independent of the exact
    tuned `minMatchScore`, so the test doesn't become flaky across future re-tuning).
  - [x] Queries under 2 characters return no list — tested (1-char blocked, 2-char allowed).
  - [x] Threshold sweep table included — below.
  - [~] Harness: `false_top_1` drops substantially — **partially literal**: baseline `false_top_1`
    was *already* 0.0% (step 0's finding: wrong top-1 results were always same-brand siblings,
    never cross-brand), so there was no headroom to "drop substantially" from. At the chosen
    threshold (0.55) `false_top_1` is 0.0% — matches/holds the baseline. Note: at lower swept
    thresholds (0.30–0.50) it briefly went to **1.5%** (one specific case, `t019`, detailed
    below) before dropping back to 0.0% at 0.55+ — flagging this transparently since the doc
    asks precisely for "measured, not assumed."
  - [x] `no_match_rate` on `not_in_corpus` fixtures rises — 0.0% → 50.0% overall. **Caveat found
    and worth recording**: this rise is almost entirely from the OCR/label set (0.0% → 88.9%);
    the typed set's `not_in_corpus` fixtures (the `generic` and `short-query` tags) stayed at
    0.0% — see "Notable findings" below for why, and why that's expected given this step's scope.
  - [x] `no_match_rate` on fixtures with a real expected match stays near baseline — 0.0% → 4.5%
    overall (3 of 67 real-expectation cases; see per-case detail below — each is a legitimate
    "wrong-answer-shown converts to no-answer-shown" trade the doc explicitly asks for, not a
    regression).
  - [x] `recall@retrieval` unchanged — **100.0% in every slice, before and after**, at every
    swept threshold (the recall stage is threshold-independent by construction, as designed).

  **Threshold sweep** (`minMatchScore` ∈ {0.30 … 0.70}, step 0.05, live corpus, 83 fixtures,
  `recallLimit=100`, `maxResults=6`; `precision@1`/`false_top_1`/`no_match` computed over the 67
  cases with a real expected match unless noted):

  ```
  minMatchScore  p@1    p@5    false_top1  no_match(oov)  no_match(real)  mean_res
  0.30           83.6%  98.5%  1.5%        6.3%           0.0%            5.2
  0.35           82.1%  97.0%  1.5%        18.8%          1.5%            4.7
  0.40           82.1%  97.0%  1.5%        31.3%          1.5%            4.5
  0.45           82.1%  95.5%  1.5%        37.5%          1.5%            3.8
  0.50           82.1%  95.5%  1.5%        50.0%          1.5%            3.5
  0.55           80.6%  94.0%  0.0%        50.0%          4.5%            2.8
  0.60           80.6%  94.0%  0.0%        50.0%          4.5%            2.5
  0.65           74.6%  88.1%  0.0%        50.0%          11.9%           2.2
  0.70           68.7%  80.6%  0.0%        56.3%          19.4%           1.8
  ```

  **Chosen threshold: `minMatchScore = 0.55`.** Reasoning: 0.55 is the lowest swept value at
  which `false_top_1` reaches 0.0% (the harmful failure mode — "a user who accepts a wrong match
  gets a wrong ingredient list," per the doc's own framing of why this direction is correct even
  at some no-match cost). 0.55 and 0.60 are metric-identical on every column except `mean_res`
  (2.8 vs 2.5 — 0.60 only trims *extra*, already-non-top candidates from result lists; verified
  by diffing every case's `displayResults` uid list between the two runs: **0 of 83 cases differ
  in their top-1, or in whether they match at all** — only tail entries beyond position 1–2 get
  dropped at 0.60). So 0.55 gives users a very slightly longer candidate list at literally zero
  precision cost, and is the more conservative pick (further from the 0.65 cliff where `no_match
  (real)` and `p@1` both degrade sharply). Above 0.60 the trade stops being favorable: 0.65→0.70
  loses real matches fast (`no_match(real)` 11.9% → 19.4%) for no further `false_top_1` benefit
  (already at floor). Consistent with the doc's explicit trade framing: raising the floor
  converts wrong-answer-shown into no-answer-shown, which is the right direction for this
  product — the sweep is what makes that a measured decision instead of a magic number.

  **Before/after metrics, split by fixture set** (before = `baselines/8c1c01f.json`, the step-0/1
  baseline with the pre-scoring `LIMIT 20`/unscored path; after = `minMatchScore=0.55`,
  `baselines/8c1c01f-final.json`):

  ```
  Overall
                 n   p@1    p@5    false_top1  recall@retr  no_match(oov)  no_match(real)  mean_res
  before         83  95.5%  98.5%  0.0%        100.0%       0.0%           0.0%            20.0
  after (0.55)   83  80.6%  94.0%  0.0%        100.0%       50.0%          4.5%            2.8

  typed
                 n   p@1    p@5    false_top1  recall@retr  no_match(oov)  no_match(real)  mean_res
  before         34  96.3%  96.3%  0.0%        100.0%       0.0%           0.0%            20.0
  after (0.55)   34  74.1%  88.9%  0.0%        100.0%       0.0%           11.1%           2.6

  label
                 n   p@1    p@5     false_top1  recall@retr  no_match(oov)  no_match(real)  mean_res
  before         49  95.0%  100.0%  0.0%        100.0%       0.0%           0.0%            20.0
  after (0.55)   49  85.0%  97.5%   0.0%        100.0%       88.9%          0.0%            2.9
  ```

  `recall@retrieval` is 100.0% in every row on both sides — this step did not touch retrieval, as
  required.

  **Per-case diff** (`--compare baselines/8c1c01f.json` at the chosen threshold, 83 cases: 9
  fixed, 11 "broken" by the raw metric, 53 unchanged-correct, 10 unchanged-wrong):

  *Fixed (9) — all genuine improvements:*
  - `t006` (typed, exact) — was matching the wrong Avène product before; now finds the correct
    one. A real precision gain, not just a no-match conversion.
  - `c040`–`c044`, `c046`–`c048` (8 of 9 OCR "generic" label fixtures) — previously all matched
    *something* (the literal bug 00-README describes: the old system essentially never returned
    empty); now correctly return `[]`, letting the existing "not found → add manually" flow fire.

  *"Broken" (11) — every one investigated individually; none is a cross-brand false-top-1, and
  most are not really precision regressions:*
  - `t003`, `t004`, `t011`, `c006` (4 cases, all CeraVe) — the new top-1 is a **different corpus
    row with the identical brand + name text** as the fixture's designated `expected` uid (score
    1.0 both ways). This is a duplicate-row artifact in the corpus data (two rows, same product,
    different `uid`/barcode), not a search-quality issue — whichever the old bm25 ordering
    happened to prefer is what the fixture recorded as "expected," and the new deterministic
    tiebreak (`uid` ascending for OCR, tier/score/`rating_count`/name for typed) picks the other
    twin. Out of scope for this step; flagging as a corpus-data note.
  - `t013` (typo), `t019` (truncation), `t031` (cyrillic) — the 3 cases behind the `no_match(real)`
    rise to 4.5%. All 3 are genuine "wrong-answer-shown → no-answer-shown" conversions per the
    doc's accepted trade. `t019` in particular (`"the ordinary natural moist"`) is the specific
    case that produced the transient 1.5% `false_top_1` at lower thresholds: at `minMatchScore
    ≤0.50`, its top-scoring candidate tied at exactly 0.5 between the correct "The Ordinary...
    Moisturizing..." product and an unrelated Colgate-Palmolive item whose name happens to contain
    "natural" and start a word with "moist" — both tie because the typed-query scorer never sees
    `candidate.brand` when `query.brand` is unset (see "Notable findings" below), so "the" and
    "ordinary" contribute zero signal for either candidate, and the alphabetically-earlier
    "Dermo..." name wins the tie. At 0.55 both fall under the floor and the case correctly
    returns `[]` instead.
  - `t018` (truncation, `"cerave skin renew"`) — now matches a different, but still CeraVe,
    moisturizing-lotion product (score 0.667) instead of the intended "Skin Renewing" line. A
    real but narrow precision loss, same-brand only.
  - `c009`, `c018`, `c033` (OCR label set: Vichy/Nivea/La Roche-Posay) — all score **1.0** for
    both the matched and the intended product (the intended product's name is a subset of a
    longer sibling product's name, and asymmetric containment scoring — by design — doesn't
    penalize the longer one). With no tiebreak signal beyond `uid` ascending for the OCR path
    (typed-style tiering doesn't apply to OCR per the doc), the winner among tied-at-1.0
    candidates is effectively arbitrary. See "Notable findings" below — this is a real, if minor,
    gap worth a mention for whoever tunes step 4 or beyond.
  - **In all 11 "broken" cases, the top-1 result is same-brand or a literal corpus duplicate —
    never a different brand.** `false_top_1` is 0.0% at the chosen threshold, confirming this
    holds in aggregate, not just by inspection of these 11.

  **Notable findings (beyond what the acceptance criteria strictly asked for):**
  1. **Typed queries never score against `candidate.brand` unless `query.brand` is set — and no
     typed call site ever sets it.** Per the doc's literal `scoreCandidate` contract
     (`if (!query.brand) return nameScore`), and since `AddProductHubScreen`/`FirstProductScreen`
     always build `{ name: fullText, origin: 'typed' }` with no `brand` field, *every* typed
     query's score comes only from matching `candidate.name` — brand words in the query
     contribute zero. In this fixture set that's largely masked because a meaningful share of
     corpus rows redundantly repeat the brand inside `name` (e.g. a row named literally `"CeraVe
     Foaming Facial Cleanser"` with `brand: "CeraVe"` too), and because the typed-tier classifier
     (which *does* look at `candidate.brand`) still ranks a true brand+name match into tier 1
     regardless of its score. But a query that's *purely* a brand fragment (e.g., typing just
     `"avene"` with nothing else) can score exactly 0 against a candidate whose `name` field
     never repeats the brand word, and gets filtered by the floor — even though "brand-only"
     search is explicitly promised by the search bar's own placeholder text ("Search by name or
     brand…"). No current fixture exercises this (all 34 typed fixtures are full brand+name
     phrases), so the harness numbers above don't reflect it, but it's a real gap. This is
     exactly what the doc's own text acknowledges and accepts ("Note the asymmetry this
     creates... which is fine") — implemented faithfully, not a bug, but flagging because it
     could show up as "why did nothing appear when I typed just the brand name" in real usage.
     Worth a look in step 3/4, or a call-site fix (e.g., typed queries could try a
     name-field-only pass and a combined-`search_norm` pass).
  2. **Typed `generic`/`short-query` fixtures still return a (wrong) result, unlike the OCR/label
     set's `generic` fixtures.** `t022`–`t025` (multi-word French descriptive phrases like
     `"creme hydratante peaux sensibles"`) and `t032`–`t034` (2–3 char prefixes `"cer"`/`"av"`/
     `"ni"`) all still match *something* at 0.55. For the short-query cases this is arguably
     correct, intended typeahead behaviour (a 3-char prefix legitimately matching some real
     brand is not a bug — it's what a search-bar dropdown is supposed to do; the fixture's
     `not_in_corpus` label reflects "no single defined right answer," not "should show nothing").
     For the multi-word generic-phrase cases, this is the class of problem 00-README explicitly
     defers to step 4 (`isCommonTerm()` / stopwords) — several descriptive words coincidentally
     overlapping with some unrelated product's name is exactly what a stopword list is for. Not
     a step-2 defect; flagging so the "is step 4 still necessary" question (asked of whoever
     runs it) has real evidence behind it, same spirit as this step's request re: step 3.
  3. **The OCR path has no tiebreak beyond `uid` ascending when multiple candidates score a tied
     1.0** (see `c009`/`c018`/`c033` above) — asymmetric containment intentionally doesn't
     penalize a longer document, but that also means an exact-length match gets no *bonus* over
     a longer sibling that happens to contain every query token. The typed path's tier system
     solves this for typed queries (tier 1 = exact match beats tier 3+ regardless of score); OCR
     has no equivalent. Low-frequency in this fixture set (3 of 49 label cases) but worth a note
     for later steps.

  **Step 3 (brand-first filtering) — is it still necessary?** Per the task's request to state
  this explicitly: **no, it does not look necessary**, on the evidence gathered here.
  `false_top_1` is 0.0% at the chosen threshold and was already 0.0% at baseline; every one of
  the 11 "broken" per-case results investigated above is same-brand (or a literal same-
  brand-same-name corpus duplicate) — never a different, unrelated brand winning top-1. Step 3's
  entire premise (hard-filtering candidates whose brand doesn't match, per 00-README's step-order
  table: "skip if step 2 already fixed `false_top_1`") is not addressing a failure mode that
  actually shows up in this fixture set post-step-2. The residual precision gaps found here
  (same-brand product-line disambiguation, OCR tied-score arbitrary tiebreak, typed generic-
  phrase false positives, typed brand-only queries) are different problems that brand-first
  filtering would not fix — the first two are "which specific product from the *correct* brand,"
  and the latter two are about non-brand signal, so hard-filtering by brand is orthogonal to all
  of them. This is a judgment call for the human maintainer to confirm, not an automatic skip —
  but the data points the same direction the doc predicted it might.

  **Concerns / anything that gave me pause:**
  - The `false_top_1` acceptance criterion's literal wording ("drops substantially") doesn't
    quite fit a baseline that was already 0.0% — documented as a wording mismatch, not a metric
    miss; the actual invariant (no cross-brand false top-1) holds.
  - Finding #1 above (typed queries never scoring `candidate.brand`) is the one I'd most want a
    human to weigh in on — it's faithful to the doc's literal contract and explicitly sanctioned
    by the doc's own prose, but a pure-brand typed query returning nothing contradicts the search
    bar's own "Search by name or brand" placeholder copy. Not fixed here since no fixture
    exercises it and the doc's contract is unambiguous; flagged for a human decision on whether a
    call-site or scoring change is warranted before/alongside step 3–4.
  - No `tsx`/harness blockers, no `npm test` regressions (118 failing before and after, same
    suites, same `palette.plumTint`/`goldenTint`/`shadow.sm` errors — confirmed pre-existing and
    unrelated via `git diff`), `npx tsc --noEmit` clean throughout.

  Next step (`04-brand-first-filtering.md`) was deliberately **not** started or read, per
  instructions — step 3 is conditional and needs a human decision informed by the finding above.

- 2026-08-23: **Step 3 (`04-brand-first-filtering.md`) — SKIPPED, human decision.** Per
  `00-README.md`'s own step-order table ("conditional — skip if step 2 already fixed
  `false_top_1`"), and the evidence gathered in step 2 plus the brand-only follow-up fix above:
  `false_top_1` is 0.0% at the chosen threshold and stays 0.0% at every swept value ≥0.55; every
  regressed case across both step 2 and the follow-up fix was individually investigated and none
  is a cross-brand false match — all are same-brand product-line confusion or corpus-duplicate
  rows, neither of which brand-first hard filtering would fix. `04-brand-first-filtering.md` was
  not read. Proceeding directly to step 4 (`05-stopwords.md`) per human direction.

- 2026-08-23: **Targeted follow-up fix (human-approved), not one of the 6 planned steps.**
  Fixes the gap step 2's own report flagged under "Notable findings" #1 above: typed queries
  never scored against `candidate.brand` because no typed call site ever sets `query.brand`
  (only OCR's `splitLabelText()` produces a segmented brand). A brand-only typed query (e.g.
  typing just `"avene"`) could score exactly 0 against every candidate whose `name` field
  didn't happen to repeat the brand word, get filtered by `SEARCH_CONFIG.minMatchScore`, and
  return zero results — contradicting the search bar's own "Search by name or brand…"
  placeholder. This is a **deliberate deviation from `03-scoring-and-cutoff.md`'s literal
  contract**, which explicitly sanctioned `if (!query.brand) return nameScore` (name-only) for
  brand-unset queries — not silently reframed as "step 2 as originally speced," recorded here as
  its own dated entry per instructions.

  **What changed:**
  - `src/services/corpus/scoreCandidate.ts` — `scoreCandidate()`'s `!query.brand` branch now
    scores `query.name` against `` `${candidate.brand ?? ''} ${candidate.name}`.trim() `` (brand
    + name combined) instead of `candidate.name` alone. `scoreField` itself is untouched — this
    changes *what text* is passed into it, not its token logic, preserving the module boundary
    the doc requires (`scoreField` holds all token-matching logic; `scoreCandidate` only blends/
    selects fields) so step 4 (stopwords) can still change `scoreField` alone. A code comment on
    the function documents this as a human-approved deviation, with a pointer to this log entry.
  - `src/services/corpus/scoreCandidate.test.ts` — 2 new tests: a brand-only query (`{name:
    'avene', origin: 'typed'}`, no `brand` field) against a candidate whose `name` field does
    NOT repeat the brand (`{brand: 'Avène', name: 'Cicalfate+ Restorative Protective Cream'}`)
    now scores `>0` (was `0` before); and a sanity check that a brand-only query against an
    unrelated brand/name (`Neutrogena`/`Hydro Boost Water Gel`) still scores `0` — confirming the
    fix doesn't introduce false positives. The pre-existing "scores on name alone when the query
    has no brand" test still passes unchanged (that fixture's candidate's `name` already repeats
    the brand, so combined-text scoring gives the same result).
  - `scripts/search-eval/fixtures/typed-queries.json` — 3 new fixtures (`t035`–`t037`), tagged
    `brand-only` (new tag, added to both `run.ts`'s `KNOWN_TAGS` and `README.md`'s tag
    vocabulary list). Each is a real corpus brand name with no product-name text, selected by
    directly probing the live corpus (`retrieveCandidates()` + old-style `scoreField(query.name,
    candidate.name)` on every retrieved candidate) to confirm the **old** name-only scoring would
    have scored literally every one of that brand's ≤100 retrieved candidates at `0` — i.e. these
    are not edge cases, they're queries that returned a hard zero-result page before this fix:
    - `t035`: `"sanoflore"` → expected `965c5e30-a108-45a7-ac0c-2ab49b3f447f` (brand `Sanoflore`,
      name `"Crème des reines riche"` — name never mentions the brand). Verified: 100/100
      retrieved candidates scored 0 under old name-only scoring.
    - `t036`: `"apivita"` → expected `5d45f4b2-eb39-49e9-9ee7-33dd5c947296` (brand `Apivita`,
      name `"Natural Dental Care Mouthwash"`). Same verification: 100/100 scored 0 before.
    - `t037`: `"akileine"` → expected `0fce7ed5-84fd-4b84-94ae-f7ec554b8740` (brand `Akileine`,
      name `"D'âme nature"`). Same verification: 100/100 scored 0 before.
    All 3 `expected` uids are the real, deterministic top-1 the fixed `search()` returns (tier 2
    — brand-starts-with — then score/rating_count/name tiebreak), verified directly against the
    live corpus, not guessed. Two brand names probed as candidates (`"vitry"`, `"gamarde"`) were
    **dropped** after discovering they have no matching rows in the live `products` table at all
    (0 results even after the fix) — not real corpus brands, despite plausibly sounding like
    skincare brand names; a lesson for anyone adding more fixtures this way: verify the brand
    exists in the corpus, don't just assume from name plausibility.

  **Harness re-run** (`npm run search-eval -- --label brand-only-fix --compare
  baselines/8c1c01f-final.json`, live corpus, 86 cases = the 83 from step 2's final baseline + 3
  new `brand-only` fixtures):

  ```
  By tag (new slice)
  slice        n   p@1    p@5    false_top1  recall@retr  no_match(real)  mean_res
  brand-only   3   100.0%  100.0%  0.0%       100.0%       0.0%            3.0
  ```

  All 3 new fixtures pass at `p@1 = 100%` — the brand-only gap is closed for these real cases
  (each previously would have returned 0 results entirely under the old scoring, confirmed
  above).

  **Regression check (`--compare baselines/8c1c01f-final.json`, the step-2 final baseline, 83
  shared cases): `broken: 0`.** No previously-passing case regressed. Unexpected bonus: **`fixed:
  3`** (`t013`, `t018`, `t031` — none of these are `brand-only`-tagged; they were pre-existing
  typed/label fixtures whose score improved because this fix changes scoring for *every* query
  with no segmented brand, not just literal brand-only ones):
  - `t013` (typo, `"avene ysteal intense concentre"`) — was `no_match(real)` (one of step 2's
    documented "wrong-answer-shown → no-answer-shown" trades, tied at 0.5 before); now correctly
    finds `c21a65ac-756b-4971-a7ad-80caab750780`. The brand token "avene" now contributes signal
    via the combined-text score instead of being invisible to the scorer, breaking the prior tie
    in the correct direction.
  - `t031` (cyrillic, `"невская косметика молочное"`) — same pattern, was `no_match(real)`, now
    correctly matches `cc0f97bb-f469-41a5-b434-3e8281ef4959`.
  - `t018` (truncation, `"cerave skin renew"`) — was matching a different CeraVe moisturizing-
    lotion product (a step-2-documented narrow same-brand precision loss); now correctly matches
    the intended `3fa86de6-da62-4d34-ad12-07be635b8c4a` ("Skin Renewing" line). Same mechanism:
    "cerave" now counts toward the score.

  `t019` (`"the ordinary natural moist"`, truncation) — explicitly checked since step 2's log
  named this as the case caused by brand-blind scoring — is **not** in the fixed list, but its
  underlying failure mode changed in a way worth recording: before this fix, its top-scoring
  candidate tied against an unrelated Colgate-Palmolive product (both scored 0.5, brand
  invisible to the tie). After this fix, all 3 top-scored candidates (score 1.0) are correctly
  `"The Ordinary"` products — the false-cross-brand tie is gone — but the query now can't
  distinguish between 3 same-brand "Natural Moisturizing Factors + {Beta Glucan / HA /
  PhytoCeramides}" variants, so `precision1` is still `false` (picks `+ Beta Glucan`, expected
  `+ HA`). This is a same-brand product-line disambiguation problem — a different, narrower gap
  than the one this fix targets, not a miss of this fix's own scope.

  **Overall/by-set metrics** (86 cases including the 3 new fixtures; compare to step 2's final
  83-case baseline for context — not apples-to-apples due to the 3 added cases, but directionally
  informative):

  ```
  Overall
                    n   p@1    p@5    false_top1  recall@retr  no_match(oov)  no_match(real)  mean_res
  step2 final       83  80.6%  94.0%  0.0%        100.0%       50.0%          4.5%            2.8
  this fix (86)     86  85.7%  98.6%  0.0%        100.0%       50.0%          0.0%            3.2

  typed
                    n   p@1    p@5     false_top1  recall@retr  no_match(oov)  no_match(real)  mean_res
  step2 final       34  74.1%  88.9%   0.0%        100.0%       0.0%           11.1%           2.6
  this fix (37)     37  86.7%  100.0%  0.0%        100.0%       0.0%           0.0%            3.6
  ```

  `no_match(real)` on the typed set drops from 11.1% to 0.0% — all 3 of step 2's own
  "wrong-answer-shown → no-answer-shown" trade cases that were typed queries (`t013`, `t019`
  partially, `t031`) improved or resolved; `false_top_1` stays at 0.0% throughout (no cross-brand
  regressions introduced). `mean_res` rose slightly (2.6 → 3.6 on typed) because brand-only and
  brand-carrying-signal queries now surface more legitimately-scored candidates instead of being
  filtered to nothing.

  Baseline JSON written (unstaged): `scripts/search-eval/baselines/8c1c01f-brand-only-fix.json`.

  **Quality gates:** `npx tsc --noEmit` clean (zero errors). `npm test`: 118 failing / 2244
  passing (same 118 pre-existing `palette.plumTint`/`goldenTint`/`shadow.sm` design-token
  failures as every prior step in this task, confirmed unrelated; +2 passing vs. step 2's 2242,
  exactly the 2 new `scoreCandidate.test.ts` regression tests added here — no new failures, no
  test-suite-shape changes elsewhere).

  **Status:** This follow-up is complete and self-contained. Step 3 (`04-brand-first-filtering.md`)
  remains un-started and unread, as instructed — this fix does not change step 2's finding that
  step 3 does not look necessary (still 0% `false_top_1`, no cross-brand false top-1 in any
  fixture, before or after this fix).

- 2026-08-23: **Step 4 (`05-stopwords.md`) implemented — down-weight generic cosmetic
  vocabulary.** Prerequisite (steps 0–2) done; step 3 formally skipped above; per the doc's step
  table, step 4 is independent of step 3.

  **What changed:**
  - `src/services/corpus/stopwords.ts` — **new file**. `COSMETIC_STOPWORDS: Set<string>`, built
    from two sources, both normalized via `normalizeForMatch`:
    1. `SEED_WORDS` — `Object.values(LATIN_COMMON_TERMS).flat()` (the same flatten
       `isCommonTerm()` in `brandCorrection.ts` uses), each entry split on whitespace/hyphen
       (multi-word seed entries like "Eau Tonique" are meaningless as a per-token Set key), minus
       `EXCLUDED_SEED_FRAGMENTS` — see below. `LATIN_NAME_TERMS` deliberately **not** reused
       (botanicals/actives are real product-name content, the opposite of noise).
    2. `HAND_ADDED_WORDS` — body-area, claim, and filler words per §1's categories in fr/en/pl/ru,
       plus a Russian product-form set (the seed dictionary has no Russian pool at all).
  - `src/services/corpus/scoreCandidate.ts` — `scoreField` modified per §2 (the *only* function
    the doc's scoring-rule section allows changing): query tokens now split into `content`
    (non-stopword) and `generic` (stopword) sets; extracted the existing token-matching loop into
    a `coverage(queryTokens, docTokens, strict)` helper reused by both. Added the `GENERIC_ONLY`
    sentinel (`-1`, out of the normal 0..1 range) returned when `content.length === 0`, with the
    exact-full-name exception (§3 last paragraph: `normalizeForMatch(queryText) ===
    normalizeForMatch(docText)` → `1`) checked first. When `generic.length === 0` (a fully-specific
    query), `scoreField` returns `contentCoverage` directly — **not** `0.85 * contentCoverage` —
    per the doc's explicit renormalization requirement. Otherwise:
    `0.85 * contentCoverage + 0.15 * genericCoverage`. All of this is gated behind
    `SEARCH_CONFIG.stopwordsEnabled`: when `false`, `scoreField` falls straight back to the
    pre-step-4 `coverage(queryTokens, docTokens, strict)` call, byte-for-byte.
    `scoreCandidate`'s 0.35/0.65 brand/name blend is untouched; the only change to
    `scoreCandidate` is the all-generic-query handling the doc itself assigns there (§3 — see
    design decision below).
  - `scripts/search-eval/run.ts` — removed `stopwordsEnabled` from `NOT_YET_IMPLEMENTED_KEYS` (it
    now has a real effect; the stale "no effect yet" warning would have been actively misleading
    for this and every future run).

  **The `!query.brand` branch design decision (explicitly requested judgment call):**
  `05-stopwords.md` §3 was written against step 2's original always-two-field
  `scoreCandidate` design ("if only one field is all-generic, fall back to scoring on the
  remaining field"). The 2026-08-23 brand-only-fix above collapsed the `!query.brand` branch
  (every typed query — no typed call site ever sets `query.brand`) to a single combined
  `candidate.brand + ' ' + candidate.name` field, so that fallback rule has no second field to
  fall back to when `query.name` alone is all-generic. Per the task's explicit instruction, this
  branch now follows the doc's own **top-level** rule instead — "if every field of the query
  returns `GENERIC_ONLY`, `scoreCandidate` returns 0" — since an all-generic `query.name` here has
  nowhere left to widen to. Implemented as: `scoreField(...) === GENERIC_ONLY ? 0 : score`. The
  two-field branch (`query.brand` set — always OCR, since `buildOcrProductQuery` is the only
  producer of a segmented brand) keeps the doc's literal §3 fallback: if both fields are
  `GENERIC_ONLY` → 0; if exactly one is → return the other field's raw score (not blended through
  0.35/0.65, since GENERIC_ONLY was never a real score to blend against).

  **Regression found and fixed during testing (not a fixture regression — a pre-existing unit
  test):** `ProductRepository.test.ts`'s "caps typed results at SEARCH_CONFIG.maxResults" test
  (a plain `{ name: 'cleanser', origin: 'typed' }` query against 20 `"Cleanser N"` candidates)
  started failing after the first draft of the stopword list, which had included "cleanser"
  (reused unfiltered from `LATIN_COMMON_TERMS`). A single-word all-generic typed query now hits
  the `!query.brand` branch's `GENERIC_ONLY → 0` rule for every candidate, so a legitimate
  category-browse query ("cleanser") returned zero results — exactly the "list too aggressive"
  failure mode the doc warns about, just caught by a unit test instead of a fixture. Root cause:
  the doc's own product-form examples (crème, cream, gel, lotion, sérum, huile, oil, baume, balm,
  mousse, masque, mask, krem, żel, крем) are all pure **texture/format** words that say nothing
  about what a product *does*; `LATIN_COMMON_TERMS` (built for a different feature — OCR brand-line
  correction) also includes **function/category** words (Cleanser, Toner, Moisturizer, Sunscreen,
  Exfoliant, Démaquillant, Essence, Ampoule, Booster, Concentrate, Elixir, Milk, Butter, Emulsion,
  Soin, Spray, Treatment, Fluid, Mist, Peeling/Scrub/Gommage) that genuinely distinguish one search
  from another. Re-curated `EXCLUDED_SEED_FRAGMENTS` in `stopwords.ts` to drop all of these (full
  reasoning and word-by-word list in the file's own doc comment) — the list went from a first-pass
  ~125 entries (almost the full unfiltered seed) down to **~78**, which also lands inside the
  doc's own "roughly 40-80" estimate instead of the first pass's overshoot.

  **A second regression found via the harness re-sweep (fixed by adding one filler word):**
  Comparing the first stopwords-enabled harness run against `baselines/8c1c01f-brand-only-fix.json`
  showed 2 "broken" cases (`c042`, `c048`, both `generic`-tagged OCR label fixtures with
  `expected: not_in_corpus`) that had previously correctly returned no_match and now surfaced a
  spurious match. Investigated per the task's instruction ("investigate ... before concluding the
  list needs trimming"): `c042`'s rawText is `"Gel nettoyant doux\nVisage et corps\nPeaux
  sensibles"` — the name field tokenizes to `[visage, et, corps, peaux, sensibles]`; every one of
  those is a stopword **except "et"** (French "and"), which was missing from the filler list (only
  "pour, avec, and, the, für, dla" — the doc's literal example set — had been added). With "et"
  treated as a real content word, `content.length` was 1, not 0, so the field never reached the
  all-generic rule at all. **Fix: added "et" to the filler category.** Re-running the harness after
  the fix resolved `c042` (`fixed: 1, broken: 0` vs. the no-"et" run). `c048` remained "broken"
  after the fix — investigated separately (see below) and found to be a legitimate scoring outcome,
  not a stopword-list defect, so left as-is.

  **`c048` investigated and NOT changed (documented per the task's instruction to record any
  fixture that regressed):** rawText `"Eau micellaire\nDémaquillant waterproof\nPeaux
  sensibles"`, `expected: not_in_corpus`, tag `generic`. After the stopword pass, this now matches
  `ee7a72d1-ddcf-45bc-8046-30f0639bba94` — a real corpus product, Uriage "Démaquillant Yeux
  Waterproof Yeux Sensibles" (queried directly from the live corpus to confirm). This is not noise:
  "démaquillant," "waterproof," and "sensibles" are all real, shared words between the query and
  this genuinely closely-related product (a waterproof, sensitive-skin-safe makeup remover). The
  fixture's `not_in_corpus`/`generic` label reflects "no single canonically-correct uid was
  assigned during fixture authoring," not "no real similar product exists" — and "démaquillant"
  and "eau"/"micellaire" are deliberately **not** stopworded (per the function-vs-texture
  distinction above and the earlier decision to exclude "eau" as too broad/risky to blanket-strip).
  Shrinking the list further to suppress this one match would mean stopwording "démaquillant"
  (already excluded as function-specific) or "eau"/"micellaire" (real, meaningful ingredient/format
  words) — both would cost more real signal than they'd gain here. Left as a known, accepted
  case; **`c048` is a good candidate for a permanent test-suite addition if a human wants to assert
  "closely-related-but-not-identical" should stay unmatched**, but that would be a fixture-design
  question (should `generic`/`not_in_corpus` allow a "plausible near-miss," or forbid any match at
  all), not a step-4 scoring defect.

  **Final stopword list — 78 entries, fr/en/pl/ru** (full list with reasoning in
  `src/services/corpus/stopwords.ts`'s doc comments):
  - product-form (texture/format only): cream/crème/krem/крем, gel/żel/гель, lotion/lotion/лосьон,
    serum/sérum/serum/сыворотка, oil/huile/olej/olejek/масло, balm/baume/balsam/бальзам,
    foam/mousse/mus/pianka/пенка, mask/masque/maska/maseczka/маска
  - body-area: visage/corps/mains/yeux, face/body/hands/eyes, twarz/ciało/ręce/oczy,
    лицо/тело/руки/глаза
  - claim/descriptor: hydratant/hydrating/nourrissant/apaisant/soothing,
    dermatologique/dermatological/sensible/sensibles/peaux/peau/skin,
    kojący/kojąca/wrażliwy/wrażliwa/skóra/dermatologiczny,
    увлажняющий/увлажняющая/успокаивающий/успокаивающая/чувствительная/кожа/дерматологический
  - filler: pour/avec/et/and/the/für/dla

  **Excluded from the seed (function/category words, not texture-noise) — see
  `EXCLUDED_SEED_FRAGMENTS`'s doc comment for the full list and reasoning:** cleanser, wash,
  nettoyant, toner, tonic, moisturizer, hydrator, milk, butter, emulsion, soin, spray, sunscreen,
  sunblock, exfoliant, peeling, scrub, gommage, démaquillant, ampoule, booster, concentrate,
  elixir, essence, treatment, fluid, mist, eau (too broad/risky standalone), solaire/soleil/
  écran/après/lavant/myjący (multi-word-split fragments, not standalone concepts).

  **Required unit tests added (all 4 named in the doc, plus supporting coverage):**
  - `scoreCandidate.test.ts` — new `describe` blocks:
    - "stopword-aware token weighting": down-weight-not-delete (0.85/0.15 split with and without
      the generic word present), renormalization to full `contentCoverage` for a fully-specific
      query, the `GENERIC_ONLY` sentinel + exact-full-name exception (`scoreField('Crème',
      'Crème')` → `1`, `scoreField('crème pour peaux sensibles', 'Unrelated Product Name')` →
      `GENERIC_ONLY`, using the doc's own canonical all-generic example phrase), the "crème mains"
      vs. "crème visage" generic tie-break (constructed with a genuine shared content anchor word,
      "cicalfate," so contentCoverage ties and the 0.15 generic weight is what actually decides
      the outcome — see reasoning below), and the `stopwordsEnabled=false` behavioral-parity check.
    - "the all-generic query rule": brand+generic-name fallback (Avène + "Crème" → scores via
      brand alone), both-fields-generic → 0, the `!query.brand` branch → 0 (no second field),
      and "Crème de la Mer" still findable (scores ≈1.0 via ordinary content-word coverage on
      "de"/"la"/"mer," none of which are stopworded — demonstrating the product is findable
      without even needing the sentinel-exception codepath, a more robust outcome than relying on
      the exception alone; the exception itself is separately covered by the `scoreField('Crème',
      'Crème')` test above).
  - `ProductRepository.test.ts` — "returns [] end-to-end for an all-generic query" (via
    `repo.search()`, not just `scoreField`'s return value, using the doc's own `"crème pour peaux
    sensibles"` example) and a `stopwordsEnabled` gate test (`describe` block mirroring the
    existing `scoringV2` gate pattern) confirming the flag genuinely reproduces pre-step-4
    behavior when off.
  - Note on the "crème mains" test: a literal 2-word `"crème mains"` vs. `"crème visage"` query
    (as the doc's illustrative sentence reads) is **itself** an all-generic query under this list
    (both "mains" and "visage" are body-area stopwords) and would hit the `GENERIC_ONLY`/`0` path
    on either side, giving no discrimination at all — that's not a bug, it's the correct
    application of §3's rule, but it makes the literal 2-word phrasing untestable as a
    demonstration of §2's 0.15-weight mechanism specifically. The test instead adds one genuine
    content anchor word shared by both queries (so `content.length > 0` and the normal weighted
    formula runs), which is what actually exercises the mechanism the doc's comment describes.

  **Harness re-run and threshold re-sweep** (live corpus, 86 fixtures, `recallLimit=100`,
  `maxResults=6`):

  Comparing `stopwordsEnabled=true` (new default) against `stopwordsEnabled=false` at the
  step-2/3 threshold (`minMatchScore=0.55`) surfaced the `c042`/`c048` finding above; after fixing
  "et," the remaining sweep was run to satisfy the doc's explicit "renormalize, then re-run the
  sweep" requirement:

  ```
  minMatchScore  p@1    p@5     false_top1  recall@retr  no_match(oov)  no_match(real)  mean_res
  0.30           85.7%  100.0%  0.0%        100.0%       12.5%          0.0%            5.2
  0.35           85.7%  100.0%  0.0%        100.0%       31.3%          0.0%            4.9
  0.40           85.7%  100.0%  0.0%        100.0%       37.5%          0.0%            4.6
  0.45           85.7%  100.0%  0.0%        100.0%       43.8%          0.0%            4.2
  0.50           85.7%  98.6%   0.0%        100.0%       43.8%          0.0%            3.8
  0.55           85.7%  98.6%   0.0%        100.0%       43.8%          0.0%            3.3
  0.60           85.7%  98.6%   0.0%        100.0%       43.8%          0.0%            2.9
  0.65           85.7%  98.6%   0.0%        100.0%       50.0%          0.0%            2.6
  0.70           85.7%  98.6%   0.0%        100.0%       56.3%          1.4%            2.4
  ```

  **`false_top_1` is 0.0% at every single swept value (0.30–0.70)** — a real qualitative change
  from step 2's sweep, where thresholds ≤0.50 briefly showed 1.5% (driven by the `t019` tie, since
  resolved by the brand-only fix). This means the step-2 tie-break criterion ("lowest threshold
  where `false_top_1` reaches 0%") no longer discriminates between candidate thresholds at all —
  it's satisfied everywhere.

  **Chosen threshold: `minMatchScore = 0.65`** (up from 0.55). Reasoning, applying the same
  underlying logic step 2 used ("raising the floor converts wrong-answer-shown into
  no-answer-shown, which is the right direction, as long as it doesn't cost real matches") to the
  new evidence: 0.50/0.55/0.60 are metric-identical (`no_match(oov)` all 43.8%, `no_match(real)`
  all 0.0%) — 0.65 is a **strict improvement** over both, verified via `--compare` (0 broken, 1
  fixed vs. both 0.55 and 0.60 — `c048` above finally clears the floor and correctly returns
  no_match, at zero cost to any other case). 0.70 is where the trade-off starts costing real
  matches (`no_match(real)` 0.0% → 1.4%, one case — investigated: `c045`, another `generic`/
  `not_in_corpus` label case moving from a wrong-answer to no-answer, not a previously-correct
  case breaking, but still the first non-zero real-match cost in the sweep). 0.65 is therefore the
  highest threshold with zero real-match cost and the best junk-filtering of the zero-cost options
  — the new knee, by the same reasoning step 2 used, just landed one step further right now that
  stopwords + the brand-only fix jointly removed the `false_top_1` floor entirely.
  `SEARCH_CONFIG.minMatchScore` updated from `0.55` to `0.65` accordingly (`searchConfig.ts`).

  **Before/after metrics** (before = pre-step-4 equivalent, i.e. `stopwordsEnabled=false` +
  `minMatchScore=0.55`, reproduced fresh on current code — byte-identical to the brand-only-fix
  baseline, confirming the flag genuinely reproduces prior behavior; after = this step's shipped
  defaults, `stopwordsEnabled=true` + `minMatchScore=0.65`):

  ```
  Overall
                  n   p@1    p@5    false_top1  recall@retr  no_match(oov)  no_match(real)  mean_res
  before          86  85.7%  98.6%  0.0%        100.0%       50.0%          0.0%            3.2
  after           86  85.7%  98.6%  0.0%        100.0%       50.0%          0.0%            2.6

  typed
                  n   p@1    p@5     false_top1  recall@retr  no_match(oov)  no_match(real)  mean_res
  before          37  86.7%  100.0%  0.0%        100.0%       0.0%           0.0%            3.6
  after           37  86.7%  100.0%  0.0%        100.0%       0.0%           0.0%            3.4

  label
                  n   p@1    p@5     false_top1  recall@retr  no_match(oov)  no_match(real)  mean_res
  before          49  85.0%  97.5%   0.0%        100.0%       88.9%          0.0%            2.9
  after           49  85.0%  97.5%   0.0%        100.0%       88.9%          0.0%            2.0
  ```

  `--compare` of the final "after" run against `baselines/8c1c01f-brand-only-fix.json`: **0 fixed,
  0 broken, 68 unchanged-correct, 18 unchanged-wrong.** Every metric is identical except
  `mean_res` (tighter tail, from the higher threshold) — on this specific 86-fixture set, step 4 is
  net-neutral: no regression anywhere (satisfying the acceptance criteria — `false_top_1` holds at
  0%, `recall@retrieval` unchanged at 100%, `no_match_rate` on real-match fixtures does not rise),
  but also no visible aggregate gain, because this fixture set only has a handful of fixtures
  (`generic`/`generic-heavy`, 17 of 86) that actually exercise generic-noise collision — the
  problem step 4 targets (a depilatory wax / hand cream / soap all ranking together on shared
  generic words) is a broader real-world OCR/typed-query pattern than this synthetic set was built
  to stress-test. The real value of this step is qualitative (down-weighting generic vocabulary
  system-wide, confirmed via the unit tests above) more than it is visible in this particular
  fixture set's aggregate numbers.

  **Regressed fixtures, named** (per the task's request — candidates for permanent test-suite
  additions): none in the final shipped state (`c042` fixed by the "et" addition; `c048`
  investigated and found to be a legitimate near-match, not a defect — see above; both are already
  documented in this entry and in `stopwords.ts`'s own comments).

  **Quality gates:** `npx tsc --noEmit` clean (zero errors, both before and after the threshold
  change). `npm test`: 118 failing / 2255 passing (same 118 pre-existing `palette.plumTint`/
  `goldenTint`/`shadow.sm` design-token failures as every prior step in this task, confirmed
  unrelated; +11 passing vs. the brand-only-fix state's 2244 — exactly the 11 new tests added
  this step: 9 in `scoreCandidate.test.ts`, 2 in `ProductRepository.test.ts` — no new failures, no
  test-suite-shape changes elsewhere).

  **Acceptance criteria (`05-stopwords.md`), checked against what was actually built:**
  - [x] Stopword list is normalized, hand-reviewed, and covers fr/en/pl/ru forms — 78 entries,
    reasoning for every exclusion/inclusion in `stopwords.ts`'s doc comments.
  - [x] Only `scoreField` changed; `scoreCandidate`'s 0.35/0.65 blend is untouched — the all-generic
    handling added to `scoreCandidate` is the doc's own explicitly-assigned exception to "only
    `scoreField` changes" (§3: "Handle it in `scoreCandidate`, not in `scoreField`'s caller
    chain"), not a blend-weight change.
  - [x] Stopwords affect scoring only — the FTS recall query is unchanged — no edits to
    `retrieveCandidates()`/`retrieveTypedCandidates()`/`retrieveOcrCandidates()` or any SQL.
  - [x] Behind `SEARCH_CONFIG.stopwordsEnabled` — verified via a dedicated gate test.
  - [x] Renormalization handled, and `minMatchScore` re-swept afterwards — done; threshold moved
    0.55 → 0.65 with the sweep table and reasoning above.
  - [x] All 4 named unit tests present (see "Required unit tests added" above).
  - [x] Harness: `false_top_1` holds at 0% (drops to 0% at every swept threshold, not just the
    chosen one); `recall@retrieval` unchanged (100.0% before/after, every slice);
    `no_match_rate` on real-match fixtures does not rise (0.0% before/after) — no list-shrinking
    needed as a result; the one investigated near-regression (`c048`) is an `oov`/`generic`
    fixture, not a real-match one, and was kept after investigation confirmed it's a legitimate
    near-match rather than an over-aggressive stopword.

  Next step (`06-word-level-fts.md`) was deliberately **not** started or read, per instructions —
  it changes the schema and requires explicit human go-ahead.

- 2026-08-23: **Real-device capture diagnostics (human-run, 9 photos), before any step-5 decision.**
  User ran 9 real device captures through the shipped (uncommitted at the time) pipeline; all 9
  fell through to manual entry ("not found"). Investigated per-case using `retrieveCandidates` +
  `scoreCandidate` directly against the live corpus (bypassing `search()`'s cutoff to see the
  pre-cutoff picture), then a direct `products` table existence check (ILIKE on user-supplied
  clean brand/name text, bypassing retrieval/scoring entirely) for the ambiguous cases. Two
  one-off scripts used and deleted after (`scripts/search-eval/_tmp-device-capture-report.ts`,
  `_tmp-existence-check.ts`) — not committed, not part of the shipped harness.

  **Result: 6 of 9 products are simply not in the corpus** (confirmed via direct table query —
  zero or clearly-unrelated hits for medipeel, eveline's serum-shot line, the specific COSRX
  AC-RX SKU, the jolika/holika sunscreen, niacynobaza, and tołpa dermo face). For these, "not
  found" is correct behavior, not a bug — no threshold or scoring change touches a coverage gap.

  **3 of 9 (AA Aloe, Skin1004 Probio-Cica, Bioderma Sensibio) are confirmed in-corpus misses:**
  scores 0.319, 0.512, and 0.000 respectively against the (then-current) 0.65 floor. Bioderma's
  0.000 is unfixable by any threshold — the OCR-read brand text had zero token overlap with the
  real brand. Skin1004 (0.512, gap 0.138) is the one genuinely threshold-adjacent case. AA Aloe
  (0.319) sits in between. Also notable: only 1 of 9 brands (COSRX) was OCR'd correctly at all —
  brand-recognition quality upstream is implicated as a major factor independent of scoring.

  Diagnosis was done on the segmented brand/name visible in the manual-entry form (UI-truncated
  with "…" for most), not the full raw OCR text — a stated limitation, not resolved in this
  entry. No code changed as a result of this investigation; it's evidence-gathering ahead of any
  step 5 / threshold-retuning decision, which remains a **pending human decision**, not concluded
  here.

- 2026-08-23: Committed and pushed to `origin/feature/ocr-improvement` (not merged):
  `2d6d537` (search-precision work: harness, steps 0/1/2/4, brand-only fix, diagnostic scripts)
  and `9f22a69` (corpus-duplicate-rows spec/tech-design, separate commit — see
  `progress/corpus-duplicate-rows.md`). Step 3 remains SKIPPED and step 5 remains
  PENDING_NEEDS_HUMAN_GO_AHEAD; neither was implemented in this push.
