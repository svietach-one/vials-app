# Task: Camera and Add-Product Form Fixes

Status: READY FOR IMPLEMENTATION
Context: continuation of work on the `add-product-accordion-wizard` flow
(see `ADD_PRODUCT_WIZARD_SPEC.md` and tasks `01`–`10` in
`add-product-wizard-tasks/`). After the first implementation pass, an OCR
regression was found (diagnosed and documented separately) along with a
number of new bugs found during manual testing. This task combines the
capture-mechanism fix and every bug found so far — implement all of it in
one pass, in the order below.

Don't guess at root causes where the bug clearly needs diagnosis first
(especially Step 1) — find the actual responsible code first, then fix it.

---

## Step 0 — Split the capture mechanism by mode (foundation for everything else)

Do this first — Steps 2–4 (manual barcode entry, field labels, active-
ingredient chips) build on top of this structure.

### Problem

`CameraCaptureModal` currently uses the same capture logic for all three
modes (`barcode`, `label`, `inci`). A barcode is scanned by a live
decoder in real time — a rectangular frame makes sense there. Text on
packaging (brand/name, ingredients) is a "take a shot → recognize" task,
not a live decode, and the text can run any direction: vertical, wrapped
around a jar, curved. A fixed frame of any single shape doesn't fit a
large share of real packaging.

### Solution

- **`mode: 'barcode'`** — leave untouched. Keeps the current live modal
  with the rectangular frame and real-time decoder.
- **`mode: 'label'` and `mode: 'inci'`** — go back to the system camera
  via `ImagePicker.launchCameraAsync({ allowsEditing: true, quality:
  0.85–1.0, base64: true })` — as it worked in the old `OcrScannerSheet`
  before commit 70df13b, before the move to a single shared modal. The
  user crops the shot themselves to the shape of the text via the system
  UI. This removes the need to compute a crop region through an
  aspect-fill coordinate transform — the most fragile part of the earlier
  fix.
- Restore the `ocrTextCleaner` call on the OCR result for `label`/`inci`
  — it must run on `rawText` before it reaches `IngredientsSection` /
  `BrandNameCategorySection`'s `splitLabelText`.

### Multi-shot capture for long ingredient lists (`mode: 'inci'` only)

After the first shot and a successful OCR pass, show a button under the
result: **"Text didn't fit? Add another shot."** Tapping it calls
`ImagePicker.launchCameraAsync({ allowsEditing: true, ... })` again. The
result of the second pass gets concatenated with a comma onto the
existing `rawText` before re-running `parseInciText(previousRawText + ',
' + newRawText)` — the parser needs no changes, since it already splits
the whole string on `split(',')`. After merging, refresh the detected-
active chips and the `inciRaw` field in form state. The "Add another
shot" button should stay available after the second shot too — don't cap
the number of attempts artificially. `mode: 'label'` doesn't need
multi-shot.

`InciScanNotice` (the Latin-characters notice) is shown before the
**first** shot in inci mode only, not again before a re-shoot — it's the
same scanning process for the same product.

### What not to touch

- The geometry, decoder, and timing of `mode: 'barcode'`.
- Don't try to compute a crop region programmatically for `label`/`inci`
  — the whole point of this fix is handing that job to the system's
  built-in crop UI instead of solving it in code.

---

## Step 1 — Camera close button doesn't work when barcode recognition fails

### Problem

If the camera can't recognize a barcode for a while, the close/cancel
button stops responding. The user gets stuck inside the modal with no
way out.

### What to do

- Find the actual reason `onClose` stops firing in this state (e.g.
  `onClose` may be wired to state that doesn't update while an active
  decode loop is running, or the tap handler is being covered by a UI
  layer during scanning).
- Verify the close button **across all three camera modes** (`barcode`,
  `label`, `inci`), not just barcode — confirm it's guaranteed to work at
  any moment, regardless of recognition state (actively decoding /
  stuck / camera error).
- Add an in-modal hint in English if recognition is unsuccessful for a
  while (e.g. after 8–10 seconds): something like *"Having trouble
  scanning? Close or enter manually."* — exact wording is up to the
  implementation, the important part is that the user gets a way out
  instead of being left in limbo.

### Done when

- [ ] The close button closes the modal in any camera state, across all
      three modes — verified manually, including simulating prolonged
      failure to recognize (blurry/damaged barcode, poor lighting).
- [ ] The English hint appears after a timeout of unsuccessful barcode
      scanning.

---

## Step 2 — Manual barcode entry when scanning fails

### Problem

If the barcode doesn't get recognized by the camera, the user has no way
to type the digits manually — the only way out is skipping the barcode
entirely.

### What to do

- Inside the `mode: 'barcode'` modal, under the scan button/area, add a
  text input for manually entering digits — styled the same as the rest
  of the app's text fields.
- Above or next to the input, a short in-modal hint: *"Can't scan? Enter
  the barcode manually."*
- **Validation:** accept only 12 or 13 digits. Both UPC-A (12 digits) and
  EAN-13 (13 digits) use the same check-digit algorithm (mod-10) —
  implement validation against it. If 12 digits are entered and the
  checksum is valid, normalize to EAN-13 by prepending `0` before using
  the code downstream (UPC-A is technically EAN-13 with a leading zero,
  so everything downstream works with the 13-digit form). No need to
  separately determine "this is specifically UPC-A" vs "this is
  specifically EAN-13" at input time — just normalize to one format.
- On invalid input (not 12/13 digits, or a failed checksum), show an
  inline error under the field; don't block further editing.
- A successful manual entry should behave identically to a successful
  scan: `dispatch({ type: 'SET_BARCODE', value: normalizedCode })`, close
  the modal, move to the next section.

### Done when

- [ ] The manual barcode input is available inside the modal at any time,
      not only after a failed scan.
- [ ] Validation correctly checks length and checksum; 12-digit input
      normalizes to the 13-digit form.
- [ ] A successful manual entry behaves the same as a successful scan.

---

## Step 3 — Labels, clear button, and scroll behavior in brand/name fields

### 3.1 Placeholders disappear and there are no field labels

**Problem:** after OCR fills the Brand/Name fields, their placeholders
disappear and there are no labels above the fields — it's unclear which
field is which.

**What to do:** add a persistent label above each field ("Brand",
"Product name") — visible at all times, whether the field is empty, still
showing a placeholder, or already holding recognized text. Don't rely on
the placeholder as the only way to tell what a field is for.

### 3.2 Field clear button

**Problem:** if OCR recognized the text badly, the only way to clear it
is the button that deletes the entire draft.

**What to do:** add a clear button (`×`) inside the active/filled input
(Brand and Name — separately for each) that clears **only the field it's
in**, not the whole Section 1 draft. It appears when the field isn't
empty; an empty field has no clear button.

### 3.3 Poor scroll/tap behavior in the product name field

**Problem:** in the Product Name field (in draft state, before saving),
scrolling to the end of a long text is broken — tapping through
characters works only up to a point, then hits a dead end. The **already
saved, editable** field (after the product is saved, reopened for
editing) scrolls and responds to taps normally. Reproduced on iOS.

**What to do:**
- Compare the text-input implementation in the draft state (Section 1,
  pre-save) against the already-saved editable field's implementation —
  these are clearly two different components or two different prop sets,
  since the behavior differs. Find the specific difference (common iOS
  causes: a fixed `height` instead of `minHeight`/`flexGrow`, missing
  `flexShrink: 1` on the parent container, a conflict between
  `scrollEnabled`/`multiline` props, or a `ScrollView` wrapper intercepting
  gestures meant for the inner `TextInput`).
- Bring the draft-state input's scroll/tap behavior in line with the
  already-working saved-field version — reuse the same base input
  component where possible instead of maintaining two different ones.

### 3.4 Brand vs. name confusion — line-assignment UI (replaces plain auto-guess)

**Problem:** after a single label scan, it's often unclear what OCR put
into Brand vs. Name — especially when recognition mixes them up. Relying
on a pure heuristic ("first line / largest text = brand") is unreliable
whenever a label has more than one plausible line (e.g. a brand name, a
sub-brand line, and a product line, all similar in size).

**What to do — replace pure auto-guessing with tap-to-assign line chips:**

- The OCR engine returns recognized text as separate lines, not one
  merged blob, for `mode: 'label'` specifically (this is already how
  Tesseract's output works — this task just means *using* the line
  breaks instead of discarding them in `splitLabelText`).
- Render each detected line as an individual chip in a "Detected text"
  pool above the Brand/Name fields (e.g. `[BIODERMA]` `[Laboratoire
  Dermatologique]` `[Hydrabio]` `[H2O]`).
- Tapping a chip shows a small two-option row: **"Brand"** / **"Product
  name"**. Tapping one appends that line's text into the chosen field
  (space-joined if the field already has content from a previous tap).
- A tapped chip stays visible in the pool, marked with a checkmark and
  dimmed — it is **not removed** — so the user can tap it again to
  reassign it to the other field if they change their mind.
- Lines the user never taps simply stay in the pool, unused — this is
  expected for subtitle/tagline lines that don't belong in either field
  (e.g. "Laboratoire Dermatologique" in the Bioderma example).
- If OCR detects only a single line of text on the whole label, skip the
  line-assignment UI entirely and auto-fill Brand directly with that
  line — the chip-picking flow only adds value when there's more than one
  line to disambiguate.
- Keep the **Swap** button between Brand and Name (as already speced) as
  a one-tap fallback for the case where the overall result is correct but
  fully reversed between the two fields.
- Keep the captured-photo thumbnail next to the fields (as already
  speced) so the user can visually cross-check against the real
  packaging without reopening the camera.
- Both fields remain freely editable text at all times — line assignment
  fills them, it doesn't lock them.

This applies to `mode: 'label'` (brand/name) only. `mode: 'inci'`
(ingredients) is unaffected — see the note at the end of Step 4 for why
ingredient parsing doesn't need this UI.

### Done when

- [ ] "Brand" and "Product name" labels are visible above their fields at
      all times.
- [ ] The clear button clears only its own field, and only appears when
      the field isn't empty.
- [ ] Scrolling and tapping through the full length of text in the draft
      Product Name field works as smoothly as in the already-saved
      editable field — verified on iOS with a long name.
- [ ] After a label scan with more than one detected line, the
      line-assignment chip pool appears; tapping a chip and choosing
      Brand/Product name fills the corresponding field; tapped chips stay
      visible and reassignable.
- [ ] A single-line OCR result skips the chip UI and auto-fills Brand
      directly.
- [ ] The Swap button still works as a one-tap fallback.
- [ ] The captured-photo thumbnail is visible next to the fields after
      scanning and opens larger on tap.

---

## Step 4 — Active-ingredient chips and raw-text visibility after OCR

### 4.1 Active-ingredient chips disappear on poor recognition

**Problem:** if OCR recognizes the ingredient list badly (not an empty
result, just a garbled set of characters), no active-ingredient chips
appear, and there's no way to select actives manually — the user gets
stuck.

**What to do:**
- The **"Choose actives manually"** button (switching to the
  `ActivesChecklist` from task 07) must be **available at all times after
  OCR**, regardless of whether the parser found a single matching active
  ingredient in the recognized text. Don't hide it only for a "fully
  empty result" — garbled text with zero matches against
  `ACTIVE_KEY_LOOKUP` looks the same to the user as an empty result, and
  should behave the same way: immediately offer a path to the manual
  checklist.
- Switching to the manual checklist must **not hide** the already-
  recognized raw text (see 4.2 below on its visibility). The user should
  be able to see exactly what was scanned while checking actives by
  hand — it helps them cross-reference against the label.

### 4.2 Raw text hidden behind a dropdown after scanning

**Problem:** right after a successful OCR pass, the raw recognized text
is hidden behind a collapsed block ("Full INCI text (raw)") that has to
be expanded manually. The user doesn't immediately see what was actually
scanned.

**What to do:**
- Immediately after OCR completes (both for `mode: 'inci'` and after
  each additional shot from Step 0's multi-shot flow), the raw-text block
  must be **expanded by default**, not collapsed. The option to collapse
  it (for users who don't want to see raw text) stays available, but the
  initial state is expanded.
- Add a clear button (`×`) for the raw text — same pattern as Step 3.2 —
  clearing only this field (resets `inciRaw` and, correspondingly, the
  `activeIngredientKeys` that came from OCR; manual checklist selections,
  if the user already made any separately, should not be touched, if
  these are distinguishable sources under `ingredientsSource: 'mixed'`).

### Note: why ingredients don't need the line-assignment UI from Step 3.4

Ingredient OCR returns one continuous block of text (the INCI list is
comma-separated, not a set of separate headline-style lines like a front
label). `parseInciText` splits that block on commas and matches known
active-ingredient names — the result is shown as chips of *found actives*
(Retinol, Niacinamide, etc.), which is a different UI problem (find known
substances inside a long string) from Step 3.4's problem (sort a handful
of short headline lines into two named fields). Nothing from Step 3.4
needs to be ported into Section 3 — the manual-checklist fallback, always-
visible raw text, and clear button already fully cover it.

### Done when

- [ ] "Choose actives manually" is visible after any OCR result,
      including garbled/unmatched text.
- [ ] Raw text is expanded immediately after scanning, no dropdown needs
      to be opened.
- [ ] The clear button clears raw text independent of manual checklist
      selections.
- [ ] Switching to the manual checklist doesn't hide already-shown raw
      text.

---

## Final check before handoff

- [ ] All checkboxes across Steps 0–4 above are checked.
- [ ] `mode: 'barcode'` hasn't regressed in any step (geometry, decoder,
      close button, now plus manual entry).
- [ ] Full end-to-end pass on a real iOS device: scan label → (if needed)
      assign lines via chips / swap → scan or manually enter barcode →
      scan ingredients with a re-shoot on a long-ingredient-list package →
      manually check actives over a poor OCR result → save.
- [ ] `npx tsc --noEmit` is clean.
