# Technical Design: OCR Ingredients Scanner
Spec: docs/specs/ocr-scanner.md
Author: tech-designer
Date: 2026-06-21

## 1. Architecture Overview

The feature is entirely within the React Native client. No backend layer is involved.

```
AddProductModal (Step 3)
  └── showOcrScanner state
        └── <OcrScannerSheet> (Modal pageSheet)
              ├── Path A: expo-clipboard → raw string
              ├── Path B: expo-image-picker → expo-file-system (base64)
              │             └── hidden <WebView> (tesseract.js via CDN)
              │                   postMessage → raw string
              └── ocrTextCleaner.ts → cleanedText
                    └── parent onResult(cleanedText)
                          ├── setFullIngredientText()
                          └── setSelectedIngredients(
                                keysToIngredients(
                                  parseActiveIngredientsFromInci()))
```

Existing modules touched: `src/components/product/AddProductModal.tsx` (remove mock, wire sheet).
New modules: `src/components/product/OcrScannerSheet.tsx`, `src/utils/ocrTextCleaner.ts`.

## 2. API Contracts

No HTTP endpoints. The only "contract" is the WebView message protocol:

**Injected JS payload (host → WebView):**
```js
{ type: 'PROCESS_IMAGE', base64: string }  // base64-encoded JPEG or PNG
```

**WebView postMessage responses:**
```js
{ type: 'OCR_RESULT', text: string }       // successful extraction
{ type: 'OCR_ERROR', message: string }     // tesseract.js threw
```

**`ocrTextCleaner` function signature:**
```ts
ocrTextCleaner(raw: string): { cleanedText: string; hadNonLatin: boolean }
```

**`OcrScannerSheet` props:**
```ts
interface OcrScannerSheetProps {
  visible: boolean;
  onClose: () => void;
  onResult: (text: string) => void;
}
```

## 3. Implementation Tasks

### engineer (scope=frontend)
- FE-1: Install packages — run `npx expo install expo-clipboard expo-image-picker expo-file-system react-native-webview`. Verify `app.json` plugin entries for `expo-image-picker` (camera + media library permissions). Files: `package.json`, `app.json`.
- FE-2: Create `src/utils/ocrTextCleaner.ts` — implement the five-step pipeline: trim/normalize line breaks → collapse commas/spaces → strip non-Latin chars → compute strip ratio → return `{ cleanedText, hadNonLatin }`. Files: `src/utils/ocrTextCleaner.ts`.
- FE-3: Create `src/components/product/OcrScannerSheet.tsx` — Modal with `presentationStyle="pageSheet"`. Implements the always-visible warning banner, Section A (clipboard path with 120-char preview), Section B (image picker + hidden WebView OCR), divider, close button. Applies design tokens from `src/constants/tokens.ts` (no Tailwind, no pink). Files: `src/components/product/OcrScannerSheet.tsx`.
- FE-4: Implement the hidden WebView HTML string inside `OcrScannerSheet` — inline HTML that loads `tesseract.js` from CDN, listens for `message` events from React Native, calls `Tesseract.recognize()`, and sends back `OCR_RESULT` or `OCR_ERROR` via `window.ReactNativeWebView.postMessage`. Files: `src/components/product/OcrScannerSheet.tsx` (same file, separate `const webviewHtml` string).
- FE-5: Update `src/components/product/AddProductModal.tsx` — delete `handleMockOcrScan` (lines 345–352), add `showOcrScanner` state, render `<OcrScannerSheet>` with `onResult` wired to `setFullIngredientText` + `setSelectedIngredients(keysToIngredients(parseActiveIngredientsFromInci(text)))`. Files: `src/components/product/AddProductModal.tsx`.

### engineer (unit tests, scope=frontend)
- FE-6: Write `src/utils/ocrTextCleaner.test.ts` — covers: empty string, Latin-only string (no stripping), string with >30% non-Latin (hadNonLatin = true), string with <30% non-Latin (hadNonLatin = false), multiple consecutive commas/spaces collapsed, mixed `\n` and `\r` normalized. Files: `src/utils/ocrTextCleaner.test.ts`.

## 4. Assumptions

- `react-native-webview` with tesseract.js via CDN is the only viable free on-device OCR path in Expo Go (ML Kit requires a Dev Build).
  Alternative: Google Cloud Vision API or AWS Textract.
  Reason: zero-cost constraint and Expo Go compatibility eliminate paid APIs and native ML Kit.

- `expo-file-system` (`FileSystem.readAsStringAsync` with `EncodingType.Base64`) is used to convert the image URI to base64.
  Alternative: `fetch(uri).then(r => r.blob())` then `FileReader`.
  Reason: `expo-file-system` is already in the Expo SDK bundle and has a stable, well-typed API across SDK versions; `FileReader` behaviour on React Native is inconsistent.

- The WebView loads tesseract.js from CDN on first use; internet connectivity is required for the image OCR path.
  Alternative: bundle the tesseract WASM (~10 MB) locally inside the app.
  Reason: CDN loading keeps the app bundle lean; Phase 1 users are assumed to have connectivity when adding new products.

- `ocrTextCleaner.ts` applies the same five-step pipeline regardless of whether the raw text came from the clipboard path or the image OCR path.
  Alternative: separate cleaners per path (e.g., more aggressive stripping for OCR output).
  Reason: both paths produce a raw string of the same character-level format; a single cleaner reduces maintenance surface and is easier to unit test.

## 5. Open Questions

No open questions. All decisions are resolved.
