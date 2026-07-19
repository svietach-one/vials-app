# Product Images — Progress Log

## Baseline (before task 01, 2026-07-19)

- Branch: `feature-add-image`.
- `npx tsc --noEmit`: clean.
- `npx jest --testPathIgnorePatterns="worktrees"`: **3 suites failing** (pre-existing,
  unrelated to this work) — `tests/catalog/catalog-screen.test.tsx`,
  `tests/catalog/product-detail.test.tsx`,
  `tests/shelf-filtering/PaoChip.integration.test.tsx`.
  Root cause at baseline: `AsyncStorage is null` at suite load (no Jest mock for
  the native module). 99 suites / 1221 tests passing.
- **Gate for every task:** introduce no failing suite beyond these 3.

---

## Task 01 — Image Foundation (types, photo service, upload queue) ✅

**Shipped**

- **Deps:** `npx expo install expo-file-system` (~19.0.23) `expo-image-manipulator`
  (~14.0.8) — both SDK-54-pinned, Expo Go compatible.
- **Types** (`src/types/index.ts`): added `Product.localImageUri?: string | null`
  (doc comment covers the sync firewall + `localImageUri ?? imageUrl ?? placeholder`
  precedence) and `PhotoUploadQueueEntry`.
- **`src/services/storage.ts`:** new `STORAGE_KEYS.photoUploadQueue`
  (`@vials/photoUploadQueue`) — queue lives outside productsStore.
- **`src/services/productImage.ts`** (new): `pickAndStoreProductPhoto`,
  `storeExistingPhotoAsProductPhoto`, `deleteProductPhoto`. Uses the **new**
  expo-file-system `File`/`Directory`/`Paths` API (not `/legacy`) and the new
  `ImageManipulator.manipulate(...).resize(...).renderAsync()` API. Produces two
  copies per photo: 800px/JPEG-0.7 display (`product-images/<id>.jpg`) and
  1600px/JPEG-0.8 upload (`pending-uploads/<id>.jpg`). Resize constrains the
  longer edge without upscaling. Never throws (returns `null` on cancel / denied).
- **`src/services/photoUploadQueue.ts`** (new): `enqueue` / `remove` / `getAll` /
  `drain(transport)` + `PhotoUploadTransport` interface + `noopTransport` stub
  (soft-fails so drain is a no-op until img-04). Persists to its own AsyncStorage
  key. One entry per product (re-attach supersedes).
- **`src/domain/photoUploadActions.ts`** (new): `drainPhotoUploadsIfDue(now?)` —
  throttles drain to once / 15 min; `activeTransport()` returns `noopTransport`
  (img-04 swaps it behind an env flag).
- **App wiring** (`App.tsx`): `AppState` foreground listener + a cold-start call,
  both routed through `drainPhotoUploadsIfDue` (no-op until img-04).
- **Delete cascade** (`src/domain/productActions.ts`): `deleteProductCascade` now
  fires `deleteProductPhoto(id)` best-effort (fire-and-forget).
- **Tests:** `photoUploadQueue.test.ts` (round-trip, drain success/failure/noop,
  empty), `productImage.test.ts` (cancel, permission-denied, happy path → two
  renders + two file writes + one queue entry, gallery path). 10 tests, green.

**Deviations from the task file**

- Added `__mocks__/@react-native-async-storage/async-storage.js` (official Jest
  mock). *Reason:* task 01's import chain (`productActions → productImage →
  photoUploadQueue → storage`) pulled AsyncStorage into module-load for two
  suites that mock the stores but not the services (`product-detail-vitc-infobox`,
  `DetectedActiveBadgeWiring`), which would have made them regress. The official
  mock is the documented fix; it also un-breaks the infra layer of the 3 baseline
  suites (they now fail — if at all — on their own pre-existing issues, e.g.
  product-detail's incomplete token mock, not on AsyncStorage). Net failing-suite
  count returns to the same 3.

**Verification**

- `npx tsc --noEmit`: clean.
- Full suite: **3 suites failing — the same 3 baseline suites**, 0 introduced.
  101 suites / 1231 tests passing.
- Grep: `localImageUri` absent from `SuggestPayload` and `src/services/vialsApi/`.

**Files touched**

`src/types/index.ts`, `src/services/storage.ts`, `src/services/productImage.ts`,
`src/services/productImage.test.ts`, `src/services/photoUploadQueue.ts`,
`src/services/photoUploadQueue.test.ts`, `src/domain/photoUploadActions.ts`,
`src/domain/productActions.ts`, `App.tsx`, `package.json`, `package-lock.json`,
`__mocks__/@react-native-async-storage/async-storage.js`.

**Manual QA for the human (needs a device / Expo Go)**

- [ ] Attach a photo (camera + gallery) to a product; confirm it persists across
      an app restart (files land under the document directory, not cache).

---

## Task 02 — ProductThumbnail, Cards, Photo Attach UI ✅

**Shipped**

- **`src/components/ui/ProductThumbnail.tsx`** (new): single owner of image
  precedence (`localImageUri ?? imageUrl ?? placeholder`) + all states. Plain RN
  `<Image>` (no expo-image). `onError` → placeholder; a local `file://` URI is
  additionally probed via `localPhotoExists` (async, off-render) and falls back
  to the placeholder — the Android dangling-file case. `ProductThumbnailPlaceholder`
  is its own subcomponent (Feather `image` glyph on a muted per-type wash).
- **`src/services/imageFile.ts`** (new): `localPhotoExists(uri)` — a lightweight
  existence probe kept out of productImage so a card render never pulls the
  picker/manipulator/queue chain.
- **`src/utils/productThumbnailTint.ts`** (new): pure per-type wash — the type
  accent hue at 0.08 alpha (never full-value Apothecary colours, never the
  semantic `*Tint` tokens). Resolves palette lazily and never throws on a
  partial/absent palette (display-util hygiene).
- **`RoutineStepCard`**: leading 44px `ProductThumbnail`. The active badge's
  text label is replaced by a compact Feather `zap` glyph — full biomarker tags
  stay on the shelf card only. The badge stays a Pressable with the same testID /
  attribution tooltip / alias icon, so INCI attribution is preserved.
- **`ProductShelfCard`**: inner layout restructured to a leading-52px-thumbnail
  row + content column. Thumbnail dims with `isHidden`. Full active badges
  unchanged.
- **`ManualProductFormScreen`**: photo section in Block 1 (preview via
  `ProductThumbnail` + Add/Change/Remove via an Alert picker → `pickAndStoreProductPhoto`).
  A stable `productId` (useRef) lets a photo be captured before save. `handleSave`
  now carries `imageUrl` (edit) + `localImageUri` (no more hardcoded null) via a
  `buildProduct` helper; removing a photo is staged and its files cleaned on save.
- **OCR shot reuse**: `OcrScannerSheet.onResult` gained an optional `sourceUri`
  (the captured shot); the form offers it as the product photo when none is set
  (staged, changeable/removable before save). The one-arg call is preserved when
  no image, so the OCR text-flow contract is unchanged.

**Deviations**

- The task's OCR-reuse step names `CameraCaptureModal` / `CaptureResult`, but the
  manual form's OCR entry point is actually `OcrScannerSheet` (text-only
  `onResult`). Implemented the reuse there instead — same outcome (the scanned
  shot becomes the product photo without re-shooting). The front-label
  `CameraCaptureModal` capture lives in the separate add-product wizard, which
  saves via a different path and is out of scope here. No BLOCKER: the acceptance
  criterion is satisfied through the form's real OCR path.
- The reused shot is the ingredient-label photo (the form's only in-context
  capture). It is *offered*, not forced: only set when no photo exists, and it is
  visible + removable in the preview before save.

**Verification**

- `npx tsc --noEmit`: clean.
- Full suite: **3 failing suites — the same 3 baseline suites**, 0 introduced;
  1246 tests passing (up from 1221). The 3 baseline suites fail on their OWN
  incomplete `@/constants/tokens` mocks (e.g. `palette` supplied as only
  `{white, black}`), unmasked by the img-01 AsyncStorage mock — `ProductShelfCard`
  already read `palette.zinc100` / `palette.cobaltTint` at module-init before this
  work, so these are pre-existing test-mock gaps, not image regressions. The new
  tint util is robust and out of the crash path.
- Affected card suites (product-shelf-card, routine-step-card, attribution
  wiring) all green (69 tests).

**Files touched**

`src/components/ui/ProductThumbnail.tsx`, `src/services/imageFile.ts`,
`src/utils/productThumbnailTint.ts` (+ `.test.ts`),
`tests/product-images/ProductThumbnail.test.tsx`,
`src/components/routine/RoutineStepCard.tsx`,
`src/components/product/ProductShelfCard.tsx`,
`src/components/product/OcrScannerSheet.tsx`,
`src/screens/ManualProductFormScreen.tsx`.

**Manual QA for the human (needs a device / Expo Go)**

- [ ] A dangling `localImageUri` on Android falls back to the placeholder (not a
      broken-image glyph).
- [ ] Scroll performance on a ~50-item shelf list with mixed photos/placeholders.
- [ ] Scan an ingredient label in the manual form with no photo set → the shot
      appears in the photo preview and is attached after save.
