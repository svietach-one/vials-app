# Investigation: Detecting an Incomplete Ingredient-List Capture

Status: INVESTIGATION + PROPOSED PLAN — nothing implemented.
Date: 2026-09-06
Scope: single-photo INCI capture (round jars, tall/long packaging).

---

## 1. The problem

The ingredient-photo capture flow (used by "Explore Composition", the
add-product wizard's "Read label"/ingredients photo, and Shot 2 of
`CaptureFlowScreen`) takes exactly **one** photo and hands whatever OCR read
straight to the next screen. Two package shapes routinely break this
assumption:

- **Round jars** — the INCI text wraps around a cylinder. A single flat
  photo can only ever see part of the circumference; the rest is around the
  back, physically out of frame.
- **Long/tall packaging** (tubes, narrow boxes) — the ingredient panel is
  taller than the label can be shot at a distance that keeps the print
  legible to the OCR engine.

In both cases the OCR engine (Tesseract) still returns a confident, clean
string — it has no idea the physical label continued past the frame. The app
currently cannot tell "this is the whole list" apart from "this is half the
list," and the user is never told the capture might be incomplete.

---

## 2. Current flow (traced from the "Explore Composition" button)

1. `CatalogScreen` → tap "Explore Composition" → navigates to
   `ExploreCompositionCaptureScreen`.
2. User picks a required category chip, then taps the "Take a photo" tile
   (`ScanTile`) → `handlePhotographPress` opens `CameraCaptureModal` in
   `mode="inci"`.
3. `CameraCaptureModal`'s `OcrPhotoFlow` shows the OS "Take Photo / Choose
   from Gallery" alert, hands off to the system camera
   (`expo-image-picker`, no crop step, full frame), and shows a "Reading
   text…" overlay while the shared hidden-WebView Tesseract engine
   (`OcrEngineWebView.tsx`) processes the photo.
4. `OcrEngineWebView` downscales the image, runs `worker.recognize(...)`,
   and gets back structured `blocks → paragraphs → lines → words`, each word
   carrying a pixel bounding box (`x0,y0,x1,y1`) and a confidence score.
   `filterOcrNoise(msg.lines)` uses this geometry to drop low-confidence/
   undersized words, then **only the resulting flat string** is passed
   outward via `onResult(text)`. The bounding-box geometry is discarded at
   this point and never reaches the caller.
5. Back in `CameraCaptureModal.OcrPhotoFlow.handleOcrText` (mode `'inci'`),
   the string is cleaned (`ocrTextCleaner`), and if non-empty,
   `onCapture({ mode: 'inci', rawText: cleanedText, ... })` fires
   **immediately** — no preview, no confirmation step.
6. `ExploreCompositionCaptureScreen.handleCapture` → `goToResult` trims a
   trailing Directions/Warnings/manufacturer section
   (`extractIngredientSection`) and navigates straight to
   `ExploreCompositionResultScreen`, which is the first place any ingredient
   text is shown to the user.

The same `CameraCaptureModal` (`mode="inci"`) choke point is also used by
`CaptureFlowScreen` (Shot 2), `IngredientsSection`, and
`BrandNameCategorySection`'s "Read label" helper — four call sites, one
shared component. A second, older component, `OcrScannerSheet.tsx`, runs an
equivalent pipeline independently and is used only by the legacy
`ManualProductFormScreen`.

**The gap:** between step 5 (OCR text ready) and step 6 (navigate away),
nothing asks "does this look complete?" That is the only point in the whole
journey where the decision needs to be made — everything before it (camera
hand-off, OCR itself) and everything after it (the Result screen) can stay
exactly as they are.

---

## 3. Is detection feasible?

Yes, without any new dependency or engine change — the raw material already
exists, it is simply thrown away one step too early (end of step 4 above).

Signals available from the geometry `OcrEngineWebView` already computes,
ranked by expected reliability:

1. **Text touching the frame edge mid-word** — a word bbox with `x1`/`x0`/
   `y1` within a few px of the image boundary, where that word is not a
   complete token. Strongest signal; directly matches "the camera physically
   cut the label off."
2. **No recognized section-end marker** — `ingredientSectionExtractor.ts`
   already lists real closing markers (Directions, Warnings, Made in, …).
   Their total absence, combined with (1) at the trailing edge, corroborates
   truncation rather than a natural ending.
3. **Line-baseline curvature / mid-line gap** — on a cylindrical jar a
   single physical line bows across a photograph taken off-axis; word
   vertical centers drift systematically, or a line shows one large
   horizontal gap consistent with a chunk wrapped around the back of the
   jar. Computable from the same per-word bboxes.
4. **No recognized opening marker** — first word hard against the left/top
   edge, no "Ingredients"/"INCI" header before it: capture likely started
   mid-list.
5. **Weak/secondary: no "Aqua/Water" anywhere** — most, not all, formulas
   list water first; only useful as a tie-breaker, unreliable alone
   (anhydrous products).

None of these is proof by itself. The realistic design is a combined score
crossing a threshold, feeding a **dismissible** prompt — never a hard block —
matching this project's existing "manual fallback always available" rule
(`CLAUDE.md`) and the "not found is not an error" tone precedent in
`docs/tasks/ux-explore-vials/07-capture-flow.md` §6.

---

## 4. Merging two shots: text-level, not image-level

A round jar's label is on a cylinder viewed from outside; true panorama-style
image stitching would need per-device camera intrinsics and jar-radius
estimation to dewarp it — disproportionate for this stack (Expo + a hidden
WebView running Tesseract, explicitly zero-marginal-cost per
`docs/specs/ocr-scanner.md`).

The simpler and more robust option: **OCR each shot independently, merge the
recognized token streams, not the images.**

- Tokenize both results with the ingredient tokenizer already used elsewhere
  (`tokenizeIngredientsText`, consumed by `resolve.ts` /
  `shelfComparison.ts` / `useCompositionInsights.ts`).
- Find the overlap between the tail of shot 1's tokens and the head of shot
  2's, using fuzzy (edit-distance / normalized-INCI) matching rather than
  exact equality, since OCR noise means the same ingredient can read
  slightly differently between the two shots.
- Concatenate with the overlap deduplicated.
- Reliability improves substantially if the capture UX explicitly asks for a
  little physical overlap ("keep the last couple of ingredients visible when
  you start the second photo") instead of expecting the algorithm to align
  two disjoint fragments blind.

This is the same idea used for subtitle/caption segment stitching, and it
reuses tokenization logic this codebase already has, rather than introducing
image-processing code.

---

## 5. Proposed implementation plan

Kept self-contained inside `CameraCaptureModal`'s `OcrPhotoFlow` wherever
possible, so the four call sites (`CaptureFlowScreen`,
`ExploreCompositionCaptureScreen`, `IngredientsSection`,
`BrandNameCategorySection`) need no changes — the modal already owns
re-prompting the user on failure (`showOcrError`'s "Try Again"), so a second
capture-and-merge round trip can live entirely inside it the same way.

### Step 1 — Stop discarding OCR geometry
Files: `src/components/camera/OcrEngineWebView.tsx`
Extend the `onResult` callback contract to also pass a lightweight
completeness signal (or the raw `lines`) alongside the filtered text — the
noise-filter's own consumption of `msg.lines` is unchanged. Additive only;
no existing behavior changes.

### Step 2 — Completeness heuristic (pure util, unit-tested)
Files: `src/utils/productForm/ocrCaptureCompleteness.ts` (+ co-located
`.test.ts`)
Implements signals 1–5 from §3 as a scored function taking word/line
geometry + the cleaned text, returning something like
`{ looksTruncated: boolean, reasons: string[] }`. No React, no store, no
I/O — pure logic per `.claude/rules/architecture-review.md` §2.

### Step 3 — Token-level merge (pure util, unit-tested)
Files: `src/utils/productProfile/mergeIngredientCaptures.ts` (+
`.test.ts`)
Takes two raw ingredient strings, tokenizes both with the existing
`tokenizeIngredientsText`, finds the fuzzy tail/head overlap, and returns one
merged, deduplicated string. Pure, testable in isolation with hand-built
overlap fixtures (no live OCR needed for the test suite).

### Step 4 — Wire the branch into `OcrPhotoFlow`
Files: `src/components/camera/CameraCaptureModal.tsx`
In `handleOcrText` (mode `'inci'`), after the existing empty-text check and
before `onCapture(...)`: run the Step 2 heuristic. If flagged, show an
`Alert` (same shape as the existing `hadNonLatin`/`showOcrError` alerts):
"Looks like the list continues — capture the rest?" → **Capture the rest**
re-opens the picker for a second shot, merges via Step 3, then re-runs the
heuristic once more on the merged text (so a still-incomplete third shot can
be caught too) before finally calling `onCapture`. **This is the whole
list** proceeds exactly as today.

### Step 5 — Types
Files: `src/types/index.ts`
No change expected for `CaptureResult`/`CaptureMode` if Step 4 stays fully
internal to the modal (the caller only ever sees the final, possibly-merged
text) — flag this as the one point to revisit if internal state turns out
not to be containable.

### Step 6 — `OcrScannerSheet` parity decision
Files: `src/components/product/OcrScannerSheet.tsx`
Separate legacy pipeline (only `ManualProductFormScreen`). Decide whether to
backport the same check or leave it — open question, see §6.

### Step 7 — Device QA before merge
This codebase has a standing lesson (recorded from the crop-removal
regression and the Tesseract v5 `data.words` shape change): heuristics that
look right in code have broken on real devices before. Before merging,
gather a handful of real photos of round jars / long tubes shot the way
users actually shoot them, and check that signals 1–3 actually correlate
with "the list is genuinely incomplete" on real Tesseract output — the
curvature signal (§3.3) is the one most likely to need threshold tuning
against real data.

### Step 8 — Quality gates
`npx tsc --noEmit` clean; new unit suites green; existing
`add-product-flow` / `productForm` / `explore-composition` suites unaffected
(Step 4's change is additive — the "use as is" path is byte-identical to
today's behavior).

---

## 6a. Real-device QA result (2026-09-06) — shipped OFF

Implementation landed on `feature/ocr-incomplete-capture` and was tested on a
real device the same day. Result: the prompt fired on **nearly every**
capture, not just genuinely truncated ones, and the induced extra shots made
the pre-existing ~10s OCR timeout ("scanner timed out") show up far more
often simply from more OCR passes being attempted per product.

**Root cause**: the edge-touch signals (§3.1–§3.4) assume text sitting near
the frame border means the physical label continues past it. But this app's
capture design has no crop step and explicitly instructs filling the frame
at arm's length (`OcrEngineWebView.tsx`'s `MAX_DIMENSION` comment) — so a
normal, complete, well-framed photo *also* routinely has text running to all
four edges. The heuristic can't currently tell "user filled the frame well"
apart from "label continues past the frame," which is most of what it was
built to detect. This is exactly the calibration risk flagged in the
original §7 plan, now confirmed rather than hypothetical.

**Action taken (2026-09-06)**: gated the whole prompt/retry/merge path
behind a new `OCR_INCOMPLETE_CAPTURE_PROMPT_ENABLED` flag, default OFF, then
— when that still wasn't enough (see below) — fully reverted
`CameraCaptureModal.tsx` and `OcrEngineWebView.tsx` to their exact
`origin/dev` state, byte-for-byte, so there was zero risk any of this
session's wiring was contributing to what turned out to be real, on-device
"nothing recognized" and "scanner timed out" reports. The detection/merge
utils (`ocrCaptureCompleteness.ts`, `mergeIngredientCaptures.ts`) and their
unit tests were kept, unwired, for future calibration work.

**Follow-up (2026-09-09, code review)**: the flag was later found to have
zero consumers anywhere in `src/` — its own doc comment claimed it gated
retry/merge wiring in `CameraCaptureModal.tsx` that, after the full revert
above, no longer existed there at all. Deleted rather than fixed: a dead
flag with a misleading comment is worse than no flag. `ocrCaptureCompleteness.ts`
gained a doc note flagging an additional real gap found in the same review —
it assumes each line's words are already left-to-right and `lines` already
top-to-bottom, unverified, which is exactly the assumption most likely to
break on the curved-jar case it targets — left as a known gap rather than
fixed, since the whole approach needs rethinking first (next paragraph).

**Before re-enabling**, the geometry approach itself likely needs to change,
not just the thresholds — e.g. distinguishing "the printed label's own
edge/margin is visible in the photo" (complete) from "the photo's border
itself cuts through print with nothing beyond it" (truncated) would need
information this heuristic doesn't currently use (such as detecting the
physical package edge/background transition in the frame, not just text
bounding boxes).

## 6b. A second, unrelated root cause found via real OCR evidence (2026-09-09)

Continued device testing surfaced a case where a photo captured cleanly
(flat surface, no curvature) still produced an empty Composition result —
"No known active ingredients detected" — even for a fully-legible shot. This
was NOT the truncation problem above. Diagnosis method: rather than guess,
ran the actual `tesseract.js` v5 pipeline (same worker langs, downscale
target, and `ocrNoiseFilter.ts` thresholds as the app) against the real
device photos in an isolated scratch environment, then ran the real
`extractIngredientSection` against that real output.

**Root cause**: `extractIngredientSection` (`ingredientSectionExtractor.ts`)
cuts the text at the FIRST section-stop marker found anywhere, assuming
ingredients always print before Directions/Warnings. The tested product (a
Farmapol serum box) prints Action → How to use → Warnings → Instrumental
test results, THEN the ingredients list — the opposite order. The function
cut at "How to use" near the very start, discarding the entire real
ingredient list, on both a full-width shot and a close-up shot of the same
box.

**Fix shipped**: `extractIngredientSection` now first searches for the real
ingredients-list OPENING marker ("Ingredients"/"INCI"/"Composition", and
critically "Ingriedents" — the box's own misprint, correctly read by
Tesseract), scored by how many ingredient-shaped tokens follow each
candidate occurrence (rejects prose disguised as a comma list), and extracts
forward from the highest-scoring one. Falls back to the original
first-stop-marker behavior when no header clears the bar, so the 9
pre-existing tests are unaffected. Two anchor strategies were tried and
rejected before this one: anchoring on a colon (`ocrTextCleaner` strips
colons before this text is ever seen — verified, not assumed) and accepting
any header followed by ≥2 commas (breaks a real case: "Warnings ... any of
the ingredients, consult a doctor, discontinue..." would misfire on the
prose "ingredients" mention). A "first qualifying occurrence" selection
strategy was also tried and reverted after it broke both real photos (an
earlier spurious mention's lookahead window can reach far enough to borrow
score from a real header later in the text) — kept the original
highest-score selection, documented as a known limitation for the narrow
case where a genuine header's immediately-following names are unusually
long. Verified against both real photos, all 9 original tests, and a
constructed regression case (ingredients-first + a later unrelated mention
of the word "ingredients"), with all three confirmed via runnable tests, not
inspection — code review then caught and fixed two more real bugs in this
same function: `stripTrailingNonLetterToken` only stripped one trailing
junk token instead of looping (a stray page number AND a batch number would
leave one behind), and the fallback branch duplicated `cutAtStopMarker`'s
logic instead of calling it.

## 6c. Stage 1 (manual reshoot) implemented (2026-09-09)

With `extractIngredientSection` fixed, the original framing problem (§1)
was revisited with the lesson from §6a applied: no auto-detection.
`ExploreCompositionCaptureScreen.tsx` gained the same manual "Text didn't
fit? Add another shot." control `IngredientsSection.tsx` already had,
merging a second shot onto the first via `mergeIngredientCaptures.ts` (now
no longer dormant). This changes the screen's previously-documented "instant
navigate, no intermediate step" contract for the PHOTO path only — after a
capture the screen now pauses on an explicit Continue/Add-another-shot
choice; the PASTE path is unchanged. The existing test suite's test pinning
the old instant-navigate contract was updated deliberately, not broken
accidentally, and a new test covers the merge-on-second-shot path.

## 6d. UX polish + a third bug, both from real user testing (2026-09-09)

**UX feedback after using Stage 1**: no visual confirmation a photo actually
attached, no indication whether a second shot replaces or adds to the
first, no feedback distinguishing 1 vs. several photos, no guidance on how
to actually take a useful second shot. Addressed: each shot now renders as
a real thumbnail (from `sourceUri`) so every photo taken is visibly
accounted for; the status line shows a live "N ingredients recognized" (or
"N photos combined — M ingredients recognized" for 2+), computed the same
way the Result screen will count them; and a hint under "Add another shot"
explicitly says the shot "will be added to what we already read, not
replace it," plus how to actually get new content ("turn the jar or unfold
the label to show what's left").

**Third bug, found because that live count made it visible**: after
merging a real second shot, the ingredient count didn't increase even
though the second photo clearly contained new ingredients. Diagnosed with
the same method as §6b — ran the actual Tesseract pipeline on the user's
real two photos, then the actual `mergeIngredientCaptures` and
`extractIngredientSection` over the real output, rather than guessing.
**Confirmed NOT a merge bug**: overlap detection correctly found 0 overlap
and concatenated both shots' full text. The loss happened at the
*extraction* step: shot 1's own photo happened to also capture its
"Made in Poland by:" manufacturer footer, so once shot 2's genuinely new
ingredients (Isopropyl Myristate, Cetearyl Alcohol, Hydroxyacetophenone)
were appended after it in the merged string, `extractIngredientSection`'s
single "cut at the first stop-marker after the header" pass stopped at
shot 1's own "Made in" and silently discarded everything shot 2
contributed.

Two more targeted fixes were tried and rejected before shipping the one
below — both still lost the data, for the same underlying reason: a
single "cut at the first marker" pass cannot safely process text stitched
from more than one shot, because a stop-marker-like phrase from an earlier
shot's own tail (or embedded within a later, headerless shot's own
fragment, ahead of ITS real ingredient tail) will always precede later
genuinely-new content in the concatenation.
- Extracting each shot individually before merging: shot 2 alone has no
  header of its own to anchor on (it's a mid-label continuation), and its
  own warnings sentence sits before its own real ingredient tail — so
  per-shot extraction discards the same content, just earlier.
- Extracting incrementally at each merge step (clean the accumulator
  before appending the next raw shot): the *last* shot in the sequence is
  still left unextracted in the accumulator, so a final trim is still
  needed somewhere, and applying one hits the exact same problem.

**Fix shipped**: `extractIngredientSection`'s trim is applied only when
exactly one photo (or paste) contributed. Once 2+ photos are merged, the
full concatenation (already deduplicated by `mergeIngredientCaptures`) is
used as-is — no further trimming. This trades a noisier ingredient count
for 2+-photo captures (some Directions/Warnings prose can show up as fake
tokens) for the much more important guarantee of never silently dropping
real ingredient data — consistent with this module's own long-standing
"under-filtering over over-filtering" principle. The live count and the
final navigated text now use the same `finalizeCapturedText` logic, so
what the user sees always matches what actually gets analyzed. A
regression test locks in the exact real-world shape (a first shot with its
own trailing junk, a second shot with genuinely new ingredients).

**Known follow-up, not chased today**: for 2+ photos, the ingredient count
can look inflated (prose fragments counted as fake tokens) since no
trimming happens at all. A more surgical fix — cleaning obviously-safe
per-shot junk without risking the data loss above — would need more real
multi-shot samples to design against, not a fourth guess today.

## 6e. Code review found two real gaps in the §6d fix (2026-09-09)

Before committing, `/code-review` caught two issues in the single-vs-multi-
shot logic itself, both fixed:

- **The multi-shot decision used the wrong signal.** `finalizeCapturedText`
  checked `capturedPhotoUris.length > 1`, but that array only grows when a
  shot's `sourceUri` is truthy — and `CameraCaptureModal.tsx` sets it from
  `assets[0]?.uri ?? null`, so it can legitimately be null. A null
  `sourceUri` on either shot would have undercounted the shots and silently
  re-enabled the extraction pass on a multi-shot merge — reintroducing the
  exact data-loss bug from §6d. Fixed with a dedicated `shotCount` counter,
  incremented unconditionally on every capture regardless of `sourceUri`;
  `capturedPhotoUris` is now used only for the thumbnail display, never for
  this decision. A regression test simulates both shots returning a null
  `sourceUri` and confirms the merge still isn't wrongly trimmed.
- **`explore_capture_started` started firing once per shot instead of once
  per flow.** This event predates Stage 1 (docs/tasks/explore_insights/
  07-analytics-events.md) and was designed as a single per-flow signal,
  compared against `explore_result_viewed` in a funnel. Once "Add another
  shot" could call `handleCapture` more than once per logical flow, the
  untouched `trackEvent` call inside it started firing on every shot,
  inflating flow-start counts relative to completions with no design
  discussion behind it. Fixed by gating the call on `capturedIngredientsText
  === null` (this is the first shot of the flow). A regression test asserts
  it fires exactly once across a two-shot capture.

A third finding (the live count and `handleContinue` both recomputing
`finalizeCapturedText` from scratch on every unrelated re-render) was a
real but minor inefficiency, not a correctness bug — fixed by memoizing the
result with `useMemo` and having both call sites read the memoized value.

## 6. Open questions (need a decision before implementation starts)

- **UX interruption vs. existing AC** — `ExploreCompositionCaptureScreen`'s
  header comment states Story 1 AC2/AC3: "either path navigates straight to
  Result the instant capture completes." A confirmation alert before
  `onCapture` doesn't lose or strand the text (same pattern as the existing
  `hadNonLatin` alert), but it does add a tap before that promised instant
  transition. Needs sign-off from whoever owns that spec — Type A/B gap per
  `.claude/rules/tech-design-template.md`, not something to assume silently.
- **Threshold tuning source** — do real device photos of round jars/tubes
  exist anywhere to calibrate against, or does this need a fresh device-QA
  round (as Step 7 assumes)?
- **`OcrScannerSheet` parity** — worth the duplicate implementation, or is
  that legacy path scheduled for removal/consolidation into
  `CameraCaptureModal` first?
- **Continuation-shot cap** — how many extra shots should the retry loop
  allow before giving up and accepting whatever was merged (to avoid
  trapping a user in a loop on a package the heuristic keeps misreading)?
