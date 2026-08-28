# Vials — "Explore Composition" flow (new)

**One self-contained spec, not a staged series.** Unlike the search-precision fix (which was split
into 7 files because it was a long chain of risky, sequential tuning decisions over the existing
corpus/scoring code), this is a bounded new feature: a few new screens, one new lightweight local
store, and a shared completion form. Read this file in full before starting.

---

## Why this exists (context, don't re-litigate)

Product decision, already made and final: the Catalog tab gets **two entry cards** instead of the
current two buttons — `Добавить средство` (post-purchase, full product identification, uses the
existing brand/name corpus-matching pipeline) and **`Исследовать состав`** (pre-purchase, in-store,
time-pressured — analyzes the ingredient list only, deliberately does **not** attempt brand or
product-name recognition at all).

This spec covers **only** `Исследовать состав` plus the two save destinations (Wishlist / Shelf)
that both entry paths funnel into. It does **not** touch `Добавить средство`'s existing matching
behavior, and does not depend on anything from the search-precision-fix work
(`search-fix/00-README.md` through `06-word-level-fts.md`) — that entire pipeline is brand/name
matching against the corpus, which this flow never invokes.

**Core principle carried over from that work and non-negotiable here too:** no fabricated
precision. No "% match", no invented efficacy/quality scores, no per-concern percentages unless
backed by real data Vials actually has. Every section below states what real field it's derived
from; if a section has no real field behind it, it's cut, not faked.

---

## Step 0 — Required reconnaissance before writing any code

This app already has two entry buttons somewhere in the Catalog tab flow (likely on/near
`AddProductHubScreen.tsx`, possibly a separate hub screen — confirm, don't assume) that route to
the existing add/search flow. Before changing anything:

1. Find the current entry point component and confirm exactly how the two existing actions route
   today (same screen? different screens? shared component?).
2. Find where `OcrEngineWebView.tsx` / the Tesseract pipeline is invoked today, and confirm whether
   it can be pointed at a plain image (ingredient-list photo) without going through
   `splitLabelText()` / `brandCorrection.ts` (those are brand-logo-specific and must **not** run in
   this flow — see Guardrails).
3. Find the existing raw-INCI-text parser. The schema notes in `db-setup-guide.md` state that
   `full_ingredients_text` (raw string) and `product_ingredients` (parsed rows) "coexist
   intentionally" and that the junction rows are "derived (parsed)" from the raw text — meaning a
   parser from raw INCI string → matched `ingredients` rows already exists somewhere (used by manual
   product entry and/or import). Find it and reuse it for both the OCR output and the pasted-text
   path in this flow. **Do not write a second INCI-text parser.**
4. Report back what you found for all three before proceeding — this determines whether steps 2–3
   below are new code or wiring existing code into a new screen.

---

## 1. Entry cards (Catalog tab)

Replace the current two buttons with two cards (not buttons) — each needs a title, a subtitle, and
tappable area for the full card, not just a small button.

```
┌─────────────────────────────┐   ┌─────────────────────────────┐
│  Добавить средство           │   │  Исследовать состав          │
│  [subtitle — already-owned,  │   │  [subtitle — pre-purchase,   │
│   full catalog entry]        │   │   ingredients only, fast]    │
└─────────────────────────────┘   └─────────────────────────────┘
```

- `Добавить средство` → existing flow, unchanged. Only the visual treatment (button → card) changes
  here; do not touch its routing or matching logic.
- `Исследовать состав` → new flow, this spec.

Subtitle copy is a placeholder pending design review — do not ship placeholder text without
flagging it, same as the low-confidence-tier copy from the earlier search work.

---

## 2. Composition capture (`Исследовать состав`)

Two methods, presented as an explicit choice (not one primary + one buried fallback — they are
equally valid depending on whether the user has the physical product in hand or is copying text
from a website):

- **Photograph the ingredient list.** Points the existing OCR pipeline at a plain ingredient-list
  photo. This is a **different text pattern than brand-logo OCR** — dense small print, not stylized
  logo type — which is the specific failure mode the earlier OCR investigation flagged as
  ill-suited to Tesseract. Do not assume the brand-logo OCR findings transfer here; this is a
  separate case with (likely more favorable) characteristics and should be measured on its own once
  built, not assumed to work or assumed to fail.
- **Paste ingredient text.** A large multi-line text field for text copied from elsewhere (a
  website, a photo the user OCR'd themselves, etc.).

Both paths converge on the same raw INCI string, which goes through the existing parser found in
Step 0 to produce a list of matched `ingredients` rows (with `function[]`, `active_key`, `position`
where derivable — position only applies to the photographed/typed order, not to pasted text unless
the user preserves list order, which is not guaranteed and should not be assumed reliable).

**Persist the raw OCR output string on every capture**, same requirement as the earlier low-
confidence-tier work — this flow will need real evidence to tune against later, and the project has
already lost this data three times by not saving it at capture time. Do not repeat that failure
here.

**No brand/name recognition runs in this path.** `splitLabelText()`, `brandCorrection.ts`, and the
corpus search/scoring pipeline (`ProductRepository.search()` and everything in `search-fix/`) must
not be invoked here. This is deliberate — do not add a "just in case it matches a known product"
silent corpus lookup. It reopens exactly the identity-matching fragility this flow was designed to
avoid, and creates a real risk of false-positive identity (two different formulations can be
near-identical in ingredient list) with no upside proportional to that risk.

**Unrecognized ingredients:** tokens from the parsed INCI string that don't match anything in the
local `ingredients` dictionary must be shown as "not recognized" in the result (see §3.3), not
silently dropped — silent drops make the ingredient count and comparison matrix quietly wrong.

---

## 3. Result screen — section by section

No identity/hero card. Skin Bliss shows neither brand nor product name when analyzing composition
directly, and neither do we — there's nothing honest to put in that card here, so it's omitted
entirely rather than shown empty or as a placeholder.

### 3.1 Functional profile

Tag list derived from `function[]` across the parsed ingredients (reuses the existing biomarker
concept from `CatalogFilterHeader` — Soothing / Actives / Hydration, US-20's mapping). Plain tags,
no score, no ranking.

### 3.2 Objective comparison matrix (5 parameters, no verdict)

Compares this composition against similar shelf items. **Requires knowing the product's category**
(serum / cream / cleanser / SPF etc.) to know what "similar" means — a composition with no category
can't be meaningfully compared to "similar" anything.

**Flagged decision, not yet confirmed — override if wrong:** ask for category as a single-tap
selector at the capture step (same screen as the photo/paste choice, or immediately after), *not*
brand, *not* name. This keeps the flow anonymous with respect to identity while still enabling the
matrix and §3.4 below. If this is rejected, the matrix and routine-placement sections (§3.2, §3.4)
must be cut from this flow entirely rather than guessed at — do not infer category from ingredient
list content, that is not a reliable signal.

The 5 parameters themselves reuse whatever was already agreed in the broader redesign discussion
(functional profile breadth, ingredient count, position/concentration-order signal, skin-type
suitability where derivable, category-relative signal) — confirm the final list against product
before implementing if it wasn't finalized elsewhere.

### 3.3 Ingredient list

Full parsed INCI list in position order (where order is known — see §2). Show total count, and
explicitly flag ingredients not recognized in the local dictionary rather than omitting them.

### 3.4 Routine placement

Where this would go in a routine (Cleansing → Exfoliation → Moisturizing etc.), using the existing
`RoutineStep` ordering concept. Depends on category — same dependency and same flagged decision as
§3.2.

### 3.5 Disclaimer footer

Reuse the existing disclaimer pattern / PRD §6 clinical-disclaimer copy.

### Explicitly excluded from this screen (do not add, even if it looks easy to bolt on)

- **Any "% match" or identification confidence badge** — there is no identification happening in
  this flow at all.
- **Routine conflict check.** Explicit product decision: this flow has not committed the product to
  any day of the week yet, so a conflict warning here would assume a schedule that doesn't exist —
  the product may end up scheduled on a day with no overlap. `conflictEngine.ts` is day-aware by
  design (US-09) specifically to avoid exactly this kind of premature warning; showing one here
  would contradict that design. Do not add a conflict section to this screen.
- **Personal skin-type suitability via the curated `skin_types_suitability` field.** That field
  lives on a `products` corpus row. This flow never matches a corpus row, so the field doesn't
  exist here. Do not fabricate a value or silently attempt a corpus match to backfill it (see §2).
- **Efficiency score / Quality score / any single-number "how good is this" verdict.**
- **Per-concern percentages** ("95% effective for acne" etc.) — no clinical data backs this for any
  product in this system.
- **Sensitive Skin Risk Factors (allergen/fragrance/preservative breakdown).** Backlog item — the
  `ingredients` table has no allergen/fragrance/preservative classification at all right now. Adding
  this display without that underlying data would mean showing an empty or fake meter. If/when the
  ingredient dictionary gets that classification as a separate project, this section can be added
  then, not before.
- **Usage & Application (frequency, wait time, how to apply).** No data source for this exists
  anywhere in the schema. Do not infer from ingredient list.

---

## 4. Save destinations

Two actions on the result screen: **`Put on My Shelf`** (always primary/filled, regardless of which
entry card the user came from) and **`Save to Wishlist`** (always secondary/outline).

### 4.1 `Save to Wishlist`

New, lightweight local store — **not** an extension of `catalogStore`. Suggested minimal shape,
adjust as needed during implementation:

```ts
WishlistEntry {
  id: string
  brand: string | null      // entered fresh here — this flow never captured it
  name: string | null       // entered fresh here — same
  category: string | null   // carried over if captured in §3.2's flagged decision, else null
  rawIngredientsText: string
  parsedIngredientIds: string[]   // from the parser found in Step 0
  sourceFlow: 'explore_composition' | 'add_product'
  createdAt: string
}
```

Tapping `Save to Wishlist` prompts for brand + name (required minimum — both are empty coming out
of this flow, this is a full manual entry, not "confirm what we detected," since nothing was
detected). Does **not**:
- write to `catalogStore`
- get evaluated by `conflictEngine.ts`
- appear in `CatalogFilterHeader` category/biomarker filters
- trigger the community-contribution flow (US-3 / `POST /api/v1/products/suggest`) — identity here
  may be incomplete or unconfirmed, this should not reach the shared/community database.

### 4.2 `Put on My Shelf`

Opens the **same completion form** used for wishlist→shelf promotion (§4.3) — one shared component,
not two implementations. Asks only for whatever is genuinely missing:
- brand, name — if not already captured (always missing, coming from this flow)
- category — if not already captured via §3.2's flagged decision
- **photo of the packaging/jar (`product_images.type = 'front'`)** — only if no such photo exists
  yet. Do **not** re-request the ingredients photo; it was already captured in §2. If the user came
  through the photo-capture path in §2, that photo is type `'ingredients'`, which is a different
  asset — the shelf-completion form needs the front/jar photo specifically, and should say so
  clearly in the UI so it doesn't read as "take the same picture again."

On submit, creates a full `catalogStore` record (per the existing `CosmeticsProduct` shape —
`product_type` is `NOT NULL`, so category is a hard requirement here, not a nice-to-have) and
triggers the existing community-contribution flow (US-3), same as today's manual-entry path.

### 4.3 Wishlist card actions

Each wishlist entry shows two actions: **Delete** and **Поставить на полку**.

- **Delete** — simple, no confirmation modal. Do **not** reuse `DeleteProductModal` — that modal
  exists specifically because deleting a catalog product can cascade into `routineStore` (US-08.1).
  Wishlist entries are never in a routine, so there's no cascade risk and no need for the heavier
  confirmation UX.
- **Поставить на полку** — opens the same shelf-completion form as §4.2, pre-filled with whatever
  the wishlist entry already has (brand, name, category if present, parsed ingredients). **The
  wishlist entry must not be deleted until the form is successfully submitted.** If the user closes
  the form without submitting, the wishlist entry remains exactly as it was. Only a successful
  submit both creates the `catalogStore` record and removes the `WishlistEntry`.

---

## Guardrails — do not touch

- `conflictEngine.ts` — no new call sites from this flow, per §3's exclusions.
- Anything in `search-fix/` (steps 0–6) — unrelated, do not invoke.
- `splitLabelText()`, `brandCorrection.ts`, `ProductRepository.search()` — brand-identity machinery,
  must not run in the `Исследовать состав` path (see §2).
- `Добавить средство`'s existing routing/matching behavior — only its card visual treatment
  changes.
- `DeleteProductModal` — do not reuse for wishlist deletion (see §4.3).

---

## Open items to confirm before/while building (flag, don't silently resolve)

1. Whether category is captured at all for `Исследовать состав` (§3.2's flagged decision) — this
   determines whether the comparison matrix and routine-placement sections ship at all in this
   version.
2. Final list of the 5 comparison-matrix parameters, if not already locked elsewhere.
3. Entry-card subtitle copy — placeholder only until design review, same rule as the earlier
   low-confidence-tier UI text.

---

## Definition of done

1. Step 0 reconnaissance findings reported before implementation starts.
2. Two entry cards render with title + subtitle; `Добавить средство` routing/logic unchanged.
3. `Исследовать состав` capture screen offers both photo and paste, converges on one parser (found
   in Step 0, not reimplemented).
4. Raw OCR text persisted on every capture (see §2 — do not repeat the earlier evidence-loss bug).
5. Result screen shows only the sections in §3.1–3.5, none of the explicitly excluded ones.
6. `WishlistEntry` store implemented, isolated from `catalogStore`/`conflictEngine`/filters/
   community-contribution as specified in §4.1.
7. `Put on My Shelf` and wishlist-promotion share one completion form (§4.2/§4.3), asking only for
   genuinely missing fields, never re-requesting the ingredients photo.
8. Wishlist delete has no confirmation modal; wishlist→shelf promotion doesn't delete until submit
   succeeds.
9. `npm test` / project test command passes.

## Report back

What Step 0 found (exact files/components), which flagged decision (category capture) was taken
and why, the final comparison-matrix parameter list used, and screenshots or a short screen-recording
of the full path: entry card → capture → result → both save destinations → wishlist card actions.
