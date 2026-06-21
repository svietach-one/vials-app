# OCR Ingredients Scanner
Date: 2026-06-21
Author: planner-agent
Status: APPROVED

## AI-SDLC Flags
```
backend_layer:  false
frontend_layer: true
infra_changes:  false
```

## 1. Problem Statement
Users currently cannot digitize a product's ingredient list without typing it in manually. The existing "Scan Ingredients" button in Step 3 of AddProductModal calls `handleMockOcrScan()`, which injects hardcoded fake text. This means real ingredient detection, conflict checking, and routine recommendations are blocked until the user laboriously types every INCI name. Users who scan many products abandon the ingredient field entirely, reducing the quality of all downstream features.

## 2. Goals
- Replace the mock scan function with a real two-pathway OCR flow that runs entirely on-device or via a free CDN resource (zero marginal cost per scan).
- Users can paste Live Text / Google Lens results from their native camera app in under 5 taps.
- Users can pick or take a photo and receive extracted ingredient text within 30 seconds on a mid-range device with a stable connection.
- Extracted text is automatically sanitized and fed into the existing ingredient parser so active ingredients are detected without any extra user action.

## 3. Non-Goals
- Real-time camera preview with live OCR overlay (requires a Dev Build and ML Kit; out of scope for Phase 1 Expo Go).
- Paid OCR APIs (Google Cloud Vision, AWS Textract, Azure Computer Vision).
- OCR for languages other than Latin-script text (Asian character sets, Arabic, Cyrillic).
- Offline OCR (tesseract.js loads from CDN; network is required for first use).
- Storing scanned images anywhere (images are read once for OCR and then discarded).
- A dedicated "scanner" screen or tab; the feature is a modal sheet inside AddProductModal.

## 4. User Stories

### Story 1: Paste Live Text from native camera (primary path)
As a user adding a product, I want to copy the ingredients text I captured with my phone's camera and paste it directly into the app so that I don't have to type any INCI names.

**Acceptance Criteria:**
- [ ] Given I am on Step 3 of AddProductModal, when I tap "Scan Ingredients Text", then the OCR Scanner Sheet opens.
- [ ] Given the sheet is open, when I tap "Paste Copied Text" and my clipboard contains non-empty Latin text, then the text appears in the ingredients textarea and active ingredients are auto-detected.
- [ ] Given the sheet is open, when I tap "Paste Copied Text" and my clipboard is empty, then an inline error message "Clipboard is empty — nothing to paste" is shown and the sheet stays open without crashing.
- [ ] Given pasted text has been previewed (first 120 characters visible), when I confirm, then the full text is injected into the ingredients field.

### Story 2: Image OCR fallback
As a user whose camera app does not support Live Text, I want to take or select a photo of the ingredient label and have the app extract the text for me so that I still avoid manual typing.

**Acceptance Criteria:**
- [ ] Given the OCR Scanner Sheet is open, when I tap "Choose Photo / Take a Photo", then the system image picker launches without crashing in Expo Go.
- [ ] Given I select an image, when OCR is processing, then a loading message "Reading ingredients… this may take 10–20 seconds" is displayed and the UI does not freeze.
- [ ] Given OCR completes successfully, when the result contains readable text, then the text is injected into the ingredients textarea and the sheet closes.
- [ ] Given OCR fails or produces empty output, when the error is returned from the WebView, then the message "Could not read text — try better lighting or paste manually" is shown and the sheet stays open.

### Story 3: Non-Latin character stripping
As a user who photographed an Asian or multilingual label, I want the app to tell me if unusable characters were removed so that I know to check the ingredients field for gaps.

**Acceptance Criteria:**
- [ ] Given OCR produces text where more than 30% of characters are non-Latin, when the cleaner processes it, then a banner "Many characters were removed — check the result looks correct" is shown above the textarea.
- [ ] Given OCR produces text where 30% or fewer characters are non-Latin, when the cleaner processes it, then no banner is shown and the cleaned text is injected silently.

## 5. UX / Behaviour

**Entry point:** "Scan Ingredients Text" button in Step 3 of AddProductModal. Tapping it sets `showOcrScanner = true` and renders `<OcrScannerSheet>` as a Modal with `presentationStyle="pageSheet"`.

**Sheet layout (top to bottom):**
1. Warning banner (always visible): "Ingredients must be in Latin/English characters. For Asian products, look for the English 'Ingredients' block on the packaging." — styled with `statusWarning` / `statusWarningTint` tokens.
2. Section A — Clipboard path:
   - Instruction text explaining the native camera Live Text / Google Lens workflow.
   - "Paste Copied Text" button.
   - If text exists in clipboard: show a preview card with the first 120 characters and a "Use This Text" confirm button.
   - If clipboard is empty: inline error label below the button.
3. Divider with label "or".
4. Section B — Image path:
   - "Choose Photo / Take a Photo" button.
   - After image is selected: loading indicator with progress message.
   - On success: brief success state before the sheet auto-closes.
   - On error: inline error message with suggestion to try Section A.
5. Close button (top-right corner).

**A hidden `WebView` is mounted off-screen when the sheet opens.** It loads tesseract.js from CDN and stays ready. Image base64 data is injected via `injectJavaScript`; results come back via `onMessage`.

**Post-processing:** Both paths pipe their raw string through `ocrTextCleaner.ts` before injecting into the parent form.

**Sheet close:** Tapping the close button or successfully injecting text both call `onClose()`. The parent form is never cleared; only the ingredients field is set.

## 6. Data Requirements
- New data: none persisted. Raw OCR output and base64 image data exist only in memory for the duration of one scan session.
- Existing data consumed: the cleaned OCR string is passed to `parseActiveIngredientsFromInci()` (already implemented in `src/utils/ingredientParser.ts`) to populate `selectedIngredients`.
- Data retention: none. Images and raw OCR strings are discarded when the sheet unmounts.

## 7. Dependencies
- Depends on: AddProductModal (Step 3, `InciField` component) — already shipped.
- Depends on: `parseActiveIngredientsFromInci` in `src/utils/ingredientParser.ts` — already shipped.
- Blocks: nothing downstream; this is an additive improvement to the existing add-product flow.
- External services: tesseract.js loaded from `https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js` (CDN, free, no key required).
- New packages required:
  - `expo-clipboard` (Expo Go SDK 52 compatible)
  - `expo-image-picker` (Expo Go SDK 52 compatible)
  - `expo-file-system` (Expo Go SDK 52 compatible)
  - `react-native-webview` (Expo Go SDK 52 compatible)

## 8. Security & Privacy
- Authentication required: no (feature is inside an authenticated screen, but OCR itself needs no auth).
- Data sensitivity: ingredient label photos are personal/consumer data. They are never stored, uploaded, or transmitted beyond the local WebView context.
- tesseract.js is loaded from a CDN (jsDelivr). The base64 image string is injected into the WebView's local JavaScript execution context only — it is not sent to any server.
- Compliance: no PII is collected or retained. No GDPR/HIPAA considerations beyond what already applies to the app.

## 9. Success Metrics
- Clipboard path success rate: at least 80% of users who tap "Paste Copied Text" with clipboard content get a non-empty ingredient list injected (measured via future analytics if added).
- Image path completion rate: at least 60% of image OCR attempts produce non-empty output within 30 seconds.
- Zero crashes attributable to the OCR sheet in the first 30 days after release.
- Manual ingredient entry rate in AddProductModal decreases by at least 30% within 60 days of release (proxy: fewer products with empty `fullIngredientText`).

## 10. Open Questions
- None. All scope, architecture, and package choices are resolved by the approved plan.
