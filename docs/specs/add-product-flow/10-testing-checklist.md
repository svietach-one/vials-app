# Task 10: Testing Checklist

Depends on: all previous task files (this is the final pass)

## Goal

Verify all-states coverage per the project's existing All-States Rule, and
run a final QA pass against `USER_STORIES.md` US-22 acceptance criteria.

## All-states matrix

| Section | Loading | Empty | Error | Data |
|---|---|---|---|---|
| Brand autocomplete | n/a — local query, sub-10ms, no spinner needed | No matches → dropdown simply doesn't render, input stays free-text | n/a — local query can't meaningfully fail | Ranked list, top 5 results |
| Label/barcode/INCI camera | Viewfinder + "Reading..." indicator during active OCR | n/a | Camera permission denied or hardware error → inline "Camera unavailable. Use manual entry instead.", modal closes back to the relevant manual path | Captured text/code shown in a brief confirmation before auto-applying |
| Ingredients checklist | n/a | Zero actives checked is valid and saves fine — not an error state | n/a | Checked chips shown with tint + checkmark |
| Save | n/a — save is instant by design, no loading state should exist here at all | n/a | Background suggest failure is silent per task 09; never shown to the user | Toast + navigation back to Shelf |

Confirm each cell above against the actual running app, not just the code
— especially the camera permission-denial path, which is easy to skip in
manual testing if the simulator/device already has permission granted.

## US-22 acceptance criteria cross-check

Go through `USER_STORIES.md` US-22 line by line and confirm:

- [ ] Camera view combines barcode scanning and OCR into a single unified
      screen concept (satisfied here via the one `CameraCaptureModal`
      parameterized by mode, launched from within the relevant section).
- [ ] Barcode found → queries `GET /api/v1/products/lookup` (unchanged,
      out of scope for this task — just confirm this flow doesn't
      regress it).
- [ ] No barcode / stable text block → this flow's Section 3, via OCR or
      checklist, replaces the described `/search` interaction for the
      not-found path per this spec's scope.
- [ ] Manual form is pre-filled with OCR-extracted text where available
      (Section 1's `APPLY_LABEL_OCR_RESULT`, Section 3's
      `APPLY_INCI_OCR_RESULT`).
- [ ] Saving adds the product to the shelf instantly, local-first (task
      09), while queuing the background suggest request.
- [ ] Newly created item appears in `productsStore` with `source:
      'manual'` immediately.
- [ ] A copy is dispatched to `POST /api/v1/products/suggest` with
      `status: 'pending'`.

## Additional feature-specific checks

- [ ] Editing any collapsed, completed section via its summary row
      preserves all other sections' data — no cross-section data loss on
      re-edit.
- [ ] Switching between OCR and manual input mid-section (e.g. scan a
      label, then manually retype the brand) works with no stale state —
      whichever `dispatch` happened most recently wins, per task 02's
      reducer design.
- [ ] `InciScanNotice` (task 05) appears every time "Scan INCI list" is
      tapped, with no persisted dismissal — confirm across multiple taps
      in one session.
- [ ] Skipping the barcode is visually equal-weight to scanning it, not a
      de-emphasized text link (task 07).
- [ ] Airplane-mode save test from task 09 passes.
- [ ] `npx tsc --noEmit` is clean across every file touched by this
      feature.
- [ ] No file in this feature imports anything AI/LLM-related — grep for
      unexpected imports as a final sanity check, since this was an
      explicit hard constraint from the start (task 00).

## Sign-off

Once every box above is checked, this feature is ready to merge. Flag
anything left unresolved (in particular, the community-counter framing
noted in task 07, if a global counter is later desired) rather than
silently deferring it.
