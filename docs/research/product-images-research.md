# Research — Product Images on Cards

**Task slug:** `product-images`
**Author:** research (discovery only — no code changed)
**Date:** 2026-07-19
**Status:** RESEARCH / awaiting product decisions (see §9)

Goal: every product can carry an image, shown as a small thumbnail on the Today
checklist (`RoutineStepCard`) and the shelf card (`ProductShelfCard`). Products
with no API image can have a user photo attached (camera or gallery) from the
edit form. When no image exists, render a tokenized monochrome placeholder.

---

## 0. Findings that change the plan up front

Three facts from the current codebase materially simplify this work:

1. **`Product.imageUrl` already exists** — `src/types/index.ts:231`:
   `imageUrl: string | null`. It is a required field, already threaded through
   every construction site. We do **not** need to add a remote-image field; we
   only need a *second* field for the user-attached local photo. It is currently
   always written as `null` in the manual form (`ManualProductFormScreen.tsx:466`)
   and never populated from any API path — so it is a live, unused slot.

2. **`expo-image-picker` is already installed and wired** — `package.json`
   pins `expo-image-picker: ~17.0.11`, and `CameraCaptureModal.tsx` already calls
   `ImagePicker.launchCameraAsync` / `launchImageLibraryAsync`. The camera + photo
   permission strings are **already declared** in `app.json` (via the
   `expo-image-picker` and `expo-camera` plugins). No new permission config is
   needed for "attach a photo."

3. **This is Expo SDK 54, not SDK 52.** `package.json` → `expo: ~54.0.35`,
   `react-native: 0.81.5`, `react: 19.1.0`. The IMPLEMENTATION_PLAN and CLAUDE.md
   still say "SDK 52" — that is stale. All dependency-compatibility below is
   verified against **SDK 54**. (Flagged as an open item; not this task to fix.)

Net effect: no remote-image plumbing to build for storage; the real work is
(a) one new type field, (b) a local-photo capture+persist helper, (c) a shared
thumbnail component, and (d) placing it in two cards + the form.

---

## 1. Data model

### Recommendation: two fields (add one, keep the existing one)

```ts
// src/types/index.ts — interface Product
export interface Product {
  // …existing…
  imageUrl: string | null;          // UNCHANGED — remote/API image URL

  /**
   * Device-local user-attached photo. A file:// URI inside the app's document
   * directory (see storage strategy §2). Local-only, never synced to the
   * server and stripped from any suggest/export payload — same class as
   * openedDate / paoMonths. Absent on records saved before this field.
   * Render precedence: localImageUri ?? imageUrl ?? <placeholder>.
   */
  localImageUri?: string | null;    // NEW
}
```

**Why two fields, not one:**

- **Provenance / sync boundary.** `imageUrl` is server-owned data that
  round-trips on the community-DB sync (it mirrors `products.image_url` server
  side, same as the existing `source` enum comment at `types/index.ts:224`).
  `localImageUri` is a device path that is meaningless off-device and must be
  excluded from outbound payloads — exactly like `openedDate`/`paoMonths`, which
  the codebase already firewalls via the separate `SuggestPayload` type
  (`types/index.ts:492`). Collapsing them into one field would let a private
  file path leak into a sync payload, or let a sync overwrite the user's photo.
- **Override without destruction.** A user can attach their own photo to an
  API product (goal #3) while the original `imageUrl` is preserved. Precedence
  is decided at render time, not by mutating one field.
- **Cheap migration.** New field is optional; `migrateProducts` needs no change
  (absence ⇒ treated as no local photo). Contrast with reusing `imageUrl` for
  local URIs, which would require distinguishing `http…` vs `file…` everywhere.

### Where the fields get threaded

| Site | File | Change |
|---|---|---|
| Manual/edit save | `ManualProductFormScreen.tsx:461-479` | stop hardcoding `imageUrl: null`; carry existing `editingProduct?.imageUrl ?? null`; add `localImageUri` from new photo state |
| Edit prefill | `ManualProductFormScreen.tsx:355-376` | load `editingProduct.localImageUri` into photo state |
| Corpus prefill | `ManualProductFormScreen.tsx:377-395` | map corpus `imageUrl` if the corpus record carries one (verify corpus repo type) |
| API result mapping | `src/services/vialsApi/products.ts` | `lookupBarcode`/`searchByText` do **not exist yet** (only `suggestProduct` does — see file comment). When they land, map `image_url → imageUrl`. Nothing to change today. |
| Store | `src/store/productsStore.ts` | **No change** — `addProduct`/`updateProduct` already spread arbitrary `Partial<Product>`; both fields flow through automatically. |

---

## 2. Local image storage strategy

### Do NOT store base64 in AsyncStorage — confirmed

All products persist as **one JSON blob** under `@vials/products`
(`storage.ts:30`, written whole on every add/update in `productsStore`). Base64
images in that blob would:
- Bloat a single AsyncStorage value that is fully `JSON.parse`d on **every cold
  start** (`productsStore.hydrate`) — hydration cost scales with total image
  bytes, not product count.
- Push toward AsyncStorage's practical per-value / total ceilings (Android's
  SQLite-backed store and the ~6 MB soft budget). A dozen ~150 KB photos alone
  is ~2 MB of base64 text re-serialized on every single product edit.

### Recommendation: copy the file, store only the URI

Flow when the user attaches a photo:
1. Pick via `expo-image-picker` (camera or library) — returns a **temporary
   cache URI** (ImagePicker's cache is not durable across app restarts).
2. Downscale + compress via `expo-image-manipulator` (§3) → small JPEG.
3. **Copy** the result into the app document directory via `expo-file-system`,
   under a stable name (e.g. `product-images/<productId>.jpg`).
4. Store only that `file://…` path in `product.localImageUri`.

Rendering reads the URI directly (`<Image source={{ uri }}>`). On delete of a
product, best-effort delete the file (cascade lives in `src/domain/`, see §6).

### App uninstall

The document directory lives in the app sandbox and is **deleted on uninstall**
(both iOS and Android). Local photos therefore share the fate of all Phase-1
local-only data — consistent with the existing `LocalDataWarningModal`
messaging ("data lives only on this device"). No extra warning needed beyond
that. Note: because ImagePicker URIs are *cache*, step 3 (copy to document dir)
is mandatory — skipping it means photos silently vanish after an OS cache purge,
not just uninstall.

### Export / Import (Phase 6 — not built yet)

`ExportBackupUtility` / `ImportRestoreUtility` **do not exist yet** (planned
Phase 6: serialize AsyncStorage keys → JSON, share via `expo-sharing`; import
via `expo-document-picker`). Two options for local images:

- **(a) Exclude local images from backup; document it.** The JSON backup carries
  `imageUrl` (a plain string, round-trips fine) but **strips `localImageUri`**,
  and on import drops any `localImageUri` whose file doesn't resolve on the new
  device. Backup summary copy notes: *"Attached photos stay on this device and
  are not included in backups."*
- **(b) Bundle images** — base64 inside the JSON (reintroduces the exact bloat
  problem §2, now at the backup layer, and `expo-sharing` a multi-MB JSON is
  clunky) or a zip (needs a JS zip lib — no Expo-native module; extra weight).

**Recommendation: (a).** It keeps the backup a small portable text file, matches
the "local-only, device-bound" model the app already commits to, and avoids a
new zip dependency. `localImageUri` is device-specific and genuinely cannot
round-trip across devices anyway. Revisit (b) only if/when images sync via the
community DB (at which point `imageUrl` covers it server-side).

---

## 3. Image picking / capture

### Dependency: reuse `expo-image-picker` (already installed)

`expo-image-picker@~17.0.11` is present, Expo-Go compatible on SDK 54, and
already used for OCR capture. It is the right tool for "attach a photo" —
`expo-camera` (also installed) is a *live camera view* suited to the barcode
scanner's real-time decode loop, not a one-shot "take/pick a photo" that also
needs a gallery option. Use `launchCameraAsync` + `launchImageLibraryAsync`.

**Do not reuse `CameraCaptureModal` directly.** It is OCR-specific: its
`onCapture` returns a `CaptureResult` of extracted *text* and it pipes every
image through the Tesseract WebView. For photo attach we want the image **URI**,
no OCR. But its `showPickerAlert` pattern (`CameraCaptureModal.tsx:297-303`) —
an `Alert` with "Take Photo / Choose from Gallery / Cancel" and the
permission-request handlers (`:305-346`) — is the correct template to mirror in
a small new helper.

Proposed helper (service layer, because it touches the filesystem):

```
src/services/productImage.ts
  pickAndStoreProductPhoto(productId, source: 'camera' | 'library')
    → requests permission → launches picker → manipulates → copies to doc dir
    → returns { uri } | null
  deleteProductPhoto(productId): Promise<void>
```

Note: existing code uses `ImagePicker.MediaTypeOptions.Images` (deprecated in
17.x → `['images']` / `MediaType`). Use the current form in new code.

### Downscale / compress before saving

Install `expo-image-manipulator` (Expo Go compatible, SDK 54). Before the copy:
resize to a thumbnail-friendly max edge (**~480 px**, enough for a crisp
retina thumbnail and a modest detail view) and `compress: 0.7` JPEG. This caps
each file at roughly 30–80 KB, which is what makes list-scroll rendering cheap
(§4) and keeps document-dir growth negligible. Downscale happens **once at save
time**, never per render.

---

## 4. Rendering & performance

### Placement

**`RoutineStepCard`** (`src/components/routine/RoutineStepCard.tsx`): the
`mainRow` is already `flexDirection: 'row'`, `alignItems: 'stretch'`,
`gap: space[3]` (`:270-274`), with an optional leading drag handle then
`contentArea`. Add a **leading thumbnail as the first child of `mainRow`**,
before `contentArea` (after the drag handle in edit mode). A 44×44 square fits
the card's two-line height (`paddingVertical: space[3]`).

**`ProductShelfCard`** (`src/components/product/ProductShelfCard.tsx`): the card
is a **vertical** stack (`content` block + `bottomRow`), so this needs a small
restructure: wrap the existing stack in a horizontal row with a **leading
thumbnail** (≈52×52) on the left and the current column on the right. The
`Pressable` root stays; only the inner layout gains a row wrapper. Keep the
`isHidden` dimming (`contentDimmed`) applied to the thumbnail too.

Both should render a **shared component** so the placeholder + precedence logic
lives in one place:

```
src/components/ui/ProductThumbnail.tsx
  props: { product: Product; size?: number }
  resolves localImageUri ?? imageUrl ?? placeholder; owns states below.
```

Other candidate call sites to confirm scope (§9): `ProductPickerCard.tsx`,
`AddToRoutineSheet`, and the `ProductDetail` hero (a larger image).

### Remote images: plain `<Image>` vs `expo-image`

`expo-image` **is** Expo-Go compatible on SDK 54, but it is **not installed**.
Recommendation: **plain React Native `<Image>`** for now.
- Local file URIs (the primary case) need no HTTP cache, disk cache, or
  blurhash — `<Image>` renders them immediately.
- Remote `imageUrl` is not even populated yet (no `lookupBarcode` path exists),
  so the caching argument is theoretical today.
- Avoids adding a dependency for a benefit we can't yet exercise.

Revisit `expo-image` only when API images ship at volume (its `cachePolicy`,
`placeholder`, and fade `transition` become worthwhile then, and it's a drop-in
swap inside `ProductThumbnail`).

### Image states (All-States Rule, Phase 7)

`ProductThumbnail` must handle:
- **Empty** (no `localImageUri`, no `imageUrl`) → placeholder (§5).
- **Loading** (remote only) → neutral surface; plain `<Image>` has no built-in
  spinner, so a light zinc background behind it suffices at thumbnail size.
- **Error** (remote URL 404 / broken, or a local file that was purged) → the
  `<Image onError>` handler flips local state to render the **same placeholder**.
  This is the critical fallback: a dangling `localImageUri` (post-restore, §2)
  must degrade to the placeholder, never a broken-image glyph.

### Scroll performance

- Fixed thumbnail dimensions + `resizeMode="cover"`; never size from image
  intrinsics.
- Downscaled-at-save files (§3) keep decode cost low; `FlatList` already
  virtualizes both lists.
- Never pass base64 data URIs to `<Image source>` in list rows.

---

## 5. Placeholder design

Size/shape: **square, `borderRadius: radius.sm` (8)**, same corner language as
the cards. 44 px on `RoutineStepCard`, ~52 px on `ProductShelfCard` (driven by
the `size` prop). Monochrome only, all values from `src/constants/tokens.ts`.

Two concepts (pick one in §9):

**Concept A — Feather icon on a neutral surface (recommended).**
- Surface `backgroundColor: palette.zinc100`, `borderWidth: 1`,
  `borderColor: palette.zinc200`.
- Centered Feather glyph, `color: palette.zinc400`, ~40% of the box.
- Icon = generic `image` (or map product type → a small icon set, reusing the
  spirit of the existing `TYPE_COLORS` map). Generic `image` is simplest and
  reads unambiguously as "no photo."

**Concept B — Brand-initial monogram.**
- Same `zinc100` surface.
- First letter of `brand` (fallback `name`) in `DMSerifDisplay-Regular`,
  `color: palette.zinc500`, centered. Feels more branded/editorial and matches
  the app's serif display accent.

### Must stay visually distinct from a "deleted" placeholder

The task references an `EmptySlotPlaceholder` meaning *"product deleted."* Note:
**no such component currently exists in the codebase** (no match in `src/`). If
/when it is built, the semantic split must hold:
- **No-photo placeholder (this task):** *solid* neutral fill (`zinc100`) + icon
  or monogram = "product exists, no image yet."
- **Deleted/empty-slot placeholder:** should read as absence — e.g. *dashed*
  border, ghosted, or a `slash`/`trash` cue — never a solid filled tile.
Keeping fill (present) vs. dashed-outline (absent) as the distinguishing signal
prevents the two from being confused.

---

## 6. Per-file change inventory (mapped to IMPLEMENTATION_PLAN phases)

The plan's phases are used here as a work taxonomy; this feature is a
post-Phase-8 addition slotted into them.

**Phase 0 — Types + store + service scaffold**
- `src/types/index.ts` — add `localImageUri?: string | null` to `Product` (§1).
- `src/services/productImage.ts` — **new**: `pickAndStoreProductPhoto`,
  `deleteProductPhoto` (expo-image-picker + expo-image-manipulator +
  expo-file-system). Filesystem/IO belongs in services, not utils (utils must
  stay pure per architecture rules).
- `src/utils/productImage.ts` — **new, optional**: pure
  `resolveProductImageSource(product)` returning uri-or-null (unit-testable, no
  React/IO).
- `package.json` — `npx expo install expo-file-system expo-image-manipulator`.
- `src/store/productsStore.ts` — **no change** (generic patch spread).

**Phase 2 — Today / RoutineStepCard**
- `src/components/ui/ProductThumbnail.tsx` — **new** shared component (§4/§5).
- `src/components/routine/RoutineStepCard.tsx` — add leading thumbnail in
  `mainRow`.
- (confirm scope) `src/components/routine/ProductPickerCard.tsx`.

**Phase 4 — Catalog + ProductForm**
- `src/components/product/ProductShelfCard.tsx` — restructure to leading
  thumbnail + column; thumbnail dims with `isHidden`.
- `src/screens/ManualProductFormScreen.tsx` — photo attach UI (thumbnail +
  "Add / Change / Remove photo" using the `Alert` picker pattern), photo state,
  thread `imageUrl` + `localImageUri` into `handleSave` and edit/corpus prefill.
- (confirm scope) `ProductDetailScreen` hero image; `AddToRoutineSheet`.
- `src/services/vialsApi/products.ts` — **no change now**; map `image_url →
  imageUrl` when `lookupBarcode`/`searchByText` are added.

**Phase 6 — Export / Import (future)**
- `ExportBackupUtility` — strip `localImageUri` from serialized products;
  add the "photos stay on this device" note.
- `ImportRestoreUtility` — drop `localImageUri` whose file doesn't resolve.
- Product-delete cascade (currently `deleteProductCascade`, invoked
  `CatalogScreen.tsx:103`, lives in `src/domain/`) — extend to best-effort
  `deleteProductPhoto(id)`.

**Tests**
- Component tests for `ProductThumbnail` (three states + error fallback),
  `RoutineStepCard` / `ProductShelfCard` thumbnail wiring.
- Existing `tests/**/fixtures.ts` builders: `localImageUri` is optional, so no
  breakage; add coverage where the photo path matters.
- `pickAndStoreProductPhoto` mocks `expo-image-picker` at the module boundary
  per `.claude/rules/testing.md`.

**Config**
- `app.json` — **no change** (camera + photo permissions already declared).

---

## 7. Dependency list (Expo SDK 54 — compatibility confirmed)

| Package | Status | Expo Go / SDK 54 | Purpose |
|---|---|---|---|
| `expo-image-picker` | **already installed** (~17.0.11) | ✅ Go-compatible, in use | pick from camera/gallery |
| `expo-camera` | already installed (~17.0.10) | ✅ | (barcode scanner; not used for attach) |
| `expo-file-system` | **install** | ✅ Go-compatible | copy photo into document dir |
| `expo-image-manipulator` | **install** | ✅ Go-compatible | downscale/compress before save |
| `expo-image` | not installed; **skip for now** | ✅ (would be Go-compatible) | optional future remote-image caching |

Install: `npx expo install expo-file-system expo-image-manipulator` (pins the
SDK-54-matched versions).

**Caution — `expo-file-system` API:** SDK 52+ ships a new `File`/`Directory`/
`Paths` API; the classic `documentDirectory` + `copyAsync`/`downloadAsync`
functions moved to `expo-file-system/legacy`. Pick one import surface
deliberately during implementation (new API preferred for new code) — this is a
known trip-hazard, not a blocker.

---

## 8. Summary of recommendations

- **Data model:** keep `imageUrl`, add optional `localImageUri` (two fields).
- **Storage:** copy picked photo → app document dir, store the URI only; never
  base64 in AsyncStorage. Downscale to ~480 px / JPEG 0.7 at save time.
- **Backup:** exclude local images (option a); `imageUrl` round-trips, document
  that photos are device-bound.
- **Deps:** reuse `expo-image-picker`; add `expo-file-system` +
  `expo-image-manipulator`. Plain `<Image>`, not `expo-image`, for now.
- **Render:** one shared `ProductThumbnail` (leading thumbnail on both cards),
  placeholder + error fallback owned inside it.
- **Placeholder:** solid `zinc100` tile + Feather `image` glyph (Concept A),
  kept distinct from any future dashed "deleted" placeholder.

---

## 9. Open questions (need a decision before implementation)

1. **Placeholder concept** — Feather `image` icon (A, recommended) or
   brand-initial serif monogram (B)? (§5)
2. **Precedence when both exist** — a user photo on an API product: show the
   local photo and keep `imageUrl` intact (recommended), or let the API image
   win? (§1)
3. **Backup handling** — confirm option (a): exclude local photos from Phase-6
   backups and document it. (§2)
4. **Scope of thumbnail placement** — cards only (Today + Shelf), or also
   `ProductDetail` hero, `ProductPickerCard`, and `AddToRoutineSheet`? (§4/§6)
5. **`expo-image` now or later** — confirm plain `<Image>` for v1. (§4)
6. **Thumbnail shape/size** — square 44/52 px with `radius.sm` corners as
   proposed, or a product-portrait aspect? (§4/§5)
7. **Stale "SDK 52" docs** — should IMPLEMENTATION_PLAN.md / CLAUDE.md be
   corrected to SDK 54 as part of this work, or tracked separately? (§0)
