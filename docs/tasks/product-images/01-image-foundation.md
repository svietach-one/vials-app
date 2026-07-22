# Task 01 — Image Foundation: Types, Photo Service, Upload Queue

**Depends on:** `docs/research/product-images-research.md` (read in full first).
**Produces:** the data model + services every later task consumes. No UI in this task.

## Locked decisions

- Two fields on `Product`: keep existing `imageUrl: string | null` (server-owned),
  add `localImageUri?: string | null` (device-local `file://` path).
  Render precedence everywhere: `localImageUri ?? imageUrl ?? placeholder`.
- **Display copy:** max edge **800 px**, JPEG quality **0.7**, stored at
  `<documentDirectory>/product-images/<productId>.jpg`.
- **Upload copy:** max edge **1600 px**, JPEG 0.8, stored at
  `<documentDirectory>/pending-uploads/<productId>.jpg`, tracked by an upload
  queue. Deleted only after a successful upload (task 04) or product deletion.
- Use `expo-file-system`'s **new** `File`/`Directory`/`Paths` API, not `/legacy`.
- Queue persistence: its own AsyncStorage key (e.g. `@vials/photoUploadQueue`),
  **never** inside `productsStore`.
- Upload transport is a **stub** in this task (interface + no-op implementation);
  task 04 provides the real one.
- `localImageUri` and any `pending-uploads` path must never appear in
  `SuggestPayload` or any other outbound payload type.

## Steps

1. **Dependencies:** `npx expo install expo-file-system expo-image-manipulator`.
   Confirm SDK-54-pinned versions land in package.json.
2. **Types** (`src/types/index.ts`):
   - Add `localImageUri?: string | null` to `Product` with a doc comment
     explaining the sync firewall and render precedence.
   - Add `PhotoUploadQueueEntry` type: `{ productId: string; filePath: string;
     createdAt: string; attempts: number; lastAttemptAt?: string }`.
3. **Photo service** (`src/services/productImage.ts`, new):
   - `pickAndStoreProductPhoto(productId, source: 'camera' | 'library')
     : Promise<{ localImageUri: string } | null>`
     - Request permission → launch picker (mirror the Alert + permission pattern
       from `CameraCaptureModal.tsx`; use the current `MediaType` array form,
       not deprecated `MediaTypeOptions`).
     - On a picked image: produce BOTH copies (800px display, 1600px upload)
       via `expo-image-manipulator`, write them to their directories
       (create dirs on demand), enqueue an upload-queue entry, return the
       display URI. Returns `null` on cancel/permission-denied (no throw).
   - `storeExistingPhotoAsProductPhoto(productId, sourceUri: string)` — same
     pipeline but from an already-captured URI (used later by the OCR-capture
     reuse flow in task 02). Extract the shared resize+copy+enqueue core.
   - `deleteProductPhoto(productId): Promise<void>` — best-effort delete of
     both files + queue entry removal. Never throws.
4. **Upload queue** (`src/services/photoUploadQueue.ts`, new):
   - `enqueue(entry)`, `remove(productId)`, `getAll()`.
   - `drain(transport: PhotoUploadTransport)`: iterates entries, calls
     `transport.upload(entry)`; on success removes entry + deletes the
     pending-upload file; on failure increments `attempts`, silently continues.
     Never surfaces errors to the user.
   - `PhotoUploadTransport` interface: `{ upload(entry): Promise<{ remoteUrl:
     string }> }`. Provide `noopTransport` that always "fails" softly (so drain
     is a no-op until task 04).
   - Wire an `AppState` foreground listener (in App root, matching however the
     app already handles foreground events — investigate first) that calls
     `drain` at most once per foreground, throttled to once per 15 minutes.
5. **Delete cascade:** extend the existing product delete cascade
   (`deleteProductCascade` in `src/domain/`, invoked from `CatalogScreen`) to
   call `deleteProductPhoto(id)` best-effort.
6. **Tests:**
   - `productImage` service: mock expo modules at the module boundary
     (per `.claude/rules/testing.md`); cover pick-cancel, permission-denied,
     happy path producing two files + queue entry.
   - `photoUploadQueue`: enqueue/getAll/remove round-trip; drain with a failing
     transport (attempts increment, nothing deleted); drain with a succeeding
     transport (entry + file removed).
   - Fixtures: confirm existing product fixture builders still compile
     (field is optional — expected no breakage).

## Acceptance

- `npx tsc --noEmit` clean; tests green.
- Grep check: `localImageUri` does not appear in `SuggestPayload` or any
  `services/vialsApi` request-building code.
- No UI changes in this task.
