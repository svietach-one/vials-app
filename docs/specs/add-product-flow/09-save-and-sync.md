# Task 09: Local-First Save + Background Sync

Depends on: `01-types.md`, `08-screen-assembly.md`

## Goal

Implement `handleSave` and `suggestProductInBackground`, wired into
`AddProductScreen` (task 08). This is the most safety-critical task in the
feature — re-read the privacy boundary carefully before implementing.

## `handleSave`

```ts
async function handleSave(draft: AddProductDraft) {
  const localProduct: Product = {
    id: generateLocalId(),
    brand: draft.brand,
    name: draft.name,
    type: draft.productType!,
    inciTags: draft.activeIngredientKeys,
    barcode: draft.barcode,
    openedDate: draft.isOpened ? draft.openedDate : null,
    paoMonths: draft.paoMonths!,
    source: 'manual',
    createdAt: new Date().toISOString(),
  };

  // 1. SYNCHRONOUS local write. This IS the save, as far as the UI cares.
  productsStore.getState().addProduct(localProduct);

  // 2. Leave the screen and confirm immediately. Do not wait on anything below.
  navigation.goBack();
  showToast('Product added to your shelf');

  // 3. Fire-and-forget. Never awaited by the caller, never gates any UI state.
  suggestProductInBackground(draft).catch((err) => {
    console.warn('[suggestProduct] background sync failed', err);
  });
}
```

## `suggestProductInBackground` — the privacy boundary

```ts
async function suggestProductInBackground(draft: AddProductDraft) {
  const payload: SuggestPayload = {
    brand: draft.brand,
    name: draft.name,
    productType: draft.productType!,
    barcode: draft.barcode,   // null if skipped — fine, treated as optional server-side
    inciRaw: draft.inciRaw,   // null if only the checklist was used — fine; the
                                // checklist-derived activeIngredientKeys are a
                                // client-side convenience parse and stay local-only,
                                // they are NOT submission-quality raw INCI text
    status: 'pending',
  };
  await suggestProduct(payload); // src/services/vialsApi/products.ts, already exists
}
```

**`openedDate`, `isOpened`, and `paoMonths` must never appear in
`payload`, under any circumstances.** This is enforced structurally, not
just by omission in this function — see the next section.

## Type-level enforcement (do not skip this)

`SuggestPayload` (defined in task 01) must be a **hand-declared
interface**, not `Omit<Product, 'openedDate' | 'paoMonths'>` or any other
derived/mapped type. If it were derived from `Product`, a future
contributor adding a new personal field to `Product` (e.g. `notes:
string`) could silently leak that field into every future suggest payload
the moment they forget to also update the `Omit`. A hand-declared
interface has no such failure mode: `SuggestPayload` only ever contains
exactly the fields explicitly listed in it, regardless of what happens to
`Product` later. Verify this is how task 01 defined it before proceeding;
if it wasn't, fix that first.

## Error handling

Per the existing project pattern in `db-tech-design.md` §5.3 ("On error:
silently swallow — do NOT surface to user, contribution is optional"):
catch and `console.warn` only. Never show an error toast, alert, or retry
prompt to the user for a failed background suggest call. The user already
has the product on their shelf and experiences this feature as complete —
the background sync is entirely invisible infrastructure from their
perspective, success or failure.

## Non-blocking guarantee — verify each of these explicitly

- [ ] `handleSave` does not `await suggestProductInBackground(...)`.
- [ ] No loading spinner, skeleton, or disabled state anywhere in the save
      path is gated on the network call's completion or the promise it
      returns.
- [ ] `navigation.goBack()` and the success toast both fire before the
      network request resolves — they run immediately after the
      synchronous `addProduct` call, full stop.
- [ ] With the device in airplane mode, the local save experience (toast,
      navigation, product appearing on the Shelf) is bit-for-bit identical
      to the online experience. `suggestProductInBackground` still gets
      called and simply rejects — caught, logged, discarded.
- [ ] A newly saved product with `RETI`/`ACID`/etc. tags is visible to
      `ConflictEngine` on the very next Routine Hub render with no manual
      cache-invalidation step — this falls out naturally from
      `ConflictEngine` reading `productsStore` at render time rather than
      being called from inside a store (existing project constraint), so
      confirm nothing in this task's implementation breaks that.

## Done when

- All checklist items above pass in manual QA, including an explicit
  airplane-mode test.
- A code review confirms `SuggestPayload` has no path by which
  `openedDate` or `paoMonths` could reach the network layer — check both
  the type definition and the object literal built in
  `suggestProductInBackground`.
