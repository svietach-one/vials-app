# search-eval

Standalone eval harness for `ProductRepository.search()`. Queries the real
Turso corpus read-only (no mocks) so precision/recall numbers reflect what
the app actually returns today, and after each step of the
`docs/tasks/ocr_improvement/` plan.

Background: `docs/tasks/ocr_improvement/00-README.md` and
`docs/tasks/ocr_improvement/01-eval-harness.md`.

## Run it

```bash
npm run search-eval
```

Requires `EXPO_PUBLIC_TURSO_HTTP_URL` / `EXPO_PUBLIC_TURSO_TOKEN` in
`.env.local` (read-only token). Writes `baselines/<git-sha>[-<label>].json`
and prints an overall / per-set / per-tag metrics table.

### Config overrides

```bash
npm run search-eval -- --set recallLimit=50 --set maxResults=6 --label sweep-1
```

`--set key=value` accepts any `SEARCH_CONFIG` key (see 00-README.md).
`recallLimit` and `maxResults` actually change this step's query behaviour;
the rest (`scoringV2`, `minMatchScore`, `segmentOcrQuery`,
`brandFilterThreshold`, `stopwordsEnabled`, `wordIndexEnabled`) are parsed
and echoed into the baseline JSON but are no-ops until the app code they
point at exists (later steps) — the script prints a note when one of those
is passed.

### Compare against a previous baseline

```bash
npm run search-eval -- --compare baselines/8c1c01f.json
```

Runs a fresh eval and prints a per-case diff (fixed / broken / unchanged)
against the given prior baseline file. The diff matters more than the
aggregate table — a change that raises precision@1 while silently breaking
previously-correct cases is not a good change, and only the diff shows that.

### Filter to one tag

```bash
npm run search-eval -- --tag typo
```

Restricts the whole run (tables + baseline JSON) to fixtures carrying that
tag. The default run always prints a full per-tag breakdown table too, so
this is mainly useful for a focused sweep.

## Adding a fixture

Edit `fixtures/typed-queries.json` (typed search-bar queries) or
`fixtures/label-captures.json` (OCR raw-text blobs, as `CaptureFlowScreen`
would pass to `search()` — multi-line, unsplit, with realistic OCR noise).

Each case needs:

```jsonc
{ "id": "t035", "query": "...", "expected": "<products.uid>", "tags": ["typo"] }
```

- `expected` must be a real `products.uid` from the live corpus, or the
  literal string `"not_in_corpus"` for a deliberately-unmatchable query.
- `tags` is required and drives per-tag reporting; use the existing
  vocabulary (`exact`, `typo`, `truncation`, `generic`, `generic-heavy`,
  `same-brand-variant`, `cyrillic`, `short-query`, `brand-only`) unless a
  later step's spec introduces a new one. `brand-only` (added by a targeted
  follow-up fix to a gap step 2's report flagged, see
  `progress/ocr-improvement.md`) is a typed query that is only a brand name,
  no product name — e.g. `"avene"`.
- For `label-captures.json`, `rawText` replaces `query` and is fed to
  `search()` unsplit (embedded `\n`s and all) — that's what the OCR path
  actually sends today. Do not pre-join lines; that would defeat the point
  of measuring today's real behaviour.
- Look up real `brand`/`name`/`uid` rows against the live corpus before
  adding a case — do not invent a uid.

No `photo` field is used in this harness. OCR device photos exist only as
local device-QA artifacts that were never committed to the repo; fixtures
are hand-constructed from real corpus rows with plausible OCR-style
`rawText` instead (dropped diacritics, truncation, stray line breaks,
occasional misread characters) — see the per-step decision recorded in
`progress/ocr-improvement.md`.
