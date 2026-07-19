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

---

## Task 03 — Routine Screen Restructure (list view) ✅

### Investigation findings (step 1, recorded before coding)

- **AM/PM today:** `RoutinesScreen` held `activePeriod` state and rendered ONE
  period at a time; the sun/moon segmented toggle lived in `PlannerBlock`'s
  header row. A separate `isEditMode` toggle (header pencil) gated the drag
  handle + per-card delete button.
- **`react-native-draggable-flatlist`:** installed (^4.0.3) and already used —
  one `DraggableFlatList` whose `ListHeaderComponent` carries the banners +
  `PlannerBlock`.
- **List/calendar toggle: DOES NOT EXIST.** Task 03 assumes it "stays" and task
  05 depends on it. Nothing in the routine screen switches representations.
  There is a `WeeklyPlanView.tsx` component, but it is **dead code** — imported
  nowhere. Resolution: built the toggle in this task (see Deviations) so task 05
  has a real mount point. Not a BLOCKER — the premise was wrong, not impossible.
- **Nesting decision — chose (b), a single list with section headers.** Rows are
  a flat `RoutineRow[]` (`{kind:'section'}` / `{kind:'step'}`) so exactly ONE
  VirtualizedList is ever mounted. Rationale: option (a) (per-section
  DraggableFlatList inside an outer ScrollView) is precisely the nested-list
  configuration that produces gesture fights and nested-VirtualizedList
  warnings; a flat list sidesteps it entirely and makes collapse a pure filter.
  Cross-section (AM→PM) drops are rejected in `resolveDragResult`, matching the
  "out of scope" rule.
- **Action-sheet pattern:** `ProductActionSheet` (Modal + backdrop + icon rows,
  tokens only) is the house pattern — mirrored rather than inventing a new one.
- **Hidden-steps mechanism exists:** `routinesStore.setStepHidden(routineId,
  stepId, hidden)` — no gap.

### Shipped

- **`src/utils/routineAccordion.ts`** (new, pure + fully unit-tested):
  `getInitialAccordionState(now)` (the 15:00 rule, date injected),
  `buildRoutineRows`, `routineRowKey`, `resolveDragResult` (rejects
  cross-section and above-first-header drops), `mergeReorderedSteps` (writes a
  reordered visible subset back around filtered-out steps).
- **`RoutineStepActionSheet`** (new): the four locked actions — view details /
  edit product / remove from routine (step only) / hide from routine.
- **`PlannerBlock`**: sun/moon AM-PM toggle replaced by the **list ⇄ calendar**
  toggle (`viewMode` / `onViewModeChange`, exported `RoutineViewMode`).
- **`RoutinesScreen`**: both periods on one screen as Morning/Evening accordion
  sections (chevron, step count, empty-section state with inline add); initial
  expansion from the 15:00 rule **on mount only**, manual toggles win after;
  `isEditMode` removed entirely; header is now `refresh-cw` (Regenerate) +
  `plus` (Add), Add rightmost; drag persists per-period order on drop.
- **`RoutineStepCard`**: `drag`/`isEditMode`/`onDelete` replaced by
  `onLongPress` (RNDFL drag) + `onOverflowPress` (three-dots). The dual-root
  edit/normal branching collapsed into one root.

### Deviations

- **Built the list/calendar toggle rather than preserving one** — it did not
  exist (see findings). The calendar branch is not wired yet; `viewMode` state
  is in place and task 05 renders into it.
- **`AddToRoutineSheet` still needs a period** — with no active period it now
  receives the time-derived default (same 15:00 rule as the accordions).
- **Three existing tests updated** because the locked decisions intentionally
  changed the behaviour they guarded:
  - `routines-screen-generation-ux`: the edit-mode pencil test replaced by two
    tests for the new header (Regenerate + Add present, no edit toggle;
    Regenerate previews without committing).
  - `routines-screen-hidden-filter`: AC-R5 no longer "switches period" — it
    expands the Evening accordion in place.
  - `routines-screen-paused-rows`: dropped the `switch-to-evening` press (the
    paused row is in the footer and always rendered).
- **Wall-clock hazard found and fixed:** because the screen seeds accordion
  state from `new Date()`, screen tests became time-of-day dependent (they
  failed only because this run happened after 15:00). The two affected screen
  suites now pin `getInitialAccordionState` via a partial module mock; the 15:00
  rule keeps its own injected-date unit tests. Worth remembering — any future
  RoutinesScreen test must pin this too.

### Verification

- `npx tsc --noEmit`: clean.
- Full suite: **3 failing suites — the same 3 baseline suites**, 0 introduced;
  1266 tests passing (up from 1221 at baseline).
- New: 14 accordion-util tests + 6 action-sheet tests, all green.

### Files touched

`src/utils/routineAccordion.ts` (+ `.test.ts`),
`src/components/routine/RoutineStepActionSheet.tsx`,
`tests/product-images/RoutineStepActionSheet.test.tsx`,
`src/components/routine/PlannerBlock.tsx`,
`src/components/routine/RoutineStepCard.tsx`,
`src/screens/RoutinesScreen.tsx`,
`tests/routine-engine/routines-screen-generation-ux.test.tsx`,
`tests/routine-engine/routines-screen-paused-rows.test.tsx`,
`tests/routines/routines-screen-hidden-filter.test.tsx`.

### Manual QA for the human (needs a device / Expo Go)

- [ ] Long-press reorder works in BOTH sections without fighting the page
      scroll; the card lifts with scale feedback and the order persists.
- [ ] Dragging a card from Morning into the Evening section is rejected
      cleanly (order snaps back, nothing is written).
- [ ] Open the screen before 15:00 → Morning expanded; after 15:00 → Evening.
      Manually opening the other section is never auto-undone.
- [ ] All four sheet actions behave; "Remove from routine" leaves the product
      on the shelf.

### Follow-ups / known gaps

- `WeeklyPlanView.tsx` is dead code (imported nowhere) and now overlaps the new
  accordion list conceptually — candidate for deletion in a cleanup pass.
- The calendar half of the toggle renders the list until task 05 lands.
