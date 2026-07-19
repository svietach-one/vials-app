# Product Images — Progress Log

## Delivered scope (as of 2026-07-19)

**Shipped and complete: on-device product photos.** Capture (camera or gallery),
document-directory storage, thumbnails on the Today checklist and the shelf,
tinted placeholders, photo attach in the product form, and reuse of the OCR
label shot. Fully offline, no backend dependency. Tasks 01–03.

**Not shipped: server sync of photos (task 04).** Deferred — contributed photos
have no destination. Not "blocked, in progress"; the delivered scope above is a
complete unit of value on its own, and community contribution is a separate
roadmap decision (`ROADMAP-vials-api-contribution.md`).

| Task | Status |
|---|---|
| 01 — image foundation | ✅ shipped |
| 02 — thumbnail + cards + form attach | ✅ shipped |
| 03 — routine screen restructure | ✅ shipped |
| 04 — photo server sync | ⛔ deferred, no backend (BLOCKERS.md) |
| 05 — routine calendar view | ✅ shipped |


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

---

## Task 04 — Photo Server Sync ⛔ HALTED (see BLOCKERS.md)

**Outcome:** not shipped. Implemented against Supabase Storage as specced, then
reverted after the premise proved wrong. Client code returned to a coherent
state; the blocking questions are recorded for the backend owner.

### What happened

Task 04 locked "upload target: Supabase Storage, bucket `product-images`". That
target comes from the **superseded pre-Turso** design in
`docs/database/db-tech-design.md` — a document carrying a "superseded" banner
over an otherwise-unchanged Supabase body. It was implemented before the
mismatch was caught; the user flagged it ("why Supabase? our database is
Turso"), and investigation confirmed the problem is deeper than a wrong vendor.

### What the investigation found

- Turso is configured for exactly one job: a **pull-only, read-only product
  corpus replica** (`CorpusProvider` + `expo-sqlite` libSQL mode, no
  `@libsql/client`). The token is read-only *by contract*
  (`.env.example`: `--read-only`); repositories are SELECT-only.
- **No write path** to the corpus exists, by design.
- **No object storage exists anywhere in the stack.** Turso replaced Supabase as
  the database; nothing replaced Supabase *Storage*. Photo bytes have no home.
- **No addressable suggestion**: `suggestProduct` returns `void`, and
  `EXPO_PUBLIC_VIALS_API_URL` is not even in `.env.example`.
- **RLS has no Turso equivalent** — its gating job moves to the API tier
  (contributions in a separate server-side DB the replica never syncs;
  moderation as an explicit promotion job). Full reasoning in BLOCKERS.md.

### Changes kept

- `photoUploadQueue.ts` hardening — 5-attempt cap (`MAX_UPLOAD_ATTEMPTS`),
  30-day pending-file TTL cleanup (`PENDING_FILE_TTL_DAYS`), `failed` marker.
  Backend-agnostic; survives whichever upload design lands.
- `PhotoUploadTransport` seam + `noopTransport` still wired — nothing uploads,
  nothing throws, the queue simply accumulates.
- `PhotoUploadQueueEntry.failed?` in types.
- 5 new queue tests (cap, capped-out skip, TTL cleanup, TTL for failed entries,
  not-yet-expired retry). 11 queue tests total, all green.

### Changes reverted

- `src/services/supabaseClient.ts`, `src/services/photoUploadTransport.supabase.ts`
  — deleted (wrong premise; would also require a write-capable client credential
  with no RLS to contain it).
- `linkPhotoEvidence` + `SuggestPayload.photo_evidence_url` — phantom contract
  for an endpoint that does not exist.
- **The two-step upload→link drain — reverted deliberately, on review of my own
  design.** With no linking endpoint, a transport wired without a link
  implementation would leave every entry uncleared and grow the queue forever.
  `drain` is single-step (upload success completes the entry) until a real
  endpoint exists. This also made the previously-failing queue test pass
  honestly rather than by adjusting the assertion.

### Verification

- `npx tsc --noEmit`: clean.
- Full suite: **3 failing suites — the same 3 baseline suites**, 0 introduced;
  1277 tests passing (up from 1221 at baseline).
- `grep -rni supabase src/` — no functional references remain (only a
  pre-existing mock comment in `DebugAccountSyncCard`).

### Open items for the human

- **BLOCKER-1** — decide the upload destination (API-owned vs presigned) and
  who owns moderation.
- **BLOCKER-2** — confirm whether the Vials API / an upload endpoint is on the
  backend roadmap at all. If not, US-3 (community contribution) is
  unsatisfiable regardless of client design and should be explicitly deferred.
  This is a product-roadmap gap, not a client scoping issue.
- **`TICKET-docs-pre-turso-architecture.md`** — the stale-docs cleanup that
  caused this detour (raised as a separate ticket, deliberately not bundled
  into this commit).

### Follow-up applied — false-success UX removed (2026-07-19)

Investigating BLOCKER-2 surfaced something worse than a missing feature: the app
was **telling users a contribution had been saved when nothing left the device.**
`BarcodeSection` rendered "Community contribution saved" with a green success
check, a "You've helped verify N products" counter, and framing copy promising
"other users can add it in one tap" — all for a `POST` to an endpoint that does
not exist and whose failure was swallowed by design.

Fixed independently of the roadmap decision:

- New `src/constants/featureFlags.ts` → `COMMUNITY_CONTRIBUTION_ENABLED = false`,
  documenting why it is off and what must be true to flip it.
- `suggestProductInBackground` returns early while gated — no request attempted,
  no failure swallowed behind UI that already implied success.
- Contribution claims gated: success label falls back to the truthful "Barcode
  saved"; the counter is hidden; framing copy describes the real (local)
  benefit. **Barcode scanning itself stays fully enabled** — the code is stored
  on the product record and used for local lookup; only the *community* claims
  are gated.
- The counter no longer increments at either call site.
- Tests: 2 rewritten to assert the gated reality, plus a new service test
  proving no request escapes — including a tripwire asserting the flag is off,
  so re-enabling it without an endpoint fails loudly.

### US-3 deferred explicitly (not silently dropped)

- `docs/PRD_Spec.md` §6 — moderation-queue open item **retired as moot** (cannot
  staff review for a non-existent service), with a pointer to the roadmap doc.
- `docs/USER_STORIES.md` US-22 — the two crowdsourcing ACs marked
  **⛔ BLOCKED — no backend**, with a deferral note explaining that no
  client-side design can satisfy them.
- `ROADMAP-vials-api-contribution.md` — roadmap-level proposal that contribution
  transport (Option A), API-tier access control replacing RLS, moderation
  workflow, and staffing be decided **as one piece of work** if the API is ever
  greenlit, so this isn't re-derived from scratch.

---

## Task 05 — Routine Calendar View (month matrix) ✅

### Investigation findings (step 1)

- **Toggle:** built in task 03 (`PlannerBlock` `viewMode` / `onViewModeChange`) —
  it did not previously exist. Task 05 renders into it.
- **Schedule logic was duplicated four ways**, all private/inline:
  `RoutinesScreen.isStepForDay`, `routineStatus.isScheduledForDay`,
  `dailyView.isScheduledOn`, and (would-have-been) the calendar. Per the task's
  "do not re-implement schedule interpretation", extracted one canonical
  `isScheduledOnDay` (`src/utils/routineSchedule.ts`) and refactored all three
  existing call sites onto it. 930 routine/util tests confirmed the refactor is
  behaviour-neutral before any calendar code was written.

### Frozen-column mechanics — chosen approach

Neither of the task's two suggested options. Both assume two vertical scrollers
kept in step via `onScroll` → `scrollTo`, which jitters.

**Instead: one vertical ScrollView contains the whole grid, and only the day
columns sit inside a horizontal ScrollView.** Vertical scrolling moves the
frozen column and the cells together because they are literally the same scroll
container; horizontal scrolling moves only the days. **There is no
synchronisation code, so there is nothing to drift.** Documented in the
component header.

### Shipped

- **`src/utils/calendarMatrix.ts`** (pure): `buildCalendarMatrix(routines,
  products, monthDate)` → rows of per-day `{am, pm}`, plus `getDaysInMonth`.
  Exclusions mirror the list view exactly (hidden steps, dangling productIds,
  `product.isHidden`). Weekdays resolved once per month, not per cell;
  same-period overlapping steps OR-accumulate.
- **`CalendarCell`** — pure + `React.memo`. Diagonal halves via the CSS
  triangle border technique (cheapest crisp option, no SVG). Both halves
  **Cobalt** — AM/PM distinguished by position only, never colour. A fully
  unscheduled cell renders as a plain bordered square with no diagonal.
- **`RoutineCalendarView`** — month label, frozen 148px identity column
  (44px `ProductThumbnail` + brand/name, single-line ellipsis), day header with
  weekday over date, monochrome today badge, auto-scroll so today lands ~2
  columns in on mount, DS empty state with an add CTA.
- **`RoutinesScreen`** — renders the calendar when `viewMode === 'calendar'`,
  keeping the sub-header so the user can toggle back. Tapping a row's identity
  cell opens the **same** action sheet as the list view; since calendar rows
  identify a product rather than a step, `openStepSheetForProduct` resolves it
  to its first visible step (morning before evening).

### Verification

- `npx tsc --noEmit`: clean.
- Full suite: **3 failing suites — the same 3 baseline suites**, 0 introduced;
  1306 tests passing (baseline 1221).
- 16 matrix tests (every-day, specific weekdays, AM/PM independence, hidden,
  dangling, product-hidden, row order, same-period overlap, leap-year February,
  empty routine) + 9 component tests.
- **Acceptance "fills match the Today checklist" is proven, not assumed:** a
  parity test reproduces the screen's filter through the same shared helper and
  compares grid vs checklist for three spot-check dates (Mon 6, Thu 9, Sun 12
  July 2026).

### Files touched

`src/utils/routineSchedule.ts`, `src/utils/calendarMatrix.ts` (+ `.test.ts`),
`src/components/routine/CalendarCell.tsx`,
`src/components/routine/RoutineCalendarView.tsx`,
`tests/product-images/RoutineCalendarView.test.tsx`,
`src/screens/RoutinesScreen.tsx`, `src/utils/routineStatus.ts`,
`src/utils/routineEngine/dailyView.ts`.

### Manual QA for the human (needs a device / Expo Go)

- [ ] Toggle list ⇄ calendar; today is visible on mount without manual scrolling.
- [ ] Vertical scroll keeps the frozen product column locked to its rows;
      horizontal scroll moves only the day columns.
- [ ] Smooth scroll with ~15 products on a mid-range device.
- [ ] Diagonal halves render crisply on both iOS and Android at cell size.

### Out of scope (noted as follow-ups)

Editing from the grid; multi-month paging (v1 is current-month only — routines
are weekly-recurring so other months repeat the pattern); procedure/PAO overlays
on the calendar.
