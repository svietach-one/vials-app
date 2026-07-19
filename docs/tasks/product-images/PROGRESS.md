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
