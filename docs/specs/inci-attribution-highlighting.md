# FE-11: Dynamic INCI Attribution and Proof-Highlighting Layer
Date: 2026-07-06
Author: planner-agent
Jira: N/A (kebab-case task slug per agent-layer-protocol.md: `inci-attribution-highlighting`)
Status: DRAFT

## 1. Problem Statement
The conflict engine correctly detects active ingredient classes from raw INCI text — for example, matching `Betaine Salicylate` against the `bha` class matcher in `src/constants/rulesets/actives.json` — but it only ever surfaces the canonical class label (`"BHA (Salicylic Acid)"`) to the user, never the literal substring it matched on. In a live user test with a Korean Centella/Propolis product, the engine correctly flagged `Niacinamide` and `Betaine Salicylate` (BHA), but the user did not trust the result: they saw `Betaine` early in the ingredient list, assumed that was the whole match, never located `Salicylic Acid` (the Western term they were scanning for), and concluded the app had glitched. Two distinct failures compound here:
- **The Hidden Alias problem:** users search ingredient text for the term they know (`Salicylic Acid`) and never find it, because the actual matched token is a regional synonym (`Betaine Salicylate`, `Salix Alba Bark Extract`) that the engine treats as equivalent but never explains as equivalent.
- **The Visual Blindness problem:** even when the right token is present in the text, long unbroken INCI blocks rendered in a narrow product-card width make it impractical for a user to manually re-derive which word the engine acted on.
Together these mean a technically correct detection is experienced as an untrustworthy black box, which directly undermines the app's core safety promise (conflict warnings must be trusted, not second-guessed).

## 2. Goals
- The engine returns, for every detected active class, the exact raw substring from the source INCI text that triggered the match (not just the canonical class key).
- A user can tap any "detected active" badge (e.g. "BHA detected") on a routine conflict warning or product detail screen and see, within one tap, the literal matched text plus a one-sentence plain-language explanation of why it counts as that class.
- Where OCR-sourced ingredient text is available with word-level coordinates, the matched token's on-image location is available to the frontend for overlay highlighting.
- Confusing aliases (i.e. matchers whose matched string commonly diverges from the class's Western/common name) have an explicit, localized micro-copy override distinct from the generic class explanation.

## 3. Non-Goals (explicitly out of scope)
- Live camera preview with real-time highlighting overlay (requires a Dev Build + on-device ML Kit; the existing OCR pipeline in `docs/tech-design/ocr-scanner.md` is a one-shot still-image WebView/tesseract.js flow, not a live camera stream).
- Highlighting on the clipboard-paste OCR path — pasted text from the user's native Live Text/Google Lens has no bounding-box data and never will; the explainer tooltip (Step 1) is the only proof layer available on that path.
- Automatic translation of non-Latin INCI text — out of scope per existing `docs/specs/ocr-scanner.md` Non-Goals; this feature only adds attribution for text already accepted by the existing pipeline.
- Retroactive re-OCR of products added before this feature ships — products with `fullIngredientText` but no stored bounding boxes fall back to the tooltip-only explainer (Step 1), never the image overlay (Step 2).
- Editing or correcting misdetected matches from this UI — disputing a match is a future feedback-loop feature, not part of this task.

## 4. User Stories

### Story 1: Tap a detected-active badge to see the literal match
As a user reviewing a conflict warning or product detail screen, I want to tap the "BHA detected" badge and see the exact ingredient-list text the app matched, so that I can verify the detection myself instead of taking it on faith.

**Acceptance Criteria:**
- [ ] Given a product's `fullIngredientText` triggered the `bha` class via the `betaine salicylate` matcher, when I tap the "BHA detected" badge, then a tooltip/sheet shows `Matched: "Betaine Salicylate"` alongside the canonical label `BHA (Salicylic Acid)`.
- [ ] Given the matcher that fired has a registered alias override (see Section 6), when the tooltip opens, then it shows the override micro-copy (e.g. "We found Betaine Salicylate. This is a gentle Korean form of BHA synthesized with moisturizing Betaine.") instead of the generic class description.
- [ ] Given the matcher that fired has no alias override, when the tooltip opens, then it falls back to the class's existing `displayName` plus its generic properties-derived description — never a raw error or empty state.
- [ ] Given a product has multiple matchers of the same class firing on different substrings (e.g. both `Salicylic Acid` and `Willow Bark` present), when the tooltip opens, then all matched substrings are listed, not just the strongest-potency one.

### Story 2: Visual highlight on the scanned label image
As a user who scanned a product label via the image-OCR path, I want the exact matched words highlighted on the photo I took, so that I can see with my own eyes where the detected ingredient sits in the text.

**Acceptance Criteria:**
- [ ] Given a product was added via the image-OCR path (`OcrScannerSheet`, photo/gallery, not clipboard paste) and word-level bounding boxes were captured, when I open that product's detail screen and tap a detected-active badge, then a "View on label" option is shown in addition to the text tooltip.
- [ ] Given I tap "View on label", when the stored label image renders, then a highlight box is drawn over the coordinates of every word contributing to that match (e.g. both words of "Betaine Salicylate").
- [ ] Given the product has no stored bounding-box data (clipboard-paste path, or added before this feature shipped), when I tap the detected-active badge, then no "View on label" option is shown — only the Story 1 tooltip.
- [ ] Given the stored image has been deleted or is unavailable, when I tap "View on label", then an inline message "Original label photo is no longer available" is shown, and the tooltip from Story 1 remains accessible.

### Story 3: Alias transparency directly on the badge
As a user quickly scanning a routine's conflict warnings, I want a visual cue distinguishing "we matched the exact term you'd expect" from "we matched a regional alias," so that I know at a glance which badges are worth double-checking before I even tap them.

**Acceptance Criteria:**
- [ ] Given a matcher has a registered alias override, when its badge renders, then it carries a small "alias" indicator (icon + `accessibilityLabel`, e.g. "Detected via regional ingredient name") distinct from badges matched on the canonical/Western term.
- [ ] Given a matcher has no alias override, when its badge renders, then no alias indicator is shown.

## 5. UX / Behaviour
**Entry points:** existing "detected active" badges already rendered per `docs/tech-design/routine-redesign.md` conflict warnings, and equivalent badges on the product detail screen's ingredient summary.

**Tooltip/sheet (Story 1):**
1. Tap target: the existing badge component (no new entry point needed).
2. Opens a small popover (or bottom sheet on narrow screens) anchored to the badge.
3. Header: canonical class `displayName`.
4. Body: one row per matched substring — literal matched text in quotes, plus its micro-copy (override or fallback).
5. If bounding-box data exists for at least one matched substring: a "View on label" secondary button.
6. Dismiss: tap outside, swipe down, or close icon — same pattern as existing sheets in the app (`OcrScannerSheet` close behaviour).

**Image overlay (Story 2):**
1. "View on label" opens a full-screen image viewer showing the originally scanned photo.
2. Semi-transparent highlight rectangles are drawn at the stored word coordinates for the matched token(s), scaled to the rendered image size.
3. A caption below the image repeats the matched text and class name.
4. Standard pinch-to-zoom/close affordances.

**Alias indicator (Story 3):**
- Small icon (not color-only, to satisfy the app's existing accessibility bar) appended to the badge, with its own `accessibilityLabel` — badges are already read by screen readers per the existing conflict-warning component contract.

**Error / empty states:**
- No bounding boxes stored → no "View on label" button (Story 2, AC 3).
- Stored image missing/deleted → inline message, tooltip still functions (Story 2, AC 4).
- No alias override registered for a matcher → silent fallback to generic class copy (Story 1, AC 3); this must never present as a missing-content error.

## 6. Data Requirements
- **New data — attribution on match:** the parser's output per matched class must additionally carry the literal substring(s) matched and which matcher fired, not just the class key and potency (see tech design for the exact shape).
- **New data — alias overrides:** a new keyed lookup (matcher-level, not class-level) of localized override copy for matchers whose matched string is likely to differ from what English-speaking users expect. Lives alongside `src/constants/rulesets/actives.json` per Section 4 below.
- **New data — OCR word coordinates:** the existing `OcrScannerSheet` image-OCR path (tesseract.js in a hidden WebView) already computes per-word bounding boxes internally (`result.data.words` in tesseract.js's output) but currently discards everything except `result.data.text`. This feature must persist `{ text, x0, y0, x1, y1 }` per word alongside the scanned image reference, scoped to the product record.
- **New data — scanned image persistence:** to show "View on label," the source image (or a reference to it) must outlive the OCR session, which is a change from the current OCR spec's explicit "images are never stored" constraint (`docs/specs/ocr-scanner.md` Section 8). This is a deliberate, scoped exception — see Open Questions.
- **Existing data consumed:** `fullIngredientText`, `activeIngredients`, `activeTags` on `Product` (`src/types/index.ts`); `INGREDIENT_CONFLICT_RULES` / class matchers in `src/constants/rulesets/actives.json`.
- **Data retention:** scanned label images (if the Open Question below resolves to "store them") persist for the lifetime of the product record and are deleted on product deletion, consistent with the app's existing local-only, no-cloud storage model.

## 7. Dependencies
- Depends on spec: `docs/specs/ocr-scanner.md` (image-OCR pipeline this feature extends) and the routine conflict-warning UI described in `docs/tech-design/routine-redesign.md`.
- Blocks: nothing downstream; this is an additive trust/transparency layer over already-shipped conflict detection.
- External services: none new. Continues to use the existing on-device tesseract.js-via-CDN pipeline; no new network calls.

## 8. Security & Privacy
- Authentication required: no (same as existing conflict/product screens).
- Data sensitivity: if the Open Question below resolves to storing label photos, this elevates data sensitivity versus the current OCR spec, which explicitly discards images after one session. Any stored image is still local-only (AsyncStorage/filesystem), never uploaded, consistent with the app's zero-cloud Phase 1 constraint.
- Compliance: no new PII category introduced (label photos of a user's own cosmetic products); still fully local-only, no third-party transmission.

## 9. Success Metrics
- In moderated user testing, at least 90% of participants shown a "Hidden Alias" match (e.g. Betaine Salicylate → BHA) correctly state, after viewing the tooltip, which word triggered the detection and why it counts as that class.
- Zero unhandled/crash states when tapping a detected-active badge for a product with no stored bounding boxes (must always degrade to the Story 1 tooltip).
- Support/feedback reports of "the app is wrong / made this up" for ingredient detection decrease measurably after release (baseline to be established from the incident that prompted this task).

## 10. Open Questions
- [ ] Should scanned label images be persisted per-product to support Story 2, overriding the current "images are never stored" constraint in `docs/specs/ocr-scanner.md`? This is a Type A business/privacy-posture gap, not a technical one. → owner: product owner (svietach@gmail.com), must be resolved before FE-11 tech design's Story 2 tasks are scoped for implementation; Story 1 and Story 3 do not depend on this answer and can proceed independently.
- [ ] Who curates and reviews the alias-override copy (Section 6) for accuracy — is dermatological/cosmetic-chemistry review required before an override ships, or is engineering judgment sufficient for Phase 1? → owner: product owner.
