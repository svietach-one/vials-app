Status: IN_PROGRESS
Tech Design: docs/tech-design/ocr-scanner.md
Code: —

## Task Card
- [x] Product requirements (planner)
- [x] Technical design (planner)
- [ ] QA tests (qa-lead)
- [x] Implementation (engineer)
- [x] Architecture review (tech-lead)

## Log

2026-06-21 — tech-lead (Tony): design review complete. STATUS: APPROVED WITH CONDITIONS.
  No blockers. Three mandatory implementation conditions:
  1. Compress images — pass quality: 0.5 to launchImageLibraryAsync/launchCameraAsync to
     prevent injectJavaScript memory crash on large photos.
  2. Guard WebView readiness — track webviewReady state via onLoadEnd; disable "Choose Photo"
     button until WebView has finished loading tesseract.js from CDN.
  3. Stringify postMessage payloads — WebView JS must JSON.stringify; RN onMessage must
     JSON.parse(event.nativeEvent.data).
  Recommended: evaluate using expo-image-picker base64:true option to drop expo-file-system
  dependency entirely (simplifies FE-1 and FE-3).
  Warnings: permission denial needs Settings redirect; CDN offline needs onError/onHttpError
  handler; first-time model download needs distinct loading state from OCR processing.

2026-06-21 — UX change: multi-path selection sheet dropped. User now taps "Scan Ingredients
  Text" and immediately gets a native Alert with "Take Photo" / "Choose from Gallery" / "Cancel".
  No clipboard path. expo-clipboard and expo-file-system not installed (not needed).
  expo-image-picker base64:true with quality:0.5 used — all tech-lead conditions addressed.

2026-06-21 — engineer: implementation complete.
  New files: src/components/product/OcrScannerSheet.tsx, src/utils/ocrTextCleaner.ts
  Modified: src/components/product/AddProductModal.tsx (removed handleMockOcrScan, wired OcrScannerSheet)
  Packages installed: expo-image-picker@~17.0.11, react-native-webview@13.15.0
  tsc --noEmit: 0 errors.
