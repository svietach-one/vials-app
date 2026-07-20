# Task 02 — ProductThumbnail, Card Integration, Photo Attach UI

**Depends on:** Task 01.
**Reference sketch:** routine card = leading square photo, brand (muted) over
name (bold), Type tag row with a lightning glyph when actives are present,
three-dots trailing; conflict warning line below when applicable.

## Locked decisions

- One shared `ProductThumbnail` component owns precedence
  (`localImageUri ?? imageUrl ?? placeholder`), all image states, and the
  placeholder. Cards never implement image logic themselves.
- Thumbnail: square, `borderRadius: radius.sm`; **44 px** on `RoutineStepCard`,
  **52 px** on `ProductShelfCard`. Fixed dimensions, `resizeMode="cover"`,
  never sized from image intrinsics.
- Plain React Native `<Image>` — do NOT add `expo-image`.
- **Placeholder v1:** Feather `image` glyph centered (~40% of box,
  `zinc400`) on a **muted per-product-type background**:
  - Derive from the existing `TYPE_COLORS` map but LIGHTENED to a pastel tint —
    full-value Apothecary colors (Amber/Cabernet/Green/Cobalt) are forbidden
    here (they carry semantics: warning/blocked/safe/informational).
    Implementation: either pre-defined light variants in tokens, or a small
    pure util that mixes the type color with the card background at low alpha —
    pick one, keep it in tokens/utils, document it.
  - Structure the placeholder as its **own subcomponent**
    (`ProductThumbnailPlaceholder`) with a stable prop contract, so future
    custom artwork replaces it without touching `ProductThumbnail`'s API.
- **Android dangling-file fallback:** `<Image onError>` may not fire for a
  missing `file://` URI on Android. In `ProductThumbnail`, when the source is a
  local URI, additionally verify file existence (async, non-blocking, cached
  per-URI in component state) and fall back to placeholder. Leave a code
  comment explaining why.
- Compact vs full display split (final): routine cards show a Feather `zap`
  glyph when the product has any parsed active tags (RETI/ACID/VIT_C/PEPT);
  full biomarker tags render ONLY on the shelf card. Do not unify.

## Steps

1. **`src/components/ui/ProductThumbnail.tsx`** (new):
   - Props: `{ product: Product; size?: number; dimmed?: boolean }`.
   - States: empty → placeholder; local/remote uri → image; load error or
     dangling local file → placeholder. Remote loading state: neutral zinc
     surface behind the image (no spinner at thumbnail size).
   - `ProductThumbnailPlaceholder` subcomponent as specced above.
2. **`RoutineStepCard`**: add leading 44 px thumbnail as the first child of
   `mainRow` (after the drag handle when in edit mode). Verify two-line text
   still aligns; adjust vertical padding only if visibly broken.
   - Add the `zap` actives glyph next to the Type tag per the sketch
     (only when active tags exist). If the card already renders full active
     tags, replace them with the glyph on this card only.
3. **`ProductShelfCard`**: restructure inner layout to a horizontal row —
   leading 52 px thumbnail + existing content column. `Pressable` root stays.
   Apply the existing `isHidden` dimming to the thumbnail via `dimmed` prop.
   Full biomarker tags remain visible here (unchanged).
4. **`ManualProductFormScreen`** — photo attach:
   - New photo section: current photo preview (via `ProductThumbnail` at a
     larger size or a dedicated preview) + actions **Add photo / Change photo /
     Remove photo** using the Alert picker pattern
     ("Take Photo / Choose from Gallery / Cancel") → calls
     `pickAndStoreProductPhoto` from task 01.
   - Wire into `handleSave`: persist `localImageUri`; stop hardcoding
     `imageUrl: null` — carry `editingProduct?.imageUrl ?? null`.
   - Edit prefill: load `editingProduct.localImageUri` into photo state.
   - Remove photo → `deleteProductPhoto` + clear state (only commit the
     deletion on save, not immediately — investigate what the form does for
     other destructive edits and stay consistent; if the form has no
     staged-changes pattern, immediate delete with a confirm Alert is fine —
     document the choice).
5. **OCR shot reuse:** when the user photographed the bottle for OCR
   recognition (`CameraCaptureModal` flow) and proceeds to the manual form,
   offer that same shot as the product photo:
   - Investigate `CaptureResult`: if the captured image URI survives, thread it
     to the form and pre-populate the photo state via
     `storeExistingPhotoAsProductPhoto` (call it on save, keyed to the real
     productId — note the productId may not exist until save; handle by
     staging the source URI and running the pipeline post-save).
   - If the URI is discarded before the form mounts, extend `CaptureResult`
     minimally to carry it. Keep OCR behavior otherwise untouched.
6. **Tests:** `ProductThumbnail` (placeholder / local image / error fallback /
   dimmed), `RoutineStepCard` + `ProductShelfCard` render with and without
   images, form photo state wiring (mock the photo service).

## Acceptance

- Both cards show photos when present, tinted placeholders when not.
- A product photographed during OCR capture ends up with that photo attached
  after manual save, without re-shooting.
- `npx tsc --noEmit` clean; tests green.
- Manual QA checklist appended to PROGRESS.md: dangling local URI on Android
  falls back to placeholder; scroll performance on a 50-item shelf list.

## Out of scope

ProductDetail hero, `ProductPickerCard`, `AddToRoutineSheet` thumbnails
(follow-up), any routine-screen layout changes (task 03).
